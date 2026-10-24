# RedirAddon 🦊

**RedirAddon** automatically checks whether a browser extension viewed on the Chrome Web Store (`chromewebstore.google.com`) is also available on Firefox Add-ons (`addons.mozilla.org`, or AMO). If it finds a match, it provides a direct link to the Firefox listing.

---

## 🚀 Features

1. **Smart title cleanup and matching**
   - Uses the extension's canonical name from its Chrome Web Store URL, avoiding localized display names when searching AMO.
   - Removes marketing taglines from page titles (for example, `Dark Reader - dark mode for every website` becomes `Dark Reader`).
   - Links only when the canonical name exactly matches an English AMO name or slug, preventing unrelated results from being selected.
2. **Resilient to dynamic SPAs and DOM changes**
   - Uses `MutationObserver` and URL monitoring to handle the Chrome Web Store's asynchronous Lit / Web Components interface.
   - Cleans up the previous state during SPA navigation before searching for the next extension.
3. **Handles CORS and CSP restrictions**
   - **Browser extension (Manifest V3):** Sends requests through `background.js` to avoid page-level CSP restrictions and uses an in-memory cache with a 15-minute lifetime.
4. **Polished, adaptive interface**
   - Pill-button design that complements the Chrome Web Store's Material 3 styling.
   - Firefox-inspired colors, subtle animations (including a loading spinner and hover effects), and dark mode support.

---

## 📁 Project structure

```text
RedirAddon/
├── manifest.json         # Manifest V3 configuration
├── background.js         # Handles AMO API requests and caching
├── content.js            # Inspects the page DOM and injects the button
├── styles.css            # Button and status styles, including dark mode
├── popup.html            # Extension toolbar popup
├── popup.css             # Popup styles
├── icons/                # Extension icons in 16x16, 48x48, and 128x128 sizes
└── README.md             # Documentation and installation instructions
```

---

## 🛠️ Installation

### Firefox-based browser extension (Manifest V3)
1. In Firefox, open `about:debugging#/runtime/this-firefox`.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on...**.
4. Select the project's `manifest.json` file.
5. The extension will be loaded and can be used on Chrome Web Store pages.

> Extensions loaded temporarily in Firefox are removed when the browser restarts. For a permanent installation, the extension must be published on AMO. Installation steps and menu names may differ in other Firefox-based browsers.

---

## 🔍 API and matching details

- **AMO endpoint:** `https://addons.mozilla.org/api/v5/addons/search/?q={QUERY}&page_size=6&type=extension`
- **Match rule:** A direct link is shown only when the Chrome Web Store's canonical name exactly matches an English AMO name or slug.
- **No exact match:** A fallback link takes the user to AMO search results for the canonical name.
