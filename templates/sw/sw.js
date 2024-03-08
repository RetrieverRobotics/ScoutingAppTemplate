/**
{#
    sw.js (service worker)

    Variables:

    SW_URL_NAMESPACE:           The URL namespace for the service worker to own. Defaults to "client" (optional)
    VIDEO_SELECTION_OUTPUT:     The URL to receive output from the select_video template on
    VIDEO_SELECTION_REDIRECT:   The URL to redirect to after receiving video selection output
    ASSETS:                     Array of URLs to consider as assets; will be pre-cacheed when the service worker is installed
#}
*/

const LOCAL_STORAGE_SW_URL_NAMESPACE = "SW_URL_NAMESPACE";
const CACHE_PAGES = "pages";
const CACHE_CLIPS = "clips";

const CURRENT_VIDEO = "video";
const CHECK_CONNECTION_INTERVAL = 10000; //ms
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

//URL used to access the service worker
const SW_URL = new URL(eval(`{{ url_for(request.endpoint) | tojson }}`), location.origin);

//variables

const SW_URL_NAMESPACE = new URL(eval(`{% if SW_URL_NAMESPACE is defined %}{{ SW_URL_NAMESPACE|tojson }}{% else %}"client"{% endif %}`), location.origin);
const VIDEO_SELECTION_OUTPUT = new URL(eval(`{{ VIDEO_SELECTION_OUTPUT|tojson }}`), location.origin);

/** @type {object} */
const VIDEO_SELECTION_REDIRECT = new URL(eval(`{{ VIDEO_SELECTION_REDIRECT|tojson }}`), location.origin);
/** @type {URL[]} */
const ASSETS = eval(`{{ ASSETS|tojson }}`).map(value => new URL(value, location.origin));


//error pages

const ERROR_VIDEO_SELECTION_400 = `{% include "sw/handle_video_selection_400.html" %}`;
const ERROR_VIDEO_SELECTION_405 = `{% include "sw/handle_video_selection_405.html" %}`;

//state

/** @type {Map<string, URL>} */
const current = new Map();
var useCache = false;
var isConnected = true;
var checkConnectionIntervalId = null;

/**
 * Checks if location.origin can be connected to
 * @returns {Promise<boolean>}
 */
async function checkConnection() {
    try {
        await fetch(SW_URL, {method: "HEAD"});
        return true;
    }
    catch(err) {
        console.error(err);
        return false;
    }
}

/**
 * Create a clip URL
 * @param {string} clip_group The clip group name
 * @param {string} clip_name The clip name
 * @returns {URL} The clip URL
 */
function makeClipURL(clip_group, clip_name) {
    return new URL(`/clips/load/${clip_group}/${clip_name}`, location.origin);
}

/**
 * Create a local video URL
 * @param {string} filename The name of the file
 * @returns {URL} The local video URL
 */
function makeLocalVideoURL(filename) {
    return new URL(`${SW_URL_NAMESPACE}/localvideo/${filename}`, location.origin);
}

const LOCAL_VIDEO_PATHNAME = makeLocalVideoURL("").pathname;

/**
 * Fetches the clip from the server
 * @param {URL} clipURL The clip URL
 * @param {boolean} docache If cache should be used when fetching. By default, this is false
 * @returns {Promise<Response>} The fetched clip response
 */
async function fetchClip(clipURL, docache) {
    let response;
    try {
        response = await fetch(clipURL);
        if (docache && response.status == 200) { //if status == 206 (first load) then dont use
            const cache = await caches.open(CACHE_CLIPS);
            cache.put(clipURL, response.clone());
        }
    }
    catch(err) {
        console.err(err);
        const match = await caches.match(clipURL);
        if (docache && match)
            response = match;
        else
            throw err;
    }
    return response;
}

/**
 * Caches the local video in clips cache under the service worker url namespace
 * @param {string|URL} name The local video's filename / service worker url
 * @param {Response|null} video The video response to store, or null to delete
 * @returns {Promise<boolean>} If the video was set/deleted successfully
 */
async function setLocalVideo(name, video) {
    if (typeof name == "string")
        name = makeLocalVideoURL(name);
    const cache = await caches.open(CACHE_CLIPS);
    if (video == null)
        return cache.delete(name);
    else
        cache.put(name, video.clone());
    return true;
}

/**
 * Retrieves the cached local video
 * @param {string|URL} name The local video's filename ?service worker url
 * @returns {Promise<Response|null>} The retrieved video, or null if does not exist
 */
async function getLocalVideo(name) {
    if (typeof name == "string")
        name = makeLocalVideoURL(name);
    const cache = await caches.open(CACHE_CLIPS);
    const response = cache.match(name);
    return response ? response : null;
}

/**
 * Handle a request sent as output from the select_video template
 * @param {Request} request The request to handle
 * @returns {Promise<Response|null>} The response to send back, or `null` if
 *                                   the request should be handled as normal
 */
async function handleClipSelection(request) {
    if (request.method.toUpperCase() == "POST") {
        const data = await request.formData();

        /** @type {File|null} */
        const file = data.get("file");
        const clip_group = data.get("clip_group");
        const clip_name = data.get("clip_name");

        //prioritize local file over clip
        if (file && file.size) {
            //create the file response to cache
            const fileCache = new Response(file, {
                status: 200,
                statusText: "OK",
                headers: new Headers({
                    "Content-Type":file.type
                })
            });
            const lvidURL = makeLocalVideoURL(file.name);
            await setLocalVideo(lvidURL, fileCache); //put it in cache
            current.set(CURRENT_VIDEO, lvidURL); //set this video to the current video being used
        }
        else if (clip_group && clip_name) {
            const clipURL = makeClipURL(clip_group, clip_name);
            await fetchClip(clipURL, true); //fetch to get it in the cache
            current.set(CURRENT_VIDEO, clipURL); //set this video to current
        }
        else return new Response(ERROR_VIDEO_SELECTION_400, {
            status: 400,
            statusText: "Bad Request",
            headers: new Headers({
                "Contnent-Type": "text/html"
            })
        });
    }
    else if (request.method.toUpperCase() == "GET") {
        const url = new URL(request.url);
        const filename = url.searchParams.get("file");
        const clip_group = url.searchParams.get("clip_group");
        const clip_name = url.searchParams.get("clip_name");

        if (filename) {
            const lvidURL = makeLocalVideoURL(filename);
            const fileCache = await getLocalVideo(lvidURL);
            if (fileCache)
                current.set(CURRENT_VIDEO, lvidURL);
            else throw new Error(`Unknown local video "${filename}".`);
        }
        else if (clip_group && clip_name) {
            const clipURL = makeClipURL(clip_group, clip_name);
            await fetchClip(clipURL, true);
            current.set(CURRENT_VIDEO, clipURL);
        }
        else return new Response(ERROR_VIDEO_SELECTION_400, {
            status: 400,
            statusText: "Bad Request",
            headers: new Headers({
                "Contnent-Type": "text/html"
            })
        });
    }
    else return new Response(ERROR_VIDEO_SELECTION_405, {
        status: 405,
        statusText: "Method Not Allowed",
        headers: new Headers({
            "Allow": "GET, POST",
            "Content-Type": "text/html"
        })
    });

    return Response.redirect(VIDEO_SELECTION_REDIRECT, 303);
}

/**
 * Handle serving video content to the client (handles 206 Partial Content)
 * @param {Request} request The incoming request
 * @param {Response} response The cached video response
 * @returns {Promise<Response>} The video content to serve (clone)
 */
async function handleClipRequest(request, response) {
    const rangeHeader = request.headers.get("Range");

    //requested partial but returning non-partial from cache
    if (response.status != 206 && rangeHeader !== null) {
        //parse the range
        if (!rangeHeader.includes(",")) {
            const unitParse = rangeHeader.split("=", 2);
            const unit = unitParse[0].toLowerCase();
            if (unit == "bytes") {
                const rangeParts = unitParse[1].split("-", 2);
                if (rangeParts.length == 2 && rangeParts[0].trim()) {
                    const videoContent = await response.blob();
                    const size = videoContent.size;
                    const start = Number(rangeParts[0]);
                    const end = rangeParts[1] ? Number(rangeParts[1]) : null;
                    const length = end == null ? size - start : end - start;
                    if (length > 0) {
                        const range = videoContent.slice(start, start+length);
                        const newResponse = new Response(range, {
                            status: 206,
                            statusText: "Partial Content",
                            headers: response.headers
                        });
                        
                        newResponse.headers.set("Content-Range", `bytes ${start}-${start+length-1}/${size}`);
                        newResponse.headers.set("Content-Length", `${range.size}`);
                        newResponse.headers.set("Content-Type", response.headers.get("Content-Type"));
                        
                        return newResponse;
                    }
                }
            }
        }
        //TODO 416
    }
    else
        return response.clone();
}

/**
 * Handle an install event
 * @param {Event} ev The install event to handle
 */
async function handleInstall(ev) {
    self.skipWaiting();

    //set connection checking interval
    if (checkConnectionIntervalId)
        clearInterval(checkConnectionIntervalId);
    checkConnectionIntervalId = setInterval(() => {
        checkConnection().then(status => {
            isConnected = status;
        });
    }, CHECK_CONNECTION_INTERVAL);

    //pre-load assets
    console.log(`Pre-loading assets (${ASSETS.length})`);
    const cache = await caches.open(CACHE_PAGES);
    console.log(`Caching assets in cache "${CACHE_PAGES}"`);
    for (const asset of ASSETS) {
        try {
            const response = await fetch(asset);
            if (response.ok)
                cache.put(asset, response.clone());
        }
        catch(err) {
            console.error(err);
        }
    }
}

/**
 * Handle a fetch event
 * @param {Event} ev The fetch event to handle
 * @returns {Promise<Response>} The response to respond with
 */
async function handleFetch(ev) {
    /** @type {Request} */
    const request = ev.request;
    const url = new URL(request.url);

    if (request.url == VIDEO_SELECTION_OUTPUT.href) {
        const response = await handleClipSelection(request);
        if (response !== null)
            return response;
    }
    else if (url.pathname.startsWith(`/clips`)) {
        return handleClipRequest(request, await fetchClip(url, true));
        //return fetchClip(url, true);
    }
    else if (url.pathname.startsWith(LOCAL_VIDEO_PATHNAME)) {
        return handleClipRequest(request, await getLocalVideo(url));
        //return getLocalVideo(url);
    }
    else if (url.pathname == SW_URL_NAMESPACE.pathname + "/current") {
        if (request.method.toUpperCase() != "GET") {
            //TODO 405 error
        }
        const key = url.searchParams.get("key");
        if (key == null) {
            //TODO 400 error
        }
        
        const value = current.get(key);
        return new Response(JSON.stringify(value), {
            status: 200,
            statusText: "OK",
            headers: new Headers({
                "Content-Type": "application/json; charset=utf-8"
            })
        });
    }

    const cache = await caches.open(CACHE_PAGES);
    const match = await cache.match(request);
    
    if (isConnected) {
        try {
            const response = await fetch(request);
            if (!match || response.ok)
                cache.put(request, response.clone());
            return response;
        }
        catch (err) {
            if (!isConnected && match)
                return match;
            else throw err;
        }
    }
    else return match;
}

self.addEventListener("install", (ev) => {
    ev.waitUntil(handleInstall(ev));
});

self.addEventListener("activate", (ev) => {
    console.log("Claiming clients");
    ev.waitUntil(clients.claim());
})

self.addEventListener("message", async (ev) => {
    if (ev.origin != location.origin) return;
    const msg = ev.data;
    if (msg.name == "namespace/get") {
        ev.source.postMessage({
            name: "localstorage/set",
            key: "SW_URL_NAMESPACE",
            value: SW_URL_NAMESPACE.href
        });
    }
});

self.addEventListener("fetch", (ev) => {
    ev.respondWith(handleFetch(ev));
});
