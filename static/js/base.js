
const LOCAL_STORAGE_SW_URL_NAMESPACE = "SW_URL_NAMESPACE";

/**
 * Get the service worker's URL namespace from localStorage
 * @param {string|null|undefined} path The url part to append after the service worker URL namespace pathname
 * @returns {URL|null} The URL namespace for the service worker
 */
function getSWURLNamespace(path) {
    const href = localStorage.getItem(LOCAL_STORAGE_SW_URL_NAMESPACE);
    if (href == null)
        return null;
    const url = new URL(href);
    if (path)
        url.pathname += path;
    return url;
}
