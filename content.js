/**
 * RedirAddon - Content Script (Manifest V3)
 * Monitors Chrome Web Store detail pages, reads extension titles,
 * searches the Firefox AMO REST API, and adds a redirect button.
 */

(function () {
  'use strict';

  // Active extension ID prevents repeated searches on the same page.
  let currentDetailId = null;
  let isSearching = false;

  // Firefox brand SVG icon.
  const FIREFOX_SVG = `
    <svg class="rediraddon-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9.44.75 1.05 1.5 1.83 2.15.54.45 1.25.9 2.05 1.25-.3-.72-.47-1.5-.47-2.3 0-1.28.45-2.45 1.2-3.37.1.33.25.68.45 1.02.6 1.05 1.45 1.88 2.45 2.45.18.1.35.18.53.25-.25-.65-.38-1.35-.38-2.07 0-1.45.52-2.78 1.4-3.82 2.76 1.4 4.75 4.14 4.75 7.34 0 4.41-3.59 8-8 8z" fill="currentColor"/>
    </svg>
  `;

  // Spinning loading indicator icon.
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

  /**
   * Extracts the Chrome Web Store extension ID from the URL.
   * Format: /detail/[slug]/[id] or /detail/[id] (32 alphanumeric characters).
   */
  function getExtensionIdFromUrl() {
    const match = window.location.pathname.match(/\/detail\/(?:[^/]+\/)?([a-z0-9]{32})/i);
    return match ? match[1] : null;
  }

  /**
   * Safely extracts the extension name from the DOM.
   */
  function extractExtensionTitle() {
    // 1. Primary method: h1 heading on the main page.
    const h1 = document.querySelector('main h1') || document.querySelector('h1');
    if (h1 && h1.textContent.trim()) {
      return h1.textContent.trim();
    }

    // 2. Secondary method: Open Graph title.
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
      return ogTitle.content.replace(/\s*-\s*Chrome\s*(Web\s*Store|Web\s*Mağazası).*/i, '').trim();
    }

    // 3. Tertiary method: document.title.
    if (document.title) {
      return document.title.replace(/\s*-\s*Chrome\s*(Web\s*Store|Web\s*Mağazası).*/i, '').trim();
    }

    return null;
  }

  /**
   * Removes marketing taglines and separators from a title to find its base name.
   * Example: "Dark Reader - dark mode for every website" -> "Dark Reader".
   */
  function cleanExtensionName(rawName) {
    if (!rawName) return '';
    return rawName
      .replace(/[™®©]/g, '')
      .split(/\s*[-–—|:]\s*/)[0]
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalizes text for similarity comparisons.
   */
  function normalizeText(text) {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Calculates the similarity score (0.0 - 1.0) between two strings.
   * Combines Levenshtein distance with token-based Jaccard similarity.
   */
  function calculateSimilarity(str1, str2) {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);

    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;

    // If one string is a prefix of the other.
    if (s1.startsWith(s2) || s2.startsWith(s1)) {
      return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    }

    // Levenshtein distance.
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

    // Token sets (Jaccard similarity).
    const t1 = new Set(str1.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
    const t2 = new Set(str2.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean));
    let inter = 0;
    t1.forEach((t) => { if (t2.has(t)) inter++; });
    const union = new Set([...t1, ...t2]).size;
    const jaccard = union > 0 ? inter / union : 0;

    return Math.max(levSim, jaccard);
  }

  /**
   * Extracts the title string from an item in the AMO API response.
   */
  function getAmoItemName(item) {
    if (!item || !item.name) return '';
    if (typeof item.name === 'string') return item.name;
    return item.name['tr'] || item.name['en-US'] || item.name[item.default_locale] || Object.values(item.name)[0] || '';
  }

  /**
   * Finds the "Add to Chrome" button or its target container on the Chrome Web Store.
   */
  function findTargetCTA() {
    const buttons = Array.from(document.querySelectorAll('button'));
    
    // Search the button text or its ARIA label directly.
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

    // If no button is found, target the section containing the heading.
    const h1 = document.querySelector('main h1') || document.querySelector('h1');
    if (h1) {
      return h1;
    }

    return null;
  }

  /**
   * Creates or retrieves the button's UI container.
   */
  function createOrGetContainer() {
    let container = document.getElementById('rediraddon-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'rediraddon-container';
      container.className = 'rediraddon-wrapper';
    }
    return container;
  }

  /**
   * Renders the button in the DOM with the specified state.
   */
  function renderButton(state, options = {}) {
    const targetElement = findTargetCTA();
    if (!targetElement) return;

    const container = createOrGetContainer();
    
    // Build the button template.
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
        btnTitle = 'Bu eklenti Firefox Add-ons mağazasında tam olarak bulunamadı. Tıklayarak mağazada manuel arama yapabilirsiniz.';
        onClick = () => window.open(options.searchFallbackUrl, '_blank', 'noopener,noreferrer');
        break;

      case 'error':
        btnClass += ' rediraddon-btn--error';
        btnHtml = `${FIREFOX_SVG} <span>Sorgu Hatası (Tekrar Dene)</span>`;
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

    // Insert next to the target element.
    if (!container.parentElement) {
      if (targetElement.tagName.toLowerCase() === 'button') {
        targetElement.insertAdjacentElement('afterend', container);
      } else {
        targetElement.insertAdjacentElement('afterend', container);
      }
    }
  }

  /**
   * Analyzes the page, reads its title, and starts a Firefox AMO search.
   */
  async function processPage(force = false) {
    const extId = getExtensionIdFromUrl();
    if (!extId) {
      const existing = document.getElementById('rediraddon-container');
      if (existing) existing.remove();
      currentDetailId = null;
      return;
    }

    if (!force && currentDetailId === extId && document.getElementById('rediraddon-container')) {
      return; // The button is already present for this extension.
    }

    if (isSearching) return;

    const rawTitle = extractExtensionTitle();
    if (!rawTitle) return;

    currentDetailId = extId;
    isSearching = true;

    const cleanName = cleanExtensionName(rawTitle);
    renderButton('loading');

    try {
      // Send a message to the background script (background.js).
      const response = await chrome.runtime.sendMessage({
        action: 'SEARCH_AMO',
        query: cleanName
      });

      if (!response || !response.success) {
        throw new Error(response ? response.error : 'Arka plan ile bağlantı kurulamadı.');
      }

      const results = (response.data && response.data.results) || [];
      let bestMatch = null;
      let highestSimilarity = 0;

      for (const item of results) {
        const amoName = getAmoItemName(item);
        const amoCleanName = cleanExtensionName(amoName);
        
        // Compare similarity using both the original and cleaned titles.
        const sim1 = calculateSimilarity(cleanName, amoCleanName);
        const sim2 = calculateSimilarity(rawTitle, amoName);
        const simSlug = calculateSimilarity(cleanName, item.slug || '');

        const maxSim = Math.max(sim1, sim2, simSlug);
        if (maxSim > highestSimilarity) {
          highestSimilarity = maxSim;
          bestMatch = item;
        }
      }

      // A similarity score of 0.65 or higher counts as a match.
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
      console.warn('[RedirAddon] AMO Arama Hatası:', err);
      renderButton('error', { error: err.message });
    } finally {
      isSearching = false;
    }
  }

  // Page load and SPA navigation listener.
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

    // Run once on initialization.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => processPage());
    } else {
      processPage();
    }
  }

  initObserver();
})();
