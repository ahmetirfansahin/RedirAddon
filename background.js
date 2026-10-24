/**
 * RedirAddon - Background Script (Manifest V3)
 * Handles Firefox Add-ons (AMO) API requests and avoids page-level CORS/CSP restrictions.
 */

// Cache results in memory to avoid unnecessary repeated API requests.
const apiCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 15; // Cache entries expire after 15 minutes.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SEARCH_AMO') {
    handleAmoSearch(request.query)
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    
    // Return true to keep the message channel open for the asynchronous response.
    return true;
  }
});

/**
 * Searches for extensions using the Firefox Add-ons v5 REST API.
 * @param {string} query Extension name to search for.
 * @returns {Promise<Object>} API response containing the extension list.
 */
async function handleAmoSearch(query) {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) {
    throw new Error('Search query cannot be empty.');
  }

  const cacheKey = cleanQuery.toLowerCase();
  const cached = apiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  // AMO v5 search endpoint.
  const endpoint = `https://addons.mozilla.org/api/v5/addons/search/?q=${encodeURIComponent(cleanQuery)}&page_size=6&type=extension`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout.

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AMO API error: HTTP ${response.status}`);
    }

    const json = await response.json();

    // Cache the response.
    apiCache.set(cacheKey, {
      timestamp: Date.now(),
      data: json
    });

    return json;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('The request timed out (8s).');
    }
    throw err;
  }
}
