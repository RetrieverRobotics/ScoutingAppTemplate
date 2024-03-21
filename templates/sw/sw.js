/**
{#
    sw.js (service worker)

    Variables:

    VIDEO_SELECTION_OUTPUT:     The URL to receive output from the select_video template on
    VIDEO_SELECTION_REDIRECT:   The URL to redirect to after receiving video selection output
    ASSETS:                     Array of URLs to consider as assets; will be pre-cacheed when the service worker is installed
#}
*/

const ASSET_ALWAYS = "always";
const ASSET_SUCCESSFUL = "successful";
const ASSET_METHOD = "method";
const ASSET_NEVER = "never";

/**
 * @typedef AssetConfig Options for how an asset should be cached
 * @property {("always"|"successful"|"method"|"never")} behavior The behavior to cache the asset with
 * @property {string[]|undefined} methods If `behavior` == "method", `methods` is the list of methods to cache for 
 */

/**
 * Set up an asset map
 * @param {Object.<string, AssetConfig|string>} options The options to use
 * @returns {Map<string, AssetConfig>}
 */
function setupAssets(options) {
    const rtv = new Map();
    for (const href in options) {
        const url = new URL(href, location.origin);
        let behavior;
        let methods;
        if (typeof options[href] == "string") {
            behavior = options[href].trim().toLowerCase();
            methods = behavior == ASSET_METHOD ? [] : undefined;
        }
        else if (typeof (options[href].behavior) == "string"){
            behavior = options[href].behavior.trim().toLowerCase();
            if (behavior == ASSET_METHOD) {
                methods = [];
                if (Array.isArray(options[href].methods))
                    for (const method of options[href].methods)
                        if (typeof method == "string")
                            methods.push(method.trim().toLowerCase());
            }
            else methods = undefined;
        }
        else continue; //invalid, skip

        rtv.set(url.pathname, {behavior: behavior, methods: methods});
    }

    return rtv;
}

const CACHE_PAGES = "pages";
const CACHE_CLIPS = "clips";

const CURRENT_VIDEO = "video";
const CHECK_CONNECTION_INTERVAL = 10000; //ms

//URL used to access the service worker
const SW_URL = new URL(eval(`{{ url_for(request.endpoint) | tojson }}`), location.origin);

//variables

const VIDEO_SELECTION_OUTPUT = new URL(eval(`{{ VIDEO_SELECTION_OUTPUT|tojson }}`), location.origin);

/** @type {URL} */
const VIDEO_SELECTION_REDIRECT = new URL(eval(`{{ VIDEO_SELECTION_REDIRECT|tojson }}`), location.origin);
const ASSETS = setupAssets(eval(`({{ ASSETS|tojson }})`));
/** @type {AssetConfig}  */
const ASSETS_DEFAULT = eval(`({% if ASSETS_DEFAULT is defined and ASSETS_DEFAULT %}{{ ASSETS_DEFAULT|tojson }}{% else %} {"behavior": "successful"} {% endif %})`);


//error pages

const ERROR_VIDEO_SELECTION_400 = `{% include "sw/handle_video_selection_400.html" %}`;
const ERROR_VIDEO_SELECTION_405 = `{% include "sw/handle_video_selection_405.html" %}`;
const ERROR_CLIP_REQUEST_416 = `{% include "sw/handle_clip_request_416.html" %}`;

//state

/** @type {Map<string, URL>} */
const current = new Map();
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
 * Set the current video URL for the service worker and client
 * @param {URL} url URL to set
 */
async function setCurrentVideo(url) {
    current.set(CURRENT_VIDEO, url);
    const all = await self.clients.matchAll();
    for (const client of all)
        client.postMessage({name:"video/set", value:url.href});
}

/*
 * Cache the given asset
 * @param {Cache} cache Cache to cache the response into
 * @param {Response} response Response to attempt to cache
 * @param {Request|URL|string|null|undefined} source source to use, attempts to retrieve url from response if `source` is null or undefined
 * @param {string|undefined} method Method that the request was made with, GET by default
 * @returns {boolean} If the response was successfully cached
 */
function cacheAsset(cache, response, source, method) {
    /** @type {URL} */
    let url;
    if (source === null || source === undefined) {
        source = new URL(response.url, location.origin);
        url = source;
    }
    else if (typeof source == "string") {
        source = new URL(source, location.origin);
        url = source;
    }
    else url = new URL(source.url, location.origin);

    if (typeof method != "string")
        method = source?.method || "get";

    method = method.trim().toLowerCase();
    
    let options = ASSETS.get(url);
    if (options === undefined)
        options = ASSETS_DEFAULT;

    switch (options.behavior.trim().toLowerCase()) {
        case ASSET_ALWAYS:
            console.log(url.pathname, options);
            cache.put(source, response);
            return true;
        default:
            console.error(`Unknown cache behavior ${options.behavior}: assuming default behavior ${ASSET_SUCCESSFUL}.`);
        case ASSET_SUCCESSFUL:
            console.log(url.pathname, options);
            if (response.ok) {
                cache.put(source, response);
                return true;
            }
            else return false;
        case ASSET_METHOD:
            console.log(url.pathname, options);
            if (Array.isArray(options.methods) && options.methods.some(value => value.trim().toLowerCase() == method)) {
                cache.put(source, response)
                return true;
            }
            return false;
        case ASSET_NEVER:
            console.log(url.pathname, options);
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
    return new URL(`${SW_URL}/localvideo/${filename}`, location.origin);
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
        if (isConnected) {
            response = await fetch(clipURL);
            if (docache && response.status == 200) { //if status == 206 (first load) then dont use
                const cache = await caches.open(CACHE_CLIPS);
                cacheAsset(cache, response.clone(), clipURL);
            }
        }
        else return await caches.match(clipURL);
    }
    catch(err) {
        console.error(err);
        const match = await caches.match(clipURL);
        if (docache && match)
            response = match;
        else
            throw err;
    }
    return response;
}

/**
 * Caches the local video in clips cache
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
        cacheAsset(cache, video.clone(), name);
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
            setCurrentVideo(lvidURL);
        }
        else if (clip_group && clip_name) {
            const clipURL = makeClipURL(clip_group, clip_name);
            await fetchClip(clipURL, true); //fetch to get it in the cache
            setCurrentVideo(clipURL);
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
                setCurrentVideo(lvidURL);
            else throw new Error(`Unknown local video "${filename}".`);
        }
        else if (clip_group && clip_name) {
            const clipURL = makeClipURL(clip_group, clip_name);
            await fetchClip(clipURL, true);
            setCurrentVideo(clipURL);
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
        const videoContent = await response.blob();
        const size = videoContent.size;
        //parse the range
        if (!rangeHeader.includes(",")) {
            const unitParse = rangeHeader.split("=", 2);
            const unit = unitParse[0].toLowerCase();
            if (unit == "bytes") {
                const rangeParts = unitParse[1].split("-", 2);
                if (rangeParts.length == 2 && rangeParts[0].trim()) {
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
        return new Response(ERROR_CLIP_REQUEST_416, {
            status: 416,
            statusText: "Range Not Satisfiable",
            headers: new Headers({
                "Content-Range": `bytes */${size}`,
                "Content-Type": "text/html"
            })
        });
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
    for (const asset of ASSETS.keys()) {
        try {
            const response = await fetch(asset);
            if (response.ok)
                cacheAsset(cache, response.clone(), asset);
        }
        catch(err) {
            console.error(err);
        }
    }
}

/**
 * Handle an activation event
 * @param {Event} ev The activation event to handle 
 */
async function handleActivate(ev) {
    await clients.claim();
    isConnected = await checkConnection();
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
    else if (url.pathname.startsWith(`/clips`))
        return await handleClipRequest(request, await fetchClip(url, true));
    else if (url.pathname.startsWith(LOCAL_VIDEO_PATHNAME))
        return await handleClipRequest(request, await getLocalVideo(url));

    const cache = await caches.open(CACHE_PAGES);
    const match = await cache.match(request);
    
    if (isConnected) {
        try {
            const response = await fetch(request);
            if (!match || response.ok)
                cacheAsset(cache, response.clone(), request);
            return response;
        }
        catch (err) {
            if (match) {
                console.error(err);
                return match;
            }
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
    ev.waitUntil(handleActivate(ev));
})

self.addEventListener("message", async (ev) => {
    if (ev.origin != location.origin) return;

    const msg = ev.data;
    if (msg.name == "video/get") {
        const url = current.get(CURRENT_VIDEO);
        ev.source.postMessage({
            name: "video/set",
            value: url === undefined ? null : url.href
        });
    }
    else if (msg.name == "video/set")
        current.set(CURRENT_VIDEO, msg.value == null ? null : new URL(msg.value));
});

self.addEventListener("fetch", (ev) => {
    ev.respondWith(handleFetch(ev));
});
