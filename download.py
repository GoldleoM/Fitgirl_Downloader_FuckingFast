import os, re, requests, cloudscraper
# pyrefly: ignore [missing-import]
from bs4 import BeautifulSoup
from datetime import datetime
from colorama import Fore, Style


class console:
    def __init__(self) -> None:
        self.colors = {"green": Fore.GREEN, "red": Fore.RED, "yellow": Fore.YELLOW, "blue": Fore.BLUE,
                       "magenta": Fore.MAGENTA, "cyan": Fore.CYAN, "white": Fore.WHITE, "black": Fore.BLACK,
                       "reset": Style.RESET_ALL, "lightblack": Fore.LIGHTBLACK_EX, "lightred": Fore.LIGHTRED_EX,
                       "lightgreen": Fore.LIGHTGREEN_EX, "lightyellow": Fore.LIGHTYELLOW_EX,
                       "lightblue": Fore.LIGHTBLUE_EX, "lightmagenta": Fore.LIGHTMAGENTA_EX,
                       "lightcyan": Fore.LIGHTCYAN_EX, "lightwhite": Fore.LIGHTWHITE_EX}

    def clear(self):
        os.system("cls" if os.name == "nt" else "clear")

    def timestamp(self):
        return datetime.now().strftime("%H:%M:%S")

    def info(self, msg, obj):
        print(f"{self.colors['lightblack']}{self.timestamp()} » {self.colors['lightblue']}INFO {self.colors['lightblack']}• {self.colors['white']}{msg} : {self.colors['lightblue']}{obj}{self.colors['white']} {self.colors['reset']}")

    def success(self, msg, obj):
        print(f"{self.colors['lightblack']}{self.timestamp()} » {self.colors['lightgreen']}SUCC {self.colors['lightblack']}• {self.colors['white']}{msg} : {self.colors['lightgreen']}{obj}{self.colors['white']} {self.colors['reset']}")

    def error(self, msg, obj):
        print(f"{self.colors['lightblack']}{self.timestamp()} » {self.colors['lightred']}ERRR {self.colors['lightblack']}• {self.colors['white']}{msg} : {self.colors['lightred']}{obj}{self.colors['white']} {self.colors['reset']}")

    def warning(self, msg, obj):
        print(f"{self.colors['lightblack']}{self.timestamp()} » {self.colors['lightyellow']}WARN {self.colors['lightblack']}• {self.colors['white']}{msg} : {self.colors['lightyellow']}{obj}{self.colors['white']} {self.colors['reset']}")


log = console()
log.clear()

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
}

# remove processed link
def remove_link(processed_link, input_file='input.txt'):
    try:
        with open(input_file, 'r', encoding="utf-8") as f:
            lines = f.readlines()
        with open(input_file, 'w', encoding="utf-8") as f:
            for line in lines:
                clean_line = line.strip()
                if clean_line.startswith("- "):
                    clean_line = clean_line[2:].strip()
                if clean_line != processed_link:
                    f.write(line)
    except Exception as e:
        log.warning("Could not remove link from input.txt", str(e))


# -------- MAIN --------
try:
    with open('input.txt', 'r', encoding="utf-8") as f:
        lines = f.readlines()
except FileNotFoundError:
    log.error("File not found", "input.txt")
    lines = []

links = []
for line in lines:
    line = line.strip()
    if line.startswith("- "):
        line = line[2:].strip()
    if line.startswith("http://") or line.startswith("https://"):
        links.append(line)


output_file = "download_links.txt"

scraper = cloudscraper.create_scraper()
for link in links:
    log.info("Processing", link)

    try:
        response = scraper.get(link, headers=headers, timeout=20)
    except Exception as e:
        log.error("Request failed", str(e))
        continue

    if response.status_code != 200:
        log.error("Bad status", response.status_code)
        continue

    download_url = None
    soup = BeautifulSoup(response.text, 'html.parser')

    # Method 1: Look for button with HTMX hx-post attribute
    btn = soup.find(attrs={'hx-post': True})
    if btn and btn.get('hx-post'):
        go_path = btn['hx-post']
        go_url = 'https://fuckingfast.co' + go_path if go_path.startswith('/') else go_path
        post_headers = headers.copy()
        post_headers['HX-Request'] = 'true'
        try:
            res_go = scraper.post(go_url, headers=post_headers, timeout=15)
            download_url = res_go.headers.get('HX-Redirect') or res_go.headers.get('Hx-Redirect') or res_go.headers.get('hx-redirect')
        except Exception as e:
            log.warning("POST request to hx-post endpoint failed", str(e))

    # Method 2: Fallback direct POST to /f/{file_id}/go
    if not download_url:
        match_id = re.search(r'fuckingfast\.co/(?:f/)?([a-zA-Z0-9]+)', link)
        if match_id:
            file_id = match_id.group(1)
            go_url = f"https://fuckingfast.co/f/{file_id}/go"
            post_headers = headers.copy()
            post_headers['HX-Request'] = 'true'
            try:
                res_go = scraper.post(go_url, headers=post_headers, timeout=15)
                download_url = res_go.headers.get('HX-Redirect') or res_go.headers.get('Hx-Redirect') or res_go.headers.get('hx-redirect')
            except Exception as e:
                log.warning("Direct POST to /f/{id}/go failed", str(e))

    # Method 3: Legacy window.open in script tags
    if not download_url:
        script_tags = soup.find_all('script')
        for script in script_tags:
            if script.text and "window.open" in script.text:
                matches = re.findall(r'window\.open\(["\'](https?://[^\s"\'\)]+)', script.text)
                if matches:
                    download_url = matches[-1]
                    break

    if not download_url:
        log.error("Download URL not found", link)
        continue

    log.success("Found download URL", download_url)

    # write to file
    with open(output_file, "a", encoding="utf-8") as f:
        f.write(download_url + "\n")

    # remove processed link
    remove_link(link)

log.success("All links saved to", output_file)
