const ID_VIDEO_SELECT_FORM = "videoSelectForm";
const ID_VIDEO_PREVIEW = "videoPreview";

const CLASS_CLIP_SELECTION = "clip-selection";
const CLASS_CLIP_SELECTED = "clip-selection-selected";

const ATTR_GROUP_NAME = "group_name";
const ATTR_NAVIGATE = "navigate"

window.addEventListener("load", () => {
    /** @type {HTMLFormElement} */
    const videoSelectForm = document.getElementById(ID_VIDEO_SELECT_FORM);
    /** @type {HTMLDivElement} */
    const videoPreview = document.getElementById(ID_VIDEO_PREVIEW);
    /** @type {HTMLInputElement} */
    const fileInput = videoSelectForm.querySelector("input[name=\"file\"]");
    /** @type {HTMLSelectElement} */
    const groupSelect = videoSelectForm.querySelector("select[name=\"clip_group\"]");

    /**
     * Set the preview video for the video select form
     * @param {string|HTMLVideoElement|null} video The video to set
     */
    function setVideoPreview(video) {
        while (videoPreview.children.length > 0)
            videoPreview.removeChild(videoPreview.firstElementChild);

        if (video === null) return;

        if (typeof video == "string") {
            const src = video;
            video = document.createElement("video");
            video.src = src;
            video.controls = true;
        }

        videoPreview.appendChild(video);
    }


    const firstClipSelect = videoSelectForm.querySelector(`.${CLASS_CLIP_SELECTION}`);
    if (firstClipSelect) {
        const sel = firstClipSelect.querySelector("select");
        firstClipSelect.classList.add(CLASS_CLIP_SELECTED);
        sel.disabled = false;
    }

    //add input event handlers

    fileInput.addEventListener("input", () => {
        fileInput.setCustomValidity("");

        if (fileInput.files.length > 0) {
            const objUrl = URL.createObjectURL(fileInput.files[0]);
            setVideoPreview(objUrl);
        }
        else
            setVideoPreview(null);
    });

    groupSelect.addEventListener("input", () => {

        groupSelect.setCustomValidity("");

        /** @type {HTMLDivElement} */
        const prev = videoSelectForm.querySelector(`.${CLASS_CLIP_SELECTED}`);
        if (prev != null) {
            if (prev.getAttribute(ATTR_GROUP_NAME) == groupSelect.value)
                return; //nothing has changed

            const prevSelect = prev.querySelector("select");
            prev.classList.remove(CLASS_CLIP_SELECTED);
            prevSelect.disabled = true;
        }

        /** @type {HTMLDivElement} */
        const current = videoSelectForm.querySelector(`.${CLASS_CLIP_SELECTION}[${ATTR_GROUP_NAME}=${JSON.stringify(groupSelect.value)}]`);
        const currentSelect = current.querySelector("select");
        current.classList.add(CLASS_CLIP_SELECTED);
        currentSelect.disabled = false;
        
        const url = `/clips/load/${groupSelect.value}/${currentSelect.value}`;
        setVideoPreview(url);

    });

    videoSelectForm.querySelectorAll(`.${CLASS_CLIP_SELECTION} > select`).forEach(elm => {
        elm.addEventListener("input", () => {
            const url = `/clips/load/${groupSelect.value}/${elm.value}`;
            setVideoPreview(url);
        });
    })

    //submission handler

    videoSelectForm.addEventListener("submit", (ev) => {
        const nav = videoSelectForm.hasAttribute(ATTR_NAVIGATE);
        if (!nav)
            ev.preventDefault();

        //check inputs, local file takes priority

        //stop if files were entered and they are invalid
        if (fileInput.files.length > 0 && !fileInput.reportValidity()) {
            ev.preventDefault();
            return;
        }
        else {
            const clipSelect = videoSelectForm.querySelector(`.${CLASS_CLIP_SELECTED} > select`);
            if (!groupSelect.value) {
                fileInput.setCustomValidity("Must either select a local video or select a video from the server.");
                ev.preventDefault();
                return;
            }
            else if (!groupSelect.reportValidity())
                return;
            else if (!clipSelect.value) {
                clipSelect.setCustomValidity("Must pick a clip if selecting a video from the server.")
                ev.preventDefault();
                return;
            }
            else if (!clipSelect.reportValidity())
                return;
        }

        if (!nav) {
            const url = new URL(videoSelectForm.action);
            const data = new FormData(videoSelectForm);
            const method = videoSelectForm.method.trim().toUpperCase();
            const options = {method: method};

            if (method == "GET") {
                if (fileInput.files.length > 0)
                    url.searchParams.append("file", data.get("file").name);
                url.searchParams.append("clip_group", data.get("clip_group"));
                url.searchParams.append("clip_name", data.get("clip_name"));
            }
            else if (method == "POST")
                options["body"] = data;

            fetch(url, options);
        }
        //if nav, then the browser will carry out the request

    });

});