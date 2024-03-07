const ID_VIDEO_VIEW = "videoView";

const CLASS_VIDEO_PLAYER = "video-player";
const CLASS_VIDEO_CONTROLS = "video-controls";

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
    video.preload = "auto";
    video.preservesPitch = true;
    video.classList.add(CLASS_VIDEO_PLAYER);

    videoView.appendChild(video);

    return video;
}

window.addEventListener("load", () => {
    getCurrentVideoURL().then(url => {
        if (url == null) {
            //TODO error message
        }
        else {
            const video = setVideo(url);
            const controls = document.querySelector(`.${CLASS_VIDEO_CONTROLS}`);
            initVideo(video, controls);
        }
    });

    
});
