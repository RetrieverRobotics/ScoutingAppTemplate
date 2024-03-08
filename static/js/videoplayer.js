
const CLASS_VIDEO_PLAYER_CONTROL = "video-player-control";
const CLASS_VIDEO_PLAYER_PLAY_BUTTON = "video-player-play-button";
const CLASS_VIDEO_PLAYER_PROGRESS_BAR = "video-player-progress-bar";
const CLASS_VIDEO_PLAYER_OPTIONS = "video-player-options";
const CLASS_VIDEO_PLAYER_OPTIONS_MENU = "video-player-options-menu";
const CLASS_VIDEO_PLAYER_TIMESTAMP = "video-player-timestamp";

const CLASS_PLAY_BUTTON_PLAY = "play-button-play";
const CLASS_PLAY_BUTTON_PAUSE = "play-button-pause";

const DAY = 86400;
const HOUR = 3600;
const MINUTE = 60;

const PROGRESS_BAR_MAX = 100;

/**
 * @typedef {object} ControlElements
 * @property {HTMLButtonElement} playButton The play/pause button
 * @property {HTMLSpanElement} timestamp The span displaying the current time
 * @property {HTMLInputElement} progressBar The video progress bar
 * @property {HTMLButtonElement} options Video options
 */



/**
 * Converts seconds into a timestamp, up to 4 spots.
 * @param {number} seconds The number (in seconds) to convert
 * @returns {string} The timestamp
 */
function secondsToTimestamp(seconds) {
    //cite: https://www.satsig.net/training/seconds-days-hours-minutes-calculator.htm
    
    if (seconds < 60)
        return `00:${String(Math.max(seconds, 0)).padStart(2, "0")}`;

    const days = Math.floor(seconds / DAY);
    const hours = Math.floor((seconds - days * DAY) / HOUR);
    const minutes = Math.floor((seconds - days * DAY - hours * HOUR) / MINUTE);
    const rseconds = seconds - days * DAY - hours * HOUR - minutes * MINUTE;

    const parts = [];
    if (days > 0)
        parts.push(String(days).padStart(2, "0"))
    if (hours > 0 || parts.length)
        parts.push(String(hours).padStart(2, "0"))
    parts.push(String(minutes).padStart(2, "0"), String(rseconds).padStart(2, "0"));
    return parts.join(":");
}

/**
 * Creates the elements needed for the custom video controller
 * @returns {ControlElements} The elements
 */
function newPlayerControls() {
    const playButton = document.createElement("button");
    playButton.classList.add(CLASS_VIDEO_PLAYER_CONTROL, CLASS_VIDEO_PLAYER_PLAY_BUTTON, CLASS_PLAY_BUTTON_PLAY);

    const timestamp = document.createElement("span");
    timestamp.innerText = "00:00";
    timestamp.classList.add(CLASS_VIDEO_PLAYER_TIMESTAMP);

    const progressBar = document.createElement("input");
    progressBar.type = "range";
    progressBar.value = 0;
    progressBar.min = 0;
    progressBar.max = PROGRESS_BAR_MAX;
    progressBar.classList.add(CLASS_VIDEO_PLAYER_CONTROL, CLASS_VIDEO_PLAYER_PROGRESS_BAR);

    const videoOptions = document.createElement("button");
    videoOptions.classList.add(CLASS_VIDEO_PLAYER_CONTROL, CLASS_VIDEO_PLAYER_OPTIONS);

    return {
        playButton: playButton,
        timestamp: timestamp,
        progressBar: progressBar,
        options: videoOptions
    }
}

/**
 * Create the option menu for the video controls
 * @returns {HTMLDivElement} The constructed option menu
 */
function createOptionMenu() {
    //TODO create the menu
    const menu = document.createElement("div");
    menu.classList.add(CLASS_VIDEO_PLAYER_OPTIONS_MENU);

    return menu;
}

//cite: https://cloudinary.com/blog/build-a-custom-html5-video-player-with-javascript

/**
 * Initialize a video to use the custom video player
 * @param {HTMLVideoElement} video Video element to control
 * @param {HTMLDivElement} controls Div containing the video controls, should be empty (will be cleared if not empty)
 */
function initVideo(video, controls) {
    while (controls.children.length > 0)
        controls.removeChild(controls.firstChild);

    const controlElements = newPlayerControls();

    //event handlers

    const updateControls = (ev) => {
        controlElements.playButton.classList.toggle(CLASS_PLAY_BUTTON_PLAY, video.paused || video.ended);
        controlElements.playButton.classList.toggle(CLASS_PLAY_BUTTON_PAUSE, !(video.paused || video.ended));
    }

    const togglePlay = (ev) => {
        if (ev.button != 0) return;

        if (video.ended) {
            video.currentTime = 0;
            video.play()
        }
        else if(video.paused)
            video.play()
        else
            video.pause();
    }

    const handleProgress = (ev) => {
        const percent = video.duration > 0 ? (video.currentTime / video.duration) : 0;
        controlElements.progressBar.value = Math.min(Math.floor(percent * PROGRESS_BAR_MAX), PROGRESS_BAR_MAX);
        controlElements.timestamp.innerText = secondsToTimestamp(Math.floor(video.currentTime));
    }

    const setTime = () => {
        const value = Number(controlElements.progressBar.value);
        const percent = Math.max(0, value / PROGRESS_BAR_MAX);
        video.currentTime = Math.min(video.duration * percent, video.duration);
        controlElements.timestamp.innerText = secondsToTimestamp(Math.floor(video.currentTime));
    }

    const optionsMenu = () => {
        //stop if theres already a menu
        if (video.parentElement.querySelector(`.${CLASS_VIDEO_PLAYER_OPTIONS_MENU}`) !== null)
            return;

        const menu = createOptionMenu();
        
        /**
         * Handles removing the options menu when it loses focus
         * @param {MouseEvent} ev The event
         */
        const loseFocusListener = (ev) => {
            if (menu.contains(ev.target) || controlElements.options.contains(ev.target))
                return;
            menu.remove();
            window.removeEventListener("click", loseFocusListener);
        }
    
        window.addEventListener("click", loseFocusListener);

        video.parentElement.appendChild(menu);

        menu.style.right = "0";
        menu.style.bottom = "5px";
    }

    //video events

    video.addEventListener("click", togglePlay);
    video.addEventListener("play", updateControls);
    video.addEventListener("pause", updateControls);
    video.addEventListener("timeupdate", handleProgress)

    //input events

    controlElements.playButton.addEventListener("click", togglePlay);
    controlElements.progressBar.addEventListener("input", setTime);
    controlElements.options.addEventListener("click", optionsMenu);
    
    controls.appendChild(controlElements.playButton);
    controls.appendChild(controlElements.timestamp);
    controls.appendChild(controlElements.progressBar);
    controls.appendChild(controlElements.options);
}