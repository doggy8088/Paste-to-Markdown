'use strict';

const { test, expect } = require('./support/fixtures');
const { gotoApp, convertPaste } = require('./support/app');

test.describe('convert edge cases', function () {
  test.beforeEach(async function ({ page }) {
    await gotoApp(page);
  });

  // Line 90: getContent skips non-element, non-text children (e.g., comments)
  test('should skip HTML comments inside elements', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<p>Hello<!-- note --> World</p>' });
    expect(markdown).toBe('Hello World');
  });

  test('should skip comments in lists', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<ul><li>Item 1<!-- TODO --></li><li><!-- comment -->Item 2</li></ul>' });
    expect(markdown).toBe('- Item 1\n- Item 2');
  });

  test('should skip comments between block elements', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<div>Para<!-- comment --><p>More</p></div>' });
    expect(markdown).toBe('Para\n\nMore');
  });

  test('should skip comments in nested structures', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<blockquote>Quote<!-- note --> text</blockquote>' });
    expect(markdown).toBe('> Quote text');
  });

  // Lines 132-133: isFlankedByWhitespace with an inline ELEMENT sibling
  test('should preserve spacing with flanking inline elements', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<p><span>foo </span><em>bar</em></p>' });
    expect(markdown).toBe('foo *bar*');
  });

  test('should handle space before inline element sibling', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<p><em>bar</em><span> baz</span></p>' });
    expect(markdown).toBe('*bar* baz');
  });

  test('should test isFlankedByWhitespace with element sibling', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<p>text <strong>bold </strong> more</p>' });
    expect(markdown).toBe('text **bold** more');
  });

  test('should handle flanking with code element', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<p>var <code>x</code> value</p>' });
    expect(markdown).toBe('var `x` value');
  });

  // Lines 231-247: post-processing regex for links wrapping lists
  test('should convert link wrapping unordered list', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<pre>[Title\n- Item 1\n- Item 2](https://example.com)</pre>' });
    expect(markdown).toBe('[Title](https://example.com)\n\n- [Item 1](https://example.com)\n- [Item 2](https://example.com)');
  });

  test('should handle link with ordered list in text', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<pre>[Start\n1. First\n2. Second](https://example.com)</pre>' });
    expect(markdown).toBe('[Start](https://example.com)\n\n1. [First](https://example.com)\n2. [Second](https://example.com)');
  });

  test('should convert link with mixed list markers', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<pre>[Label\n- One\n- Two\n- Three](https://example.com)</pre>' });
    expect(markdown).toBe('[Label](https://example.com)\n\n- [One](https://example.com)\n- [Two](https://example.com)\n- [Three](https://example.com)');
  });

  test('should handle link with empty list item in markdown', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<pre>[Title\n- Item\n- \n- Item2](https://example.com)</pre>' });
    expect(markdown).toBe('[Title](https://example.com)\n\n- [Item](https://example.com)\n- [Item2](https://example.com)');
  });

  // Lines 335-360: table header detection
  test('should treat first row as header in table without thead', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<table><tr><td>Name</td><td>Age</td></tr><tr><td>Alice</td><td>30</td></tr></table>' });
    expect(markdown).toBe('| Name | Age |\n| --- | --- |\n| Alice | 30 |');
  });

  test('should detect first row as header with preceding comments', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<table><!-- comment --><tr><td>Header1</td><td>Header2</td></tr><tr><td>Value1</td><td>Value2</td></tr></table>' });
    expect(markdown).toBe('| Header1 | Header2 |\n| --- | --- |\n| Value1 | Value2 |');
  });

  test('should not treat second tbody first row as header', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<table><tbody><tr><td>H1</td><td>H2</td></tr><tr><td>V1</td><td>V2</td></tr></tbody><tbody><tr><td>Data1</td><td>Data2</td></tr></tbody></table>' });
    expect(markdown).toBe('| H1 | H2 |\n| --- | --- |\n| V1 | V2 |\n| Data1 | Data2 |');
  });

  test('should respect explicit thead for header detection', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<table><thead><tr><td>Name</td><td>Value</td></tr></thead><tbody><tr><td>Alice</td><td>100</td></tr></tbody></table>' });
    expect(markdown).toBe('| Name | Value |\n| --- | --- |\n| Alice | 100 |');
  });

  test('should handle table with whitespace before first tr', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<table>  <tr><td>H</td></tr><tr><td>D</td></tr></table>' });
    expect(markdown).toBe('| H |\n| --- |\n| D |');
  });

  test('should detect header in tbody without preceding tbody', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<table><tbody><tr><th>Header</th></tr><tr><td>Data</td></tr></tbody></table>' });
    expect(markdown).toBe('| Header |\n| --- |\n| Data |');
  });

  test('should handle multiple tbody elements correctly', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<table><tbody><tr><td>H</td></tr></tbody><tbody><tr><td>D</td></tr><tr><td>D2</td></tr></tbody></table>' });
    expect(markdown).toBe('| H |\n| --- |\n| D |\n| D2 |');
  });

  // Lines 845-853: collapse-whitespace removing trailing whitespace-only text node
  test('should remove trailing whitespace-only text nodes in bold', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<p>word <b>bold</b> </p>' });
    expect(markdown).toBe('word **bold**');
  });

  test('should remove trailing whitespace-only text node in span', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<div>text <span> </span></div>' });
    expect(markdown).toBe('text');
  });

  test('should handle multiple trailing spaces', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<p>content <em>italic</em>   </p>' });
    expect(markdown).toBe('content *italic*');
  });

  test('should handle trailing whitespace in various contexts', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<p>text <strong>bold</strong>  </p>' });
    expect(markdown).toBe('text **bold**');
  });

  test('should remove empty trailing spans with space', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<div>text<i> </i></div>' });
    expect(markdown).toBe('text');
  });

  test('should remove trailing space in heading', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<h1>Title <b>bold</b> </h1>' });
    expect(markdown).toBe('# Title **bold**');
  });

  test('should handle trailing whitespace in blockquote', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<blockquote>Quote <strong>text</strong> </blockquote>' });
    expect(markdown).toBe('> Quote **text**');
  });

  // Mutation-specific tests: kill the 6 survived mutants

  // Mutation 1: isFlankedByWhitespace left regex / $/ changed to /$/
  // Left flanking detects trailing space in previous sibling
  test('kills mutation: left flank regex requires trailing space', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<p><b>bold </b><em>text</em></p>' });
    // With space after bold, em is left-flanked and no extra space is added
    expect(markdown).toBe('**bold** *text*');
  });

  // Mutation 2: isFlankedByWhitespace right regex /^ / changed to /^/
  // Right flanking detects leading space in next sibling
  test('kills mutation: right flank regex requires leading space', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<p><em>text</em><b> bold</b></p>' });
    // With space before bold, em is right-flanked and no extra space is added
    expect(markdown).toBe('*text* **bold**');
  });

  // Mutation 3: isFlankedByWhitespace regExp.test(...) inverted
  // If test result is inverted, flanking detection is reversed
  test('kills mutation: flank test result inversion adds unwanted spaces', async function ({ page }) {
    // Element with leading whitespace in HTML but no flanking whitespace from sibling
    const markdown = await convertPaste(page, { html: '<p><span>foo</span><em> bar</em></p>' });
    // Original: foo has no trailing space so em is NOT left-flanked, leading space in em.innerHTML is added
    // Expected: "foo *bar*" (space between foo and em is added)
    // Mutated (inverted test): em would be considered left-flanked, no leading space added
    // Mutated result: "foo*bar*" (no space)
    expect(markdown).toBe('foo *bar*');
  });

  // Mutation 4: link-wrapped-list marker class [-*] changed to [-] only
  // This regex looks for either - or * at start of list items
  test('kills mutation: link-wrapped-list supports asterisk markers', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<pre>[Title\n* One\n* Two](https://example.com)</pre>' });
    // With mutation, * markers won't be recognized, list won't be split
    expect(markdown).toBe('[Title](https://example.com)\n\n* [One](https://example.com)\n* [Two](https://example.com)');
  });

  // Mutation 5: link-wrapped-list callback made to always return ''
  // This would prevent the link from being split into list items
  test('kills mutation: link-wrapped-list processes list items correctly', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<pre>[Guide\n- One\n- Two](https://example.com)</pre>' });
    // With mutation, callback returns '', all links disappear
    expect(markdown).toBe('[Guide](https://example.com)\n\n- [One](https://example.com)\n- [Two](https://example.com)');
  });

  // Mutation 6: tr converter "if (thead.length === 0)" changed to "if (true)"
  // This would always treat first row as header, even when tbody exists with explicit thead
  test('kills mutation: header row detection respects explicit thead', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<table><thead><tr><td>H1</td><td>H2</td></tr></thead><tbody><tr><td>Data1</td><td>Data2</td></tr></tbody></table>' });
    // With mutation changed to "if (true)", even tbody first row would get header separator
    // Expected: only one separator line after thead
    const lines = markdown.trim().split('\n');
    const separatorCount = lines.filter(l => l.includes('---')).length;
    expect(separatorCount).toBe(1);
  });

  // Additional test for mutation 6: ensure first tbody row is NOT treated as header when table has no explicit thead
  test('kills mutation: first tbody row treated as header only when no thead exists', async function ({ page }) {
    const markdown = await convertPaste(page, { html: '<table><tbody><tr><td>Name</td><td>Age</td></tr><tr><td>Alice</td><td>30</td></tr></tbody></table>' });
    // First row of tbody should be treated as header when table has no thead
    expect(markdown).toBe('| Name | Age |\n| --- | --- |\n| Alice | 30 |');
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
