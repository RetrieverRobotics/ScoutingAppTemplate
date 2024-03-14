const CLASS_INPUT_SYSTEM_INPUT = "input-system-input";
const CLASS_INPUT_SYSTEM_PAGE = "input-system-page";
const CLASS_INPUT_SYSTEM_PAGE_CURRENT = "input-system-page-current";
const CLASS_INPUT_SYSTEM_NAVIGATE = "input-system-navigate";
const CLASS_INPUT_SYSTEM_SUBMIT = "input-system-submit";

const EVENT_NAVIGATE = "InputSystem::navigate";
const EVENT_SUBMIT = "InputSystem::submit";

const ATTR_PAGE = "page";

/**
 * @typedef {object} InputSystemNavigateEvent 
 * @extends Event
 * @property {string} page 
 */

/**
 * @typedef {Event} InputSystemSubmissionEvent Event for submitting data collected by the InputSystem
 */

/**
 * A custom InputSystem event
 */
class InputSystemEvent extends Event {
    /**
     * @param {string} type Event name
     * @param {EventInit|undefined} init Event initialization options; includes `inputSystem` property
     */
    constructor(type, init) {
        const sys = init?.inputSystem || null;
        delete init.inputSystem;
        super(type, init);
        /** @type {InputSystem} InputSystem that this event is relevant to */
        this.inputSystem = sys;
    }
}

/**
 * Input System event dispatched to Input System inputs of the current page
 * before navigating to another Input System page
 */
class InputSystemNavigateEvent extends InputSystemEvent {
    /**
     * @param {string} type Event name
     * @param {EventInit|undefined} init Event initialization options; includes `page` property
     */
    constructor(type, init) {
        const page = init?.page || null;
        delete init.page;
        super(type, init);
        /** @type {string} Name of the page being navigated to */
        this.page = page;
    }
}

/**
 * Input System event dispatched to all Input System inputs before submitting
 * the collected data
 */
class InputSystemSubmissionEvent extends InputSystemEvent { }

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
     * Select each navigation element and apply the appropriate event listeners
     * to it. Requires that the navigation element has a `page` attribute set to the desired
     * name of the page to navigate to.
     */
    applyNavigation() {
        this.root.querySelectorAll(`.${CLASS_INPUT_SYSTEM_PAGE}`).forEach(page => {
            page.querySelectorAll(`.${CLASS_INPUT_SYSTEM_NAVIGATE}`).forEach(elm => {
                elm.addEventListener("click", () => {
                    const pagename = elm.getAttribute(ATTR_PAGE);
                    const navigateEvent = new InputSystemNavigateEvent(EVENT_NAVIGATE, {bubbles:false, cancelable:true, page:pagename});

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
     * Select each submission element and apply the appropriate event listeners to it.
     * The submission event listener will dispatch an event to each element in the input system's root marked with
     * the `input-system-input` class.
     * @param {function|undefined} success An optional callback with no parameters-- called when submission was not canceled and there were no invalid inputs
     * @param {function|undefined} cancel An optional callback with no parameters-- called when submission was interrupted
     */
    applySubmission(success, cancel) {
        this.root.querySelectorAll(`.${CLASS_INPUT_SYSTEM_SUBMIT}`).forEach(submittionElm => {
            submittionElm.addEventListener("click", () => {
                const inputs = this.root.querySelectorAll(`.${CLASS_INPUT_SYSTEM_INPUT}`);
                const submitEvent = new InputSystemSubmissionEvent(EVENT_SUBMIT, {bubbles:false, cancelable:true})

                let doSubmit = true;
                for (let i = 0; i < inputs.length; i++)
                    doSubmit = inputs[i].dispatchEvent(submitEvent) && (!"reportValidity" in inputs[i] || inputs[i].reportValidity()) && doSubmit;

                if (!doSubmit) return; //cancelled / doesnt get submitted anywhere

                if (doSubmit && success)
                    success();
                else if (!doSubmit && cancel)
                    cancel(); //NOTE: to get invalid inputs, use `inputSystem.root.querySelectAll(".input-system-input:invalid")`
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