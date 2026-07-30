import firebase_admin
from firebase_admin import credentials, firestore
import fdm_bridge

# Initialize Firebase Admin SDK
cred = credentials.Certificate('path/to/serviceAccount.json')  # Update with the actual path
firebase_admin.initialize_app(cred)

# Initialize Firestore
db = firestore.client()

def upload_links_to_firestore(game_title, game_slug, urls):
    # Extract links using the existing function
    extracted_links = fdm_bridge.resolve_links_sync(urls)
    
    # Prepare the Firestore document
    doc_ref = db.collection('games').document(game_slug)
    doc_ref.set({
        'title': game_title,
        'slug': game_slug,
        'links': extracted_links,
        'updatedAt': firestore.SERVER_TIMESTAMP
    }, merge=True)

if __name__ == "__main__":
    # Example usage
    game_title = "Example Game"
    game_slug = "example-game"
    urls = ["http://example.com/link1", "http://example.com/link2"]
    
    upload_links_to_firestore(game_title, game_slug, urls)