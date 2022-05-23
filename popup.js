/***** Form Setup *****/

const urlRegexInput = setupInputListener("urlRegex", "", false);
const valueSelectorInput = setupInputListener("valueSelector", "", false);
const sortByNumberCheckbox = setupInputListener("sortByNumber", true, true);
const descendingSortCheckbox = setupInputListener("descendingSort", false, true);

const sortButton = document.querySelector("#sortButton");
sortButton.addEventListener("click", () => {
    // Save most-recent arguments to local storage
    const args = {
        urlRegex: urlRegexInput.value,
        valueSelector: valueSelectorInput.value,
        sortByNumber: sortByNumberCheckbox.checked,
        descendingSort: descendingSortCheckbox.checked
    };
    setLocalStorage(args);
    chrome.runtime.sendMessage({ action: "sortTabs", args });
});

/***** Helpers *****/

function getLocalStorage(keys) {
    const args = {};
    for (const [key, defaultValue] of Object.entries(keys)) {
        const storedValue = localStorage[key];
        args[key] = storedValue == null ? defaultValue : storedValue;
    }
    return args;
}

function setLocalStorage(args) {
    for (const [key, value] of Object.entries(args)) {
        localStorage[key] = value;
    }
}

function setupInputListener(key, defaultValue, isCheckbox) {
    const input = document.querySelector(`#${key}`);
    
    let storedValue = getLocalStorage({ [key]: defaultValue })[key];
    if (isCheckbox) {
        input.checked = storedValue === "true";
    } else {
        input.value = storedValue;
    }

    input.addEventListener("change", (event) => {
        if (event.target.value != null) {
            setLocalStorage({ [key]: isCheckbox? event.target.checked : event.target.value });
        }
    });

    return input;
}
