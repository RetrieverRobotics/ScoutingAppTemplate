
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

function setMenuModeSelect() {
    const videoMenu = document.querySelector(".video-menu");
    videoMenu.classList.remove(MODE_TRIM);
    videoMenu.classList.add(MODE_SELECT);
}

function setMenuModeTrim() {
    const videoMenu = document.querySelector(".video-menu");
    videoMenu.classList.remove(MODE_SELECT);
    videoMenu.classList.add(MODE_TRIM);
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

    //input event clears any invalidity status

    videoSelectForm.querySelectorAll("input").forEach(elm => {
        elm.addEventListener("input", () => {
            elm.setCustomValidity("");
        });
    });
    
    videoTrimForm.querySelectorAll("input").forEach(elm => {
        elm.addEventListener("input", () => {
            elm.setCustomValidity("");
        });
    });

    //set submission hander for select form (select -> trim)

    videoSelectForm.addEventListener("submit", (ev) => {
        ev.preventDefault();

        //get inputs by name

        /** @type {HTMLInputElement} */
        const fileInput = videoSelectForm.querySelector("input[name=\"file\"]");
        /** @type {HTMLInputElement} */
        const urlInput = videoSelectForm.querySelector("input[name=\"url\"]");

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

    });

    //cancel button for trim form (select <- trim)
    cancelTrim.addEventListener("click", (ev) => {
        if (ev.button != 0) return;
        
        ev.preventDefault();
        
        setMenuModeSelect();
    });
});