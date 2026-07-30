---
title: FitGirl Hub FDM Vault
emoji: 🎮
colorFrom: indigo
colorTo: blue
sdk: gradio
sdk_version: 5.16.0
app_file: app.py
pinned: false
---

# FitGirl FuckingFast Link Extractor

A Python script designed to extract direct download links from FuckingFast file host URLs (commonly used on FitGirl Repacks) and generate a batch list for Free Download Manager (FDM).

---

## 📋 Instructions

### 1. Install Dependencies
Open your command prompt or terminal in the project folder and run:
```bash
pip install -r requirements.txt
```

---

### 2. Add Links to `input.txt`
Copy your FuckingFast links and paste them into `input.txt`.

**Example format (`input.txt`):**
```text
- https://fuckingfast.co/xamz5yc1zsym#God_of_War_--_fitgirl-repacks.site_--_.part21.rar
- https://fuckingfast.co/7psu4osk1ptp#God_of_War_--_fitgirl-repacks.site_--_.part23.rar
- https://fuckingfast.co/lortgiaooffb#God_of_War_--_fitgirl-repacks.site_--_.part28.rar
- https://fuckingfast.co/vkulpa7nzpic#God_of_War_--_fitgirl-repacks.site_--_.part33.rar
```

---

### 3. Run the Script
Execute the extraction script by running:
```bash
python download.py
```

---

### 4. Output Links
Once processing is complete, all extracted direct download links will be written to:
`download_links.txt`

---

### 5. Download in Free Download Manager (FDM)
1. Open **Free Download Manager (FDM)**.
2. Click the **Main menu** (three lines icon `☰` / `≡` in the top right corner).
3. Click **Paste urls from clipboard**.
4. FDM will automatically import all copied direct download links into the queue.

