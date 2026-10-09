'use strict';

const { test, expect } = require('./support/fixtures');
const { gotoApp, convertPaste, pasteContent, getMarkdown, readFixture } = require('./support/app');

test.describe('convert-postprocess', function () {
  test.beforeEach(async function ({ page }) {
    await gotoApp(page);
  });

  test.describe('pandoc converter rules', function () {
    test('converts <sup> to ^...^ (superscript)', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>E = mc<sup>2</sup></p>'
      });
      expect(markdown).toContain('^2^');
    });

    test('converts <sub> to ~...~ (subscript)', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>H<sub>2</sub>O</p>'
      });
      expect(markdown).toContain('~2~');
    });

    test('converts <br> to backslash newline', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Line 1<br>Line 2</p>'
      });
      expect(markdown).toContain('\\\n');
    });

    test('converts <hr> to dash rule', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Before</p><hr><p>After</p>'
      });
      expect(markdown).toContain('---');
    });

    test('adds proper spacing around hr', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Before</p><hr><p>After</p>'
      });
      // hr should have newlines on both sides for proper markdown rendering
      expect(markdown).toContain('\n\n---\n\n');
    });

    test('converts <h1> with proper spacing', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<h1>Main Title</h1><p>Content</p>'
      });
      // h1 should have newlines after it
      expect(markdown).toContain('# Main Title\n\n');
    });

    test('converts <h2> with proper spacing', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<h2>Subtitle</h2><p>Content</p>'
      });
      // h2 should have newlines after it
      expect(markdown).toContain('## Subtitle\n\n');
    });

    test('converts <em> to *...*', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>This is <em>emphasized</em> text</p>'
      });
      expect(markdown).toContain('*emphasized*');
    });

    test('converts <i> to *...*', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>This is <i>italic</i> text</p>'
      });
      expect(markdown).toContain('*italic*');
    });

    test('converts <cite> to *...*', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>This is <cite>cited</cite> text</p>'
      });
      expect(markdown).toContain('*cited*');
    });

    test('converts <var> to *...*', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>The variable <var>x</var> is important</p>'
      });
      expect(markdown).toContain('*x*');
    });

    test('converts inline <code> to backticks', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Use <code>console.log()</code> for debugging</p>'
      });
      expect(markdown).toContain('`console.log()`');
    });

    test('converts <kbd> to backticks', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Press <kbd>Ctrl</kbd> to select</p>'
      });
      expect(markdown).toContain('`Ctrl`');
    });

    test('converts <samp> to backticks', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>The output is <samp>42</samp></p>'
      });
      expect(markdown).toContain('`42`');
    });

    test('converts <tt> to backticks', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Code: <tt>x = 5</tt></p>'
      });
      expect(markdown).toContain('`x = 5`');
    });

    test('converts <strong> with trimmed content to **...**', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>This is <strong>bold</strong> text</p>'
      });
      expect(markdown).toContain('**bold**');
    });

    test('converts <b> to **...**', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>This is <b>bold</b> text</p>'
      });
      expect(markdown).toContain('**bold**');
    });

    test('removes empty <strong> elements', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Text <strong>  </strong> more text</p>'
      });
      expect(markdown).not.toContain('****');
    });

    test('handles links with href', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<a href="https://example.com">Example</a>'
      });
      expect(markdown).toContain('[Example](https://example.com)');
    });

    test('handles links with title attribute', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<a href="https://example.com" title="Example Site">Example</a>'
      });
      expect(markdown).toContain('[Example](https://example.com "Example Site")');
    });

    test('converts autolinks (text equals URL)', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<a href="https://example.com">https://example.com</a>'
      });
      expect(markdown).toContain('<https://example.com>');
    });

    test('converts mailto autolinks', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<a href="mailto:user@example.com">user@example.com</a>'
      });
      expect(markdown).toContain('<user@example.com>');
    });

    test('removes empty link text', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<a href="https://example.com">   </a>'
      });
      // Empty link text should produce empty string, no markdown link syntax
      expect(markdown.trim()).toBe('');
    });

    test('normalizes multiline link text', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<a href="https://example.com">Line 1\nLine 2</a>'
      });
      expect(markdown).toContain('Line 1 Line 2');
    });

    test('converts <li> to bullet list', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li>Item 1</li><li>Item 2</li></ul>'
      });
      expect(markdown).toContain('- Item 1');
      expect(markdown).toContain('- Item 2');
    });

    test('converts <li> in <ol> to numbered list', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ol><li>First</li><li>Second</li></ol>'
      });
      expect(markdown).toContain('1. First');
      expect(markdown).toContain('2. Second');
    });

    test('indents nested list items', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li>Item<ul><li>Nested</li></ul></li></ul>'
      });
      expect(markdown).toContain('    - Nested');
    });

    test('preserves p2m-math-block elements', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div class="p2m-math-block">x^2 + y^2 = z^2</div>'
      });
      expect(markdown).toContain('x^2 + y^2 = z^2');
    });

    test('preserves p2m-math-inline elements', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>The equation <span class="p2m-math-inline">E=mc^2</span> is important.</p>'
      });
      expect(markdown).toContain('E=mc^2');
    });
  });

  test.describe('escape function - smart punctuation', function () {
    test('converts left single quote (‘) to apostrophe', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>‘Hello’</p>'
      });
      expect(markdown).toContain("'Hello'");
    });

    test('converts right single quote (’) to apostrophe', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>it’s</p>'
      });
      expect(markdown).toContain("it's");
    });

    test('converts left double quote (“) to straight quote', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>“Hello”</p>'
      });
      expect(markdown).toContain('"Hello"');
    });

    test('converts right double quote (”) to straight quote', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>He said “Hi”</p>'
      });
      expect(markdown).toContain('He said "Hi"');
    });

    test('converts en dash (–) to double dash', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>1970–1980</p>'
      });
      expect(markdown).toContain('1970--1980');
    });

    test('converts em dash (—) to triple dash', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Hello—world</p>'
      });
      expect(markdown).toContain('Hello---world');
    });

    test('converts horizontal ellipsis (…) to three dots', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Wait…</p>'
      });
      expect(markdown).toContain('Wait...');
    });

    test('removes trailing spaces before line breaks', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Text<br>Line 2</p>'
      });
      // Trailing spaces before line breaks should be removed
      expect(markdown).toContain('Text\\\nLine 2');
      expect(markdown).not.toMatch(/Text\s+\\\n/);
    });

    test('includes backslash in br line breaks', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Line 1<br>Line 2</p>'
      });
      // Exact test: br must convert to backslash-newline, not just newline
      expect(markdown).toContain('\\\n');
      expect(markdown).toBe('Line 1\\\nLine 2');
    });

    test('normalizes consecutive backslash newlines', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Line1<br><br>Line2</p>'
      });
      // Should normalize consecutive \\ to single paragraph break
      expect(markdown).toContain('Line1');
      expect(markdown).toContain('Line2');
      // Should not have more than 2 consecutive newlines
      expect(markdown).not.toContain('\\\n\\\n\\\n');
    });

    test('removes trailing spaces at line ends', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Text with trailing spaces   </p>'
      });
      expect(markdown).not.toMatch(/   $/m);
    });

    test('strictly removes trailing spaces with exact assertion', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Exact text   </p>'
      });
      // Should not have trailing spaces
      expect(markdown.trimEnd()).toBe('Exact text');
      expect(markdown).not.toContain('Exact text   ');
    });

    test('replaces non-breaking spaces with regular spaces', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Text with nbsp</p>'
      });
      // Non-breaking spaces should be converted to regular spaces
      expect(markdown).toContain('Text with nbsp');
      // Verify no actual nbsp characters remain
      expect(markdown).not.toContain(' ');
    });

    test('removes zero-width spaces', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Text​with​zero-width</p>'
      });
      expect(markdown).toContain('Textwith');
    });

    test('converts minus sign (−) to dash', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>5−3=2</p>'
      });
      expect(markdown).toContain('5-3');
    });

    test('removes leading and trailing whitespace from entire result', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>   Content   </p>'
      });
      expect(markdown).toBe('Content');
    });

    test('normalizes multiple consecutive newlines to double newline', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>A</p><p>B</p><p>C</p>'
      });
      // Paragraphs should be separated by double newlines, not more
      const matches = markdown.match(/\n\n\n+/);
      expect(matches).toBeNull();
    });

    test('ensures maximum two consecutive newlines', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Paragraph 1</p><p>Paragraph 2</p><p>Paragraph 3</p>'
      });
      // Check: no more than 2 consecutive newlines anywhere
      expect(markdown).not.toMatch(/\n{3,}/);
      // Check: at least some double newlines for paragraph separation
      expect(markdown).toMatch(/\n\n/);
    });
  });

  test.describe('convert function - math processing', function () {
    test('detects and protects literal $$ math blocks', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Formula: $$x^2 + y^2 = z^2$$</p>'
      });
      expect(markdown).toContain('$$x^2 + y^2 = z^2$$');
    });

    test('restores math after post-processing', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>$$a + b = c$$</p>'
      });
      expect(markdown).toContain('a + b = c');
    });

    test('detects KaTeX math elements in HTML', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Equation: <span class="katex"><annotation>E=mc^2</annotation></span></p>'
      });
      // Should preserve the math content from annotation
      expect(markdown).toContain('Equation');
      expect(markdown).toContain('E=mc^2');
    });

    test('detects MathJax math elements in HTML', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Formula: <div class="mjx-display"><annotation>x+y=z</annotation></div></p>'
      });
      // Should preserve the math content from annotation
      expect(markdown).toContain('Formula');
      expect(markdown).toContain('x+y=z');
    });

    test('handles multiple $$ blocks', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>First: $$a+b$$. Second: $$c+d$$.</p>'
      });
      // Should preserve both math blocks
      expect(markdown).toContain('$$a+b$$');
      expect(markdown).toContain('$$c+d$$');
      expect(markdown).toContain('First');
      expect(markdown).toContain('Second');
    });

    test('preserves math inside paragraph', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>The equation $$E=mc^2$$ is famous.</p>'
      });
      expect(markdown).toContain('The equation');
      expect(markdown).toContain('is famous');
    });
  });

  test.describe('convert function - Chinese text processing', function () {
    test('normalizes parentheses next to Chinese text', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>中文(content) 更多文字</p>'
      });
      expect(markdown).toContain('中文（content）');
    });

    test('normalizes parentheses before Chinese bold text', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>中文(desc) **文字**</p>'
      });
      expect(markdown).toContain('中文（desc）');
    });

    test('converts Chinese blockquotes with 或者 separator', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>「引用一」或者：「引用二」</p>'
      });
      expect(markdown).toContain('> 「引用一');
      expect(markdown).toContain('> 或者');
    });

    test('converts single Chinese blockquote', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>「這是一個引用」</p>'
      });
      expect(markdown).toContain('「這是一個引用」');
    });

    test('handles multiple 或者 blockquote options', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>「選項一」或者：「選項二」或者：「選項三」</p>'
      });
      expect(markdown).toContain('> 「選項');
      expect(markdown).toContain('> 或者');
    });

    test('converts bold law headings to H3', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>**第一定律 基本原則**</p>'
      });
      expect(markdown).toContain('### 第一定律 基本原則');
    });

    test('handles numeric law sections', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>**第二法 定義**</p>'
      });
      expect(markdown).toContain('### 第二法 定義');
    });

    test('handles law/rule/regulation characters', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>**第三則 重要規則**</p>'
      });
      expect(markdown).toContain('### 第三則');
    });
  });

  test.describe('convert function - SOUL.md management model formatting', function () {
    test('converts SOUL.md entry to list item', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>SOUL.md --- description</p>'
      });
      expect(markdown).toContain('- SOUL.md ---');
    });

    test('converts agent-scope.yaml to list item', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>agent-scope.yaml --- config</p>'
      });
      expect(markdown).toContain('- agent-scope.yaml ---');
    });

    test('converts 執行階段配置 to list item', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>執行階段配置 --- details</p>'
      });
      expect(markdown).toContain('- 執行階段配置 ---');
    });

    test('converts 代理註冊表 to list item', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>代理註冊表 --- info</p>'
      });
      expect(markdown).toContain('- 代理註冊表 ---');
    });

    test('converts 外部監控 to list item', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>外部監控 --- monitoring</p>'
      });
      expect(markdown).toContain('- 外部監控 ---');
    });

    test('removes blank lines between consecutive management model items', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>SOUL.md --- a</p><p>agent-scope.yaml --- b</p>'
      });
      // Check that consecutive list items are not separated by blank lines
      const pattern = /- SOUL\.md[^\n]*\n- agent-scope\.yaml/;
      expect(markdown).toMatch(pattern);
    });
  });

  test.describe('convert function - tags separator', function () {
    test('adds separator before 人工智慧 tag', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Some content</p><a href="https://example.com">人工智慧</a>'
      });
      expect(markdown).toContain('---');
      expect(markdown).toContain('[人工智慧]');
    });

    test('adds separator before Cybersecurity tag', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Some content</p><a href="https://example.com">Cybersecurity</a>'
      });
      expect(markdown).toContain('---');
      expect(markdown).toContain('[Cybersecurity]');
    });

    test('preserves link format with separator', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Some text before</p><a href="url">人工智慧</a>'
      });
      expect(markdown).toContain('---');
    });
  });

  test.describe('HTML preprocessing - p inside li', function () {
    test('removes <p> tags inside <li>', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><p>Item text</p></li></ul>'
      });
      expect(markdown).toContain('- Item text');
      expect(markdown).not.toContain('<p>');
    });

    test('preserves list nesting when removing <p> inside <li>', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>'
      });
      expect(markdown).toContain('- Item 1');
      expect(markdown).toContain('- Item 2');
    });

    test('removes <p> with attributes inside <li>', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><p class="special">Item</p></li></ul>'
      });
      expect(markdown).toContain('- Item');
    });

    test('removes <li> with attributes when they contain <p>', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li class="active"><p>Item</p></li></ul>'
      });
      expect(markdown).toContain('- Item');
    });

    test('extracts text when <p> is inside <li>', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><p>Item content</p></li></ul>'
      });
      // The p unwrap must extract content correctly
      const match = markdown.match(/- Item content/);
      expect(match).not.toBeNull();
      // Make sure there are no p tags in the output
      expect(markdown.toLowerCase()).not.toContain('<p>');
    });

    test('handles multiple nested p tags in li', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><p>First</p><p>Second</p></li></ul>'
      });
      expect(markdown).toContain('- First');
      expect(markdown).toContain('Second');
    });

    test('ensures p content is on same line as li bullet', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><p>Text here</p></li></ul>'
      });
      // If p is not unwrapped, the text would be on multiple lines
      // With unwrap, it should be: "- Text here" on one line
      expect(markdown).toBe('- Text here');
    });
  });

  test.describe('HTML preprocessing - br normalization', function () {
    test('normalizes <br /> to <br>', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Line1<br />Line2</p>'
      });
      expect(markdown).toContain('\\\n');
    });

    test('normalizes <br/> to <br>', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Line1<br/>Line2</p>'
      });
      expect(markdown).toContain('\\\n');
    });

    test('normalizes <br > with whitespace to <br>', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Line1<br >Line2</p>'
      });
      expect(markdown).toContain('\\\n');
    });

    test('normalizes <BR /> uppercase to <br>', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Line1<BR />Line2</p>'
      });
      expect(markdown).toContain('\\\n');
    });
  });

  test.describe('HTML preprocessing - read-frog artifacts', function () {
    test('removes .read-frog-spinner elements', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Content<span class="read-frog-spinner">Loading...</span> more</p>'
      });
      expect(markdown).not.toContain('Loading');
      expect(markdown).toContain('Content');
      expect(markdown).toContain('more');
    });

    test('unwraps .read-frog-translated-content-wrapper', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Before<span class="read-frog-translated-content-wrapper">translated text</span>after</p>'
      });
      expect(markdown).toContain('translated text');
      expect(markdown).not.toContain('wrapper');
    });

    test('removes multiple spinners', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p><span class="read-frog-spinner">1</span>Text<span class="read-frog-spinner">2</span></p>'
      });
      expect(markdown).toContain('Text');
      expect(markdown).not.toContain('1');
      expect(markdown).not.toContain('2');
    });

    test('unwraps nested content in translation wrapper', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Start<span class="read-frog-translated-content-wrapper"><b>bold text</b></span>end</p>'
      });
      expect(markdown).toContain('bold text');
      expect(markdown).toContain('Start');
      expect(markdown).toContain('end');
    });

    test('handles spinners with text nodes', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div>Before<span class="read-frog-spinner">🔄</span> After</div>'
      });
      expect(markdown).toContain('Before');
      expect(markdown).toContain('After');
    });

    test('unwraps wrappers with multiple children', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p><span class="read-frog-translated-content-wrapper">First <b>bold</b> then</span></p>'
      });
      expect(markdown).toContain('First');
      expect(markdown).toContain('bold');
      expect(markdown).toContain('then');
    });
  });

  test.describe('HTML preprocessing - block elements in headings', function () {
    test('unwraps div inside heading', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<h1><div>Title Text</div></h1>'
      });
      expect(markdown).toContain('# Title Text');
      expect(markdown).not.toContain('<div>');
    });

    test('unwraps p inside heading', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<h2><p>Subtitle</p></h2>'
      });
      expect(markdown).toContain('## Subtitle');
      expect(markdown).not.toContain('<p>');
    });

    test('unwraps multiple block elements inside heading', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<h1><div>Part</div> <span>One</span></h1>'
      });
      expect(markdown).toContain('# Part');
      expect(markdown).toContain('One');
    });

    test('unwraps nested blocks in h3', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<h3><p><span>Content</span></p></h3>'
      });
      expect(markdown).toContain('### Content');
    });

    test('handles all heading levels', async function ({ page }) {
      for (let i = 1; i <= 6; i++) {
        const markdown = await convertPaste(page, {
          html: `<h${i}><div>Heading ${i}</div></h${i}>`
        });
        expect(markdown).toContain(`Heading ${i}`);
      }
    });
  });

  test.describe('golden fixtures', function () {
    test('tc1: complex Chinese article conversion', async function ({ page }) {
      const source = readFixture('tc1-source.html');
      const expected = readFixture('tc1-perfect.md');

      const markdown = await convertPaste(page, { html: source });
      const normalizedMarkdown = markdown.trimEnd();
      const normalizedExpected = expected.trimEnd();

      expect(normalizedMarkdown).toBe(normalizedExpected);
    });

    test('tc2: loop engineering article conversion', async function ({ page }) {
      const source = readFixture('tc2-source.html');
      const expected = readFixture('tc2-perfect.md');

      const markdown = await convertPaste(page, { html: source });
      const normalizedMarkdown = markdown.trimEnd();
      const normalizedExpected = expected.trimEnd();

      expect(normalizedMarkdown).toBe(normalizedExpected);
    });

    test('tc3: five pieces article conversion', async function ({ page }) {
      const source = readFixture('tc3-source.html');
      const expected = readFixture('tc3-perfect.md');

      const markdown = await convertPaste(page, { html: source });
      const normalizedMarkdown = markdown.trimEnd();
      const normalizedExpected = expected.trimEnd();

      expect(normalizedMarkdown).toBe(normalizedExpected);
    });
  });

  test.describe('plain text processing path', function () {
    test('converts plain text when no HTML is available', async function ({ page }) {
      const markdown = await convertPaste(page, {
        text: 'Hello World'
      });
      expect(markdown).toContain('Hello World');
    });

    test('processes plain text with rules', async function ({ page }) {
      const markdown = await convertPaste(page, {
        text: 'Some plain text content'
      });
      // Plain text should be processed and returned
      expect(markdown).toContain('Some plain text content');
    });

    test('prefers HTML over plain text', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>From HTML</p>',
        text: 'From plain text'
      });
      // When both HTML and plain text are available, HTML should be used
      expect(markdown).toBe('From HTML');
      expect(markdown).not.toContain('From plain text');
    });
  });

  test.describe('edge cases and integration', function () {
    test('handles complex nested structures', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<ul><li><strong>Bold item</strong> with <em>italic</em></li><li><code>code</code> inline</li></ul>'
      });
      expect(markdown).toContain('- **Bold item**');
      expect(markdown).toContain('*italic*');
      expect(markdown).toContain('`code`');
    });

    test('preserves content order in complex HTML', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<div>First<span class="read-frog-spinner">X</span>Middle<span class="read-frog-translated-content-wrapper">Last</span></div>'
      });
      const firstIdx = markdown.indexOf('First');
      const middleIdx = markdown.indexOf('Middle');
      const lastIdx = markdown.indexOf('Last');
      expect(firstIdx).toBeLessThan(middleIdx);
      expect(middleIdx).toBeLessThan(lastIdx);
    });

    test('handles mixed processing rules', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Text with <sup>1</sup> superscript and en–2010 dash</p>'
      });
      // Should convert superscript and en-dash
      expect(markdown).toContain('Text with ^1^');
      expect(markdown).toContain('en--2010');
    });

    test('escapes content after heading unwrapping', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<h1><div>“Quoted” Title</div></h1>'
      });
      expect(markdown).toContain('# "Quoted" Title');
    });

    test('handles empty and whitespace-only elements', async function ({ page }) {
      const markdown = await convertPaste(page, {
        html: '<p>Before</p><p>   </p><p>After</p>'
      });
      expect(markdown).toContain('Before');
      expect(markdown).toContain('After');
    });
  });
});
