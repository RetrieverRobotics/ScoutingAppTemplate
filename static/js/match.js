const ID_VIDEO_VIEW = "videoView";

const CLASS_VIDEO_CONTAINER = "video-container";
const CLASS_VIDEO_PLAYER = "video-player";
const CLASS_VIDEO_CONTROLS = "video-controls";
const CLASS_HORIZONTAL_VIDEO = "horizontal-video";
const CLASS_VERTICAL_VIDEO = "vertical-video";
const CLASS_INPUT_CONTENT = "input-content";

/** @type {CustomVideo} */
var currentVideoPlayer = null;
var inputSystem = new InputSystem()

const SW_CURRENT = getSWURLNamespace("/current");

/**
 * Get the current video URL from the service worker.
 * @returns {string|null} The URL that the video is stored under.
 */
async function getCurrentVideoURL() {
    if (SW_CURRENT == null) return null;
    const copyURL = new URL(SW_CURRENT.href);
    copyURL.searchParams.append("key", "video");
    const response = await fetch(copyURL);
    if (response.ok && response.headers.get("Content-Type").startsWith("application/json")) {
        return await response.json();
    }
    return null;
}

/**
 * Set the current video
 * @param {string|null} src The video src, or null to remove the current video
 * @returns {HTMLVideoElement|null} The video that was set, or null if the video was removed
 */
function setVideo(src) {
    const videoView = document.getElementById(ID_VIDEO_VIEW);
    while (videoView.children.length > 0)
        videoView.removeChild(videoView.firstElementChild);

    if (src == null) return null;

    const video = document.createElement("video");
    video.src = src;
    video.preservesPitch = true;
    video.classList.add(CLASS_VIDEO_PLAYER);

    videoView.appendChild(video);

    return video;
}

/**
 * Cause the current custom video player to lose focus.
 * Use when handling events that should take away / restore focus from/to the video player.
 * 
 * @param {boolean|undefined} state The focus state for the custom video player to have (false by default)
 */
function setVideoFocus(state) {
    currentVideoPlayer.container.classList.toggle(CLASS_VIDEO_FOCUSED, state ? true : false);
}

/**
 * 
 * @param {CustomVideo} videoPlayer 
 */
function controlVideoLayout(videoPlayer) {
    videoPlayer.video.addEventListener("loadedmetadata", () => {
        /** @type {HTMLDivElement} */
        const videoRect = videoPlayer.video.getBoundingClientRect()
        const horizontal = videoRect.width > videoRect.height;
        videoPlayer.container.classList.toggle(CLASS_HORIZONTAL_VIDEO, horizontal);
        videoPlayer.container.classList.toggle(CLASS_VERTICAL_VIDEO, !horizontal);
    });
}

window.addEventListener("load", () => {
    getCurrentVideoURL().then(url => {
        if (url == null) {
            console.error("Could not load video URL");
        }
        else {
            const video = setVideo(url);
            const controls = document.querySelector(`.${CLASS_VIDEO_CONTROLS}`);
            /** @type {CustomVideo} */
            currentVideoPlayer = initVideo(video, controls, document.querySelector(`.${CLASS_VIDEO_CONTAINER}`));
            setVideoFocus(true);
            controlVideoLayout(currentVideoPlayer);

            
        }
    });

    document.querySelector(`.${CLASS_INPUT_CONTENT}`).addEventListener("click", () => {
        setVideoFocus(false);
    });
});
