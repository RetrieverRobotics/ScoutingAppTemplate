
const MODE_SELECT = "mode-select";
const MODE_TRIM = "mode-trim";

const ID_VIDEO_SELECT_FORM = "videoSelectForm";
const ID_VIDEO_TRIM_FORM = "videoTrimForm";
const ID_VIDEO_PREVIEW = "videoPreview";
const ID_CANCEL_TRIM = "cancelTrim";

const PREVIEW_LOCAL = "preview-local";
const PREVIEW_URL = "preview-url";

const PREVIEW_YOUTUBE = "preview-youtube";

const YOUTUBE_URLS = ["www.youtube.com", "youtube.com", "youtu.be"];

/**
 * Makes the video select form visible and the video trib form not visible
 */
function setMenuModeSelect() {
    const videoMenu = document.querySelector(".video-menu");
    videoMenu.classList.remove(MODE_TRIM);
    videoMenu.classList.add(MODE_SELECT);
}

/**
 * Makes the video trim form visible and the video select form not visible
 */
function setMenuModeTrim() {
    const videoMenu = document.querySelector(".video-menu");
    videoMenu.classList.remove(MODE_SELECT);
    videoMenu.classList.add(MODE_TRIM);
}

/**
 * Convert a video timestamp to seconds since the start of the video
 * @param {string} timestamp The timestamp to convert
 * @returns {number} The number of seconds 
 */
function convertTimestamp(timestamp) {
    if (!timestamp.includes(":")) //if there is no colon, then its just seconds
        return Number(timestamp);

    const parts = timestamp.split(":");
    let total = 0;
    for (let i = 0; i < parts.length; i++)
        total += Number(parts[parts.length-i-1]) * Math.pow(60, i);

    return total;
}

/**
 * Check if the duration input `elm` is valid
 * @param {HTMLInputElement} elm The element to check
 * @returns {boolean} If the input is valid
 */
function checkDurationInput(elm) {
    if (elm.disabled) {
        elm.setCustomValidity("");
        return true;
    }
    const val = Number(elm.value);
    if (val === NaN) {
        elm.setCustomValidity("Must be a number.");
        return false;
    }
    else if (val < 0) {
        elm.setCustomValidity("Cannot be negative.");
        return false;
    }
    else {
        elm.setCustomValidity("");
        return true;
    }
}

window.addEventListener("load", () => {
    /** @type {HTMLFormElement} */
    const videoSelectForm = document.getElementById(ID_VIDEO_SELECT_FORM);
    /** @type {HTMLFormElement} */
    const videoTrimForm = document.getElementById(ID_VIDEO_TRIM_FORM);
    /** @type {HTMLDivElement} */
    const videoPreview = document.getElementById(ID_VIDEO_PREVIEW);
    /** @type {HTMLButtonElement} */
    const cancelTrim = document.getElementById(ID_CANCEL_TRIM);

    //get inputs by name

    //video select form
    /** @type {HTMLInputElement} */
    const fileInput = videoSelectForm.querySelector("input[name=\"file\"]");
    /** @type {HTMLInputElement} */
    const urlInput = videoSelectForm.querySelector("input[name=\"url\"]");

    //video trim form
    /** @type {HTMLInputElement} */
    const startInput = videoTrimForm.querySelector("input[name=\"start\"]");
    /** @type {HTMLInputElement} */
    const durationInput = videoTrimForm.querySelector("input[name=\"duration\"]");
    /** @type {HTMLInputElement} */
    const wholeVideoInput = videoTrimForm.querySelector("input[name=\"whole_video\"]");


    //add input event listeners

    fileInput.addEventListener("input", () => { fileInput.setCustomValidity(""); });
    urlInput.addEventListener("input", () => { urlInput.setCustomValidity(""); });
    startInput.addEventListener("input", () => { startInput.setCustomValidity(""); });

    durationInput.addEventListener("input", () => {
        checkDurationInput(durationInput);
    });

    //enable and disable duration input when toggled
    wholeVideoInput.addEventListener("input", () => {
        if (wholeVideoInput.checked)
            durationInput.disabled = true;
        else {
            durationInput.disabled = false;
            checkDurationInput(durationInput);
        }
    });


    //set submission hander for select form (select -> trim)

    videoSelectForm.addEventListener("submit", (ev) => {
        ev.preventDefault();

        if (fileInput.reportValidity() && fileInput.files.length) {

            //set video preview to file
            videoPreview.classList.remove(PREVIEW_URL);
            videoPreview.classList.add(PREVIEW_LOCAL);

            //remove previous contents, if any
            while (videoPreview.children.length > 0)
                videoPreview.removeChild(videoPreview.firstChild);

            //create video for local file
            const url = URL.createObjectURL(fileInput.files[0]);
            const video = document.createElement("video");
            video.controls = true;
            video.autoplay = true;

            video.src = url;

            //set video as preview

            videoPreview.appendChild(video);
        }
        else if (urlInput.reportValidity()) {
            fileInput.setCustomValidity("");

            //set video preview to url
            videoPreview.classList.remove(PREVIEW_LOCAL);
            videoPreview.classList.add(PREVIEW_URL);

            //remove previous contents
            while (videoPreview.children.length > 0)
                videoPreview.removeChild(videoPreview.firstChild);

            //create embed for video
            const urlValue = new URL(urlInput.value);

            if (YOUTUBE_URLS.includes(urlValue.hostname)) {
                
                //get youtube video ID
                let v = urlValue.searchParams.get("v");
                if (v === null)
                    v = urlValue.pathname.slice(1);
            
                //create youtube embed url
                const url = new URL(`https://www.youtube.com/embed/${v}`);
                url.searchParams.set("autoplay", "1");
                url.searchParams.set("modestbranding", "1");

                //create iframe
                const iframe = document.createElement("iframe");
                iframe.classList.add(PREVIEW_YOUTUBE);
                iframe.src = url;

                videoPreview.appendChild(iframe);
            }
            else {

                //create generic video player
                const video = document.createElement("video");
                video.controls = true;
                video.autoplay = true;

                video.src = urlValue;

                videoPreview.appendChild(video);
            }
        }
        else {
            alert("Either Video File or URL is required.");
            return;
        }

        setMenuModeTrim();
    });

    //submission handler for trim form (trim -> match page)

    videoTrimForm.addEventListener("submit", (ev) => {
        ev.preventDefault();

        const startSeconds = convertTimestamp(startInput.value);
        if (startSeconds === NaN) {
            startInput.setCustomValidity("Not a valid number or timestamp.");
            return;
        }
        else if (startSeconds < 0) {
            startInput.setCustomValidity("Seconds or timestamp cannot be negative.");
            return;
        }

        if (!checkDurationInput(durationInput) || !durationInput.reportValidity())
            return;

        //TODO get video url from preview (check classes to retrieve properly)

        startInput.value = startSeconds;

        const data = new FormData(videoTrimForm);
        //TODO data.append("video", url.href); or something like that

        //TODO construct url to post to, handled by service worker
    });

    //cancel button for trim form (select <- trim)
    cancelTrim.addEventListener("click", (ev) => {
        if (ev.button != 0) return;
        
        ev.preventDefault();
        
        setMenuModeSelect();
    });
});