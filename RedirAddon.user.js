// ==UserScript==
// @name         RedirAddon - Chrome to Firefox Extension Redirector
// @namespace    https://github.com/rediraddon
// @version      1.0.0
// @description  Find Chrome Web Store extensions on Firefox Add-ons with one click.
// @author       RedirAddon
// @match        https://chromewebstore.google.com/detail/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mozilla.org
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      addons.mozilla.org
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // --- 1. UI STYLES (GM_addStyle or dynamic <style>) ---
  const CSS_STYLES = `
    .rediraddon-wrapper {
      display: inline-flex;
      align-items: center;
      margin-left: 10px;
      margin-right: 10px;
      vertical-align: middle;
      font-family: 'Google Sans', Roboto, Arial, sans-serif;
      z-index: 100;
    }

    .rediraddon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 20px;
      border-radius: 9999px;
      border: 1px solid transparent;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.25px;
      cursor: pointer;
      user-select: none;
      text-decoration: none;
      white-space: nowrap;
      box-sizing: border-box;
      transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      animation: rediraddon-fadein 0.3s cubic-bezier(0, 0, 0.2, 1);
    }

    .rediraddon-btn--loading {
      background: #f1f3f4;
      color: #5f6368;
      border-color: #dadce0;
      cursor: wait;
    }

    .rediraddon-btn--found {
      background: linear-gradient(135deg, #ff7139 0%, #ff3b00 50%, #9013fe 100%);
      color: #ffffff;
      border-color: transparent;
      box-shadow: 0 2px 8px rgba(255, 59, 0, 0.35);
    }

    .rediraddon-btn--found:hover {
      transform: translateY(-1.5px);
      box-shadow: 0 4px 14px rgba(255, 59, 0, 0.45);
      background: linear-gradient(135deg, #ff824f 0%, #ff4b15 50%, #9e2cfb 100%);
    }

    .rediraddon-btn--found:active {
      transform: translateY(0);
      box-shadow: 0 2px 5px rgba(255, 59, 0, 0.3);
    }

    .rediraddon-btn--not-found {
      background: #f8f9fa;
      color: #70757a;
      border-color: #dadce0;
      box-shadow: none;
    }

    .rediraddon-btn--not-found:hover {
      background: #f1f3f4;
      color: #3c4043;
      border-color: #bdc1c6;
    }

    .rediraddon-btn--error {
      background: #fce8e6;
      color: #c5221f;
      border-color: #fad2cf;
    }

    .rediraddon-icon {
      flex-shrink: 0;
      display: inline-block;
      vertical-align: middle;
    }

    .rediraddon-spinner {
      flex-shrink: 0;
      animation: rediraddon-spin 1s linear infinite;
    }

    @keyframes rediraddon-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    @keyframes rediraddon-fadein {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    @media (prefers-color-scheme: dark) {
      .rediraddon-btn--loading {
        background: #303134;
        color: #bdc1c6;
        border-color: #5f6368;
      }
      .rediraddon-btn--not-found {
        background: #202124;
        color: #9aa0a6;
        border-color: #3c4043;
      }
      .rediraddon-btn--not-found:hover {
        background: #303134;
        color: #e8eaed;
        border-color: #5f6368;
      }
      .rediraddon-btn--error {
        background: #3c2626;
        color: #f28b82;
        border-color: #5c3030;
      }
    }
  `;

  if (typeof GM_addStyle !== 'undefined') {
    GM_addStyle(CSS_STYLES);
  } else {
    const styleElem = document.createElement('style');
    styleElem.textContent = CSS_STYLES;
    document.head.appendChild(styleElem);
  }

  // --- 2. CONSTANTS AND ICONS ---
  const FIREFOX_SVG = `
    <svg class="rediraddon-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9.44.75 1.05 1.5 1.83 2.15.54.45 1.25.9 2.05 1.25-.3-.72-.47-1.5-.47-2.3 0-1.28.45-2.45 1.2-3.37.1.33.25.68.45 1.02.6 1.05 1.45 1.88 2.45 2.45.18.1.35.18.53.25-.25-.65-.38-1.35-.38-2.07 0-1.45.52-2.78 1.4-3.82 2.76 1.4 4.75 4.14 4.75 7.34 0 4.41-3.59 8-8 8z" fill="currentColor"/>
    </svg>
  `;

  const SPINNER_SVG = `
    <svg class="rediraddon-spinner" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="2" x2="12" y2="6"></line>
      <line x1="12" y1="18" x2="12" y2="22"></line>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
      <line x1="2" y1="12" x2="6" y2="12"></line>
      <line x1="18" y1="12" x2="22" y2="12"></line>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
    </svg>
  `;

  let currentDetailId = null;
  let isSearching = false;
  const memoryCache = new Map();

  // --- 3. HELPER AND SIMILARITY FUNCTIONS ---
  function getExtensionIdFromUrl() {
    const match = window.location.pathname.match(/\/detail\/(?:[^/]+\/)?([a-z0-9]{32})/i);
    return match ? match[1] : null;
  }

  function extractExtensionTitle() {
    const h1 = document.querySelector('main h1') || document.querySelector('h1');
    if (h1 && h1.textContent.trim()) {
      return h1.textContent.trim();
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
      return ogTitle.content.replace(/\s*-\s*Chrome\s*(Web\s*Store|Web\s*Mağazası).*/i, '').trim();
    }
    if (document.title) {
      return document.title.replace(/\s*-\s*Chrome\s*(Web\s*Store|Web\s*Mağazası).*/i, '').trim();
    }
    return null;
  }

  function cleanExtensionName(rawName) {
    if (!rawName) return '';
    return rawName
      .replace(/[™®©]/g, '')
      .split(/\s*[-–—|:]\s*/)[0]
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  function calculateSimilarity(str1, str2) {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);

    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;

    if (s1.startsWith(s2) || s2.startsWith(s1)) {
      return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    }

    const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= s2.length; j++) {
      for (let i = 1; i <= s1.length; i++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    const dist = matrix[s2.length][s1.length];
    const maxLen = Math.max(s1.length, s2.length);
    const levSim = (maxLen - dist) / maxLen;

    const t1 = new Set(str1.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
    const t2 = new Set(str2.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
    let inter = 0;
    t1.forEach((t) => { if (t2.has(t)) inter++; });
    const union = new Set([...t1, ...t2]).size;
    const jaccard = union > 0 ? inter / union : 0;

    return Math.max(levSim, jaccard);
  }

  function getAmoItemName(item) {
    if (!item || !item.name) return '';
    if (typeof item.name === 'string') return item.name;
    return item.name['tr'] || item.name['en-US'] || item.name[item.default_locale] || Object.values(item.name)[0] || '';
  }

  // --- 4. FIREFOX AMO API REQUEST (GM_xmlhttpRequest) ---
  function fetchAmoAddons(query) {
    return new Promise((resolve, reject) => {
      const cacheKey = query.toLowerCase();
      if (memoryCache.has(cacheKey)) {
        return resolve(memoryCache.get(cacheKey));
      }

      const endpoint = `https://addons.mozilla.org/api/v5/addons/search/?q=${encodeURIComponent(query)}&page_size=6&type=extension`;

      if (typeof GM_xmlhttpRequest !== 'undefined') {
        GM_xmlhttpRequest({
          method: 'GET',
          url: endpoint,
          headers: {
            'Accept': 'application/json',
            'Accept-Language': 'tr,en-US;q=0.9,en;q=0.8'
          },
          timeout: 8000,
          onload: (res) => {
            if (res.status >= 200 && res.status < 300) {
              try {
                const data = JSON.parse(res.responseText);
                memoryCache.set(cacheKey, data);
                resolve(data);
              } catch (e) {
                reject(new Error('JSON çözümlenemedi.'));
              }
            } else {
              reject(new Error(`AMO API Hatası: HTTP ${res.status}`));
            }
          },
          ontimeout: () => reject(new Error('İstek zaman aşımına uğradı.')),
          onerror: () => reject(new Error('Ağ bağlantı hatası oluştu.'))
        });
      } else {
        // Fall back to the built-in fetch API.
        fetch(endpoint)
          .then((r) => r.json())
          .then((data) => {
            memoryCache.set(cacheKey, data);
            resolve(data);
          })
          .catch(reject);
      }
    });
  }

  // --- 5. DOM AND BUTTON CREATION ---
  function findTargetCTA() {
    const buttons = Array.from(document.querySelectorAll('button'));
    const cta = buttons.find((btn) => {
      const text = (btn.textContent || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      return (
        text.includes("chrome'a ekle") ||
        text.includes("add to chrome") ||
        text.includes("chrome'dan kaldır") ||
        text.includes("remove from chrome") ||
        aria.includes("add to chrome") ||
        aria.includes("chrome'a ekle")
      );
    });

    if (cta) return cta;

    const h1 = document.querySelector('main h1') || document.querySelector('h1');
    if (h1) return h1;

    return null;
  }

  function createOrGetContainer() {
    let container = document.getElementById('rediraddon-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'rediraddon-container';
      container.className = 'rediraddon-wrapper';
    }
    return container;
  }

  function renderButton(state, options = {}) {
    const targetElement = findTargetCTA();
    if (!targetElement) return;

    const container = createOrGetContainer();
    let btnHtml = '';
    let btnClass = 'rediraddon-btn';
    let btnTitle = '';
    let onClick = null;

    switch (state) {
      case 'loading':
        btnClass += ' rediraddon-btn--loading';
        btnHtml = `${SPINNER_SVG} <span>Firefox'ta Aranıyor...</span>`;
        btnTitle = 'Mozilla Add-ons mağazasında sorgulanıyor...';
        break;

      case 'found':
        btnClass += ' rediraddon-btn--found';
        btnHtml = `${FIREFOX_SVG} <span>Firefox'ta Bul ↗</span>`;
        btnTitle = `Firefox Add-ons: "${options.addonName}"\nKullanıcı: ${options.users || 'Bilinmiyor'} | Puan: ${options.rating ? options.rating.toFixed(1) + ' ★' : '-'}\nFirefox sayfasına gitmek için tıklayın.`;
        onClick = () => window.open(options.url, '_blank', 'noopener,noreferrer');
        break;

      case 'not_found':
        btnClass += ' rediraddon-btn--not-found';
        btnHtml = `${FIREFOX_SVG} <span>Firefox'ta Bulunamadı</span>`;
        btnTitle = 'Bu eklenti Firefox Add-ons mağazasında tam olarak bulunamadı. Tıklayarak mağazada arama yapabilirsiniz.';
        onClick = () => window.open(options.searchFallbackUrl, '_blank', 'noopener,noreferrer');
        break;

      case 'error':
        btnClass += ' rediraddon-btn--error';
        btnHtml = `${FIREFOX_SVG} <span>Sorgu Hatası</span>`;
        btnTitle = options.error || 'Bağlantı hatası oluştu. Tekrar denemek için tıklayın.';
        onClick = () => {
          container.remove();
          processPage(true);
        };
        break;
    }

    container.innerHTML = `<button type="button" class="${btnClass}" title="${btnTitle.replace(/"/g, '&quot;')}">${btnHtml}</button>`;
    
    const btnElement = container.querySelector('button');
    if (onClick) {
      btnElement.addEventListener('click', onClick);
    }

    if (!container.parentElement) {
      targetElement.insertAdjacentElement('afterend', container);
    }
  }

  // --- 6. BUSINESS LOGIC AND NAVIGATION ---
  async function processPage(force = false) {
    const extId = getExtensionIdFromUrl();
    if (!extId) {
      const existing = document.getElementById('rediraddon-container');
      if (existing) existing.remove();
      currentDetailId = null;
      return;
    }

    if (!force && currentDetailId === extId && document.getElementById('rediraddon-container')) {
      return;
    }

    if (isSearching) return;

    const rawTitle = extractExtensionTitle();
    if (!rawTitle) return;

    currentDetailId = extId;
    isSearching = true;

    const cleanName = cleanExtensionName(rawTitle);
    renderButton('loading');

    try {
      const data = await fetchAmoAddons(cleanName);
      const results = (data && data.results) || [];
      let bestMatch = null;
      let highestSimilarity = 0;

      for (const item of results) {
        const amoName = getAmoItemName(item);
        const amoCleanName = cleanExtensionName(amoName);
        
        const sim1 = calculateSimilarity(cleanName, amoCleanName);
        const sim2 = calculateSimilarity(rawTitle, amoName);
        const simSlug = calculateSimilarity(cleanName, item.slug || '');

        const maxSim = Math.max(sim1, sim2, simSlug);
        if (maxSim > highestSimilarity) {
          highestSimilarity = maxSim;
          bestMatch = item;
        }
      }

      if (bestMatch && highestSimilarity >= 0.65) {
        renderButton('found', {
          addonName: getAmoItemName(bestMatch),
          url: bestMatch.url,
          users: bestMatch.average_daily_users ? bestMatch.average_daily_users.toLocaleString('tr-TR') : null,
          rating: bestMatch.ratings ? bestMatch.ratings.average : null
        });
      } else {
        const searchFallbackUrl = `https://addons.mozilla.org/tr/firefox/search/?q=${encodeURIComponent(cleanName)}`;
        renderButton('not_found', { searchFallbackUrl });
      }
    } catch (err) {
      console.warn('[RedirAddon Userscript] Hata:', err);
      renderButton('error', { error: err.message });
    } finally {
      isSearching = false;
    }
  }

  function initObserver() {
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const extId = getExtensionIdFromUrl();
        if (extId && extId !== currentDetailId) {
          processPage();
        } else if (extId && !document.getElementById('rediraddon-container')) {
          processPage();
        }
      }, 250);
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => processPage());
    } else {
      processPage();
    }
  }

  initObserver();
})();
