# ⚡ FitBoy PRO — High-Speed FitGirl Repack Vault & Direct Downloader

[![Firebase Hosting](https://img.shields.io/badge/Hosting-Firebase%20Hosting-FFCA28?logo=firebase&logoColor=black)](https://fitboy-0.web.app)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)](https://python.org/)
[![License](https://img.shields.io/badge/License-MIT-00F2FE.svg)](LICENSE)

A high-performance web platform and automated link resolution suite engineered to instantly extract, cloud-cache, and batch-download FitGirl Repack parts with **1-Click Free Download Manager (FDM)** clipboard integration.

---

## ✨ Features

- **⚡ 1-Click FDM Batch Clipboard**: Instantly copies all verified direct download parts ready to paste directly into Free Download Manager (`☰` → *Paste URLs from clipboard*).
- **🎮 Cloud Firestore Vault**: Pre-warmed catalog with 150+ popular repacks and automatic cloud link caching for sub-second game loading.
- **🔍 0ms Instant Fuzzy Search**: Zero-latency client-side search indexing with real-time autocompletion and alias resolution.
- **🛡️ Resilient Resolver Engine**: Multi-tab parallel headless browser crawler with auto-retry, button detection, and Firestore state checkpoints.
- **🎨 Cyberpunk Gaming HUD UI**: Dark aesthetic built with glassmorphism, glowing accents, genre badges, dynamic pagination, and responsive mobile support.
- **🔒 Secure Architecture**: Built-in SSRF defense, IP-based rate limiting, and secure Firestore read rules.

---

## 🏗️ Project Architecture

```
Fitgirl/
├── frontend/                 # React 19 + Vite Frontend SPA
│   ├── src/
│   │   ├── components/       # UI Components (Navbar, GameModal, Footer, etc.)
│   │   ├── styles/           # Cyberpunk Design System (index.css)
│   │   ├── utils/            # Fuzzy search, API helpers, & parsers
│   │   └── data/             # Keywords & alias maps
│   ├── index.html
│   └── vite.config.js
│
├── server.py                 # Flask API Backend & SSRF-Protected Proxy
├── firestore_db.py           # Remote Firestore DB Interface & Game Cache
├── fetch_missing_links.py    # Background Headless Parallel Link Resolver
├── populate_popular_games.py # Popular Repacks Pre-warmer
├── download.py               # Standalone CLI Link Extractor
├── fdm_bridge.py             # FDM URL Bridge & Formatter
├── firestore.rules           # Firebase Security Rules
├── firebase.json             # Firebase Hosting Configuration
└── requirements.txt          # Python Backend Dependencies
```

---

## 🚀 Getting Started

### 1. Prerequisites

- **Node.js** (v18+) & **npm**
- **Python** (v3.10+)
- **Free Download Manager (FDM)** installed on your machine

---

### 2. Backend Setup

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Start the API server:
   ```bash
   python server.py
   ```
   *The server will start at `http://127.0.0.1:5000`.*

---

### 3. Frontend Setup

1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```
   *Open `http://localhost:5173` in your browser.*

3. Or build for production:
   ```bash
   npm run build
   ```

---

### 4. Background Link Resolver (Optional)

To automatically resolve and pre-cache direct links into Firestore:
```bash
python fetch_missing_links.py
```

---

## 📥 How to Download with Free Download Manager (FDM)

1. **Find your game** in FitBoy PRO and click on the card to open details.
2. Click **⚡ 1-Click Direct Download (FDM)** or click **Copy All Links**.
3. Open **Free Download Manager (FDM)**.
4. Click the top-right menu icon (`☰` or `≡`) and select **Paste URLs from clipboard** (or press `Ctrl + V`).
5. FDM will automatically import all split archive parts into your queue!

---

## 🔒 Security & Privacy

- All sensitive keys (`serviceAccountKey.json`, `.env`) are excluded via `.gitignore` and must never be published.
- Firestore database rules restrict client writes while allowing open read access for fast catalog browsing.
- Strict proxy validation prevents SSRF attacks to private and link-local address spaces.

---

## 📜 Disclaimer & Legal Notice

This project is strictly for **educational and archival research purposes**. FitBoy PRO does not host, store, or distribute any copyrighted game files or torrents on its servers. All metadata and external links belong to their respective creators and file hosts.

---

## 👨‍💻 Author

Created & Maintained by **[@GoldleoM](https://github.com/GoldleoM)**
Project Repository: **[Fitgirl_Downloader_FuckingFast](https://github.com/GoldleoM/Fitgirl_Downloader_FuckingFast)**
