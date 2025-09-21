# <img src="icons/128.png" width="32" height="32" align="center"> Tab Sorter — Smart DOM-Based Tab Organization

<div align="center">

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=google-chrome&logoColor=white&style=flat-square)](https://chrome.google.com/webstore)
[![Manifest Version](https://img.shields.io/badge/Manifest-V3-brightgreen?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org/)

**Sort your browser tabs by any value extracted from the page content**
*Prices, ratings, dates, or any custom field — all with a simple CSS selector*

[🚀 Install](#-installation) • [✨ Features](#-features) • [📖 Usage](#-usage) • [🎯 Examples](#-examples)

<img src="icons/icon-header.png" width="128" height="128">

</div>

---

## 🎯 What is Tab Sorter?

Tab Sorter is a Chrome extension that lets you **organize your browser tabs based on actual content from the web pages**. Instead of just sorting by title or URL, you can extract and sort by any value visible on the page — product prices, ratings, dates, or any custom field you specify.

### Perfect for:
- 🛍️ **Shopping** — Sort products by price across multiple stores
- ⭐ **Reviews** — Organize items by ratings (IMDb, Goodreads, etc.)
- 📰 **News** — Sort articles by publication date
- 🏠 **Real Estate** — Order listings by price, size, or location
- 📊 **Research** — Organize any data-heavy tabs by custom criteria

## ✨ Features

### Core Functionality
- 🎨 **Custom CSS Selectors** — Extract any value from any website using standard CSS selectors
- 🔄 **Flexible Sorting** — Sort ascending or descending by text, numbers, prices, or dates
- 🎯 **Smart Filtering** — Use regex patterns to sort only specific tabs
- 👁️ **Preview Mode** — See sorted results before reordering tabs
- 🌓 **Dark Mode** — Matches your system style or toggle between modes

### Advanced Features
- 🔍 **Test Tools** — Test your selectors and regex patterns before sorting
- ⚡ **Right-Click Context Menu** — Select an element on any page to use as sort key

## 📖 Usage

### Basic Workflow

1. **Click the Tab Sorter icon** in your Chrome toolbar
2. **Enter a CSS selector** for the value you want to sort by (e.g., `.price`, `[data-rating]`)
3. **Choose how to parse** the value (text, number, price, or date)
4. **Select sort direction** (ascending or descending)
5. **Click Preview** to see the sorted order
6. **Click Apply Sort** to reorder your tabs

### Using Filters

Add a **URL regex pattern** to sort only specific tabs:
- `.*amazon.*` — Only Amazon tabs
- `.*\.(com|org)$` — Only .com or .org domains
- `https://.*` — Only HTTPS pages

Use the **Test Regex** button to see which tabs match your pattern.

### Quick Selection via Right-Click

1. **Right-click any element** on a webpage
2. Select **"Sort tabs by this field"** from the context menu
3. The extension popup will open with the selector pre-filled
4. Adjust settings if needed and apply

## 🎯 Examples

### E-Commerce Price Comparison
```css
/* Amazon */
.a-price-whole

/* eBay */
.s-item__price

/* Walmart */
[data-automation="product-price"]
```

### Review Sites
```css
/* IMDb */
[data-testid="hero-rating-bar__aggregate-rating__score"]

/* Rotten Tomatoes */
.tomatometer-score

/* Goodreads */
.RatingStatistics__rating
```

### News & Articles
```css
/* Publication dates */
time[datetime]
.article-date
[data-published]

/* View counts */
.view-count
[data-views]
```

### Real Estate
```css
/* Zillow */
[data-test="property-card-price"]

/* Realtor.com */
.Price__Component

/* Redfin */
.homecardV2Price
```

### Project Structure

```
├── src/
│   ├── background/       # Service worker & core logic
│   ├── content/          # Content scripts for DOM access
│   ├── ui/              # React components for popup & options
│   │   ├── popup/       # Extension popup interface
│   │   └── components/  # Shared UI components
│   └── types.ts         # TypeScript type definitions
├── icons/               # Extension icons
├── manifest.json        # Chrome extension manifest
└── vite.config.ts      # Build configuration
```

## 🔒 Privacy & Security

- ✅ **100% Local** — No data ever leaves your browser
- ✅ **No Analytics** — No tracking or telemetry
- ✅ **No External APIs** — Everything runs client-side
- ✅ **Open Source** — Audit the code yourself
- ✅ **Minimal Permissions** — Only requests necessary Chrome APIs

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🐛 Known Issues

- Some dynamically loaded content may require a page refresh before sorting
- Heavily JavaScript-rendered sites may need special handling
- Questionable support for tab groups
