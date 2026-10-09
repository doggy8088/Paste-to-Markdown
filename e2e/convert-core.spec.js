'use strict';

const { test, expect } = require('./support/fixtures');
const { gotoApp, convertPaste } = require('./support/app');

test.describe('to-markdown core converters', function () {
  test.beforeEach(async function ({ page }) {
    await gotoApp(page);
  });

  // ============================================================================
  // Heading converters (h1-h6)
  // ============================================================================
  test.describe('headings', function () {
    test('converts h1 to markdown level 1 heading', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<h1>Main Title</h1>' });
      expect(markdown).toBe('# Main Title');
    });

    test('converts h2 to markdown level 2 heading', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<h2>Subtitle</h2>' });
      expect(markdown).toBe('## Subtitle');
    });

    test('converts h3 to markdown level 3 heading', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<h3>Section</h3>' });
      expect(markdown).toBe('### Section');
    });

    test('converts h4 to markdown level 4 heading', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<h4>Subsection</h4>' });
      expect(markdown).toBe('#### Subsection');
    });

    test('converts h5 to markdown level 5 heading', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<h5>Minor heading</h5>' });
      expect(markdown).toBe('##### Minor heading');
    });

    test('converts h6 to markdown level 6 heading', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<h6>Smallest heading</h6>' });
      expect(markdown).toBe('###### Smallest heading');
    });

    test('converts heading with inline formatting', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<h2>Title with <strong>bold</strong> text</h2>' });
      expect(markdown).toBe('## Title with **bold** text');
    });
  });

  // ============================================================================
  // Paragraph converter
  // ============================================================================
  test.describe('paragraphs', function () {
    test('converts p to plain text with newlines', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Simple paragraph</p>' });
      expect(markdown).toBe('Simple paragraph');
    });

    test('converts multiple paragraphs with blank lines', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>First</p><p>Second</p>' });
      expect(markdown).toBe('First\n\nSecond');
    });

    test('converts paragraph with inline elements', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text with <strong>bold</strong>, <em>italic</em>, and <code>code</code>.</p>' });
      expect(markdown).toBe('Text with **bold**, *italic*, and `code`.');
    });
  });

  // ============================================================================
  // Emphasis and strong converters
  // ============================================================================
  test.describe('emphasis and strong', function () {
    test('converts em to single asterisk italic', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>This is <em>emphasized</em> text.</p>' });
      expect(markdown).toBe('This is *emphasized* text.');
    });

    test('converts i to single asterisk italic', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>This is <i>italic</i> text.</p>' });
      expect(markdown).toBe('This is *italic* text.');
    });

    test('converts strong to double asterisk bold', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>This is <strong>strong</strong> text.</p>' });
      expect(markdown).toBe('This is **strong** text.');
    });

    test('converts b to double asterisk bold', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>This is <b>bold</b> text.</p>' });
      expect(markdown).toBe('This is **bold** text.');
    });

    test('handles nested emphasis', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p><strong><em>Bold italic</em></strong></p>' });
      expect(markdown).toBe('***Bold italic***');
    });

    test('trims whitespace around strong tags', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text <strong>  bold content  </strong> text</p>' });
      expect(markdown).toBe('Text **bold content** text');
    });
  });

  // ============================================================================
  // Strikethrough converter
  // ============================================================================
  test.describe('strikethrough', function () {
    test('converts del to strikethrough', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>This is <del>deleted</del> text.</p>' });
      expect(markdown).toBe('This is ~~deleted~~ text.');
    });

    test('converts s to strikethrough', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>This is <s>struck</s> text.</p>' });
      expect(markdown).toBe('This is ~~struck~~ text.');
    });

    test('converts strike to strikethrough', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>This is <strike>struck</strike> text.</p>' });
      expect(markdown).toBe('This is ~~struck~~ text.');
    });
  });

  // ============================================================================
  // Whitespace flanking and processing edge cases
  // ============================================================================
  test.describe('whitespace flanking edge cases', function () {
    test('strong flanked by whitespace on right', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text<strong>bold</strong> more</p>' });
      expect(markdown).toBe('Text**bold** more');
    });

    test('strong flanked by whitespace on left', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text <strong>bold</strong>more</p>' });
      expect(markdown).toBe('Text **bold**more');
    });

    test('em flanked by block siblings', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p><em>italic</em></p><p>text</p>' });
      expect(markdown).toBe('*italic*\n\ntext');
    });

    test('inline element with next sibling check', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text <strong>bold</strong></p>' });
      expect(markdown).toBe('Text **bold**');
    });

    test('code without flanking whitespace', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Use<code>fn()</code>here</p>' });
      expect(markdown).toBe('Use`fn()`here');
    });
  });

  // ============================================================================
  // Line break and hr converters
  // ============================================================================
  test.describe('line breaks and horizontal rules', function () {
    test('converts br to backslash newline', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Line 1<br>Line 2</p>' });
      expect(markdown).toBe('Line 1\\\nLine 2');
    });

    test('converts hr to three dashes', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<hr>' });
      expect(markdown).toBe('---');
    });

    test('preserves hr in context with paragraphs', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Above</p><hr><p>Below</p>' });
      expect(markdown).toBe('Above\n\n---\n\nBelow');
    });
  });

  // ============================================================================
  // Inline code converter
  // ============================================================================
  test.describe('inline code', function () {
    test('converts code to backticks', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Use <code>console.log()</code> to debug.</p>' });
      expect(markdown).toBe('Use `console.log()` to debug.');
    });

    test('handles code with special characters', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p><code>const x = 5;</code></p>' });
      expect(markdown).toBe('`const x = 5;`');
    });

    test('does not convert code inside pre as inline code', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<pre><code>function test() {}</code></pre>' });
      expect(markdown).not.toContain('`function test() {}`');
    });
  });

  // ============================================================================
  // Code block converters
  // ============================================================================
  test.describe('code blocks', function () {
    test('converts pre>code to fenced code block', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<pre><code>function test() {\n  return true;\n}</code></pre>' });
      expect(markdown).toBe('```\nfunction test() {\n  return true;\n}\n```');
    });

    test('trims whitespace in code blocks', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<pre><code>  spaced code  </code></pre>' });
      expect(markdown).toBe('```\nspaced code\n```');
    });

    test('preserves newlines in code blocks', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<pre><code>line1\nline2\nline3</code></pre>' });
      expect(markdown).toBe('```\nline1\nline2\nline3\n```');
    });
  });

  // ============================================================================
  // Link converter
  // ============================================================================
  test.describe('links', function () {
    test('converts a with href to markdown link', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<a href="https://example.com">Example</a>' });
      expect(markdown).toBe('[Example](https://example.com)');
    });

    test('converts a with title attribute', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<a href="https://example.com" title="Visit example">Link</a>' });
      expect(markdown).toBe('[Link](https://example.com "Visit example")');
    });

    test('handles link with surrounding whitespace in text', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Check <a href="https://example.com">  this link  </a> out.</p>' });
      expect(markdown).toBe('Check [this link](https://example.com) out.');
    });

    test('handles link with multiline text content', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<a href="https://example.com">Text\nwith\nnewlines</a>' });
      expect(markdown).toBe('[Text with newlines](https://example.com)');
    });

    test('ignores a tags without href', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text with <a>no link</a> here.</p>' });
      expect(markdown).toBe('Text with no link here.');
    });
  });

  // ============================================================================
  // Image converter
  // ============================================================================
  test.describe('images', function () {
    test('converts img with src and alt', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<img src="image.png" alt="An image">' });
      expect(markdown).toBe('![An image](image.png)');
    });

    test('converts img with title', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<img src="image.png" alt="Image" title="Image Title">' });
      expect(markdown).toBe('![Image](image.png "Image Title")');
    });

    test('uses "image" as default alt text', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<img src="image.png">' });
      expect(markdown).toBe('![image](image.png)');
    });

    test('omits img without src', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text with <img alt="broken"> image.</p>' });
      expect(markdown).not.toContain('![broken]');
    });
  });

  // ============================================================================
  // Blockquote converter
  // ============================================================================
  test.describe('blockquotes', function () {
    test('converts blockquote to quoted text', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<blockquote><p>This is a quote</p></blockquote>' });
      expect(markdown).toBe('> This is a quote');
    });

    test('handles blockquote with multiple paragraphs', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<blockquote><p>Para 1</p><p>Para 2</p></blockquote>' });
      expect(markdown).toBe('> Para 1\n>\n> Para 2');
    });

    test('handles blockquote with nested block elements', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<blockquote><h3>Heading</h3><p>Text</p></blockquote>' });
      expect(markdown).toBe('> ### Heading\n>\n> Text');
    });

    test('handles blockquote with line breaks', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<blockquote><p>Line 1</p><p>Line 2</p></blockquote>' });
      expect(markdown).toBe('> Line 1\n>\n> Line 2');
    });
  });

  // ============================================================================
  // Unordered list converter
  // ============================================================================
  test.describe('unordered lists', function () {
    test('converts ul with li items', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>' });
      expect(markdown).toBe('- Item 1\n- Item 2\n- Item 3');
    });

    test('handles nested unordered lists', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li>Item 1<ul><li>Nested 1</li><li>Nested 2</li></ul></li></ul>'
      });
      expect(markdown).toBe('- Item 1\n    - Nested 1\n    - Nested 2');
    });

    test('handles list items with formatting', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li><strong>Bold</strong> item</li><li><em>Italic</em> item</li></ul>' });
      expect(markdown).toBe('- **Bold** item\n- *Italic* item');
    });

    test('handles list items with paragraphs', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li><p>Para 1</p><p>Para 2</p></li></ul>' });
      expect(markdown).toContain('Para 1');
      expect(markdown).toContain('Para 2');
    });

    test('handles list items with line breaks', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li>Line 1<br>Line 2</li></ul>' });
      expect(markdown).toBe('- Line 1\\\n    Line 2');
    });
  });

  // ============================================================================
  // Ordered list converter
  // ============================================================================
  test.describe('ordered lists', function () {
    test('converts ol with li items', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ol><li>First</li><li>Second</li><li>Third</li></ol>' });
      expect(markdown).toBe('1. First\n2. Second\n3. Third');
    });

    test('handles ol with start attribute', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ol start="5"><li>Five</li><li>Six</li></ol>' });
      expect(markdown).toBe('1. Five\n2. Six');
    });

    test('handles nested ordered lists', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ol><li>Item 1<ol><li>Nested 1</li><li>Nested 2</li></ol></li></ol>'
      });
      expect(markdown).toBe('1. Item 1\n    1. Nested 1\n    2. Nested 2');
    });

    test('handles mixed nested lists', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ol><li>Item 1<ul><li>Bullet A</li><li>Bullet B</li></ul></li></ol>'
      });
      expect(markdown).toBe('1. Item 1\n    - Bullet A\n    - Bullet B');
    });
  });

  // ============================================================================
  // Task list (checkbox) converter
  // ============================================================================
  test.describe('task lists', function () {
    test('handles checkbox in list items', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><input type="checkbox" checked> Complete task</li></ul>'
      });
      expect(markdown).toBe('- [x]  Complete task');
    });

    test('handles unchecked checkbox in list items', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><input type="checkbox"> Incomplete task</li></ul>'
      });
      expect(markdown).toBe('- [ ]  Incomplete task');
    });

    test('handles list with checkbox items', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><input type="checkbox" checked> Done</li><li><input type="checkbox"> Todo</li></ul>'
      });
      expect(markdown).toBe('- [x]  Done\n- [ ]  Todo');
    });
  });

  // ============================================================================
  // Table converters (thead, tbody, tfoot, tr, th, td)
  // ============================================================================
  test.describe('tables', function () {
    test('converts simple table with thead', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><thead><tr><th>Header 1</th><th>Header 2</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table>'
      });
      expect(markdown).toContain('| Header 1 |');
      expect(markdown).toContain('| Header 2 |');
      expect(markdown).toContain('| Cell 1 |');
      expect(markdown).toContain('| Cell 2 |');
      expect(markdown).toContain('---');
    });

    test('converts table without thead', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th>Header 1</th><th>Header 2</th></tr><tr><td>Cell 1</td><td>Cell 2</td></tr></table>'
      });
      expect(markdown).toContain('| Header 1 |');
      expect(markdown).toContain('---');
      expect(markdown).toContain('| Cell 1 |');
    });

    test('handles table with align attribute', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th align="left">Left</th><th align="center">Center</th><th align="right">Right</th></tr><tr><td>1</td><td>2</td><td>3</td></tr></table>'
      });
      expect(markdown).toContain(':--');
      expect(markdown).toContain(':-:');
      expect(markdown).toContain('--:');
    });

    test('handles table with br in cells', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th>Header</th></tr><tr><td>Line 1<br>Line 2</td></tr></table>'
      });
      expect(markdown).toContain('| ');
      expect(markdown).toContain('<br>');
    });

    test('handles table with pipes in cell content', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th>Header</th></tr><tr><td>A | B</td></tr></table>'
      });
      expect(markdown).toContain('A | B');
    });

    test('handles table with paragraph elements in cells', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th>Header</th></tr><tr><td><p>Content</p></td></tr></table>'
      });
      expect(markdown).toContain('| ');
      expect(markdown).toContain('Content');
    });

    test('converts table with multiple tbody sections', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tbody><tr><td>Row 1</td></tr></tbody><tbody><tr><td>Row 2</td></tr></tbody></table>'
      });
      expect(markdown).toContain('Row 1');
      expect(markdown).toContain('Row 2');
    });

    test('handles br outside table context', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Line 1<br>Line 2</p>' });
      expect(markdown).toContain('Line 1');
      expect(markdown).toContain('Line 2');
    });

    test('handles br directly in table cell', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><td>Start<br>End</td></tr></table>'
      });
      expect(markdown).toContain('<br>');
    });

    test('handles br nested in table cell with paragraph', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><td><p>Para<br>Continued</p></td></tr></table>'
      });
      expect(markdown).toContain('Para');
      expect(markdown).toContain('Continued');
    });

    test('handles table row with tbody parent', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tbody><tr><td>Cell</td></tr></tbody></table>'
      });
      expect(markdown).toContain('Cell');
    });

    test('handles table row in thead with th cells', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><thead><tr><th align="center">Center</th></tr></thead></table>'
      });
      expect(markdown).toContain(':-:');
    });

    test('handles nested tbody checking in tr replacement', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tbody><tr><td>R1</td></tr><tr><td>R2</td></tr></tbody></table>'
      });
      expect(markdown).toContain('R1');
      expect(markdown).toContain('R2');
    });

    test('handles table with tfoot', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Data</td></tr></tbody><tfoot><tr><td>Footer</td></tr></tfoot></table>'
      });
      expect(markdown).toContain('Header');
      expect(markdown).toContain('Data');
      expect(markdown).toContain('Footer');
    });

    test('handles table with no header row marker', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tbody><tr><td>Cell 1</td></tr></tbody></table>'
      });
      expect(markdown).toContain('Cell 1');
    });
  });

  // ============================================================================
  // HTML Parser Fallback (when DOMParser is unavailable)
  // ============================================================================
  test.describe('html parser fallback', function () {
    test('uses fallback parser when DOMParser is unavailable', async function ({ page }) {
      // Stub DOMParser before scripts load so canParseHtmlNatively() returns false
      // and createHtmlParser fallback is used instead
      await page.addInitScript(function () {
        window.DOMParser = null;
      });
      await page.goto('/index.html');
      await page.waitForFunction(function () {
        return !!(window.i18n && document.querySelector('.tab-button.active'));
      });

      const markdown = await page.evaluate(function () {
        return window.toMarkdown('<p>Test content</p>');
      });
      expect(markdown).toBe('Test content');
    });

    test('uses document.implementation fallback', async function ({ page }) {
      await page.addInitScript(function () {
        window.DOMParser = null;
        window.ActiveXObject = null;
      });
      await page.goto('/index.html');
      await page.waitForFunction(function () {
        return !!(window.i18n && document.querySelector('.tab-button.active'));
      });

      const markdown = await page.evaluate(function () {
        return window.toMarkdown('<h2>Heading</h2><p>Content</p>');
      });
      expect(markdown).toBe('## Heading\n\nContent');
    });

    test('parses html with list elements using fallback', async function ({ page }) {
      await page.addInitScript(function () {
        window.DOMParser = null;
      });
      await page.goto('/index.html');
      await page.waitForFunction(function () {
        return !!(window.i18n && document.querySelector('.tab-button.active'));
      });

      const markdown = await page.evaluate(function () {
        return window.toMarkdown('<ul><li>Item 1</li><li>Item 2</li></ul>');
      });
      expect(markdown).toBe('*   Item 1\n*   Item 2');
    });

    test('parses table with fallback parser', async function ({ page }) {
      await page.addInitScript(function () {
        window.DOMParser = null;
      });
      await page.goto('/index.html');
      await page.waitForFunction(function () {
        return !!(window.i18n && document.querySelector('.tab-button.active'));
      });

      const markdown = await page.evaluate(function () {
        return window.toMarkdown('<table><tr><th>Col1</th></tr><tr><td>Data1</td></tr></table>');
      });
      expect(markdown).toContain('Col1');
      expect(markdown).toContain('Data1');
    });
  });

  // ============================================================================
  // Custom helper functions: trimInlineContent, normalizeLinkContent, trimListContent
  // ============================================================================
  test.describe('custom helper functions', function () {
    test('strong with whitespace trimming', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text <strong>  bold  </strong> more</p>' });
      expect(markdown).toBe('Text **bold** more');
    });

    test('link with multiline content normalization', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<a href="http://example.com">Line1\nLine2\nLine3</a>' });
      expect(markdown).toBe('[Line1 Line2 Line3](http://example.com)');
    });

    test('link with whitespace around multiline text', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<a href="http://example.com">  \n  Text  \n  </a>' });
      expect(markdown).toBe('[Text](http://example.com)');
    });

    test('link with no content after trim', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<a href="http://example.com">   \n  \n  </a>' });
      expect(markdown).toBe('');
    });

    test('list item with leading whitespace and newline', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li>\n  Content here</li></ul>' });
      expect(markdown).toBe('- Content here');
    });

    test('list item with trailing whitespace and newline', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li>Content here\n  </li></ul>' });
      expect(markdown).toBe('- Content here');
    });

    test('list item with leading and trailing newlines', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li>\nContent\n</li></ul>' });
      expect(markdown).toBe('- Content');
    });

    test('list item with only whitespace', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li>   \n   </li></ul>' });
      expect(markdown.trim()).toBe('');
    });

    test('list item with nested paragraphs and whitespace', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li>\n<p>Para1</p>\n<p>Para2</p>\n</li></ul>' });
      expect(markdown).toContain('Para1');
      expect(markdown).toContain('Para2');
    });

    test('link inside emphasis with proper nesting', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<em><a href="url">  italic link  </a></em>' });
      expect(markdown).toBe('*[italic link](url)*');
    });

    test('strong with special whitespace characters', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text <strong>\n  \t  bold  \n  </strong> more</p>' });
      expect(markdown).toBe('Text **bold** more');
    });

    test('strong with non-string content handling', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p><strong>bold</strong></p>' });
      expect(markdown).toBe('**bold**');
    });

    test('link with carriage returns and newlines', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<a href="url">Text\r\nwith\r\nreturns</a>' });
      expect(markdown).toBe('[Text with returns](url)');
    });

    test('link with multiple consecutive newlines', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<a href="url">Line\n\n\nMultiple</a>' });
      expect(markdown).toBe('[Line Multiple](url)');
    });

    test('link with non-string input handling', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p><a href="url">link text</a></p>' });
      expect(markdown).toBe('[link text](url)');
    });

    test('list item with empty string after trim', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li></li><li>Item</li></ul>' });
      expect(markdown).toBe('- Item');
    });

    test('list item with only leading newline', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li>\nContent</li></ul>' });
      expect(markdown).toBe('- Content');
    });

    test('list item with only trailing newline', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li>Content\n</li></ul>' });
      expect(markdown).toBe('- Content');
    });

    test('list item with non-string input handling', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li>Text content</li></ul>' });
      expect(markdown).toBe('- Text content');
    });

    test('strong without whitespace', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text <strong>bold</strong> more</p>' });
      expect(markdown).toBe('Text **bold** more');
    });
  });

  // ============================================================================
  // Whitespace collapsing and normalization
  // ============================================================================
  test.describe('whitespace handling', function () {
    test('collapses multiple spaces', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text    with    spaces</p>' });
      expect(markdown).toBe('Text with spaces');
    });

    test('removes excessive blank lines', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Para 1</p><p></p><p></p><p>Para 2</p>' });
      expect(markdown).toBe('Para 1\n\nPara 2');
    });

    test('trims leading and trailing whitespace', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>  Text  </p>' });
      expect(markdown).toBe('Text');
    });

    test('handles whitespace around inline elements', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text <strong> bold </strong> text</p>' });
      expect(markdown).toBe('Text **bold** text');
    });

    test('preserves whitespace in code blocks', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<pre><code>  indented\n    code  </code></pre>' });
      expect(markdown).toBe('```\nindented\n    code\n```');
    });
  });

  // ============================================================================
  // Complex nested structures
  // ============================================================================
  test.describe('complex nested structures', function () {
    test('handles heading with multiple inline elements', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<h2>Title with <strong>bold</strong>, <em>italic</em>, and <code>code</code></h2>'
      });
      expect(markdown).toBe('## Title with **bold**, *italic*, and `code`');
    });

    test('handles list with complex content', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><strong>Bold</strong> item with <a href="url">link</a></li><li>Regular item</li></ul>'
      });
      expect(markdown).toBe('- **Bold** item with [link](url)\n- Regular item');
    });

    test('handles blockquote with multiple block elements', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<blockquote><h3>Title</h3><p>Para</p><ul><li>Item</li></ul></blockquote>'
      });
      expect(markdown).toContain('> ### Title');
      expect(markdown).toContain('> Para');
      expect(markdown).toContain('> - Item');
    });

    test('handles table with formatted content', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th><strong>Bold Header</strong></th></tr><tr><td><em>Italic</em> data</td></tr></table>'
      });
      expect(markdown).toContain('**Bold Header**');
      expect(markdown).toContain('*Italic* data');
    });
  });

  // ============================================================================
  // Special cases and edge conditions
  // ============================================================================
  test.describe('special cases', function () {
    test('handles empty elements', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p></p><p>Text</p>' });
      expect(markdown.trim()).toBe('Text');
    });

    test('handles void elements (img, br, hr)', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Before<br><hr><img src="test.png">After</p>' });
      expect(markdown).toContain('Before');
      expect(markdown).toContain('After');
    });

    test('handles mixed content types', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div><h1>Title</h1><p>Para</p><ul><li>Item</li></ul><blockquote><p>Quote</p></blockquote></div>'
      });
      expect(markdown).toBe('# Title\n\nPara\n\n- Item\n\n> Quote');
    });

    test('handles content with only whitespace', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>   \n\t   </p>' });
      expect(markdown.trim()).toBe('');
    });

    test('handles numbered content escaping', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>1. Item with number</p>' });
      expect(markdown).toContain('Item with number');
    });

    test('handles link text with list items inside', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p><a href="https://example.com">Items\n- Item 1\n- Item 2</a></p>'
      });
      expect(markdown).toContain('Item 1');
      expect(markdown).toContain('Item 2');
    });

    test('handles list marker with nbsp in link text', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p><a href="https://example.com">List\n1.&nbsp;First\n2.&nbsp;Second</a></p>'
      });
      expect(markdown).toContain('example.com');
    });

    test('handles multiple numbered lists in link text', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p><a href="https://example.com">1. One\n2. Two\n3. Three</a></p>'
      });
      expect(markdown).toContain('One');
    });

    test('handles link with fragment', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<a href="#section">Anchor</a>' });
      expect(markdown).toContain('[Anchor](#section)');
    });

    test('handles image with empty src', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<img alt="test">' });
      expect(markdown.trim()).toBe('');
    });

    test('handles deeply nested lists', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li>L1<ul><li>L2<ul><li>L3</li></ul></li></ul></li></ul>'
      });
      expect(markdown).toContain('L1');
      expect(markdown).toContain('L2');
      expect(markdown).toContain('L3');
    });
  });

  // ============================================================================
  // GFM and extended features
  // ============================================================================
  test.describe('github flavored markdown features', function () {
    test('handles strikethrough', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p><del>Strike through this</del></p>' });
      expect(markdown).toContain('~~Strike through this~~');
    });

    test('handles lists with inputs', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><input type="checkbox" checked> Done</li><li><input type="checkbox"> Todo</li></ul>'
      });
      expect(markdown).toContain('Done');
      expect(markdown).toContain('Todo');
    });

    test('handles tables', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>'
      });
      expect(markdown).toContain('|');
      expect(markdown).toContain('---');
    });
  });

  // ============================================================================
  // HTML display:inline style handling
  // ============================================================================
  test.describe('display:inline style handling', function () {
    test('treats elements with display:inline as inline', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<div style="display: inline">Text</div>' });
      expect(markdown).toBe('Text');
    });

    test('removes blank block elements', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<div><p>  </p></div>' });
      expect(markdown.trim()).toBe('');
    });
  });

  // ============================================================================
  // Real-world complex example
  // ============================================================================
  test.describe('real-world examples', function () {
    test('converts article with mixed content', async function ({ page }) {
      const html = `
        <h1>Main Heading</h1>
        <p>Introduction paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
        <h2>Section 1</h2>
        <p>Content here.</p>
        <ul>
          <li>Point 1</li>
          <li>Point 2 with <a href="https://link.com">link</a></li>
          <li>Point 3</li>
        </ul>
        <h2>Section 2</h2>
        <blockquote>
          <p>Important quote here</p>
        </blockquote>
        <p>Final paragraph.</p>
      `;
      const markdown = await convertPaste(page, { html });
      expect(markdown).toContain('# Main Heading');
      expect(markdown).toContain('**bold**');
      expect(markdown).toContain('*italic*');
      expect(markdown).toContain('## Section');
      expect(markdown).toContain('- Point');
      expect(markdown).toContain('[link]');
      expect(markdown).toContain('> Important quote');
    });

    test('converts table-heavy content', async function ({ page }) {
      const html = `
        <table>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="center">Count</th>
              <th align="right">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Item 1</td>
              <td>5</td>
              <td>Active</td>
            </tr>
            <tr>
              <td>Item 2</td>
              <td>3</td>
              <td>Pending</td>
            </tr>
          </tbody>
        </table>
      `;
      const markdown = await convertPaste(page, { html });
      expect(markdown).toContain('| Name |');
      expect(markdown).toContain('| Count |');
      expect(markdown).toContain('| Status |');
      expect(markdown).toContain('| Item 1 |');
      expect(markdown).toContain('| Item 2 |');
      expect(markdown).toContain(':--');
      expect(markdown).toContain(':-:');
      expect(markdown).toContain('--:');
    });
  });

  // ============================================================================
  // Escape and post-processing
  // ============================================================================
  test.describe('markdown escape sequences', function () {
    test('handles numbered content', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>1. This is just text</p>' });
      expect(markdown).toContain('This is just text');
    });

    test('handles content with HTML entities decoded', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>&lt;div&gt; and &amp; symbol</p>' });
      expect(markdown).toContain('<div>');
      expect(markdown).toContain('&');
      expect(markdown).toContain('symbol');
    });
  });

  // ============================================================================
  // Syntax highlighted code blocks
  // ============================================================================
  test.describe('syntax highlighted code blocks', function () {
    test('converts GitHub-style highlighted code block', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div class="highlight highlight-javascript"><pre><code>function test() {\n  return true;\n}</code></pre></div>'
      });
      expect(markdown).toContain('```');
      expect(markdown).toContain('function test()');
    });

    test('converts highlight div wrapper', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div class="highlight highlight-python"><pre>Code here</pre></div>'
      });
      expect(markdown).toContain('Code here');
    });

    test('handles code with syntax highlighting', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div class="highlight highlight-typescript"><pre><code>const x: string = "test";</code></pre></div>'
      });
      expect(markdown).toContain('```');
      expect(markdown).toContain('const x');
    });
  });

  // ============================================================================
  // List content trimming
  // ============================================================================
  test.describe('list content trimming', function () {
    test('handles list content with whitespace', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li>\n  Content here</li></ul>' });
      expect(markdown).toContain('Content here');
    });

    test('handles list content with trailing whitespace', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li>Content here\n</li></ul>' });
      expect(markdown).toContain('Content here');
    });

    test('handles list items with nested structure', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li>Text<p>Paragraph inside</p></li></ul>'
      });
      expect(markdown).toContain('Text');
      expect(markdown).toContain('Paragraph inside');
    });
  });

  // ============================================================================
  // Additional edge cases for better coverage
  // ============================================================================
  test.describe('edge cases for line coverage', function () {
    test('handles inline style display attribute', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<div style="display:inline">inline</div><p>block</p>' });
      expect(markdown).toBe('inline\n\nblock');
    });

    test('handles br inside table cell', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><td>First<br>Second</td></tr></table>'
      });
      expect(markdown).toContain('<br>');
    });

    test('handles empty heading', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<h1></h1><h2>Title</h2>' });
      expect(markdown).toBe('## Title');
    });

    test('handles paragraph with leading/trailing whitespace', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>  \n  Text with whitespace  \n  </p>' });
      expect(markdown).toBe('Text with whitespace');
    });

    test('handles multiple empty paragraphs', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p></p><p></p><p>Content</p>' });
      expect(markdown).toBe('Content');
    });

    test('handles strong with empty content', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p><strong></strong>text</p>' });
      expect(markdown).toBe('text');
    });

    test('handles link without href attribute', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<a>No link</a>' });
      expect(markdown).toBe('No link');
    });

    test('handles image without alt', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<img src="test.png">' });
      expect(markdown).toBe('![image](test.png)');
    });

    test('handles nested blockquotes', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<blockquote><p>Outer<blockquote><p>Inner</p></blockquote></p></blockquote>'
      });
      expect(markdown).toContain('>');
      expect(markdown).toContain('Inner');
    });

    test('handles complex table alignment', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th align="left">L</th><th align="center">C</th><th align="right">R</th><th>None</th></tr><tr><td>1</td><td>2</td><td>3</td><td>4</td></tr></table>'
      });
      expect(markdown).toContain(':--');
      expect(markdown).toContain(':-:');
      expect(markdown).toContain('--:');
    });

    test('handles list with no items', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul></ul>' });
      expect(markdown.trim()).toBe('');
    });

    test('handles ordered list with type attribute', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ol type="a"><li>First</li></ol>' });
      expect(markdown).toContain('1.');
    });

    test('handles mixed list content', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li>Text <strong>bold</strong> <em>italic</em></li></ul>'
      });
      expect(markdown).toContain('**bold**');
      expect(markdown).toContain('*italic*');
    });

    test('handles hr with attributes', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<hr class="divider" id="hr1">' });
      expect(markdown).toContain('---');
    });

    test('handles pre without code child', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<pre>Direct text</pre>' });
      expect(markdown).toContain('Direct text');
    });

    test('handles table with colspan/rowspan', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th colspan="2">Header</th></tr><tr><td>A</td><td>B</td></tr></table>'
      });
      expect(markdown).toContain('Header');
      expect(markdown).toContain('---');
    });

    test('handles content with multiple whitespace types', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text  \n\n  with  \t  whitespace</p>' });
      expect(markdown).toContain('Text');
      expect(markdown).toContain('whitespace');
    });

    test('handles link with whitespace around text', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<a href="url">  Link text  </a>' });
      expect(markdown).toContain('Link text');
    });

    test('handles code blocks with language variants', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div class="highlight highlight-javascript"><pre><code>code</code></pre></div>'
      });
      expect(markdown).toContain('```');
      expect(markdown).toContain('code');
    });

    test('handles whitespace between block elements', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div><p>Para1</p>  \n\n  <p>Para2</p></div>'
      });
      expect(markdown).toContain('Para1');
      expect(markdown).toContain('Para2');
    });

    test('handles comment nodes', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Before<!-- comment -->After</p>' });
      expect(markdown).toContain('Before');
      expect(markdown).toContain('After');
    });

    test('handles list wrapped in anchor tag', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<a href="https://example.com"><ul><li>Item 1</li><li>Item 2</li></ul></a>'
      });
      expect(markdown).toContain('Item 1');
      expect(markdown).toContain('Item 2');
    });

    test('handles varying whitespace in headings', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<h1>  Title  with   spaces  </h1>'
      });
      expect(markdown).toContain('Title');
      expect(markdown).toContain('spaces');
    });

    test('handles em tag with whitespace', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Text <em>  italic text  </em> more</p>'
      });
      expect(markdown).toContain('*italic text*');
    });

    test('handles i tag with formatting', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p><i>Start</i> middle <i>end</i></p>' });
      expect(markdown).toContain('*Start*');
      expect(markdown).toContain('*end*');
    });

    test('handles code with backticks inside', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Text with <code>some `code`</code> inside</p>'
      });
      expect(markdown).toContain('`');
      expect(markdown).toContain('code');
    });

    test('handles link with query parameters', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<a href="https://example.com?q=test&x=1">Search</a>'
      });
      expect(markdown).toContain('[Search]');
      expect(markdown).toContain('q=test');
    });

    test('handles image with relative path', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<img src="./images/photo.jpg" alt="My photo">'
      });
      expect(markdown).toContain('./images/photo.jpg');
      expect(markdown).toContain('My photo');
    });

    test('handles blockquote with mixed content', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<blockquote><p>A quote</p><ul><li>Point</li></ul></blockquote>'
      });
      expect(markdown).toContain('>');
    });

    test('handles multiple list types mixed', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li>Bullet</li></ul><ol><li>Number</li></ol>'
      });
      expect(markdown).toContain('- Bullet');
      expect(markdown).toContain('1. Number');
    });

    test('handles table cell with multiple elements', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th>Header</th></tr><tr><td>Text <strong>bold</strong> <em>italic</em></td></tr></table>'
      });
      expect(markdown).toContain('bold');
      expect(markdown).toContain('italic');
    });

    test('handles hr in different contexts', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div><p>Before</p><hr><p>After</p><hr><p>End</p></div>'
      });
      const hrCount = (markdown.match(/---/g) || []).length;
      expect(hrCount).toBeGreaterThanOrEqual(2);
    });

    test('handles nested emphasis', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p><strong>Bold <em>and italic</em></strong></p>'
      });
      expect(markdown).toContain('**');
      expect(markdown).toContain('*');
    });

    test('handles code blocks with indentation', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<pre><code>    line 1\n      line 2</code></pre>'
      });
      expect(markdown).toContain('line 1');
      expect(markdown).toContain('line 2');
    });

    test('handles list with different element types', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li>First item</li><li><strong>Bold item</strong></li><li><code>Code item</code></li></ul>'
      });
      expect(markdown).toContain('- First item');
      expect(markdown).toContain('**');
      expect(markdown).toContain('`');
    });

    test('handles table without tbody', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th>Header</th></tr><tr><td>Data</td></tr></table>'
      });
      expect(markdown).toContain('Header');
      expect(markdown).toContain('Data');
    });

    test('handles header followed by multiple content types', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<h2>Section</h2><p>Text</p><ul><li>Item</li></ul><blockquote><p>Quote</p></blockquote>'
      });
      expect(markdown).toContain('##');
      expect(markdown).toContain('Text');
      expect(markdown).toContain('- Item');
      expect(markdown).toContain('>');
    });

    test('handles inline element with adjacent inline sibling', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p><strong>bold</strong><em>italic</em></p>'
      });
      expect(markdown).toContain('**bold**');
      expect(markdown).toContain('*italic*');
    });

    test('handles link text with surrounding inline formatting', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p><em><a href="url">italic link</a></em></p>'
      });
      expect(markdown).toBe('*[italic link](url)*');
    });

    test('handles code inside formatted text', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p><strong><code>bold code</code></strong></p>'
      });
      expect(markdown).toBe('**`bold code`**');
    });

    test('handles list item with multiple inline elements in sequence', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><strong>Bold</strong> <em>italic</em> <code>code</code></li></ul>'
      });
      expect(markdown).toBe('- **Bold** *italic* `code`');
    });

    test('handles paragraph containing consecutive formatting elements', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Text <strong>one</strong><strong>two</strong> more</p>'
      });
      expect(markdown).toBe('Text **one****two** more');
    });

    test('handles blockquote with hr inside', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<blockquote><p>Before</p><hr><p>After</p></blockquote>'
      });
      expect(markdown).toContain('>');
      expect(markdown).toContain('Before');
      expect(markdown).toContain('After');
    });

    test('handles table cell with br multiple times', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><td>Line 1<br>Line 2<br>Line 3</td></tr></table>'
      });
      expect(markdown).toContain('<br>');
      expect(markdown).toContain('Line 1');
      expect(markdown).toContain('Line 3');
    });

    test('handles deeply nested inline formatting', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p><strong><em><code>nested</code></em></strong></p>'
      });
      expect(markdown).toBe('***`nested`***');
    });

    test('handles multiple adjacent block elements with whitespace', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Para 1</p>\n\n<p>Para 2</p>\n\n<p>Para 3</p>'
      });
      expect(markdown).toContain('Para 1');
      expect(markdown).toContain('Para 2');
      expect(markdown).toContain('Para 3');
    });

    test('handles div wrapper around content', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<div><p>Content</p></div>' });
      expect(markdown).toContain('Content');
    });

    test('handles section with multiple paragraphs', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<section><p>Para 1</p><p>Para 2</p></section>'
      });
      expect(markdown).toContain('Para 1');
      expect(markdown).toContain('Para 2');
    });

    test('handles article with heading and paragraphs', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<article><h2>Title</h2><p>Content</p></article>'
      });
      expect(markdown).toContain('##');
      expect(markdown).toContain('Title');
      expect(markdown).toContain('Content');
    });

    test('handles ordered list with single item', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ol><li>Item</li></ol>' });
      expect(markdown).toContain('1.');
      expect(markdown).toContain('Item');
    });

    test('handles unordered list with single item', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul><li>Item</li></ul>' });
      expect(markdown).toContain('- Item');
    });

    test('handles nested ol inside ul', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li>Bullet<ol><li>Numbered</li></ol></li></ul>'
      });
      expect(markdown).toContain('- Bullet');
      expect(markdown).toContain('1.');
    });

    test('handles table with only header row', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th>A</th><th>B</th></tr></table>'
      });
      expect(markdown).toContain('|');
      expect(markdown).toContain('A');
      expect(markdown).toContain('B');
    });

    test('handles nested div elements', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div><div><p>Nested</p></div></div>'
      });
      expect(markdown).toContain('Nested');
    });

    test('handles pre element without code child', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<pre>Text without code wrapper</pre>' });
      expect(markdown).toContain('Text without code wrapper');
    });

    test('handles em with whitespace inside', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Text <em>  italic  </em> text</p>' });
      expect(markdown).toBe('Text *italic* text');
    });

    test('handles del with text content', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Some <del>deleted text</del> here</p>' });
      expect(markdown).toBe('Some ~~deleted text~~ here');
    });

    test('handles table with br separators in cells', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><td>Cell1<br>Continuation</td></tr></table>'
      });
      expect(markdown).toContain('<br>');
      expect(markdown).toContain('Cell1');
      expect(markdown).toContain('Continuation');
    });

    test('handles table cell with br at boundary', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th>Header<br>Line2</th></tr></table>'
      });
      expect(markdown).toContain('<br>');
    });

    test('handles nested tables', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><td><table><tr><td>Inner</td></tr></table></td></tr></table>'
      });
      expect(markdown).toContain('Inner');
    });

    test('handles table with empty cells', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><td></td><td>Data</td></tr></table>'
      });
      expect(markdown).toContain('Data');
    });

    test('handles table with first row as headers (no thead)', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><td>Col1</td><td>Col2</td></tr><tr><td>Data1</td><td>Data2</td></tr></table>'
      });
      expect(markdown).toContain('Col1');
      expect(markdown).toContain('---');
    });

    test('handles blockquote with inline formatting only', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<blockquote><strong>Bold quote</strong></blockquote>'
      });
      expect(markdown).toContain('> **Bold quote**');
    });

    test('handles br element flanked by text nodes', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Line1<br>Line2</p>' });
      expect(markdown).toContain('Line1');
      expect(markdown).toContain('Line2');
    });

    test('handles code element with whitespace', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Use <code>  fn()  </code> here</p>' });
      expect(markdown).toContain('`fn()`');
    });

    test('handles nested list with different markers', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li>Unordered<ol><li>Ordered</li></ol></li></ul>'
      });
      expect(markdown).toContain('- Unordered');
      expect(markdown).toContain('1.');
    });

    test('handles image inside link', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<a href="http://example.com"><img src="image.png" alt="alt text"></a>'
      });
      expect(markdown).toContain('http://example.com');
    });

    test('handles h1-h6 without text content', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<h1></h1><h1>Title</h1>' });
      expect(markdown).toBe('# Title');
    });

    test('handles paragraph with comment node', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Start<!-- hidden -->End</p>' });
      expect(markdown).toBe('StartEnd');
    });

    test('handles ol with complex nesting', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ol><li>Item 1<ol><li>Nested 1<ol><li>Deep</li></ol></li></ol></li></ol>'
      });
      expect(markdown).toContain('1.');
      expect(markdown).toContain('Deep');
    });

    test('handles blockquote escaping special characters', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<blockquote>1. This looks like a list item</blockquote>'
      });
      expect(markdown).toContain('>');
    });

    test('handles div with inline style display:inline', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div style="display: inline">Inline div</div><p>Block para</p>'
      });
      expect(markdown).toContain('Inline div');
      expect(markdown).toContain('Block para');
    });

    test('handles complex text node interactions', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Text <strong>bold</strong> text <em>italic</em> more</p>'
      });
      expect(markdown).toBe('Text **bold** text *italic* more');
    });

    test('handles link with empty text node siblings', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Click <a href="url">here</a> now</p>'
      });
      expect(markdown).toContain('[here](url)');
    });

    test('handles multiple br tags in sequence', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p>Line<br><br>Spaced</p>' });
      expect(markdown).toContain('Line');
      expect(markdown).toContain('Spaced');
    });

    test('handles table with tfoot alignment markers', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><thead><tr><th align="left">Left</th></tr></thead><tfoot><tr><td>Footer</td></tr></tfoot></table>'
      });
      expect(markdown).toContain(':--');
      expect(markdown).toContain('Footer');
    });

    test('handles ol without start attribute', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ol><li>First</li><li>Second</li></ol>' });
      expect(markdown).toBe('1. First\n2. Second');
    });

    test('handles ul with no list items', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<ul></ul>' });
      expect(markdown.trim()).toBe('');
    });

    test('handles table with tbody containing multiple rows', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tbody><tr><td>R1C1</td></tr><tr><td>R2C1</td></tr></tbody></table>'
      });
      expect(markdown).toContain('R1C1');
      expect(markdown).toContain('R2C1');
    });

    test('handles link with trailing punctuation', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>See <a href="http://example.com">this link</a>.</p>'
      });
      expect(markdown).toContain('[this link](http://example.com)');
    });

    test('handles img with data: protocol removed', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<img src="data:image/png;base64,iVBORw0KGgo=" alt="data image">'
      });
      expect(markdown).toBe('![data image](data:image/png;base64,iVBORw0KGgo=)');
    });

    test('handles strong immediately followed by em', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p><strong>bold</strong><em>italic</em></p>'
      });
      expect(markdown).toBe('**bold***italic*');
    });

    test('handles blockquote containing hr', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<blockquote><p>Before</p><hr><p>After</p></blockquote>'
      });
      expect(markdown).toContain('>');
      expect(markdown).toContain('Before');
      expect(markdown).toContain('After');
    });

    test('handles checkbox in ol list item', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ol><li><input type="checkbox" checked> Done item</li></ol>'
      });
      expect(markdown).toContain('1.');
      expect(markdown).toContain('Done item');
    });

    test('handles strong with empty content trimmed', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p><strong></strong>text</p>' });
      expect(markdown).toBe('text');
    });

    test('handles em with empty content', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<p><em></em>text</p>' });
      expect(markdown).toBe('text');
    });

    test('handles link with only whitespace text', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<a href="url">   </a>' });
      expect(markdown).toBe('');
    });

    test('handles br in pre element', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<pre><code>line1<br>line2</code></pre>' });
      expect(markdown).toContain('line1');
      expect(markdown).toContain('line2');
    });

    test('handles multiple node types in sequence', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Text<!-- comment -->More<strong>Bold</strong>End</p>'
      });
      expect(markdown).toContain('TextMore');
      expect(markdown).toContain('**Bold**');
    });

    test('handles th in table without align', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th>Plain</th><th>Header</th></tr></table>'
      });
      expect(markdown).toContain('Plain');
      expect(markdown).toContain('Header');
    });

    test('handles td with pipe characters', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><td>A | B</td></tr></table>'
      });
      expect(markdown).toContain('A | B');
    });

    test('handles br in th element', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th>Header<br>Line 2</th></tr></table>'
      });
      expect(markdown).toContain('Header');
      expect(markdown).toContain('Line 2');
    });

    test('handles del tag with attributes', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Keep this <del class="removed">deleted</del> text</p>'
      });
      expect(markdown).toContain('~~deleted~~');
    });

    test('handles s tag variations', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Text <s id="strikethrough">struck</s> end</p>'
      });
      expect(markdown).toContain('~~struck~~');
    });

    test('handles checkbox input without checked', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><input type="checkbox">Task</li></ul>'
      });
      expect(markdown).toContain('Task');
    });

    test('handles checkbox input with checked attribute', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><input type="checkbox" checked="checked">Done</li></ul>'
      });
      expect(markdown).toContain('Done');
    });

    test('handles div with display inline in complex structure', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div><span style="display: inline">Inline</span></div>'
      });
      expect(markdown).toContain('Inline');
    });

    test('handles fenced code block with language', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div class="highlight highlight-json"><pre><code>{"key": "value"}</code></pre></div>'
      });
      expect(markdown).toContain('```');
      expect(markdown).toContain('key');
    });

    test('handles pre with syntax highlight wrapper', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div class="highlight highlight-rust"><pre>fn main() {}</pre></div>'
      });
      expect(markdown).toContain('fn main()');
    });

    test('handles highlight div without pre/code nesting', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div class="highlight highlight-go">Code here</div>'
      });
      expect(markdown).toContain('Code here');
    });

    test('handles img with alt text containing special chars', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<img src="img.png" alt="Image [with] (brackets)">'
      });
      expect(markdown).toContain('Image [with] (brackets)');
    });

    test('handles a tag with data attributes', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<a href="https://example.com" data-id="123">Link</a>'
      });
      expect(markdown).toBe('[Link](https://example.com)');
    });

    test('handles nested strong and em tags', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p><strong><em><u>text</u></em></strong></p>'
      });
      expect(markdown).toContain('***text***');
    });

    test('handles blockquote with code', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<blockquote><p>Use <code>fn()</code> for this</p></blockquote>'
      });
      expect(markdown).toContain('>');
      expect(markdown).toContain('`fn()`');
    });

    test('handles li with multiple block children', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><p>Para 1</p><p>Para 2</p><p>Para 3</p></li></ul>'
      });
      expect(markdown).toContain('Para 1');
      expect(markdown).toContain('Para 3');
    });

    test('handles ol and ul mixed at same level', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ol><li>1</li></ol><ul><li>A</li></ul>'
      });
      expect(markdown).toContain('1. 1');
      expect(markdown).toContain('- A');
    });

    test('handles table cell alignment left right center none', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th align="left">L</th><th align="right">R</th><th align="center">C</th><th>N</th></tr></table>'
      });
      expect(markdown).toContain(':--');
      expect(markdown).toContain('--:');
      expect(markdown).toContain(':-:');
    });

    test('handles image with title attribute', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<img src="photo.jpg" alt="Photo" title="My Photo">'
      });
      expect(markdown).toBe('![Photo](photo.jpg "My Photo")');
    });

    test('handles link with title attribute', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<a href="https://example.com" title="Example Site">Visit</a>'
      });
      expect(markdown).toBe('[Visit](https://example.com "Example Site")');
    });

    test('handles list marker with space after numbering', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<blockquote>1. First item here</blockquote>'
      });
      expect(markdown).toContain('>');
    });

    test('handles table with only th and no separator', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><th>Header</th></tr></table>'
      });
      expect(markdown).toContain('Header');
    });

    test('handles td with pipe in beginning', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><td>|value</td></tr></table>'
      });
      expect(markdown).toContain('|value');
    });

    test('handles br immediately after table cell start', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><td><br>Start</td></tr></table>'
      });
      expect(markdown).toContain('Start');
    });

    test('handles br before closing table cell tag', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tr><td>End<br></td></tr></table>'
      });
      expect(markdown).toContain('End');
    });

    test('handles table row with previous sibling tbody', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tbody><tr><td>First</td></tr></tbody><tbody><tr><td>Second</td></tr></tbody></table>'
      });
      expect(markdown).toContain('First');
      expect(markdown).toContain('Second');
    });

    test('handles strikethrough in list', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><strike>Struck item</strike></li></ul>'
      });
      expect(markdown).toContain('~~Struck item~~');
    });

    test('handles unchecked checkbox rendering', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><input type="checkbox"> Unchecked</li></ul>'
      });
      expect(markdown).toContain('[ ]');
    });

    test('handles collapse whitespace in multiple scenarios', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Text    with    multiple     spaces</p>'
      });
      expect(markdown).toBe('Text with multiple spaces');
    });

    test('handles text node collapsing', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Start   <!-- comment -->   End</p>'
      });
      expect(markdown).toContain('Start');
      expect(markdown).toContain('End');
    });

    test('handles pre tag preventing whitespace collapse', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<pre>Text    with    spaces</pre>'
      });
      expect(markdown).toContain('Text    with    spaces');
    });

    test('handles br in heading', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<h2>Title<br>Subtitle</h2>'
      });
      expect(markdown).toContain('Title');
      expect(markdown).toContain('Subtitle');
    });

    test('handles aligned table header in tbody context', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tbody><tr><th align="right">Right</th><th align="left">Left</th></tr></tbody></table>'
      });
      expect(markdown).toContain('--:');
      expect(markdown).toContain(':--');
    });

    test('handles complex nesting with whitespace preservation', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<pre><code>  line1\n    line2\n  line3</code></pre>'
      });
      expect(markdown).toContain('line1');
      expect(markdown).toContain('line2');
      expect(markdown).toContain('line3');
    });

    test('handles blockquote with trailing whitespace', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<blockquote>Quote text   </blockquote>'
      });
      expect(markdown).toContain('>');
      expect(markdown).toContain('Quote text');
    });

    test('handles img in blockquote', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<blockquote><img src="img.png" alt="Image"></blockquote>'
      });
      expect(markdown).toContain('>');
    });

    test('handles strong as first child of li', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><strong>Bold</strong> text</li></ul>'
      });
      expect(markdown).toContain('- **Bold**');
    });

    test('handles em as only child', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p><em>only</em></p>'
      });
      expect(markdown).toBe('*only*');
    });
  });
});
