# Paste to Markdown

A simple, client-side web application for converting clipboard content (HTML/RTF/Text) to Markdown.

## How to use

1. Copy content from any webpage using `Ctrl+C` or `⌘+C`
2. Press `Ctrl+V` or `⌘+V` on this page to paste clipboard content
3. You will get a complete Markdown document, press `Ctrl+C` or `⌘+C` to copy it back
4. Press `Escape` to reset
5. Press `Alt+1` to switch to edit mode, `Alt+2` to switch to preview mode

## Features

- **Clipboard conversion**: Converts HTML, RTF, and plain text to Markdown
- **Multi-source support**: Handles content from web pages, VS Code, Word, Excel, and more
- **Live preview**: Edit and preview your Markdown in real-time
- **Dark mode**: Supports system dark mode preference
- **Multi-language**: Available in English, Turkish, and Chinese
- **Client-side only**: All data is processed locally, nothing is sent to any server

## Project Structure

- `index.html`: Main entry point and UI
- `assets/`:
  - `clipboard2markdown.js`: Main application logic
  - `to-markdown.js`: Conversion utilities
  - `bootstrap.css`: Styling
- `vendor/`: Third-party libraries (Turndown, Marked, GFM plugin)
- `i18n/`: Internationalization files

## Credits

This converter is based on [to-markdown](https://github.com/domchristie/to-markdown).

Style adapted from [Paste to Markdown](https://euangoddard.github.io/clipboard2markdown/).

## License

This project is open source and available on [GitHub](https://github.com/doggy8088/Paste-to-Markdown).
