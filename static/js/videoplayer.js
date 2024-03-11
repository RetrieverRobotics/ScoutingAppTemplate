
const CLASS_VIDEO_PLAYER_CONTROL = "video-player-control";
const CLASS_VIDEO_PLAYER_PLAY_BUTTON = "video-player-play-button";
const CLASS_VIDEO_PLAYER_VOLUME_CONTROL = "video-player-volume-control"
const CLASS_VIDEO_PLAYER_PROGRESS_BAR = "video-player-progress-bar";
const CLASS_VIDEO_PLAYER_OPTIONS = "video-player-options";
const CLASS_VIDEO_PLAYER_OPTIONS_MENU = "video-player-options-menu";
const CLASS_VIDEO_PLAYER_TIMESTAMP = "video-player-timestamp";
const CLASS_VIDEO_PLAYER_DURATION = "video-player-duration";
const CLASS_OPTIONS_DOWNLOAD = "options-download";
const CLASS_OPTIONS_PLAYBACK_SPEED = "options-playback-speed";

const CLASS_PLAY_BUTTON_PLAY = "play-button-play";
const CLASS_PLAY_BUTTON_PAUSE = "play-button-pause";
const CLASS_PLAY_BUTTON_REPLAY = "play-button-replay";
const CLASS_VOLUME_MUTED = "volume-muted";
const CLASS_OPTIONS_PLAYBACK_SPEED_INPUT = "playback-speed-input";
const CLASS_VIDEO_FOCUSED = "video-focused";

const DAY = 86400;
const HOUR = 3600;
const MINUTE = 60;

const PROGRESS_BAR_MAX = 100;

/**
 * @typedef {object} ControlElements The elements that make up a `CustomVideo`'s controls
 * @property {HTMLButtonElement} playButton The play/pause button
 * @property {HTMLButtonElement} volume The volume controller
 * @property {HTMLSpanElement} timestamp The span displaying the current time
 * @property {HTMLSpanElement} totalTime The span displaying the total duration of the video
 * @property {HTMLInputElement} progressBar The video progress bar
 * @property {HTMLButtonElement} options Video options
 */

/**
 * @typedef {object} CustomVideo A custom video player
 * @property {Video} video The video element
 * @property {HTMLDivElement} controls The container for all of the controls
 * @property {ControlElements} controlElements All of the control elements for the video
 * @property {HTMLDivElement} container The container for the video and control elements
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
    const playButtonIcon = document.createElement("img");
    playButtonIcon.loading = "eager";
    playButton.classList.add(CLASS_VIDEO_PLAYER_CONTROL, CLASS_VIDEO_PLAYER_PLAY_BUTTON, CLASS_PLAY_BUTTON_PLAY);
    playButton.appendChild(playButtonIcon);

    const volume = document.createElement("button");
    const volumeIcon = document.createElement("img");
    volume.classList.add(CLASS_VIDEO_PLAYER_CONTROL, CLASS_VIDEO_PLAYER_VOLUME_CONTROL);
    volumeIcon.loading = "eager";
    volume.appendChild(volumeIcon);

    const timestamp = document.createElement("span");
    timestamp.innerText = "00:00";
    timestamp.classList.add(CLASS_VIDEO_PLAYER_TIMESTAMP);

    const totalTime = document.createElement("span");
    totalTime.classList.add(CLASS_VIDEO_PLAYER_DURATION);

    const progressBar = document.createElement("input");
    progressBar.type = "range";
    progressBar.value = 0;
    progressBar.min = 0;
    progressBar.max = PROGRESS_BAR_MAX;
    progressBar.classList.add(CLASS_VIDEO_PLAYER_CONTROL, CLASS_VIDEO_PLAYER_PROGRESS_BAR);

    const options = document.createElement("button");
    const optionsIcon = document.createElement("img");
    options.classList.add(CLASS_VIDEO_PLAYER_CONTROL, CLASS_VIDEO_PLAYER_OPTIONS);
    optionsIcon.loading = "eager";
    options.appendChild(optionsIcon);

    return {
        playButton: playButton,
        volume: volume,
        timestamp: timestamp,
        totalTime: totalTime,
        progressBar: progressBar,
        options: options
    }
}

/**
 * Create the option menu for the video controls
 * @param {HTMLVideoElement} video The video the options menu is for
 * @returns {HTMLDivElement} The constructed option menu
 */
function createOptionMenu(video) {

    //create elements

    const menu = document.createElement("div");
    const optionsList = document.createElement("ul");

    const playbackSpeed = document.createElement("div");
    const playbackSpeedFront = document.createElement("div");
    const playbackSpeedIcon = document.createElement("img");
    const playbackSpeedText = document.createElement("span");
    const playbackSpeedInput = document.createElement("input");

    const downloadButton = document.createElement("a");
    const downloadButtonIcon = document.createElement("img");
    const downloadButtonText = document.createElement("span");

    //add classes

    menu.classList.add(CLASS_VIDEO_PLAYER_OPTIONS_MENU);
    playbackSpeed.classList.add(CLASS_OPTIONS_PLAYBACK_SPEED);
    downloadButton.classList.add(CLASS_OPTIONS_DOWNLOAD);

    //set values

    playbackSpeedIcon.loading = "eager";
    playbackSpeedText.innerText = "Playback Speed";
    playbackSpeedInput.type = "number";
    playbackSpeedInput.value = video.playbackRate;
    playbackSpeedInput.step = "any";

    const linksplit = new URL(video.src).pathname.split("/");
    downloadButton.href = video.src;
    if (video.src.includes("/clips/load"))
    downloadButton.download = `${linksplit[linksplit.length-2]}__${linksplit[linksplit.length-1]}` //download name = "{groupname}__{clipname}"
    downloadButton.loading = "eager";
    downloadButtonText.innerText = "Download";

    //event listeners

    /**
     * Take the value from the speed input and set that as the video playback rate
     */
    const commitSpeed = () => {
        if (playbackSpeedInput.checkValidity()) {
            try {
                video.playbackRate = Number(playbackSpeedInput.value);
                playbackSpeed.classList.remove(CLASS_OPTIONS_PLAYBACK_SPEED_INPUT);
            }
            catch (err) {
                console.error(err);
                alert(`Playback speed '${playbackSpeedInput.value}' is not supported.`);
            }
        }
        playbackSpeedInput.value = video.playbackRate;
    };

    playbackSpeed.addEventListener("click", /** @param {MouseEvent} ev */ (ev) => {
        if (playbackSpeed.classList.contains(CLASS_OPTIONS_PLAYBACK_SPEED_INPUT))
            return;
        playbackSpeedInput.value = video.playbackRate;
        playbackSpeed.classList.add(CLASS_OPTIONS_PLAYBACK_SPEED_INPUT);
        playbackSpeedInput.focus();
        ev.stopPropagation();
    });

    playbackSpeedInput.addEventListener("keydown", (ev) => {
        if (ev.key == "Enter")
            commitSpeed();
        else if (ev.key == "Escape") {
            playbackSpeedInput.value = video.playbackRate;
            playbackSpeed.classList.remove(CLASS_OPTIONS_PLAYBACK_SPEED_INPUT);
        }
    });

    menu.addEventListener("click", (ev) => {
        if (!playbackSpeed.classList.contains(CLASS_OPTIONS_PLAYBACK_SPEED_INPUT) || ev.target == playbackSpeedInput)
            return;
        playbackSpeedInput.value = video.playbackRate;
        playbackSpeed.classList.remove(CLASS_OPTIONS_PLAYBACK_SPEED_INPUT);
        ev.stopPropagation();
    });

    //combine elements

    playbackSpeedFront.appendChild(playbackSpeedText);
    playbackSpeed.appendChild(playbackSpeedIcon);
    playbackSpeed.appendChild(playbackSpeedFront);
    playbackSpeed.appendChild(playbackSpeedInput);
    const playbackSpeedLi = document.createElement("li");
    playbackSpeedLi.appendChild(playbackSpeed);

    downloadButton.appendChild(downloadButtonIcon);
    downloadButton.appendChild(downloadButtonText);
    const downloadLi = document.createElement("li");
    downloadLi.appendChild(downloadButton);

    optionsList.appendChild(playbackSpeedLi);
    if (video.controlsList == undefined || !video.controlsList.contains("nodownload"))
        optionsList.appendChild(downloadLi);

    menu.appendChild(optionsList);
    return menu;
}

//cite: https://cloudinary.com/blog/build-a-custom-html5-video-player-with-javascript

/**
 * Initialize a video to use the custom video player
 * @param {HTMLVideoElement} video Video element to control
 * @param {HTMLDivElement} controls Div containing the video controls, should be empty (will be cleared if not empty)
 * @param {HTMLDivElement} container Div containing the video and video controls
 * @returns {CustomVideo} The initialized custom video
 */
function initVideo(video, controls, container) {
    while (controls.children.length > 0)
        controls.removeChild(controls.firstChild);

    const controlElements = newPlayerControls();
    const inbetween = document.createElement("span");
    inbetween.innerText = "/";

    //event handlers

    /**
     * Update the play button to match the current video status
     */
    const updatePlayButton = () => {
        controlElements.playButton.classList.toggle(CLASS_PLAY_BUTTON_PLAY, video.paused && !video.ended);
        controlElements.playButton.classList.toggle(CLASS_PLAY_BUTTON_PAUSE, !(video.paused || video.ended));
        controlElements.playButton.classList.toggle(CLASS_PLAY_BUTTON_REPLAY, video.ended);
    }

    /**
     * Toggle the video between play and pause
     * @param {MouseEvent} ev The event to handle
     */
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
    };

    /**
     * Update the video controls every time the video progresses (currentTime changes)
     */
    const handleProgress = () => {
        //progress bar and timetamp
        const percent = video.duration > 0 ? (video.currentTime / video.duration) : 0;
        controlElements.progressBar.value = Math.min(Math.floor(percent * PROGRESS_BAR_MAX), PROGRESS_BAR_MAX);
        controlElements.timestamp.innerText = secondsToTimestamp(Math.floor(video.currentTime));

        //volume appearance
        controlElements.volume.classList.toggle(CLASS_VOLUME_MUTED, video.muted);
    };

    /**
     * Begin seeking through the video; temporarily pauses the video if it was playing
     */
    const beginSeekTime = () => {
        if (controlElements.progressBar.wasPlaying === undefined) {
            controlElements.progressBar.wasPlaying = !video.paused || video.ended;
            video.pause();
        }
    };

    /**
     * Set the video's currentTime to the seeked time
     */
    const setTime = () => {
        const value = Number(controlElements.progressBar.value);
        const percent = Math.max(0, value / PROGRESS_BAR_MAX);
        video.currentTime = Math.min(video.duration * percent, video.duration);
        controlElements.timestamp.innerText = secondsToTimestamp(Math.floor(video.currentTime));
    };

    /**
     * Finish seeking through the video; undo the temporary pause if applicable
     */
    const commitTime = () => {
        if (controlElements.progressBar.wasPlaying) {
            video.play();
            controlElements.progressBar.wasPlaying = undefined;
        }
    };

    /**
     * Display the options menu
     */
    const optionsMenu = () => {
        //stop if theres already a menu
        if (video.parentElement.querySelector(`.${CLASS_VIDEO_PLAYER_OPTIONS_MENU}`) == null) {
            const menu = createOptionMenu(video);
        
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
            controlElements.options.loseFocusListener = loseFocusListener;

            video.parentElement.appendChild(menu);
        }
        else if (controlElements.options.loseFocusListener !== undefined) {
            //calling with an empty object means that event.target === undefined, which leads to the early stop check being false
            controlElements.options.loseFocusListener({});
            controlElements.options.loseFocusListener = undefined;
        }
    };

    /**
     * Apply focus to the video player (for keyboard controls)
     * @param {MouseEvent} ev The event to handle
     */
    const checkFocus = (ev) => {
        if (container.contains(ev.target))
            container.classList.add(CLASS_VIDEO_FOCUSED);
    }

    /**
     * Controls the video player with keypresses if the videoplayer is set as focused
     * @param {KeyboardEvent} ev The event to handle
     */
    const keyboardControls = (ev) => {
        if (!container.classList.contains(CLASS_VIDEO_FOCUSED)) return; //dont handle

        switch(ev.key) {
            case " ":
            case "k":
            case "MediaPlayPause":
                if (video.paused || video.ended)
                    video.play();
                else video.pause();
                break;
            case "ArrowLeft":
                if (video.ended) {
                    video.currentTime = 0;
                    video.play();
                }
                else
                    video.currentTime = Math.max(0, video.currentTime - 5 * video.playbackRate);
                break;
            case "ArrowRight":
                if (video.ended) {
                    video.currentTime = 0;
                    video.play();
                }
                else
                    video.currentTime = Math.min(video.duration, video.currentTime + 5 * video.playbackRate);
                break;
            case "j":
                if (video.ended) {
                    video.currentTime = 0;
                    video.play();
                }
                else
                    video.currentTime = Math.max(0, video.currentTime - 10 * video.playbackRate);
                break;
            case "l":
                if (video.ended) {
                    video.currentTime = 0;
                    video.play();
                }
                else
                    video.currentTime = Math.min(video.duration, video.currentTime + 10 * video.playbackRate);
                break;
            case ",":
                if (video.ended) {
                    video.currentTime = 0;
                    video.play();
                }
                else
                    video.currentTime = Math.max(0, video.currentTime - 0.1 * video.playbackRate);
                break;
            case ".":
                if (video.ended) {
                    video.currentTime = 0;
                    video.play();
                }
                else
                    video.currentTime = Math.min(video.duration, video.currentTime + 0.1 * video.playbackRate);
                break;
            case "MediaPlay":
                if (video.paused || video.ended)
                    video.play();
                break;
            case "MediaPause":
                if (!video.paused && !video.ended)
                    video.pause();
                break;
            // TODO implement volume up/down? would need a slider added to the volume button
            // case "AudioVolumeUp":
            // case "VolumeUp":
            //     break;
            // case "AudioVolumeDown":
            // case "VolumeDown":
            //     break;
            case "m":
            case "AudioVolumeMute":
            case "VolumeMute":
                video.muted = !video.muted;
                controlElements.volume.classList.toggle(CLASS_VOLUME_MUTED, video.muted);
                break;
            default:
                return;
        }

        ev.stopPropagation(); //eat the event
    } 

    //video events

    video.addEventListener("loadedmetadata", (ev) => {
        controlElements.totalTime.innerText = secondsToTimestamp(Math.floor(video.duration));
    });
    video.addEventListener("click", togglePlay);
    video.addEventListener("play", updatePlayButton);
    video.addEventListener("pause", updatePlayButton);
    video.addEventListener("timeupdate", handleProgress)

    //input events

    controlElements.playButton.addEventListener("click", togglePlay);

    controlElements.volume.addEventListener("click", () => {
        video.muted = !video.muted;
        controlElements.volume.classList.toggle(CLASS_VOLUME_MUTED, video.muted);
    })

    controlElements.progressBar.addEventListener("mousedown", beginSeekTime);
    controlElements.progressBar.addEventListener("input", setTime);
    controlElements.progressBar.addEventListener("change", commitTime);

    controlElements.options.addEventListener("click", optionsMenu);


    //global events (need to be de-initialized)

    window.addEventListener("click", checkFocus);
    window.addEventListener("keydown", keyboardControls);
    

    
    controls.appendChild(controlElements.playButton);
    controls.appendChild(controlElements.volume);
    controls.appendChild(controlElements.timestamp);
    controls.appendChild(inbetween);
    controls.appendChild(controlElements.totalTime);
    controls.appendChild(controlElements.progressBar);
    controls.appendChild(controlElements.options);

    return {
        video: video,
        controls: controls,
        controlElements: controlElements,
        container: container,
        globalEvents: {
            checkFocus: checkFocus,
            keyboardControls: keyboardControls
        }
    }
}

/**
 * De-initialze a custom video player
 * @param {CustomVideo} customVideo The initialized custom video to de-initialize
 */
function deInitVideo(customVideo) {
    window.removeEventListener("click", customVideo.globalEvents.checkFocus);
    window.removeEventListener("keydown", customVideo.globalEvents.keyboardControls);
}
