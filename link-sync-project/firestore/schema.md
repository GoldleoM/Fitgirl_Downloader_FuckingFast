# Firestore Schema for the "games" Collection

The Firestore schema for the "games" collection is designed to store information about various games, including their associated links and metadata. Each document in the "games" collection represents a single game and contains the following fields:

## Document Structure

- **title** (string): The name of the game.
- **slug** (string): A URL-friendly version of the game title, used for routing and linking.
- **links** (array): An array of strings, where each string is a URL associated with the game.
- **parts** (array): An array of objects, where each object represents a part of the game (e.g., expansions, DLCs) with the following fields:
  - **partTitle** (string): The title of the part.
  - **partSlug** (string): A URL-friendly version of the part title.
  - **partLinks** (array): An array of strings containing URLs related to the part.
- **updatedAt** (timestamp): A timestamp indicating when the document was last updated.

## Example Document

```json
{
  "title": "Example Game",
  "slug": "example-game",
  "links": [
    "https://example.com/link1",
    "https://example.com/link2"
  ],
  "parts": [
    {
      "partTitle": "Expansion Pack 1",
      "partSlug": "expansion-pack-1",
      "partLinks": [
        "https://example.com/expansion1/link1",
        "https://example.com/expansion1/link2"
      ]
    }
  ],
  "updatedAt": "2023-10-01T12:00:00Z"
}
```

## Notes

- Ensure that the `slug` field is unique for each game to avoid conflicts in Firestore.
- The `updatedAt` field should be automatically updated whenever the document is modified.
- Use Firestore security rules to manage access to the "games" collection and its documents.