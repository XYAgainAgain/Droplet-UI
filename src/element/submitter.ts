// jelly-button answers true under this key while it is a submit button. Implicit submission
// checks it instead of reading `type` off whatever form-associated element comes first.
export const SUBMIT_BUTTON: unique symbol = Symbol('jelly-submit-button');
