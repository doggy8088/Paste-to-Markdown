# Agent Guide: Paste-to-Markdown

This repository contains a simple, client-side web application for converting clipboard content (HTML/RTF/Text) to Markdown. It is built using vanilla JavaScript, HTML, and CSS.

## Project Structure

- `index.html`: The main entry point and UI structure.
- `assets/`:
  - `clipboard2markdown.js`: Main application logic, handles paste events and UI updates.
  - `to-markdown.js`: Custom conversion logic and utilities.
  - `bootstrap.css`: Styling (Bootstrap 3 based).
- `vendor/`: Third-party libraries (Turndown, Marked, GFM plugin).
- `assets/background.svg`: Background image for the application.

## Build, Lint, and Test Commands

Currently, this project does **not** use a package manager (npm/yarn) or a build system.

- **Build**: No build step is required. Changes to JS/CSS/HTML are reflected immediately upon browser refresh.
- **Lint**: No automated linter is configured. Adhere to existing styles.
- **Test**: No automated tests exist.
  - **Manual Testing**: Open `index.html` in a browser and test different clipboard sources (Web, VS Code, Word, Excel, Plain Text).
  - **Single Test**: To test a specific conversion rule, you can use the browser console to call `turndownService.turndown(html)` or `convert(html)`.

## Code Style Guidelines

### General
- Use `'use strict';` inside all JS files.
- Wrap scripts in an Immediately Invoked Function Expression (IIFE) to avoid global namespace pollution.
- Indentation: **2 spaces**.
- Semicolons: **Always use semicolons**.
- Line length: Aim for a reasonable line length (under 100-120 characters).

### Imports and Dependencies
- Dependencies are managed manually in the `vendor/` directory.
- Add new scripts to `index.html` before the application scripts.
- Order of scripts:
  1. Vendor libraries (Turndown, Marked, etc.)
  2. Custom utilities (`to-markdown.js`)
  3. Main application logic (`clipboard2markdown.js`)
- Prefer vanilla JS over adding new libraries.

### Variables and Types
- Prefer `const` for constants and `let` for variables.
- Avoid using `var` for new code to prevent hoisting issues and ensure block scoping.
- This is a non-TypeScript project; use JSDoc comments for complex function signatures or object structures.
- Use descriptive variable names that reflect the data they hold.

### Naming Conventions
- Variables and functions: `camelCase` (e.g., `updatePreview`, `isSafeUrl`).
- Global constants: `SCREAMING_SNAKE_CASE` (though few are currently used).
- DOM elements: Use descriptive names (e.g., `pastebin`, `output`, `preview`).
- CSS classes: Kebab-case (e.g., `tab-button`, `tab-content`).
- Event handlers: Inline functions or clearly named functions like `handlePaste`.

### DOM Manipulation
- Use `document.querySelector` and `document.querySelectorAll` for selecting elements.
- Use `addEventListener` for event handling instead of `onEvent` properties.
- Use `classList.add`, `classList.remove`, and `classList.toggle` for managing CSS classes.
- Avoid inline event handlers in HTML.

### Error Handling
- Use `try...catch` blocks for operations that might fail (e.g., parsing HTML or complex regex operations).
- Provide fallback values or silent failures for non-critical features.
- Log errors to the console for debugging during development.

### Security
- **XSS Prevention**: When rendering Markdown to the preview, use the `sanitizeHtml` function.
- The `sanitizeHtml` function uses `DOMParser` to parse HTML safely and removes `<script>` tags.
- It also validates URLs in `<a>` and `<img>` tags using `isSafeUrl`.
- **URL Validation**: `isSafeUrl` blocks `javascript:`, `data:`, and other dangerous protocols.
- **Bootstrap Integration**: The sanitizer also adds Bootstrap classes (`table-striped`, `img-responsive`, etc.) to the rendered HTML to ensure consistent styling.
- Never use `innerHTML` with unsanitized user input.

## Key Implementation Details

### Paste Handling
The application listens for `paste` events on a hidden `contenteditable` div (`#pastebin`). It prioritizes clipboard types in this order:
1. `vscode-editor-data`: Handles VS Code code snippets. It extracts `text/plain` and removes the minimum common leading indentation from all lines to keep the code clean.
2. `text/rtf` + `text/html`: Used for content from Microsoft Word, Outlook, or Rich Text editors. Includes specific fixes for common RTF-to-HTML conversion artifacts like bullet point characters (e.g., `ü`).
3. `text/plain` (only if `text/html` is missing): Applies custom `plainTextRules` to identify and format specific text patterns (like Copilot CLI output).
4. `text/html`: Standard web content conversion. It pre-processes the HTML to remove unnecessary tags (like `<p>` inside `<li>`) and normalize line breaks from sources like Excel.

### Markdown Conversion Logic
Conversion is primarily handled by `TurndownService` with the GFM tables plugin.
- **Custom Rules**: Added via `turndownService.addRule` in `assets/clipboard2markdown.js`.
  - `brInTableCell`: Preserves `<br>` inside table cells, as many Markdown flavors (like GFM) support them for multi-line cells.
  - `pandoc`: A collection of rules for Pandoc-style Markdown features:
    - `^sup^` for superscripts.
    - `~sub~` for subscripts.
    - `atx` style headings (`# H1`, `## H2`).
    - Smart punctuation conversion.
- **Smart Punctuation**: The custom `escape` function handles:
  - Converting curly quotes (`“”`, `‘’`) to straight quotes.
  - Normalizing various dash types (`–`, `—`) to Markdown dashes.
  - Converting ellipses (`…`) to triple dots.
  - Cleaning up trailing whitespace and excessive newlines.

### Preview and Theming
- **Marked**: Used to render the Markdown back to HTML in the "Preview" tab.
- **Sanitization**: All output from `marked.parse()` MUST pass through `sanitizeHtml()`.
- **Theming**:
  - UI components use Bootstrap 3 classes.
  - Dark Mode: Supports `prefers-color-scheme: dark` via CSS media queries. The background image changes to `background-dark.svg`, and colors are adjusted for readability.

## Workflow for Agents

### Adding a New Conversion Rule
1. Open `assets/clipboard2markdown.js`.
2. Locate the `turndownService.addRule` calls or the `pandoc` array.
3. Define a new rule with:
   - `filter`: A string (tag name), array of strings, or a function that returns true for matching nodes.
   - `replacement`: A function that returns the Markdown string for that node.
4. If it's a plain text rule (for when no HTML is available), add it to the `plainTextRules` object with a detection function and a transformation function.

### Modifying the UI
1. Edit `index.html` for HTML structure changes.
2. Update the `<style>` block in `index.html` for CSS changes.
3. For theme-specific changes, ensure you update the `@media (prefers-color-scheme: dark)` section.
4. If adding new tabs, update the tab switching logic in `assets/clipboard2markdown.js`.

### Common Tasks and Troubleshooting
- **Fixing Table Alignment**: Check `turndown-plugin-gfm.js` and the `tr` rule in `clipboard2markdown.js`.
- **Handling New Clipboard Sources**: Log `event.clipboardData.types` in the `paste` event handler to see what formats the new source provides.
- **Regex Debugging**: When adding regex-based cleanup in `escape()` or `plainTextRules`, use non-greedy matches where appropriate and test with varied input.

### Verification and Testing
Since there are no automated tests:
1. Open `index.html` in a local browser (Chrome/Edge/Firefox).
2. Copy content from various sources:
   - Web pages (tables, lists, headings).
   - VS Code (code blocks).
   - Microsoft Word (formatted text, lists).
   - Excel (tables).
   - Copilot CLI or other terminal outputs.
3. Paste into the app and verify the Markdown output in the "Edit" tab.
4. Switch to the "Preview" tab to ensure it renders correctly, follows Bootstrap styling, and is properly sanitized.
5. Check the browser console for any errors or "Matched" logs from `plainTextRules`.

---
*Note: This file is intended for agentic consumption. Keep it updated as the project evolves.*
