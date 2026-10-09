'use strict';

// This file tests the public window.toMarkdown API for code paths the UI can never reach.
// The app always calls toMarkdown(html, { converters: pandoc, gfm: true }), which means
// the library's default converters are shadowed by the app's custom ones.
// These tests call toMarkdown() with different options to cover those default paths.

const { test, expect } = require('./support/fixtures');
const { gotoApp } = require('./support/app');

test.describe('toMarkdown API', function () {
  test('br converter with no options returns two spaces and newline', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<p>line1<br>line2</p>');
    });
    expect(result).toBe('line1  \nline2');
  });

  test('hr converter returns correct markdown', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<p>before</p><hr><p>after</p>');
    });
    expect(result).toContain('* * *');
  });

  test('em and i tags are converted to underscores', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<p><em>italic</em> and <i>also italic</i></p>');
    });
    expect(result).toContain('_italic_');
    expect(result).toContain('_also italic_');
  });

  test('strong and b tags are converted to double asterisks', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<p><strong>bold</strong> and <b>also bold</b></p>');
    });
    expect(result).toContain('**bold**');
    expect(result).toContain('**also bold**');
  });

  test('empty b tag returns empty string', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<p>text<b></b>more</p>');
    });
    // Empty b tags should not produce any markdown
    expect(result).toBe('textmore');
  });

  test('inline code is wrapped in backticks', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<p>Use <code>function()</code> to call it.</p>');
    });
    expect(result).toContain('`function()`');
    expect(result).not.toContain("'function()'");
  });

  test('links with href and text', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<p><a href="http://example.com">click here</a></p>');
    });
    expect(result).toContain('[click here](http://example.com)');
  });

  test('links with title attribute', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<p><a href="http://example.com" title="Example Site">click here</a></p>');
    });
    const mdResult = result.trim();
    expect(mdResult).toContain('[click here](http://example.com "Example Site")');
    // Ensure title is actually included - not just empty brackets
    expect(mdResult).toContain('Example Site');
  });

  test('links with multi-line content normalized with br', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<p><a href="http://example.com">line1<br>line2</a></p>');
    });
    // normalizeLinkContent joins lines with <br>
    expect(result).toContain('[line1<br>line2](http://example.com)');
  });

  test('empty link text returns markdown with empty link', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<p><a href="http://example.com"></a></p>');
    });
    // Empty link text produces [](url) which has the URL even with empty text
    expect(result).toContain('[]');
  });

  test('pre with code block indented with 4 spaces', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<pre><code>var x = 1;</code></pre>');
    });
    expect(result).toContain('    var x = 1;');
  });

  test('ul list items with asterisks and 3 spaces', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<ul><li>item1</li><li>item2</li></ul>');
    });
    expect(result).toContain('*   item1');
    expect(result).toContain('*   item2');
  });

  test('ol list items with numbers and dots', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<ol><li>first</li><li>second</li></ol>');
    });
    expect(result).toContain('1.  first');
    expect(result).toContain('2.  second');
  });

  test('trimListContent preserves leading line breaks', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<ul><li>\nitem</li></ul>');
    });
    // Should preserve structure with leading newline
    expect(result).toContain('*');
    expect(result).toContain('item');
    // Verify that item is properly formatted as a list item
    expect(result).toMatch(/\*\s+item/);
  });

  test('trimListContent returns empty string for whitespace-only content', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<ul><li>   \n   </li></ul>');
    });
    // Whitespace-only list items should be trimmed
    expect(result.trim()).not.toContain('*');
  });

  test('trimListContent preserves trailing line breaks', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<ul><li>item\n</li></ul>');
    });
    // Should preserve structure with trailing line breaks
    expect(result).toContain('item');
  });

  test('trimListContent with both leading and trailing newlines', async function ({ page }) {
    await gotoApp(page);
    const result = await page.evaluate(function () {
      return window.toMarkdown('<ol><li>\n  content\n</li></ol>');
    });
    // Should handle content with both leading and trailing newlines
    expect(result).toContain('content');
  });

  test.describe('default list item converter (trimListContent)', function () {
    test('keeps a leading line break before block content', async function ({ page }) {
      await gotoApp(page);
      const markdown = await page.evaluate(() => window.toMarkdown('<ul><li><p>Para</p></li></ul>'));
      expect(markdown).toBe('*   \n    Para');
    });

    test('drops a whitespace-only item', async function ({ page }) {
      await gotoApp(page);
      const markdown = await page.evaluate(() => window.toMarkdown('<ul><li> </li><li>B</li></ul>'));
      expect(markdown).toBe('*   B');
    });

    test('keeps the line break between text and a nested block', async function ({ page }) {
      await gotoApp(page);
      const markdown = await page.evaluate(() => window.toMarkdown('<ol><li>A<div>nested</div></li></ol>'));
      expect(markdown).toBe('1.  A\n\n    nested');
    });
  });

  test.describe('GFM br converter', function () {
    test('br inside td returns literal br tag', async function ({ page }) {
      await gotoApp(page);
      const result = await page.evaluate(function () {
        return window.toMarkdown('<table><tr><td>line1<br>line2</td></tr></table>', { gfm: true });
      });
      expect(result).toContain('<br>');
    });

    test('br outside table with gfm returns newline', async function ({ page }) {
      await gotoApp(page);
      const result = await page.evaluate(function () {
        return window.toMarkdown('<p>line1<br>line2</p>', { gfm: true });
      });
      expect(result).toContain('line1\nline2');
    });

    test('br inside table caption returns newline (no td ancestor)', async function ({ page }) {
      await gotoApp(page);
      const result = await page.evaluate(function () {
        return window.toMarkdown(
          '<table><caption>Title<br>Subtitle</caption><tr><td>Cell</td></tr></table>',
          { gfm: true }
        );
      });
      // br in caption is not inside td/th, so should return newline not literal br
      const lines = result.split('\n');
      expect(lines.length).toBeGreaterThan(1);
    });
  });

  test.describe('toMarkdown exported helpers', function () {
    test('toMarkdown.outer creates element with content', async function ({ page }) {
      await gotoApp(page);
      const result = await page.evaluate(function () {
        const div = document.createElement('div');
        div.className = 'test-class';
        const outerResult = window.toMarkdown.outer(div, 'hello');
        // Also test without class to verify wrapping behavior
        const span = document.createElement('span');
        const spanResult = window.toMarkdown.outer(span, 'world');
        return {
          div: outerResult,
          span: spanResult
        };
      });
      expect(result.div).toBe('<div class="test-class">hello</div>');
      expect(result.span).toBe('<span>world</span>');
      // Ensure content is actually wrapped, not just replaced
      expect(result.div).toContain('hello');
      expect(result.span).toContain('world');
    });

    test('toMarkdown.isBlock identifies block elements', async function ({ page }) {
      await gotoApp(page);
      const result = await page.evaluate(function () {
        const p = document.createElement('p');
        const span = document.createElement('span');
        const div = document.createElement('div');
        const blockquote = document.createElement('blockquote');
        const em = document.createElement('em');
        return {
          p: window.toMarkdown.isBlock(p),
          span: window.toMarkdown.isBlock(span),
          div: window.toMarkdown.isBlock(div),
          blockquote: window.toMarkdown.isBlock(blockquote),
          em: window.toMarkdown.isBlock(em)
        };
      });
      expect(result.p).toBe(true);
      expect(result.span).toBe(false);
      expect(result.div).toBe(true);
      expect(result.blockquote).toBe(true);
      expect(result.em).toBe(false);
    });

    test('toMarkdown.isVoid identifies void elements', async function ({ page }) {
      await gotoApp(page);
      const result = await page.evaluate(function () {
        const br = document.createElement('br');
        const div = document.createElement('div');
        const hr = document.createElement('hr');
        const img = document.createElement('img');
        const input = document.createElement('input');
        const span = document.createElement('span');
        return {
          br: window.toMarkdown.isVoid(br),
          div: window.toMarkdown.isVoid(div),
          hr: window.toMarkdown.isVoid(hr),
          img: window.toMarkdown.isVoid(img),
          input: window.toMarkdown.isVoid(input),
          span: window.toMarkdown.isVoid(span)
        };
      });
      expect(result.br).toBe(true);
      expect(result.div).toBe(false);
      expect(result.hr).toBe(true);
      expect(result.img).toBe(true);
      expect(result.input).toBe(true);
      expect(result.span).toBe(false);
    });
  });

  test.describe('error handling', function () {
    test('non-string input throws TypeError', async function ({ page }) {
      await gotoApp(page);
      const errors = await page.evaluate(function () {
        const results = {};

        // Test number
        try {
          window.toMarkdown(123);
          results.number = 'no error';
        } catch (e) {
          results.number = e.message;
        }

        // Test boolean
        try {
          window.toMarkdown(true);
          results.boolean = 'no error';
        } catch (e) {
          results.boolean = e.message;
        }

        // Test object
        try {
          window.toMarkdown({});
          results.object = 'no error';
        } catch (e) {
          results.object = e.message;
        }

        return results;
      });

      expect(errors.number).toContain('is not a string');
      expect(errors.boolean).toContain('is not a string');
      expect(errors.object).toContain('is not a string');
    });

    test('converter filter that is a number throws TypeError', async function ({ page }) {
      await gotoApp(page);
      const error = await page.evaluate(function () {
        try {
          window.toMarkdown('<p>test</p>', {
            converters: [
              {
                filter: 123,
                replacement: function () { return 'text'; }
              }
            ]
          });
        } catch (e) {
          return e.message;
        }
      });
      expect(error).toContain('needs to be a string, array, or function');
    });

    test('converter replacement that is not a function throws TypeError', async function ({ page }) {
      await gotoApp(page);
      const error = await page.evaluate(function () {
        try {
          window.toMarkdown('<p>test</p>', {
            converters: [
              {
                filter: 'p',
                replacement: 'not a function'
              }
            ]
          });
        } catch (e) {
          return e.message;
        }
      });
      expect(error).toContain('needs to be a function');
    });
  });

  // to-markdown picks its HTML parser once, when the script loads. These
  // tests emulate legacy browsers with init scripts that run before any app
  // script: DOMParser cannot parse an empty string (so the native parser is
  // rejected), and documents created while the page is loading cannot be
  // opened (so the ActiveX probe takes its catch branch).
  test.describe('legacy HTML parser fallback', function () {
    function emulateLegacyParser(options) {
      const NativeDOMParser = window.DOMParser;
      window.DOMParser = function () {
        this.parseFromString = function (markup, type) {
          return markup === '' ? null : new NativeDOMParser().parseFromString(markup, type);
        };
      };

      const implementation = document.implementation;
      const createHTMLDocument = implementation.createHTMLDocument.bind(implementation);
      implementation.createHTMLDocument = function (title) {
        const doc = createHTMLDocument(title);
        if (document.readyState === 'loading') {
          doc.open = function () {
            throw new Error('open() is unavailable while loading');
          };
        }
        return doc;
      };

      if (options.activeX) {
        window.ActiveXObject = function (progId) {
          window.__activeXProgId = progId;
          return createHTMLDocument('');
        };
      }
    }

    test('uses the ActiveX htmlfile parser when ActiveXObject exists', async function ({ page }) {
      await page.addInitScript(emulateLegacyParser, { activeX: true });
      await gotoApp(page);

      const markdown = await page.evaluate(() => window.toMarkdown('<p>Hello <b>World</b></p>'));

      expect(markdown).toBe('Hello  **World**');
      expect(await page.evaluate(() => window.__activeXProgId)).toBe('htmlfile');
    });

    test('uses the document.write parser when ActiveXObject is missing', async function ({ page }) {
      await page.addInitScript(emulateLegacyParser, { activeX: false });
      await gotoApp(page);

      const markdown = await page.evaluate(() => window.toMarkdown('<p>Test <strong>content</strong></p>'));

      expect(markdown).toBe('Test  **content**');
      expect(await page.evaluate(() => window.__activeXProgId)).toBeUndefined();
    });

    test('uses the document.write parser when documents can be opened', async function ({ page }) {
      await page.addInitScript(function () {
        const NativeDOMParser = window.DOMParser;
        window.DOMParser = function () {
          this.parseFromString = function (markup, type) {
            return markup === '' ? null : new NativeDOMParser().parseFromString(markup, type);
          };
        };
      });
      await gotoApp(page);

      const markdown = await page.evaluate(() => window.toMarkdown('<ul><li>One</li><li>Two</li></ul>'));

      expect(markdown).toBe('*   One\n*   Two');
    });
  });
});
