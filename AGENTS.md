# Agent Guide: Paste-to-Markdown

This repository contains a simple, client-side web application for converting clipboard content (HTML/RTF/Text) to Markdown. It is built using vanilla JavaScript, HTML, and CSS.

## Project Structure

- `index.html`: The main entry point and UI structure.
- `assets/`:
  - `clipboard2markdown.js`: Main application logic, handles paste events and UI updates.
  - `to-markdown.js`: Custom conversion logic and utilities.
  - `bootstrap.css`: Styling (Bootstrap 3 based).
- `vendor/`: Third-party libraries (Turndown, Marked, GFM plugin, KaTeX).
- `assets/background.svg`: Background image for the application.
- `e2e/`: Playwright end-to-end tests (`*.spec.js`) and their harness in `e2e/support/`.
- `tests/`: Golden fixtures (`tcN-source.html` → `tcN-perfect.md`) asserted by the E2E tests.

## Build, Lint, and Test Commands

The app itself has no build system and no runtime npm dependencies. npm is used only for the dev-only E2E test tooling in `package.json`.

- **Build**: No build step is required. Changes to JS/CSS/HTML are reflected immediately upon browser refresh.
- **Lint**: No automated linter is configured. Adhere to existing styles. `make check` runs `node --check` on the app scripts.
- **Test**: Playwright E2E tests (Chromium) in `e2e/`. Setup once with `npm install && npx playwright install chromium`.
  - `npm test` runs every spec; `npx playwright test e2e/<name>.spec.js` runs one.
  - `npm run test:coverage` also fails the run when lines, statements or functions drop below 90%, checked per file and in total, for first-party code (`assets/clipboard2markdown.js`, `assets/to-markdown.js`, `i18n/*.js`, inline scripts in `index.html`). This is what CI runs on every pull request (`.github/workflows/e2e.yml`).
  - `node e2e/support/uncovered.js <file-substring> [--from N --to N]` lists uncovered lines from the last run.

## Code Style Guidelines

### General
- Use `'use strict';` inside all JS files.
- Wrap scripts in an Immediately Invoked Function Expression (IIFE) to avoid global namespace pollution.
- Indentation: **2 spaces**.
- Semicolons: **Always use semicolons**.
- Line length: Aim for a reasonable line length (under 100-120 characters).

### Imports and Dependencies
- Runtime dependencies are managed manually in the `vendor/` directory; `package.json` holds dev-only test tooling.
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

### Version Management
- **Automatic Patch Version Bump**: Whenever ANY change or modification is made to the codebase (features, bug fixes, UI adjustments, or refactoring), agents **MUST** automatically bump the patch version (e.g., `v1.0.0` -> `v1.0.1`).
- **Update Footer Version**: Always update the displayed version in `index.html` inside the footer (`<span class="app-version" title="Version vX.Y.Z">vX.Y.Z</span>`).
- **Update Schema Version**: Keep the `"softwareVersion"` field in the JSON-LD schema inside `index.html` synchronized with the current version.
- **Cache-Busting Query Strings**: When modifying JavaScript or CSS files, also update the query string version (e.g., `?v=...`) on the corresponding script or stylesheet tags in `index.html` to avoid browser cache issues.

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
- **Math Rendering (KaTeX)**:
  - Custom `marked` extensions (`blockMath` and `inlineMath`) intercept `$$...$$`, `$...$`, and ````math```` code blocks.
  - Math is rendered locally offline using KaTeX (`vendor/katex/`).
  - Preprocesses pasted HTML (KaTeX, MathJax, MathML, Wikipedia math, and data attributes) into clean Markdown math syntax.
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
5. Add an E2E test for the new rule in the matching `e2e/*.spec.js` file that pastes realistic input and asserts the exact Markdown.

### Modifying the UI
1. Edit `index.html` for HTML structure changes.
2. Update the `<style>` block in `index.html` for CSS changes.
3. For theme-specific changes, ensure you update the `@media (prefers-color-scheme: dark)` section.
4. If adding new tabs, update the tab switching logic in `assets/clipboard2markdown.js`.

### Common Tasks and Troubleshooting
- **Fixing Table Alignment**: Check `turndown-plugin-gfm.js` and the `tr` rule in `clipboard2markdown.js`.
- **Handling New Clipboard Sources**: Log `event.clipboardData.types` in the `paste` event handler to see what formats the new source provides.
### Version Bumping and Pre-commit Checklist
Before finalizing changes, testing, or committing:
1. **Bump Patch Version**: Increment the patch version following Semantic Versioning (e.g., `v1.0.0` -> `v1.0.1`).
2. **Update Footer in `index.html`**: Ensure `<span class="app-version" title="Version vX.Y.Z">vX.Y.Z</span>` matches the new version.
3. **Update Schema in `index.html`**: Ensure `"softwareVersion": "X.Y.Z"` in JSON-LD is updated.
4. **Update Cache Query Strings**: If any JS/CSS assets were changed, bump their `?v=...` query string parameter in `index.html`.

### Verification and Testing
1. Run `npm run test:coverage` and keep it green; add or update E2E tests for every behavior change.
2. For clipboard sources the synthetic paste cannot reproduce, also verify manually: open `index.html` in a local browser (Chrome/Edge/Firefox) and copy content from various sources:
   - Web pages (tables, lists, headings).
   - VS Code (code blocks).
   - Microsoft Word (formatted text, lists).
   - Excel (tables).
   - Copilot CLI or other terminal outputs.
3. Paste into the app and verify the Markdown output in the "Edit" tab.
4. Switch to the "Preview" tab to ensure it renders correctly, follows Bootstrap styling, and is properly sanitized.
5. Check the browser console for any errors or "Matched" logs from `plainTextRules`.

### Writing E2E Tests
- Import `test`/`expect` from `e2e/support/fixtures.js`, which records coverage for `page` and for extra pages opened with the `openPage` fixture.
- Drive the app through `e2e/support/app.js`: `pasteContent()` dispatches a synthetic `paste` event on `#pastebin` with `html`/`text`/`rtf`/`vscode` data, the same entry point a real paste uses.
- Stub `navigator.userAgentData`/`navigator.platform` with `page.addInitScript` whenever shortcuts or their labels are involved; headless Chromium reports the host OS, and CI runs on Linux.
- Stub `navigator.clipboard` with `page.addInitScript` to assert what Copy/Share write.
- Assert exact Markdown with `toBe`, and wait with web-first assertions or `page.clock`.
- When a test exposes a real app bug, keep the test asserting the correct output and mark it `test.fail(true, 'Known bug: ...')` so the suite stays green and flags the fix.
- Parallel runs on one machine need distinct `E2E_PORT`, `E2E_OUTPUT_DIR` and `E2E_COVERAGE_DIR` values.

---
*Note: This file is intended for agentic consumption. Keep it updated as the project evolves.*
