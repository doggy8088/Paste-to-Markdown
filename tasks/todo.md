# 2026-05-31 social_assets

- [x] Restate goal + acceptance criteria
  - Create PNG OpenGraph image that renders well on Facebook/Twitter.
  - Create favicon.ico for the site.
  - Create ultra-wide README banner and reference it from README.md.
  - Publish assets through the static GitHub Pages site.
- [x] Locate existing implementation / patterns
  - Static site, no build step.
  - `index.html` currently links the upstream favicon URL.
  - README has no banner.
- [x] Design: minimal approach + key decisions
  - Store generated assets under `assets/` with stable filenames.
  - Use `https://p2m.gh.miniasp.com/assets/og-image.png` for crawler-safe OG/Twitter URLs.
  - Keep `favicon-source.png` for future icon regeneration and publish `favicon.ico` for browsers.
- [x] Implement smallest safe slice
  - Generated project assets and wired them into static site metadata/README.
- [x] Add/adjust tests
  - No automated test harness exists for this static site; used deterministic asset inspection instead.
- [x] Run verification (lint/tests/build/manual repro)
  - Verified PNG/ICO formats, dimensions, favicon embedded sizes, metadata references, and README image reference.
- [x] Summarize changes + verification story
- [x] Record lessons (if any)

## Risk & Rollback
- Risk level: low.
- Affected components: static metadata and image assets only.
- Rollback strategy: revert `index.html`, `README.md`, and remove newly added image files.

## Dependencies & Environment
- No package manager or build step.
- Uses local/static browser loading for verification.
- Image assets generated with built-in imagegen, then copied into `assets/`.

## Working Notes
- Use standard social preview size `1200x630` for OG/Twitter compatibility.
- Use an `.ico` containing multiple square sizes if local tooling supports it.

## Results
- Added `assets/og-image.png` at 1200x630 for Facebook/Twitter previews.
- Added `assets/favicon.ico` with 16, 32, 48, 64, 128, and 256 px entries.
- Added `assets/favicon-source.png` for future favicon regeneration.
- Added `assets/readme-banner.png` at 2400x600 and referenced it at the top of `README.md`.
- Updated `index.html` with description, OpenGraph, Twitter Card, and local favicon tags.

# 2026-05-31 modern_ui_theme_redesign

- [x] Restate goal + acceptance criteria
  - Redesign the static Paste to Markdown page with a modern, clean product UI.
  - Support light and dark modes.
  - Add a top-right theme switcher with System default and explicit Light/Dark choices.
  - Default behavior follows `prefers-color-scheme` until the user chooses an override.
  - Preserve existing paste conversion, language selector, edit/preview tabs, and keyboard shortcuts.
- [x] Locate existing implementation / patterns
  - Static site, no build system.
  - `index.html` contains all page CSS and markup.
  - `assets/clipboard2markdown.js` owns tabs, paste behavior, preview updates, and DOM event setup.
  - Existing i18n uses `data-i18n` and language scripts loaded from `i18n/`.
- [x] Design: minimal approach + key decisions
  - Use a product-workspace layout: app header, right-aligned controls, concise instructions, editor/preview work area.
  - Use CSS variables for the theme palette, with explicit body fallback styles for reliable live theme switching.
  - Keep the hidden paste target out of the layout flow so it does not distort the grid.
- [x] Implement smallest safe slice
  - Reworked `index.html` markup and inline CSS.
  - Added theme choice persistence and ARIA state updates in `assets/clipboard2markdown.js`.
- [x] Add/adjust tests
  - No automated harness exists; used static syntax checks and browser interaction checks.
- [x] Run verification (lint/tests/build/manual repro)
  - `node --check assets/clipboard2markdown.js` passed.
  - `node --check i18n/index.js` passed.
  - `node .agents/skills/impeccable/scripts/detect.mjs --json index.html` returned `[]`.
  - Contrast spot checks passed: light body 15.27, light muted 5.78, dark body 16.74, dark muted 8.60.
  - Browser checks on `http://localhost:8010/index.html?v=3` verified visible workspace, hidden paste target removed from layout flow, theme controls, tab ARIA state, empty preview, and Markdown preview rendering.
- [x] Summarize changes + verification story
- [x] Record lessons (if any)

## Risk & Rollback
- Risk level: medium.
- Affected components: single static HTML page, inline CSS, and main browser script.
- Rollback strategy: revert `index.html`, `assets/clipboard2markdown.js`, `PRODUCT.md`, and this task note.

## Dependencies & Environment
- No package manager or build step.
- Manual/static verification is required in a browser.
- Theme state can use `localStorage`; failure should fall back to system preference.

## Working Notes
- Visual thesis: a restrained editor workspace with crisp surfaces, clear tabs, and a compact command bar.
- Content plan: concise app header, short workflow steps, primary paste/edit/preview workspace, local-only trust note.
- Interaction thesis: theme segmented control with immediate feedback, tab state transitions, focused paste surface states with reduced-motion support.

## Results
- Added `PRODUCT.md` required by the `impeccable` setup flow.
- Redesigned the page into a modern product workspace with responsive layout and cleaner hierarchy.
- Added a top-right theme switcher with System, Light, and Dark choices.
- System mode follows `prefers-color-scheme`; Light/Dark are persisted with `localStorage`.
- Preserved existing language selector, edit/preview tabs, preview sanitization path, and keyboard tab shortcuts.

# 2026-05-31 layout_seo_background_polish

- [x] Restate goal + acceptance criteria
  - Fix messy "How to use" layout.
  - Add SEO meta tags and improve SEO quality.
  - Finish project-bound light/dark background assets generated with `imagegen`.
- [x] Locate existing implementation / patterns
  - `index.html` owns metadata, layout markup, and page CSS.
  - `i18n/en.js` rewrites English How-to text after load.
  - Theme switching in `assets/clipboard2markdown.js` applies explicit body theme fallback styles.
- [x] Design: minimal approach + key decisions
  - Keep instructions as compact utility rows, not a decorative card grid.
  - Use generated backgrounds as subtle page material only, with overlay protection for readability.
  - Use standard SEO primitives: descriptive title/description, canonical, robots, social image alt text, theme colors, and WebApplication JSON-LD.
- [x] Implement smallest safe slice
  - Reworked `.steps li` so inline text and `<code>` chips no longer become separate grid items.
  - Shortened English instruction copy.
  - Added `assets/workspace-bg-light.png` and `assets/workspace-bg-dark.png`.
  - Wired background images into light/dark/system theme CSS and JS fallback styles.
  - Added SEO/social/structured metadata in `index.html`.
- [x] Add/adjust tests
  - No automated test harness exists; used syntax, static, structured-data parsing, detector, and browser checks.
- [x] Run verification (lint/tests/build/manual repro)
  - `node --check assets/clipboard2markdown.js` passed.
  - `node --check i18n/en.js` passed.
  - JSON-LD parsed as `WebApplication Paste to Markdown 5`.
  - `node .agents/skills/impeccable/scripts/detect.mjs --json index.html` returned `[]`.
  - Browser check on `http://localhost:8010/index.html?v=7` verified light/dark background URLs and compact step heights around 42-43px.
- [x] Summarize changes + verification story
- [x] Record lessons (if any)

## Risk & Rollback
- Risk level: low to medium.
- Affected components: static page metadata, CSS, one English i18n file, theme JS, and two image assets.
- Rollback strategy: revert `index.html`, `i18n/en.js`, `assets/clipboard2markdown.js`, and remove `assets/workspace-bg-*.png`.

## Results
- "How to use" now renders as compact, readable rows instead of broken grid fragments.
- SEO metadata now describes the converter's real clipboard sources and local-only behavior.
- Light and dark modes use separate generated raster backgrounds while keeping panel readability.

# 2026-06-01 platform_shortcuts_background_redesign

- [x] Restate goal + acceptance criteria
  - "How to use" shortcuts must automatically match Windows/Linux or macOS.
  - Shortcut hints must not show both platforms with "or".
  - All locale files must be adjusted to the platform-aware shortcut model.
  - Redesign the background with `imagegen` so light and dark modes have more refined technical detail.
- [x] Locate existing implementation / patterns
  - `i18n/index.js` controls translation replacement through `data-i18n`.
  - All locale files define `step1`, `step2`, and `step5` with shortcut copy.
  - `assets/clipboard2markdown.js` already detects the platform for tab shortcut tooltips.
  - `index.html` and theme JS reference `assets/workspace-bg-light.png` and `assets/workspace-bg-dark.png`.
- [x] Design: minimal approach + key decisions
  - Use placeholder tokens such as `{copyShortcut}` in all locales, then inject platform-specific `<code>` labels centrally.
  - Keep translations natural while removing dual-platform wording.
  - Replace the existing background PNGs with richer light/dark generated images featuring tech wave lines, data dots, and document layers.
- [x] Implement smallest safe slice
  - Added `i18n.shortcutLabels()` and interpolation in `i18n/index.js`.
  - Updated all locale files under `i18n/`.
  - Updated fallback HTML copy in `index.html`.
  - Replaced `assets/workspace-bg-light.png` and `assets/workspace-bg-dark.png` with new `imagegen` outputs.
  - Added cache-busting query strings to all i18n scripts and the app script.
- [x] Add/adjust tests
  - No automated test harness exists; used syntax checks, static grep checks, VM simulation, detector checks, and browser verification.
- [x] Run verification (lint/tests/build/manual repro)
  - `node --check` passed for every `i18n/*.js` file.
  - `node --check assets/clipboard2markdown.js` passed.
  - Static grep found no hard-coded Windows/macOS shortcut alternatives in `step1`, `step2`, or `step5`.
  - VM simulation proved `Win32` renders Ctrl/Alt shortcuts and `MacIntel` renders `⌘`/Option shortcuts.
  - Browser verification on `http://localhost:8010/index.html?v=20260601-final2` confirmed versioned locale scripts, no "or" wording in shortcut steps, and correct light/dark background URLs.
  - `node .agents/skills/impeccable/scripts/detect.mjs --json index.html` returned `[]`.
- [x] Summarize changes + verification story
- [x] Record lessons (if any)

## Risk & Rollback
- Risk level: medium.
- Affected components: all i18n locale files, theme script behavior, page script loading, and two PNG background assets.
- Rollback strategy: revert `index.html`, `i18n/`, `assets/clipboard2markdown.js`, and restore the previous `assets/workspace-bg-*.png` files.

## Results
- Shortcut hints now show only the current platform's shortcuts.
- All locales use platform-aware shortcut placeholders instead of hard-coded dual-platform wording.
- Light and dark backgrounds have more visible premium technical detail while preserving quiet central space for the app UI.
