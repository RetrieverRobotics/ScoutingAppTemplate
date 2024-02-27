
/**
 * Loads video contents from youtube
 * @param {string} id The youtube video ID
 * @param {number} start The time, in seconds, to begin loading from
 * @param {number} duration The number of seconds to load, starting from `start`
 * @returns {BLOB} The video contents loaded
 */
function loadYoutube(id, start, duration) {
    if (start == undefined) start = 0;

    const url = new URL(`https://youtube.com/watch`);
    url.searchParams.set("v", id);
}