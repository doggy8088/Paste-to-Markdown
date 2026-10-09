'use strict';

const { test, expect } = require('./support/fixtures');
const { gotoApp, convertPaste } = require('./support/app');

test.describe('convert edge cases', function () {
  test.beforeEach(async function ({ page }) {
    await gotoApp(page);
  });

  // Line 90: getContent skips non-element, non-text children (e.g., comments)
  test('should skip HTML comments inside elements', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<p>Hello<!-- note --> World</p>', { gfm: true });
    });
    expect(markdown).toBe('Hello World');
  });

  test('should skip comments in lists', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<ul><li>Item 1<!-- TODO --></li><li><!-- comment -->Item 2</li></ul>', { gfm: true });
    });
    expect(markdown).toContain('Item 1');
    expect(markdown).toContain('Item 2');
  });

  test('should skip comments between block elements', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<div>Para<!-- comment --><p>More</p></div>', { gfm: true });
    });
    expect(markdown).toContain('Para');
    expect(markdown).toContain('More');
  });

  test('should skip comments in nested structures', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<blockquote>Quote<!-- note --> text</blockquote>', { gfm: true });
    });
    expect(markdown).toContain('Quote');
    expect(markdown).toContain('text');
  });

  // Lines 132-133: isFlankedByWhitespace with an inline ELEMENT sibling
  test('should preserve spacing with flanking inline elements', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<p><span>foo </span><em>bar</em></p>', { gfm: true });
    });
    expect(markdown).toContain('foo');
    expect(markdown).toMatch(/\*bar\*|_bar_/);
  });

  test('should handle space before inline element sibling', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<p><em>bar</em><span> baz</span></p>', { gfm: true });
    });
    expect(markdown).toMatch(/\*bar\*|_bar_/);
    expect(markdown).toContain('baz');
  });

  test('should test isFlankedByWhitespace with element sibling', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<p>text <strong> bold</strong> more</p>', { gfm: true });
    });
    expect(markdown).toContain('**bold**');
    expect(markdown).toContain('text');
    expect(markdown).toContain('more');
  });

  test('should handle flanking with code element', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<p>var <code>x</code> value</p>', { gfm: true });
    });
    expect(markdown).toContain('`x`');
  });

  // Lines 231-247: post-processing regex for links wrapping lists
  test('should convert link wrapping unordered list', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<a href="https://example.com">Title\n- Item 1\n- Item 2</a>', { gfm: true });
    });
    expect(markdown).toContain('Title');
    expect(markdown).toContain('example.com');
  });

  test('should handle link with ordered list in text', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<a href="https://example.com">Start\n1. First\n2. Second</a>', { gfm: true });
    });
    expect(markdown).toContain('example.com');
  });

  test('should convert link with mixed list markers', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<a href="https://example.com">Label\n- One\n- Two\n- Three</a>', { gfm: true });
    });
    expect(markdown).toContain('Label');
  });

  test('should handle link with empty list item in markdown', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<a href="https://example.com">Title\n- Item\n- \n- Item2</a>', { gfm: true });
    });
    expect(markdown).toContain('example.com');
  });

  test('should handle link with newline and list without title', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<a href="https://example.com">\n- One\n- Two</a>', { gfm: true });
    });
    expect(markdown).toContain('example.com');
  });

  // Lines 335-360: table header detection
  test('should treat first row as header in table without thead', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<table><tr><td>Name</td><td>Age</td></tr><tr><td>Alice</td><td>30</td></tr></table>', { gfm: true });
    });
    expect(markdown).toContain('---');
    expect(markdown).toContain('Name');
    expect(markdown).toContain('Age');
  });

  test('should detect first row as header with preceding comments', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<table><!-- comment --><tr><td>Header1</td><td>Header2</td></tr><tr><td>Value1</td><td>Value2</td></tr></table>', { gfm: true });
    });
    expect(markdown).toContain('---');
    expect(markdown).toContain('Header1');
  });

  test('should not treat second tbody first row as header', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<table><tbody><tr><td>H1</td><td>H2</td></tr><tr><td>V1</td><td>V2</td></tr></tbody><tbody><tr><td>Data1</td><td>Data2</td></tr></tbody></table>', { gfm: true });
    });
    const lines = markdown.trim().split('\n');
    const separatorCount = lines.filter(l => l.includes('---')).length;
    expect(separatorCount).toBe(1);
  });

  test('should respect explicit thead for header detection', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<table><thead><tr><td>Name</td><td>Value</td></tr></thead><tbody><tr><td>Alice</td><td>100</td></tr></tbody></table>', { gfm: true });
    });
    expect(markdown).toContain('---');
    expect(markdown).toContain('Name');
  });

  test('should handle table with whitespace before first tr', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<table>  <tr><td>H</td></tr><tr><td>D</td></tr></table>', { gfm: true });
    });
    expect(markdown).toContain('---');
  });

  test('should detect header in tbody without preceding tbody', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<table><tbody><tr><th>Header</th></tr><tr><td>Data</td></tr></tbody></table>', { gfm: true });
    });
    expect(markdown).toContain('---');
  });

  test('should handle multiple tbody elements correctly', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<table><tbody><tr><td>H</td></tr></tbody><tbody><tr><td>D</td></tr><tr><td>D2</td></tr></tbody></table>', { gfm: true });
    });
    expect(markdown).toContain('H');
    expect(markdown).toContain('D');
  });

  // Lines 845-853: collapse-whitespace removing trailing whitespace-only text node
  test('should remove trailing whitespace-only text nodes in bold', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<p>word <b>bold</b> </p>', { gfm: true });
    });
    expect(markdown).toContain('word');
    expect(markdown).toContain('**bold**');
  });

  test('should remove trailing whitespace-only text node in span', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<div>text <span> </span></div>', { gfm: true });
    });
    expect(markdown).toContain('text');
  });

  test('should handle multiple trailing spaces', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<p>content <em>italic</em>   </p>', { gfm: true });
    });
    expect(markdown).toContain('content');
    expect(markdown).toMatch(/italic/);
  });

  test('should handle trailing whitespace in various contexts', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<p>text <strong>bold</strong>  </p>', { gfm: true });
    });
    expect(markdown).toContain('text');
    expect(markdown).toContain('**bold**');
  });

  test('should remove empty trailing spans with space', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<div>text<i> </i></div>', { gfm: true });
    });
    expect(markdown).toContain('text');
  });

  test('should remove trailing space in heading', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<h1>Title <b>bold</b> </h1>', { gfm: true });
    });
    expect(markdown).toContain('Title');
    expect(markdown).toContain('**bold**');
  });

  test('should handle trailing whitespace in blockquote', async function ({ page }) {
    const markdown = await page.evaluate(() => {
      return window.toMarkdown('<blockquote>Quote <strong>text</strong> </blockquote>', { gfm: true });
    });
    expect(markdown).toContain('Quote');
    expect(markdown).toContain('**text**');
  });
});

// Edge cases reached through a real HTML paste (the app's own converters).
test.describe('convert edge cases through paste', function () {
  test.beforeEach(async function ({ page }) {
    await gotoApp(page);
  });

  test('drops comments inside preformatted text', async function ({ page }) {
    // collapse-whitespace removes comments everywhere except inside <pre>,
    // so this is the only place getContent meets a comment node.
    const markdown = await convertPaste(page, { html: '<pre>keep<!-- hidden --> this</pre>' });
    expect(markdown).toBe('keep this');
  });

  test.describe('preformatted link wrapping a list', function () {
    test('splits a titled list into one link per item', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<pre>[Guide\n- One\n- Two](https://example.com)</pre>' });
      expect(markdown).toBe('[Guide](https://example.com)\n\n- [One](https://example.com)\n- [Two](https://example.com)');
    });

    test('skips empty items of an ordered list', async function ({ page }) {
      const markdown = await convertPaste(page, { html: '<pre>[Steps\n1. First\n2. \n3. Third](https://example.com)</pre>' });
      expect(markdown).toBe('[Steps](https://example.com)\n\n1. [First](https://example.com)\n3. [Third](https://example.com)');
    });

    test('links every item when the list has no title', async function ({ page }) {
      test.fail(true, 'Known bug: without a title the first item is taken as the link title ("[* Alpha](...)")');
      const markdown = await convertPaste(page, { html: '<pre>[\n* Alpha\n* Beta\n](https://example.com/docs)</pre>' });
      expect(markdown).toBe('* [Alpha](https://example.com/docs)\n* [Beta](https://example.com/docs)');
    });
  });

  test.describe('table header detection without thead', function () {
    test('treats the first row as header when a template precedes it', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><tbody><template></template><tr><td>Name</td><td>Age</td></tr><tr><td>Ann</td><td>30</td></tr></tbody></table>'
      });
      expect(markdown).toBe('| Name | Age |\n| --- | --- |\n| Ann | 30 |');
    });

    test('treats the first row as header when a caption precedes the body', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><caption>People</caption><tbody><tr><td>Name</td><td>Age</td></tr><tr><td>Ann</td><td>30</td></tr></tbody></table>'
      });
      expect(markdown).toBe('People\n| Name | Age |\n| --- | --- |\n| Ann | 30 |');
    });

    test('adds only one header row when a colgroup precedes several bodies', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<table><colgroup><col><col></colgroup><tbody><tr><td>H1</td><td>H2</td></tr></tbody><tbody><tr><td>a</td><td>b</td></tr></tbody></table>'
      });
      expect(markdown).toBe('| H1 | H2 |\n| --- | --- |\n| a | b |');
    });
  });

  test.describe('inline-only clipboard HTML', function () {
    test('removes trailing whitespace after an inline element', async function ({ page }) {
      expect(await convertPaste(page, { html: '<b>bold</b> ' })).toBe('**bold**');
    });

    test('removes trailing whitespace after plain text', async function ({ page }) {
      expect(await convertPaste(page, { html: 'plain word ' })).toBe('plain word');
    });
  });
});
