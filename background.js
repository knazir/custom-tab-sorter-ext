function extract(selector, isNumber) {
    const valueText = document.querySelector(selector).innerText;
    return isNumber ? Number(valueText) : valueText;
}

async function sortTabs({ urlRegex: urlRegexStr, valueSelector, sortByNumber, descendingSort }) {
    // Find the tabs we care about based on the regex
    const urlRegex = new RegExp(urlRegexStr);
    const allWindowTabs = await chrome.tabs.query({ currentWindow: true, status: "complete" });
    const tabsOfInterest = allWindowTabs
        .filter(tab => urlRegex.test(tab.url))
        .map(({ id, url }) => { return { id, url }; });

    // Extract the target sort value from each tab
    for (const tabInfo of tabsOfInterest) {
        const [data] = await chrome.scripting.executeScript({
            target: { tabId: tabInfo.id },
            func: extract,
            args: [valueSelector, sortByNumber]
        });
        tabInfo.sortValue = data.result;
    }

    // Sort the tabs based on the extracted value
    let sortedTabInfos;
    if (sortByNumber) {
        sortedTabInfos = tabsOfInterest.sort((a, b) => a.sortValue - b.sortValue);
    } else {
        sortedTabInfos = tabsOfInterest.sort((a, b) => a.sortValue.localeCompare(b.sortValue));
    }
    if (descendingSort) {
        sortedTabInfos = sortedTabInfos.reverse();
    }

    for (let i = 0; i < sortedTabInfos.length; i++) {
        const tabInfo = sortedTabInfos[i];
        try {
            await chrome.tabs.move(tabInfo.id, { index: i });
        } catch {
            console.error(`Failed to reorganize tab ${tab.id}`);
        }
    }
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "sortTabs") {
        sortTabs(req.args).then(() => sendResponse("{ \"success\": true }"));
        return true;
    }
});