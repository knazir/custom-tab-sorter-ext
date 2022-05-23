# Custom Tab Sorter Extension
A Google Chrome extension that sorts your tabs using a custom value in each tab specified by a CSS selector.


## Options
- **URL Regex**: A [regular expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions) used to specify which tabs will be sorted.
- **Value Selector**: A [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors) that will specify what value will be extracted from each tab to sort by. This will extract the `textContent` of the first element matching the selector.
- **Numeric Sort**: Whether the value extracted and sorted by will be considered as a number.
- **Descending Sort**: Specifies if the tabs should be ordered from highest to lowest if checked.


## Rationale
When I'm searching for something (e.g. something to read, something to buy), I usually open a ton of tabs and then manually sort them by their rating to see which ones are the best. This extension was just to automate that process because it was starting to become a pain when I would open 30+ tabs...


## TODO
- [ ] Show information about how many tabs were found and sorted
- [ ] Show information about how many tabs matched the search but were unloaded
- [ ] Add custom code for post-processing selector value string (e.g. for formatting)
