import os
import json
import xml.etree.ElementTree as ET
from xml.dom import minidom
from datetime import datetime, timezone
import firestore_db

BASE_URL = "https://fitboy-0.web.app"

def get_utc_date_str():
    return datetime.now(timezone.utc).strftime('%Y-%m-%d')

def generate_sitemap():
    print("[Sitemap Generator] Initializing Firestore...")
    db = firestore_db.init_firestore()
    
    games = []
    if db:
        try:
            print("[Sitemap Generator] Fetching game list from Firestore...")
            docs = db.collection('games').select(['slug', 'title', 'last_updated', 'date']).stream()
            for doc in docs:
                data = doc.to_dict()
                slug = data.get('slug') or doc.id
                if slug:
                    games.append({
                        'slug': slug,
                        'title': data.get('title', ''),
                        'last_updated': data.get('last_updated') or data.get('date') or get_utc_date_str()
                    })
        except Exception as e:
            print(f"[Sitemap Generator] Error querying Firestore: {e}")

    print(f"[Sitemap Generator] Total games retrieved: {len(games)}")

    # XML root
    urlset = ET.Element('urlset', xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")

    # 1. Homepage
    url_el = ET.SubElement(urlset, 'url')
    ET.SubElement(url_el, 'loc').text = f"{BASE_URL}/"
    ET.SubElement(url_el, 'lastmod').text = get_utc_date_str()
    ET.SubElement(url_el, 'changefreq').text = 'daily'
    ET.SubElement(url_el, 'priority').text = '1.0'

    # 2. Genre / Category Virtual Hubs
    genres = ['action', 'rpg', 'open-world', 'strategy', 'racing', 'adventure', 'shooter', 'simulation', 'horror', 'sports']
    for genre in genres:
        url_el = ET.SubElement(urlset, 'url')
        ET.SubElement(url_el, 'loc').text = f"{BASE_URL}/?genre={genre}"
        ET.SubElement(url_el, 'lastmod').text = get_utc_date_str()
        ET.SubElement(url_el, 'changefreq').text = 'weekly'
        ET.SubElement(url_el, 'priority').text = '0.8'

    # 3. Individual Game URLs
    for game in games:
        slug = game['slug']
        url_el = ET.SubElement(urlset, 'url')
        ET.SubElement(url_el, 'loc').text = f"{BASE_URL}/?game={slug}"
        
        lastmod = game['last_updated']
        if isinstance(lastmod, str) and len(lastmod) >= 10:
            lastmod_str = lastmod[:10]
        else:
            lastmod_str = get_utc_date_str()
            
        ET.SubElement(url_el, 'lastmod').text = lastmod_str
        ET.SubElement(url_el, 'changefreq').text = 'weekly'
        ET.SubElement(url_el, 'priority').text = '0.7'

    # Pretty format XML
    xml_str = minidom.parseString(ET.tostring(urlset, encoding='utf-8')).toprettyxml(indent="  ")
    
    # Save to frontend/public/sitemap.xml and static/sitemap.xml
    target_paths = [
        os.path.join(os.path.dirname(__file__), 'frontend', 'public', 'sitemap.xml'),
        os.path.join(os.path.dirname(__file__), 'static', 'sitemap.xml')
    ]

    for p in target_paths:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf-8') as f:
            f.write(xml_str)
        print(f"[Sitemap Generator] Saved sitemap to {p}")

if __name__ == '__main__':
    generate_sitemap()
