from firebase_admin import credentials, firestore, initialize_app

def initialize_firestore():
    # Use a service account
    cred = credentials.Certificate('firebase/serviceAccount.sample.json')
    initialize_app(cred)

    # Initialize Firestore
    db = firestore.client()
    return db

def add_game_links(game_title, game_slug, links):
    db = initialize_firestore()
    doc_ref = db.collection('games').document(game_slug)
    
    # Overwrite existing document with new links
    doc_ref.set({
        'title': game_title,
        'slug': game_slug,
        'links': links,
        'updatedAt': firestore.SERVER_TIMESTAMP
    })

def get_game_links(game_slug):
    db = initialize_firestore()
    doc_ref = db.collection('games').document(game_slug)
    doc = doc_ref.get()
    
    if doc.exists:
        return doc.to_dict()
    else:
        return None

# Example usage
if __name__ == "__main__":
    initialize_firestore()  # Initialize Firestore connection
    # Add example game links
    add_game_links('Example Game', 'example-game', ['http://example.com/link1', 'http://example.com/link2'])