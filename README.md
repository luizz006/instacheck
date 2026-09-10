# 🔍 InstaCheck - Instagram Non-Followers Checker

A lightweight, secure, and privacy-first browser extension (Manifest V3) that detects who doesn't follow you back on Instagram. 

Built to be **100% local, rate-limit safe, and completely free**—without paywalls, subscriptions, or external servers.

---

## ✨ Features

- **🛡️ Anti-Ban & Rate-Limit Safe:** Configurable throttling (1.2s to 3.0s) with randomized jitter between requests to mimic natural browsing patterns.
- **💾 Smart Following Cache:** Saves your following list locally. On subsequent scans, you can choose to fetch **followers only**, cutting API requests and scan time by **50%**.
- **🔒 100% Private & Local:** Runs entirely within your browser session. Your credentials, cookies, and account data never leave your computer.
- **🖼️ Profile Pictures Display:** Uses native Chrome DeclarativeNetRequest rules to bypass Instagram's CORP (*Cross-Origin-Resource-Policy*) restrictions safely.
- **⚡ Real-Time Search:** Instantly filter non-followers by username or full name.
- **📥 CSV Export:** One-click export of your non-followers list (Username, Full Name, Profile Link).
- **🚫 Zero Paywalls:** Unlimited scans and full list view with no artificial limits.

---

## 🛠️ How It Works

1. **Session Reuse:** Detects your authenticated session directly via your browser's `ds_user_id` cookie. No password input required.
2. **Cursor Pagination:** Fetches following and followers lists in batches of 50 using Instagram's signed pagination token (`next_max_id`).
3. **Set Difference:** Compares both lists client-side:
   $$\text{Not Following Back} = \text{Following} \setminus \text{Followers}$$
4. **Local Persistence:** Caches results in `chrome.storage.local` so you won't lose your data if the popup closes.

---

## 🚀 Installation Guide

### Prerequisites
- Google Chrome, Microsoft Edge, Brave, or any Chromium-based browser.
- An active Instagram session logged in on your browser.

### Step-by-Step Setup

1. **Download / Clone this repository:**
   ```bash
   git clone https://github.com/luizz006/instacheck.git
   ```
   *(Or download and extract the ZIP archive).*

2. **Load the Extension into Chrome:**
   - Open Chrome and navigate to:
     ```text
     chrome://extensions
     ```
   - Toggle on **"Developer mode"** in the top-right corner.
   - Click **"Load unpacked"** in the top-left corner.
   - Select the `instacheck` project directory.

3. **Pin and Run:**
   - Click the extension puzzle icon in the Chrome toolbar and pin **InstaCheck**.
   - Make sure you are logged in to [instagram.com](https://www.instagram.com).
   - Click the **InstaCheck** icon and hit **"Start Scan"**!

---

## 📂 Project Structure

```text
instacheck/
├── manifest.json       # Extension configuration (Manifest V3)
├── popup.html          # Clean popup user interface
├── popup.css           # Modern dark-mode Instagram-themed styling
├── popup.js            # Core logic, pagination, caching, and export
├── rules.json          # DeclarativeNetRequest CORP & Referer rules
├── icon.svg            # Vector icon design
├── icon16.png          # Favicon icon
├── icon48.png          # Toolbar icon
├── icon128.png         # Web Store / management icon
└── README.md           # Project documentation
```

---

## 💡 Best Practices & Safety Tips

- **Recommended Delay:** Keep the default **2.0s (Recommended)** or **3.0s (Extra safe)** delay, especially if you follow more than 500 accounts.
- **Scan Frequency:** Avoid running scans dozens of times per hour. Running a scan once or twice a day is optimal and keeps your account completely under Instagram's radar.
- **Read-Only:** This tool only **reads** data. It intentionally does not offer automated mass-unfollowing, as mass automated actions are the primary trigger for Instagram account restrictions.

---

## ⚠️ Disclaimer

This project is for educational and personal use only. It is not affiliated with, authorized, maintained, sponsored, or endorsed by Instagram, Meta Platforms, Inc., or any of its affiliates. Always use responsibly and adhere to Instagram's Terms of Service.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
