# Link Sync Project

This project is designed to extract links for games and upload them to Firebase Firestore. It consists of a backend Python script that handles the extraction and uploading process, as well as a frontend application that fetches and displays the links.

## Project Structure

```
link-sync-project
├── backend
│   ├── sync_links.py          # Python script for extracting and uploading links
│   ├── admin_init.py          # Initializes Firebase Admin SDK and Firestore
│   ├── requirements.txt        # Required Python packages
│   └── firebase
│       └── serviceAccount.sample.json  # Sample service account for Firebase
├── frontend
│   ├── index.html             # Main HTML file for the frontend
│   └── static
│       └── js
│           └── links.js       # JavaScript for fetching links from Firestore
├── firestore
│   └── schema.md              # Firestore schema documentation
├── .gitignore                 # Files and directories to ignore in version control
└── README.md                  # Project documentation
```

## Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd link-sync-project
   ```

2. **Backend Setup**
   - Navigate to the `backend` directory.
   - Install the required Python packages:
     ```bash
     pip install -r requirements.txt
     ```
   - Configure Firebase Admin SDK:
     - Replace `serviceAccount.sample.json` with your actual Firebase service account JSON file.

3. **Frontend Setup**
   - Open `index.html` in a web browser to access the frontend application.

## Usage

- Use the `sync_links.py` script to extract links for a specific game by providing the game title, slug, and URLs.
- The frontend will fetch the links from Firestore when a game is selected, displaying them on the webpage.

## Contributing

Feel free to submit issues or pull requests for any improvements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.