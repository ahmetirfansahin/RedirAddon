/**
 * RedirAddon - Content Script (Manifest V3)
 * Monitors Chrome Web Store detail pages, reads extension titles,
 * searches the Firefox AMO REST API, and adds a redirect button.
 */

(function () {
  'use strict';

  // Active extension ID prevents repeated searches on the same page.
  let currentSearchKey = null;
  let isSearching = false;
  let pendingReloadId = null;
  let pendingReloadTimer = null;

  /**
   * Extracts the Chrome Web Store extension ID from the URL.
   * Format: /detail/[slug]/[id] or /detail/[id] (32 alphanumeric characters).
   */
  function getExtensionIdFromUrl() {
    const match = window.location.pathname.match(/\/detail\/(?:[^/]+\/)?([a-z0-9]{32})/i);
    return match ? match[1] : null;
  }

  // The Chrome Web Store URL slug uses the extension's canonical, non-localized name.
  function getGlobalExtensionNameFromUrl() {
    const match = window.location.pathname.match(/\/detail\/([^/]+)\/[a-z0-9]{32}/i);
    if (!match) return null;

    let slug;
    try {
      slug = decodeURIComponent(match[1]);
    } catch {
      slug = match[1];
    }

    const name = slug
      .replace(/[™®©]/g, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return name && name.toLowerCase() !== 'empty title' ? name : null;
  }

  function extractExtensionTitle() {
    const heading = document.querySelector('main h1') || document.querySelector('h1');
    if (heading && heading.textContent.trim()) {
      return heading.textContent.trim();
    }

    const openGraphTitle = document.querySelector('meta[property="og:title"]')?.content;
    const title = openGraphTitle || document.title;
    if (!title) return null;

    const cleanedTitle = title.replace(/\s*-\s*Chrome\s*Web\s*Store.*$/i, '').trim();
    return cleanedTitle && !/^chrome web store$/i.test(cleanedTitle) ? cleanedTitle : null;
  }

  function getCurrentSearchKey() {
    const extensionId = getExtensionIdFromUrl();
    const name = getGlobalExtensionNameFromUrl() || cleanExtensionName(extractExtensionTitle() || '');
    return extensionId && name ? `${extensionId}:${normalizeText(name)}` : null;
  }

  function reloadExtensionPageOnce() {
    const extensionId = getExtensionIdFromUrl();
    const storageKey = 'rediraddon:reloaded-extension';
    try {
      if (!extensionId) {
        if (pendingReloadTimer) {
          clearTimeout(pendingReloadTimer);
          pendingReloadTimer = null;
        }
        pendingReloadId = null;
        sessionStorage.removeItem(storageKey);
        return false;
      }

      if (pendingReloadId === extensionId) return true;

      if (pendingReloadId && pendingReloadId !== extensionId) {
        if (pendingReloadTimer) clearTimeout(pendingReloadTimer);
        pendingReloadTimer = null;
        pendingReloadId = null;
      }

      if (sessionStorage.getItem(storageKey) === extensionId) return false;

      sessionStorage.setItem(storageKey, extensionId);
      pendingReloadId = extensionId;

      const reloadAfterPageLoad = () => {
        pendingReloadTimer = setTimeout(() => {
          if (getExtensionIdFromUrl() !== extensionId) {
            pendingReloadId = null;
            pendingReloadTimer = null;
            return;
          }

          pendingReloadId = null;
          pendingReloadTimer = null;
          window.location.reload();
        }, 1000);
      };

      if (document.readyState === 'complete') {
        reloadAfterPageLoad();
      } else {
        window.addEventListener('load', reloadAfterPageLoad, { once: true });
      }
      return true;
    } catch (error) {
      console.warn('[RedirAddon] Could not prepare the one-time page reload:', error);
      return false;
    }
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
      .normalize('NFKD')
      .replace(/\u0131/g, 'i')
      .replace(/\p{M}/gu, '')
      .replace(/[^\p{L}\p{N}]/gu, '');
  }

  /**
   * Returns English names from an item in the AMO API response.
   */
  function getAmoItemNames(item) {
    if (!item || !item.name) return [];
    if (typeof item.name === 'string') return [item.name];
    return Object.entries(item.name)
      .filter(([locale, name]) => /^en(?:[-_]|$)/i.test(locale) && typeof name === 'string' && name.trim())
      .map(([, name]) => name);
  }

  function findExactAmoMatch(items, globalName) {
    const normalizedGlobalName = normalizeText(globalName);
    if (!normalizedGlobalName) return null;

    for (const item of items) {
      const names = getAmoItemNames(item);
      const matchingName = names.find(
        (name) => normalizeText(cleanExtensionName(name)) === normalizedGlobalName
      );
      const exactSlugMatch = normalizeText(item.slug || '') === normalizedGlobalName;

      if (matchingName || exactSlugMatch) {
        return {
          item,
          name: matchingName || names[0] || item.slug
        };
      }
    }

    return null;
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
        text.includes("add to chrome") ||
        text.includes("remove from chrome") ||
        aria.includes("add to chrome") ||
        aria.includes("remove from chrome")
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

  function createFirefoxIcon() {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('class', 'rediraddon-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');

    const path = document.createElementNS(namespace, 'path');
    path.setAttribute(
      'd',
      'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9.44.75 1.05 1.5 1.83 2.15.54.45 1.25.9 2.05 1.25-.3-.72-.47-1.5-.47-2.3 0-1.28.45-2.45 1.2-3.37.1.33.25.68.45 1.02.6 1.05 1.45 1.88 2.45 2.45.18.1.35.18.53.25-.25-.65-.38-1.35-.38-2.07 0-1.45.52-2.78 1.4-3.82 2.76 1.4 4.75 4.14 4.75 7.34 0 4.41-3.59 8-8 8z'
    );
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    return svg;
  }

  function createSpinnerIcon() {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    svg.setAttribute('class', 'rediraddon-spinner');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    [
      [12, 2, 12, 6],
      [12, 18, 12, 22],
      [4.93, 4.93, 7.76, 7.76],
      [16.24, 16.24, 19.07, 19.07],
      [2, 12, 6, 12],
      [18, 12, 22, 12],
      [4.93, 19.07, 7.76, 16.24],
      [16.24, 7.76, 19.07, 4.93]
    ].forEach(([x1, y1, x2, y2]) => {
      const line = document.createElementNS(namespace, 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      svg.appendChild(line);
    });

    return svg;
  }

  /**
   * Renders the button in the DOM with the specified state.
   */
  function renderButton(state, options = {}) {
    const targetElement = findTargetCTA();
    if (!targetElement) return;

    const container = createOrGetContainer();
    
    // Build the button template.
    let btnClass = 'rediraddon-btn';
    let btnTitle = '';
    let btnText = '';
    let iconType = 'firefox';
    let onClick = null;

    switch (state) {
      case 'loading':
        btnClass += ' rediraddon-btn--loading';
        btnText = 'Searching Firefox...';
        iconType = 'spinner';
        btnTitle = 'Searching Mozilla Add-ons...';
        break;

      case 'found':
        btnClass += ' rediraddon-btn--found';
        btnText = 'Find on Firefox ↗';
        btnTitle = `Firefox Add-ons: "${options.addonName}"\nUsers: ${options.users || 'Unknown'} | Rating: ${options.rating ? options.rating.toFixed(1) + ' ★' : '-'}\nClick to open the Firefox listing.`;
        onClick = () => window.open(options.url, '_blank', 'noopener,noreferrer');
        break;

      case 'not_found':
        btnClass += ' rediraddon-btn--not-found';
        btnText = 'Not found on Firefox';
        btnTitle = 'No exact match was found on Firefox Add-ons. Click to search the store manually.';
        onClick = () => window.open(options.searchFallbackUrl, '_blank', 'noopener,noreferrer');
        break;

      case 'error':
        btnClass += ' rediraddon-btn--error';
        btnText = 'Search failed (Retry)';
        btnTitle = options.error || 'A connection error occurred. Click to try again.';
        onClick = () => {
          container.remove();
          processPage(true);
        };
        break;
    }

    const btnElement = document.createElement('button');
    btnElement.type = 'button';
    btnElement.className = btnClass;
    btnElement.title = btnTitle;
    btnElement.appendChild(iconType === 'spinner' ? createSpinnerIcon() : createFirefoxIcon());

    const label = document.createElement('span');
    label.textContent = btnText;
    btnElement.appendChild(label);
    container.replaceChildren(btnElement);

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
      currentSearchKey = null;
      return;
    }

    const searchKey = getCurrentSearchKey();
    if (!searchKey) return;

    if (!force && currentSearchKey === searchKey && document.getElementById('rediraddon-container')) {
      return; // The button is already present for this extension.
    }

    if (isSearching) return;

    const globalName = getGlobalExtensionNameFromUrl() || cleanExtensionName(extractExtensionTitle() || '');
    if (!globalName || !findTargetCTA()) return;

    currentSearchKey = searchKey;
    isSearching = true;

    renderButton('loading');

    try {
      // Send a message to the background script (background.js).
      const response = await browser.runtime.sendMessage({
        action: 'SEARCH_AMO',
        query: globalName
      });

      if (!response || !response.success) {
        throw new Error(response ? response.error : 'Could not connect to the background script.');
      }

      if (getCurrentSearchKey() !== searchKey) return;

      const results = (response.data && response.data.results) || [];
      const match = findExactAmoMatch(results, globalName);

      if (match) {
        renderButton('found', {
          addonName: match.name,
          url: match.item.url,
          users: match.item.average_daily_users ? match.item.average_daily_users.toLocaleString('en-US') : null,
          rating: match.item.ratings ? match.item.ratings.average : null
        });
      } else {
        const searchFallbackUrl = `https://addons.mozilla.org/en-US/firefox/search/?q=${encodeURIComponent(globalName)}`;
        renderButton('not_found', { searchFallbackUrl });
      }
    } catch (err) {
      console.warn('[RedirAddon] AMO search error:', err);
      if (getCurrentSearchKey() === searchKey) {
        renderButton('error', { error: err.message });
      }
    } finally {
      isSearching = false;
      if (getCurrentSearchKey() !== currentSearchKey ||
          (getCurrentSearchKey() && !document.getElementById('rediraddon-container'))) {
        setTimeout(() => processPage(), 0);
      }
    }
  }

  // Page load and SPA navigation listener.
  function initObserver() {
    if (reloadExtensionPageOnce()) return;

    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (reloadExtensionPageOnce()) return;
        processPage();
      }, 250);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    setInterval(() => {
      if (reloadExtensionPageOnce()) return;
      const searchKey = getCurrentSearchKey();
      if (getExtensionIdFromUrl() &&
          (!searchKey || searchKey !== currentSearchKey || !document.getElementById('rediraddon-container'))) {
        processPage();
      }
    }, 500);

    // Run once on initialization.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => processPage());
    } else {
      processPage();
    }
  }

  initObserver();
})();
