/**
 * RedirAddon - Background Service Worker (Manifest V3)
 * Firefox Add-ons (AMO) API isteklerini yönetir ve CORS/CSP kısıtlamalarını aşar.
 */

// Sonuçları hafızada tutarak gereksiz tekrarlı API isteklerini önleyen önbellek
const apiCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 dakika geçerlilik süresi

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SEARCH_AMO') {
    handleAmoSearch(request.query)
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    
    // Asenkron sendResponse için true dönülmelidir
    return true;
  }
});

/**
 * Firefox Add-ons v5 REST API üzerinde eklenti araması yapar.
 * @param {string} query Aranacak eklenti adı
 * @returns {Promise<Object>} API yanıtı ve eklenti listesi
 */
async function handleAmoSearch(query) {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) {
    throw new Error('Arama sorgusu boş olamaz.');
  }

  const cacheKey = cleanQuery.toLowerCase();
  const cached = apiCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }

  // AMO v5 Arama Uç Noktası
  const endpoint = `https://addons.mozilla.org/api/v5/addons/search/?q=${encodeURIComponent(cleanQuery)}&page_size=6&type=extension`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 sn timeout

  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'tr,en-US;q=0.9,en;q=0.8'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AMO API Hatası: HTTP ${response.status}`);
    }

    const json = await response.json();

    // Yanıtı önbelleğe kaydet
    apiCache.set(cacheKey, {
      timestamp: Date.now(),
      data: json
    });

    return json;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('İstek zaman aşımına uğradı (8s).');
    }
    throw err;
  }
}

