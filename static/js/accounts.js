const AccountValidityCheck = {
    OK: 0,
    FAILED: 1,
    ID_EXISTS: 2,
    NAME_MISSING: 3,
    NAME_SHORT: 4,
    NAME_LONG: 5,
    NAME_WRONG: 6,
    EMAIL_MISSING: 7,
    EMAIL_SHORT: 8,
    EMAIL_LONG: 9,
    EMAIL_INVALID: 10,
    EMAIL_WRONG: 11,
    PASSWORD_MISSING: 12,
    PASSWORD_SHORT: 13,
    PASSWORD_LONG: 14,
    PASSWORD_INVALID: 15,
    PASSWORD_WRONG: 16
};


/**
 * 
 * @param {string} message The message reporting any issues with input validity
 * @param {number} code A code representing the validity check that the submission failed, or 0 for success
 */
function setValidityMessage(message, code) {
    /** @type {HTMLInputElement} */
    let elm = null;
    if (code == AccountValidityCheck.OK)
        document.querySelectorAll("input").forEach(elm => elm.setCustomValidity(""));
    else if (code >= AccountValidityCheck.NAME_MISSING && code <= AccountValidityCheck.NAME_WRONG)
        elm = document.querySelector(`input[name="name"]`);
    else if (code >= AccountValidityCheck.EMAIL_MISSING && code <= AccountValidityCheck.EMAIL_WRONG)
        elm = document.querySelector(`input[name="email"]`);
    else if (code >= AccountValidityCheck.PASSWORD_MISSING && code <= AccountValidityCheck.PASSWORD_WRONG)
        elm = document.querySelector(`input[name="password"]`);
    else
        setTimeout(() =>alert(message), 100);

    if (elm) {
        elm.setCustomValidity(message);
        elm.reportValidity();
    }
}

window.addEventListener("load", () => {
    /** @type {HTMLInputElement} */
    const password = document.querySelector(`input[name="password"]`);
    /** @type {HTMLInputElement} */
    const confirmPassword = document.querySelector(`input[name="confirm_password"]`);

    if (confirmPassword) {
        /**
         * Makes sure that the password and confirm_password inputs are the same
         * @param {InputEvent} ev The event to handle
         */
        const matches = (ev) => {
            if (password.value == confirmPassword.value)
                confirmPassword.setCustomValidity("");
            else
                confirmPassword.setCustomValidity("Confirm Password does not match Password.");
        }
        password.addEventListener("change", matches);
        confirmPassword.addEventListener("change", matches);
    }

    document.querySelectorAll("input").forEach(elm => {
        elm.addEventListener("input", () => { elm.setCustomValidity(""); });
    });

    if (VALIDITY_MESSAGE)
        setValidityMessage(VALIDITY_MESSAGE, Number(VALIDITY_CODE));
})