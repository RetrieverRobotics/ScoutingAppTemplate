const CLASS_INPUT_SYSTEM_INPUT = "input-system-input";
const CLASS_INPUT_SYSTEM_PAGE = "input-system-page";
const CLASS_INPUT_SYSTEM_PAGE_CURRENT = "input-system-page-current";
const CLASS_INPUT_SYSTEM_NAVIGATE = "input-system-navigate";
const CLASS_INPUT_SYSTEM_SUBMIT = "input-system-submit";

const EVENT_NAVIGATE = "InputSystem::navigate";

const ATTR_PAGE = "page";

class InputSystem {
    /**
     * Creates a new `InputSystem` instance
     * @param {HTMLElement} root The root element containing all of the Input System pages and inputs
     */
    constructor(root) {
        /** @type {HTMLElement} */
        this.root = root || document.documentElement;
        /** @type {Map<string, any>} */
        this.data = new Map();
        
        this.bound = {}
        this.bound.clearValidity = this.clearValidity.bind(this);
        this.bound.saveInput = this.saveInput.bind(this);
    }

    /**
     * Get the currently visible page
     * @returns {HTMLElement|null} The page element, or `null` if no page is currently visible
     */
    getCurrentPage() {
        return this.root.querySelector(`.${CLASS_INPUT_SYSTEM_PAGE}.${CLASS_INPUT_SYSTEM_PAGE_CURRENT}`);
    }

    /**
     * Set the page with the specified name as the current page
     * @param {string} name The name of the page being set as current
     */
    setCurrentPage(name) {
        const currentPage = this.getCurrentPage();
        if (currentPage !== null)
            currentPage.classList.remove(CLASS_INPUT_SYSTEM_PAGE_CURRENT);

        const nextPage = this.root.querySelector(`.${CLASS_INPUT_SYSTEM_PAGE}[name="${name}"]`);
        nextPage.classList.add(CLASS_INPUT_SYSTEM_PAGE_CURRENT);
    }

    /**
     * Select each navigation/submission element and apply the appropriate event listeners
     * to it. Requires that the navigation element has a `page` attribute set to the desired
     * name of the page to navigate to.
     */
    applyNavigation() {
        this.root.querySelectorAll(`.${CLASS_INPUT_SYSTEM_PAGE}`).forEach(page => {
            page.querySelectorAll(`.${CLASS_INPUT_SYSTEM_NAVIGATE}`).forEach(elm => {
                elm.addEventListener("click", (ev) => {
                    const pagename = elm.getAttribute(ATTR_PAGE);
                    const navigateEvent = new Event(EVENT_NAVIGATE, {bubbles:false, cancelable:true});
                    navigateEvent.page = pagename; //TODO JSDoc so that suggestions work for InputSystemNavigateEvent.page

                    let doNav = true;
                    const inputs = page.querySelectorAll(`.${CLASS_INPUT_SYSTEM_INPUT}`);
                    for (let i = 0; i < inputs.length; i++)
                        doNav = inputs[i].dispatchEvent(navigateEvent) && doNav; //keep true; change when false -> keep false;

                    if (!doNav) return; //event was cancelled: navigateEvent.preventDefault()

                    this.setCurrentPage(pagename);
                });
            });
        });
    }

    /**
     * Add the specified event listeners to the input element
     * with the given name. Event listeners will be passed the element
     * @param {string} name The input name
     * @param {TODO} events The event listeners to add to the element
     */
    addInput(name, events) {
        const elm = this.root.querySelector(`.${CLASS_INPUT_SYSTEM_INPUT}[name="${name}"]`);
        for (const eventName in events) {
            const listener = events[eventName];
            elm.addEventListener(eventName, (ev) => listener(ev, elm));
        }
    }

    /**
     * Element-dependent event listener which clears the element's custom validity
     * @param {Event} ev Event to handle
     * @param {HTMLInputElement} elm Element the event is being handled for
     */
    clearValidity(ev, elm) {
        elm.setCustomValidity("");
    }

    /**
     * Element-dependent event listener which saves the element's current value
     * in the `InputSystem` instance
     * @param {Event} ev Event to handle
     * @param {HTMLInputElement} elm Element the event is being handled for
     */
    saveInput(ev, elm) {
        this.saveValue(elm.name, elm.value);
    }

    /**
     * Save the given value for the input of the specified name.
     * @param {string} name Name of the input to save the value under
     * @param {any} value The value to save
     * @param {boolean} reflect If the change should be reflected in the element this value came from (false by default) (may not work for everything passed in for `value`)
     */
    saveValue(name, value, reflect) {
        this.data.set(name, value);
        if (reflect) {
            const elm = this.root.querySelectorAll(`.${CLASS_INPUT_SYSTEM_INPUT}[name="${name}"]`);
            elm.value = value;
        }
    }
}