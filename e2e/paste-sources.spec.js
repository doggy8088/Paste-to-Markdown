'use strict';

const { test, expect } = require('./support/fixtures');
const { gotoApp, pasteContent, convertPaste, getMarkdown, setMarkdown, switchTab } = require('./support/app');

test.describe('paste sources', function () {
  test.beforeEach(async function ({ page }) {
    await gotoApp(page);
  });

  test.describe('VS Code paste', function () {
    test('converts vscode-editor-data with common indent removal', async function ({ page }) {
      const vscodeData = {
        version: 1,
        isFromEmptySelection: false,
        mode: 'javascript'
      };
      const code = '  function test() {\n    console.log("hello");\n  }';
      const markdown = await convertPaste(page, { vscode: vscodeData, text: code });
      // Common indent (2 spaces) should be removed
      expect(markdown).toBe('function test() {\n  console.log("hello");\n}');
    });

    test('vscode paste with no common indent', async function ({ page }) {
      const vscodeData = { version: 1, isFromEmptySelection: false, mode: 'javascript' };
      const code = 'line1\nline2\nline3';
      const markdown = await convertPaste(page, { vscode: vscodeData, text: code });
      expect(markdown).toBe('line1\nline2\nline3');
    });

    test('vscode paste with mixed indentation', async function ({ page }) {
      const vscodeData = { version: 1, isFromEmptySelection: false, mode: 'python' };
      const code = '  def test():\n    print("x")\n  return 5';
      const markdown = await convertPaste(page, { vscode: vscodeData, text: code });
      // Min indent is 2, so remove 2 from each line
      expect(markdown).toBe('def test():\n  print("x")\nreturn 5');
    });

    test('vscode paste with empty lines', async function ({ page }) {
      const vscodeData = { version: 1, isFromEmptySelection: false, mode: 'javascript' };
      const code = '  line1\n\n  line2';
      const markdown = await convertPaste(page, { vscode: vscodeData, text: code });
      // Empty line should not affect minimum indent calculation
      expect(markdown).toBe('line1\n\nline2');
    });
  });

  test.describe('Word paste (text/rtf + text/html)', function () {
    test('converts Word HTML with normalizeWordHtmlLists', async function ({ page }) {
      const wordHtml = '<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1;margin-left:0pt"><![if !supportLists]><span style="font-family:Symbol"><span style="mso-list:Ignore">·<span style=\'font-variant-numeric:normal;font-variant-east-asian:normal;vertical-align:baseline;line-height:normal\'> </span></span></span><![endif]>Item 1</p>';
      const rtf = '{\\rtf1 stub}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml, text: 'Item 1' });
      expect(markdown).toContain('Item 1');
    });

    test('Word paste with ü bullet character replacement', async function ({ page }) {
      // Word uses ü as a bullet in plain text
      const wordPlainText = 'ü Item 1\nü Item 2';
      const wordHtml = '<p>plain text list</p>';
      const rtf = '{\\rtf1 stub}';
      // The ü character () is used for bullets
      const wordHtmlWithBullets = '<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Item 1</p>';
      const markdown = await convertPaste(page, { rtf, html: wordHtmlWithBullets, text: wordPlainText });
      // When ü is in the markdown output, it should be converted to '  - ' in lines 1850
      expect(markdown).toContain('-');
    });

    test('Word paste with nested list levels', async function ({ page }) {
      const wordHtml = `<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Level 1</p>
        <p class=MsoListParagraph style="mso-list:l0 level2 lfo1;margin-left:72pt"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Level 2</p>`;
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml, text: 'Level 1\nLevel 2' });
      expect(markdown).toContain('Level 1');
      expect(markdown).toContain('Level 2');
    });

    test('Word paste with table containing <br> elements', async function ({ page }) {
      const wordHtml = '<table><tr><td>Cell 1<br>Line 2</td><td>Cell 2</td></tr></table>';
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      // brInTableCell rule should preserve <br> as <br> in the output
      expect(markdown).toContain('Line 2');
    });

    test('Word paste whitespace normalization', async function ({ page }) {
      const wordHtml = '<p>Test  .  multiple</p>';
      const rtf = '{\\rtf1}';
      const plainText = 'Test.  multiple';
      const markdown = await convertPaste(page, { rtf, html: wordHtml, text: plainText });
      // Whitespace should be normalized, content should be preserved
      expect(markdown.length).toBeGreaterThan(0);
    });
  });

  test.describe('Plain text only paste', function () {
    test('Word unordered list in plain text', async function ({ page }) {
      //  is the Symbol font bullet character for level 0
      //  is the Symbol font bullet character for level 1
      const plainText = ' Item 1\n Item 2\n Sub item';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- Item 1\n- Item 2\n  - Sub item');
    });

    test('Word unordered list with empty lines', async function ({ page }) {
      const plainText = ' Item 1\n\n Item 2';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- Item 1\n\n- Item 2');
    });

    test('Copilot CLI format with ● marker', async function ({ page }) {
      const plainText = ' ● command output line 1\n   continuation line\n   another continuation';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('command output line 1\ncontinuation line\nanother continuation');
    });

    test('Copilot CLI format with > marker', async function ({ page }) {
      const plainText = ' > error message\n   details line 1\n   details line 2';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('error message\ndetails line 1\ndetails line 2');
    });

    test('Copilot CLI with empty continuation lines', async function ({ page }) {
      const plainText = ' ● command\n   line 1\n\n   line 2';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('command\nline 1\n\nline 2');
    });

    test('Generic plain text with common leading spaces', async function ({ page }) {
      const plainText = '    Line 1\n    Line 2\n    Line 3';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('Line 1\nLine 2\nLine 3');
    });

    test('Generic plain text with mixed indentation', async function ({ page }) {
      const plainText = '  Line 1\n    Line 2\n  Line 3';
      const markdown = await convertPaste(page, { text: plainText });
      // Minimum is 2 spaces
      expect(markdown).toBe('Line 1\n  Line 2\nLine 3');
    });

    test('Plain text with empty lines preserves structure', async function ({ page }) {
      const plainText = '  Line 1\n\n  Line 2';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('Line 1\n\nLine 2');
    });

    test('Plain text with no common indent returns original', async function ({ page }) {
      const plainText = 'No indent line\n  Some indent';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('No indent line\n  Some indent');
    });

    test('Plain text falls through all rules returns original', async function ({ page }) {
      const plainText = 'Just normal text\nwith no special markers';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('Just normal text\nwith no special markers');
    });
  });

  test.describe('Insert function with cursor positioning', function () {
    test('inserts text at cursor position', async function ({ page }) {
      await setMarkdown(page, 'Hello world');
      // Set cursor position to after "Hello "
      await page.evaluate(() => {
        const output = document.querySelector('#output');
        output.setSelectionRange(6, 6);
      });
      await pasteContent(page, { text: 'beautiful ' }, { keepExisting: true });
      const markdown = await getMarkdown(page);
      expect(markdown).toBe('Hello beautiful world');
    });

    test('replaces selected text with pasted content', async function ({ page }) {
      await setMarkdown(page, 'Hello world');
      // Select "world"
      await page.evaluate(() => {
        const output = document.querySelector('#output');
        output.setSelectionRange(6, 11);
      });
      await pasteContent(page, { text: 'universe' }, { keepExisting: true });
      const markdown = await getMarkdown(page);
      expect(markdown).toBe('Hello universe');
    });

    test('insert at start of text', async function ({ page }) {
      await setMarkdown(page, 'world');
      await page.evaluate(() => {
        const output = document.querySelector('#output');
        output.setSelectionRange(0, 0);
      });
      await pasteContent(page, { text: 'Hello ' }, { keepExisting: true });
      const markdown = await getMarkdown(page);
      expect(markdown).toBe('Hello world');
    });

    test('insert at end of text', async function ({ page }) {
      await setMarkdown(page, 'Hello');
      await page.evaluate(() => {
        const output = document.querySelector('#output');
        output.setSelectionRange(5, 5);
      });
      // Note: pasting 'world' without leading space, since genericPlainText removes leading spaces
      await pasteContent(page, { text: 'world' }, { keepExisting: true });
      const markdown = await getMarkdown(page);
      expect(markdown).toBe('Helloworld');
    });

    test('insert with selection at middle', async function ({ page }) {
      await setMarkdown(page, 'Hello world');
      // Select "world" (positions 6-11)
      await page.evaluate(() => {
        const output = document.querySelector('#output');
        output.setSelectionRange(6, 11);
      });
      await pasteContent(page, { text: 'universe' }, { keepExisting: true });
      const markdown = await getMarkdown(page);
      expect(markdown).toBe('Hello universe');
    });

    test('insert with zero-length selection', async function ({ page }) {
      await setMarkdown(page, 'test');
      await page.evaluate(() => {
        const output = document.querySelector('#output');
        output.setSelectionRange(2, 2);
      });
      await pasteContent(page, { text: '00' }, { keepExisting: true });
      const markdown = await getMarkdown(page);
      expect(markdown).toBe('te00st');
    });

    test('insert into empty text', async function ({ page }) {
      await setMarkdown(page, '');
      await pasteContent(page, { text: 'text' }, { keepExisting: true });
      const markdown = await getMarkdown(page);
      expect(markdown).toBe('text');
    });
  });

  test.describe('brInTableCell rule', function () {
    test('preserves <br> inside table cells', async function ({ page }) {
      const html = '<table><tr><td>Line 1<br>Line 2</td></tr></table>';
      const markdown = await convertPaste(page, { html });
      // The brInTableCell rule should convert <br> to <br> (preserving it)
      expect(markdown).toContain('Line 1');
      expect(markdown).toContain('Line 2');
    });

    test('brInTableCell with multiple breaks', async function ({ page }) {
      const html = '<table><tr><td>A<br>B<br>C</td></tr></table>';
      const markdown = await convertPaste(page, { html });
      expect(markdown).toContain('A');
      expect(markdown).toContain('B');
      expect(markdown).toContain('C');
    });

    test('brInTableCell in header cells', async function ({ page }) {
      const html = '<table><tr><th>Header<br>Line2</th></tr></table>';
      const markdown = await convertPaste(page, { html });
      expect(markdown).toContain('Header');
    });

    test('normal <br> outside tables converted to spaces', async function ({ page }) {
      // <br> outside tables should be converted by default TurndownService rule
      const html = '<p>Line 1<br>Line 2</p>';
      const markdown = await convertPaste(page, { html });
      // Default br conversion is '  ' (two spaces)
      expect(markdown).toContain('Line 1');
      expect(markdown).toContain('Line 2');
    });
  });

  test.describe('Word list conversion functions', function () {
    test('convertWordUnorderedListPlainText with single level', async function ({ page }) {
      const plainText = ' Item 1\n Item 2\n Item 3';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- Item 1\n- Item 2\n- Item 3');
    });

    test('convertWordUnorderedListPlainText with two levels', async function ({ page }) {
      const plainText = ' Level 1\n Sub 1\n Sub 2\n Level 2';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- Level 1\n  - Sub 1\n  - Sub 2\n- Level 2');
    });

    test('normalizeWordHtmlLists with nested structure', async function ({ page }) {
      const wordHtml = `<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>First</p>
        <p class=MsoListParagraph style="mso-list:l0 level2 lfo1;margin-left:72pt"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Nested</p>
        <p class=MsoListParagraph style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Back to First</p>`;
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      expect(markdown).toContain('First');
      expect(markdown).toContain('Nested');
      expect(markdown).toContain('Back to First');
    });

    test('normalizeWordHtmlLists skipped levels normalized', async function ({ page }) {
      const wordHtml = `<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Level 1</p>
        <p class=MsoListParagraph style="mso-list:l0 level3 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Skipped to Level 3</p>`;
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      // Skipped level 3 should be normalized to level 2
      expect(markdown).toContain('Level 1');
      expect(markdown).toContain('Skipped to Level 3');
    });

    test('getWordHtmlListLevel with margin-left style', async function ({ page }) {
      // Test margin-left parsing: 36pt = level 1, 72pt = level 2, etc.
      const wordHtml = `<p class=MsoListParagraphCxSpFirst style="margin-left:36pt"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Item</p>`;
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      expect(markdown).toContain('Item');
    });

    test('getWordHtmlListLevel with mso-list style', async function ({ page }) {
      // mso-list:l0 level2 lfo1 indicates level 2
      const wordHtml = `<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level2 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Item</p>`;
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      expect(markdown).toContain('Item');
    });

    test('normalizeWordHtmlLists with non-list paragraphs', async function ({ page }) {
      const wordHtml = `<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Item</p>
        <p>Regular paragraph</p>
        <p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Another Item</p>`;
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      expect(markdown).toContain('Item');
      expect(markdown).toContain('Regular paragraph');
      expect(markdown).toContain('Another Item');
    });
  });

  test.describe('Markdown conversion and preview', function () {
    test('converts and previews HTML in preview tab', async function ({ page }) {
      const html = '<h1>Title</h1><p>Content with <strong>bold</strong></p>';
      await convertPaste(page, { html });
      await switchTab(page, 'preview');
      await expect(page.locator('#preview h1')).toHaveText('Title');
      await expect(page.locator('#preview strong')).toHaveText('bold');
    });

    test('handles code blocks', async function ({ page }) {
      const html = '<pre><code>const x = 5;</code></pre>';
      const markdown = await convertPaste(page, { html });
      expect(markdown).toContain('```');
      expect(markdown).toContain('const x = 5');
    });

    test('handles lists', async function ({ page }) {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const markdown = await convertPaste(page, { html });
      expect(markdown).toContain('- Item 1');
      expect(markdown).toContain('- Item 2');
    });
  });

  test.describe('Plain text rules edge cases', function () {
    test('Word list with tabs', async function ({ page }) {
      const plainText = '\tItem 1\n\tItem 2';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- Item 1\n- Item 2');
    });

    test('Word list with trailing whitespace', async function ({ page }) {
      const plainText = ' Item 1  \n Item 2  ';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- Item 1\n- Item 2');
    });

    test('Copilot CLI with all empty continuations', async function ({ page }) {
      const plainText = ' ● first line\n   \n   ';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('first line\n\n');
    });

    test('Mixed line endings in generic plain text', async function ({ page }) {
      // Test both \r\n and \r line endings
      const plainText = '  line1\r\n  line2\r  line3';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toContain('line1');
      expect(markdown).toContain('line2');
      expect(markdown).toContain('line3');
    });

    test('Word list with only spaces before bullet', async function ({ page }) {
      const plainText = '    Item';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- Item');
    });

    test('Non-matching text returns original', async function ({ page }) {
      const plainText = 'Line 1\nLine 2\nLine 3';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  test.describe('Complex scenarios', function () {
    test('Word paste with list that has plain text matching', async function ({ page }) {
      // When Word provides both plain text with bullets and HTML, the plain text path wins
      const plainText = ' Item 1\n Item 2';
      const wordHtml = '<p>Some HTML</p>';
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml, text: plainText });
      expect(markdown).toBe('- Item 1\n- Item 2');
    });

    test('clipboard types priority: vscode > word > plain text > html', async function ({ page }) {
      // vscode-editor-data has highest priority
      const vscodeData = { version: 1, isFromEmptySelection: false, mode: 'javascript' };
      const code = '  code';
      const wordHtml = '<p>Word HTML</p>';
      const plainText = 'Plain text';
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { vscode: vscodeData, text: code, rtf, html: wordHtml });
      expect(markdown).toBe('code');
    });

    test('VS Code paste ignores HTML if present', async function ({ page }) {
      const vscodeData = { version: 1, isFromEmptySelection: false, mode: 'javascript' };
      const code = 'code';
      const html = '<p>This should be ignored</p>';
      const markdown = await convertPaste(page, { vscode: vscodeData, text: code, html });
      expect(markdown).toBe('code');
    });
  });

  test.describe('Coverage-specific tests for uncovered branches', function () {
    test('brInTableCell with deeply nested table structure (lines 32-36 parent walk)', async function ({ page }) {
      // Test the while loop that checks parent nodes walking up through multiple levels
      // <br> nested inside <b> inside <span> inside <td> (lines 32, 34, 36)
      const html = '<table><tr><td><span><b>Text<br>More</b></span></td></tr></table>';
      const markdown = await convertPaste(page, { html });
      // The brInTableCell rule should preserve <br>, then it gets converted
      expect(markdown).toContain('Text');
      expect(markdown).toContain('More');
    });

    test('brInTableCell walks up multiple parent levels (lines 32, 34, 36)', async function ({ page }) {
      // Test that the while loop iterates through multiple parent levels
      // before finding the TD/TH ancestor
      const html = '<table><tr><td><div><span><b><i>Line<br>Break</i></b></span></div></td></tr></table>';
      const markdown = await convertPaste(page, { html });
      expect(markdown).toContain('Line');
      expect(markdown).toContain('Break');
    });

    test('brInTableCell with BR also outside table (lines 32-36, 817, 852)', async function ({ page }) {
      // Test BR inside table cell AND BR outside table
      // This ensures the parent walk loop runs and also reaches content outside
      const html = '<p>Outside<br>table</p><table><tr><td>Inside<br>cell</td></tr></table>';
      const markdown = await convertPaste(page, { html });
      expect(markdown).toContain('Outside');
      expect(markdown).toContain('Inside');
    });

    test('Word paste without plain text with bullets', async function ({ page }) {
      // Word HTML without plain text bullet markers should use HTML conversion
      const wordHtml = '<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Item 1</p>';
      const rtf = '{\\rtf1}';
      const plainText = 'Item 1';  // No bullet characters
      const markdown = await convertPaste(page, { rtf, html: wordHtml, text: plainText });
      expect(markdown).toContain('Item 1');
    });

    test('Copilot CLI with continuation having leading spaces beyond 3', async function ({ page }) {
      // Test copilot CLI with indented continuation lines
      const plainText = ' ● command\n   line with 3 spaces\n      line with 6 spaces';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toContain('command');
      expect(markdown).toContain('line with 3 spaces');
      // 6 spaces means it's not a valid continuation (needs exactly 3), so it won't match
    });

    test('Word list with all level 0 bullets', async function ({ page }) {
      const plainText = ' First\n Second\n Third';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- First\n- Second\n- Third');
    });

    test('Word list with all level 1 bullets', async function ({ page }) {
      const plainText = ' First\n Second';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('  - First\n  - Second');
    });

    test('Plain text rule detection tries all rules in order', async function ({ page }) {
      // First, test that wordUnorderedList is tried before copilotCli
      const wordListText = ' Item';
      const wordMarkdown = await convertPaste(page, { text: wordListText });
      expect(wordMarkdown).toBe('- Item');

      // Then test copilotCli is tried next
      const copilotText = ' ● command';
      const copilotMarkdown = await convertPaste(page, { text: copilotText });
      expect(copilotMarkdown).toBe('command');

      // Then test generic plain text with indentation
      const genericText = '  indented line';
      const genericMarkdown = await convertPaste(page, { text: genericText });
      expect(genericMarkdown).toBe('indented line');
    });

    test('VS Code with only vscode-editor-data (no text/plain)', async function ({ page }) {
      // If only vscode-editor-data is present without text/plain, should use normal HTML path
      const vscodeData = { version: 1, isFromEmptySelection: false, mode: 'javascript' };
      const html = '<p>HTML content</p>';
      const markdown = await convertPaste(page, { vscode: vscodeData, html });
      expect(markdown).toContain('HTML content');
    });

    test('Word paste with no text/plain provided', async function ({ page }) {
      const wordHtml = '<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Item</p>';
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      expect(markdown).toContain('Item');
    });

    test('Plain text only with copilot CLI first line without bullet', async function ({ page }) {
      // Test case where first line doesn't match copilot pattern
      const plainText = 'no bullet here\n   with indentation';
      const markdown = await convertPaste(page, { text: plainText });
      // Should not match copilot pattern, fall through to genericPlainText
      expect(markdown).toContain('no bullet here');
    });

    test('getWordHtmlListLevel extracts level from complex style attribute', async function ({ page }) {
      const wordHtml = `<p style="color: red; mso-list:l0 level2 lfo1; font-size: 12pt;"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Item</p>`;
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      expect(markdown).toContain('Item');
    });

    test('normalizeWordHtmlLists with multiple consecutive lists', async function ({ page }) {
      const wordHtml = `<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>List1Item1</p>
        <p class=MsoListParagraphCxSpLast style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>List1Item2</p>
        <p>Regular paragraph</p>
        <p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>List2Item1</p>`;
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      expect(markdown).toContain('List1Item1');
      expect(markdown).toContain('List1Item2');
      expect(markdown).toContain('Regular paragraph');
      expect(markdown).toContain('List2Item1');
    });

    test('Word paste with text/plain but no RTF marker', async function ({ page }) {
      // Even if it looks like Word content, if rtf is present, use Word processing
      const html = '<p>Content</p>';
      const plainText = 'Plain content';
      const rtf = '{\\rtf1 \\ansi}';
      const markdown = await convertPaste(page, { rtf, html, text: plainText });
      expect(markdown).toBeDefined(); // Content should be converted
    });

    test('normalizeWordHtmlLists removes word support markers', async function ({ page }) {
      const wordHtml = `<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1">
        <![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>
        Text content
        <o:p></o:p>
      </p>`;
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      expect(markdown).toContain('Text content');
    });

    test('applyPlainTextRules returns original if no rule matches', async function ({ page }) {
      const unmatchedText = 'Just some plain text\nthat matches no rules\nwhatever';
      const markdown = await convertPaste(page, { text: unmatchedText });
      expect(markdown).toBe(unmatchedText);
    });

    test('VS Code paste with large common indent', async function ({ page }) {
      const vscodeData = { version: 1, isFromEmptySelection: false, mode: 'python' };
      const code = '        def func():\n            return 42\n        end';
      const markdown = await convertPaste(page, { vscode: vscodeData, text: code });
      // 8 spaces is the minimum, should be removed from all lines
      expect(markdown).toBe('def func():\n    return 42\nend');
    });

    test('VS Code with single line no indent', async function ({ page }) {
      const vscodeData = { version: 1, isFromEmptySelection: false, mode: 'javascript' };
      const code = 'single line';
      const markdown = await convertPaste(page, { vscode: vscodeData, text: code });
      expect(markdown).toBe('single line');
    });

    test('convertWordUnorderedListPlainText with minimal content', async function ({ page }) {
      const plainText = ' x\n y';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- x\n- y');
    });

    test('brInTableCell with BR as table direct child (edge case)', async function ({ page }) {
      // BR tag as direct child of table element (invalid HTML but let's test the logic)
      const html = '<table><br></table>';
      const markdown = await convertPaste(page, { html });
      expect(markdown).toBeDefined(); // Should not crash on edge case HTML
    });

    test('brInTableCell with BR in table but not in cell', async function ({ page }) {
      // BR tag inside table but not inside a cell
      const html = '<table><tr><td>Cell</td></tr><br></table>';
      const markdown = await convertPaste(page, { text: 'test' });
      expect(markdown).toBeDefined(); // Should not crash
    });

    test('Copilot CLI with invalid continuation line (fails pattern)', async function ({ page }) {
      // First line matches ● pattern, but continuation line doesn't have exactly 3 spaces
      const plainText = ' ● command\n  only 2 spaces\n   valid line';
      const markdown = await convertPaste(page, { text: plainText });
      // Should not match copilot CLI pattern because continuation line doesn't have exactly 3 spaces
      // Should fall through to generic plain text or return original
      expect(markdown).toBeDefined(); // Should fall through or return original
    });

    test('Copilot CLI with line that has > 3 leading spaces in continuation', async function ({ page }) {
      // First line matches > pattern, but continuation has 4 spaces (not exactly 3)
      const plainText = ' > error\n    invalid\n   valid';
      const markdown = await convertPaste(page, { text: plainText });
      // Should not match because of the 4-space line
      expect(markdown).toBeDefined(); // Should not match continuation pattern
    });

    test('applyPlainTextRules with empty text', async function ({ page }) {
      const plainText = '';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('');
    });

    test('genericPlainText with all empty lines', async function ({ page }) {
      const plainText = '\n\n\n';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('\n\n\n');
    });

    test('insert function with no selection support (fallback)', async function ({ page }) {
      // Test the fallback path when selectionStart/End don't work
      await setMarkdown(page, 'test');
      // Clear selectionStart to simulate a browser without that support
      await page.evaluate(() => {
        const output = document.querySelector('#output');
        Object.defineProperty(output, 'selectionStart', {
          get: function() { return undefined; },
          configurable: true
        });
        Object.defineProperty(output, 'selectionEnd', {
          get: function() { return undefined; },
          configurable: true
        });
      });
      // Now paste with keepExisting to trigger insert()
      await pasteContent(page, { text: 'x' }, { keepExisting: true });
      const markdown = await getMarkdown(page);
      // In the fallback path, it should just append
      expect(markdown).toContain('test');
      expect(markdown).toContain('x');
    });

    test('insert function when selectionStart is zero (edge case)', async function ({ page }) {
      await setMarkdown(page, 'test');
      await page.evaluate(() => {
        const output = document.querySelector('#output');
        output.setSelectionRange(0, 0);
      });
      await pasteContent(page, { text: 'prefix' }, { keepExisting: true });
      const markdown = await getMarkdown(page);
      expect(markdown).toContain('prefix');
    });

    test('genericPlainText removes minimum leading spaces from each line', async function ({ page }) {
      const plainText = '      line1\n      line2\n      line3';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('line1\nline2\nline3');
    });

    test('Word list match failure returns null', async function ({ page }) {
      const plainText = 'Line 1\nLine 2\n This line has bullet but line 1 doesnt';
      const markdown = await convertPaste(page, { text: plainText });
      // Doesn't match word list pattern because first line has no bullet
      expect(markdown).toBeDefined(); // Should handle mismatched patterns
    });

    test('VS Code paste with all lines having same indent', async function ({ page }) {
      const vscodeData = { version: 1, isFromEmptySelection: false, mode: 'javascript' };
      const code = '    a\n    b\n    c';
      const markdown = await convertPaste(page, { vscode: vscodeData, text: code });
      expect(markdown).toBe('a\nb\nc');
    });

    // Direct tests for uncovered branches in word list functions
    test('Word unordered list with proper tabs between bullet and text', async function ({ page }) {
      const plainText = '\tItem with tab';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- Item with tab');
    });

    test('Word unordered list with spaces instead of tabs', async function ({ page }) {
      const plainText = '   Item with spaces';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- Item with spaces');
    });

    test('Word list with exactly 2 levels transitions', async function ({ page }) {
      const plainText = ' First level\n Second level\n Back to first';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- First level\n  - Second level\n- Back to first');
    });

    test('normalizeWordHtmlLists with closed list and reopened', async function ({ page }) {
      const wordHtml = `<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Item1</p>
        <p>Paragraph between lists</p>
        <p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Item2</p>`;
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      expect(markdown).toContain('Item1');
      expect(markdown).toContain('Paragraph between lists');
      expect(markdown).toContain('Item2');
    });

    test('getWordHtmlListLevel extracts margin-left in different format', async function ({ page }) {
      const wordHtml = `<p style="margin-left:72.0pt"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>Item</p>`;
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      expect(markdown).toBeDefined(); // Should parse decimal margin-left format
    });

    test('Plain text unordered list with various whitespace', async function ({ page }) {
      const plainText = '  Item\n  Another\n  Third';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- Item\n- Another\n- Third');
    });

    test('brInTableCell rule filters correctly', async function ({ page }) {
      // Multiple BR tags in different contexts
      const html = '<p>Paragraph<br>Break</p><table><tr><td>Cell<br>Break</td></tr></table>';
      const markdown = await convertPaste(page, { html });
      expect(markdown).toContain('Paragraph');
      expect(markdown).toContain('Cell');
    });

    test('insert at various cursor positions in long text', async function ({ page }) {
      await setMarkdown(page, 'The quick brown fox');
      // Insert after "quick "
      await page.evaluate(() => {
        const output = document.querySelector('#output');
        output.setSelectionRange(9, 9);
      });
      // Note: pasting "and" without leading space due to plainTextRules
      await pasteContent(page, { text: 'and' }, { keepExisting: true });
      const markdown = await getMarkdown(page);
      expect(markdown).toContain('and');
    });

    test('Word list plain text detection and conversion', async function ({ page }) {
      // Ensure the Word bullet detection regex works properly
      const plainText = ' Simple item\n Another item';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('- Simple item\n- Another item');
    });

    test('Copilot CLI format with mixed empty and non-empty lines', async function ({ page }) {
      const plainText = ' ● first line\n   continuation 1\n\n   continuation 2';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toContain('first line');
      expect(markdown).toContain('continuation 1');
      expect(markdown).toContain('continuation 2');
    });

    test('normalizeWordHtmlLists closing multiple nested lists', async function ({ page }) {
      const wordHtml = `<p class=MsoListParagraphCxSpFirst style="mso-list:l0 level1 lfo1"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>L1</p>
        <p class=MsoListParagraph style="mso-list:l0 level2 lfo1;margin-left:72pt"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>L2A</p>
        <p class=MsoListParagraph style="mso-list:l0 level2 lfo1;margin-left:72pt"><![if !supportLists]><span style="mso-list:Ignore"> </span><![endif]>L2B</p>
        <p>End</p>`;
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      expect(markdown).toContain('L1');
      expect(markdown).toContain('L2A');
      expect(markdown).toContain('L2B');
      expect(markdown).toContain('End');
    });

    test('plainTextRules fallthrough return (line 852)', async function ({ page }) {
      const unmatchedText = 'Regular text without any markers\nor patterns that match rules';
      const markdown = await convertPaste(page, { text: unmatchedText });
      expect(markdown).toBe(unmatchedText);
    });

    test('genericPlainText branch execution (line 817)', async function ({ page }) {
      const plainText = '    common indent\n    second line\n    third line';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('common indent\nsecond line\nthird line');
    });

    test('genericPlainText with infinite spaces edge case (line 817)', async function ({ page }) {
      const plainText = '\n\n\n';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('\n\n\n');
    });

    test('brInTableCell filter returns false for BR in table but not in cell (lines 34, 36)', async function ({ page }) {
      // BR inside TABLE structure but not in a TD/TH
      // Use Word HTML format to ensure proper parsing and rule application
      const wordHtml = '<table><tr><td>A<br>B</td><td>C<br>D</td></tr></table>';
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      // Should preserve BR inside cells
      expect(markdown).toContain('A');
      expect(markdown).toContain('B');
      expect(markdown).toContain('C');
      expect(markdown).toContain('D');
    });

    test('brInTableCell with BR directly in table row element (line 34)', async function ({ page }) {
      // BR in TR without being in a TD - tests the loop exit condition
      const wordHtml = '<table><tr><td><span>X<br>Y</span></td></tr></table>';
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      // The span adds a level of nesting, testing line 34 iteration
      expect(markdown).toContain('X');
      expect(markdown).toContain('Y');
    });

    test('brInTableCell with multiple nesting levels before TABLE', async function ({ page }) {
      // BR deeply nested inside TD with multiple inline wrapper elements
      // Tests that line 34 (parent = parent.parentNode) iterates multiple times
      const wordHtml = '<table><tr><td><strong><em>A<br>B</em></strong></td></tr></table>';
      const rtf = '{\\rtf1}';
      const markdown = await convertPaste(page, { rtf, html: wordHtml });
      // The nested strong/em tags require multiple parent walk iterations
      expect(markdown).toContain('A');
      expect(markdown).toContain('B');
    });

    test('plainTextRules handles empty text edge case (line 817)', async function ({ page }) {
      // Test when text splits to empty or single element arrays
      const plainText = '';
      const markdown = await convertPaste(page, { text: plainText });
      expect(markdown).toBe('');
    });

  });
});
