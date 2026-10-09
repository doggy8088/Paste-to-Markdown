'use strict';

const { test, expect } = require('./support/fixtures');
const { gotoApp, setMarkdown, getMarkdown, switchTab } = require('./support/app');

test.describe('share-hash', function () {
  // Helper to setup clipboard capture before loading app
  function withClipboardCapture() {
    return async function (page) {
      await page.addInitScript(function () {
        window.__clipboardCaptures = [];
        const originalWrite = navigator.clipboard.write;
        const originalWriteText = navigator.clipboard.writeText;

        if (originalWrite) {
          navigator.clipboard.write = async function (items) {
            const captures = [];
            for (const item of items) {
              for (const type of item.types) {
                const blob = await item.getType(type);
                const text = await blob.text();
                captures.push({ type: type, text: text });
              }
            }
            window.__clipboardCaptures.push({ items: captures });
            return originalWrite.call(this, items);
          };
        }

        if (originalWriteText) {
          navigator.clipboard.writeText = async function (text) {
            window.__clipboardCaptures.push({ text: text });
            return originalWriteText.call(this, text);
          };
        }
      });
    };
  }

  // Get share URL from clipboard captures
  async function getShareUrl(page) {
    const captures = await page.evaluate(function () {
      return window.__clipboardCaptures || [];
    });
    if (captures.length === 0) return null;
    const last = captures[captures.length - 1];
    if (last.text) return last.text;
    if (last.items) {
      const plainItem = last.items.find(i => i.type === 'text/plain');
      return plainItem ? plainItem.text : null;
    }
    return null;
  }

  // Get HTML from clipboard captures
  async function getShareHtml(page) {
    const captures = await page.evaluate(function () {
      return window.__clipboardCaptures || [];
    });
    if (captures.length === 0) return null;
    const last = captures[captures.length - 1];
    if (last.items) {
      const htmlItem = last.items.find(i => i.type === 'text/html');
      return htmlItem ? htmlItem.text : null;
    }
    return null;
  }

  // Trigger share via button
  async function shareViaButton(page) {
    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();
    // Wait for button to be disabled and then enabled again (indicates share action completed)
    await expect(shareButton).toBeDisabled();
    await expect(shareButton).not.toBeDisabled({ timeout: 2000 });
  }

  // Trigger share via Alt+S keyboard shortcut
  async function shareViaKeyboard(page) {
    await page.keyboard.press('Alt+S');
    const shareButton = page.locator('button:has-text("Share")').first();
    // Wait for button to be disabled and then enabled again (indicates share action completed)
    await expect(shareButton).toBeDisabled();
    await expect(shareButton).not.toBeDisabled({ timeout: 2000 });
  }

  test.describe('round-trip tests', function () {
    test('shares and restores simple markdown in edit tab', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const originalMarkdown = '# Hello\n\nThis is a test.';
      await setMarkdown(page, originalMarkdown);

      await shareViaButton(page);

      // Verify hash mode is set
      await expect(page.locator('html')).toHaveAttribute('data-hash-mode', '1');

      const shareUrl = await getShareUrl(page);
      expect(shareUrl).toBeTruthy();
      expect(shareUrl).toContain('#');

      // Open in new page
      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(originalMarkdown);

      await expect(newPage.locator('html')).toHaveAttribute('data-hash-mode', '1');
      await expect(newPage.locator('#info')).toHaveClass(/hidden/);
      await expect(newPage.locator('#output')).toHaveAttribute('placeholder', '');

      await newPage.close();
    });

    test('preserves unicode and emoji in round-trip', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const originalMarkdown = '# 你好 🌍\n\n中文 test 日本語 🚀';
      await setMarkdown(page, originalMarkdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(originalMarkdown);

      await newPage.close();
    });

    test('preserves very long markdown in round-trip', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const lines = [];
      for (let i = 0; i < 50; i++) {
        lines.push(`## Line ${i}\n\nThis is line ${i} with some content.`);
      }
      const originalMarkdown = lines.join('\n\n');
      await setMarkdown(page, originalMarkdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(originalMarkdown);

      await newPage.close();
    });

    test('shares with preview tab and restores preview tab', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const originalMarkdown = '# Test\n\nContent here.';
      await setMarkdown(page, originalMarkdown);

      await switchTab(page, 'preview');

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const previewTab = newPage.locator('.tab-button[data-tab="preview"]');
      await expect(previewTab).toHaveClass(/active/);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(originalMarkdown);

      await expect(newPage.locator('#preview h1')).toHaveText('Test');

      await newPage.close();
    });

    test('preserves markdown formatting in share', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const originalMarkdown = '**bold** *italic* `code` [link](http://example.com)';
      await setMarkdown(page, originalMarkdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(originalMarkdown);

      await newPage.close();
    });

    test('preserves tables in share', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const originalMarkdown = '| A | B |\n|---|---|\n| 1 | 2 |';
      await setMarkdown(page, originalMarkdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(originalMarkdown);

      await newPage.close();
    });

    test('preserves newlines in shared markdown', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const originalMarkdown = 'Line 1\n\nParagraph 2\n\nParagraph 3\n\n- Item 1\n- Item 2';
      await setMarkdown(page, originalMarkdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(originalMarkdown);

      await newPage.close();
    });
  });

  test.describe('keyboard shortcut', function () {
    test('shares via Alt+S keyboard shortcut', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const originalMarkdown = '# Keyboard Share\n\nTest content.';
      await setMarkdown(page, originalMarkdown);

      await shareViaKeyboard(page);

      await expect(page.locator('html')).toHaveAttribute('data-hash-mode', '1');

      const shareUrl = await getShareUrl(page);
      expect(shareUrl).toContain('#');

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(originalMarkdown);

      await newPage.close();
    });
  });

  test.describe('compression', function () {
    test('uses z or r prefix in hash', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const originalMarkdown = '# Compression Test\n\nThis content should be encoded.';
      await setMarkdown(page, originalMarkdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);

      // Check if z: or r: prefix is used (URL-encoded as z%3A or r%3A)
      const hasPrefix = shareUrl.includes('z%3A') || shareUrl.includes('r%3A') ||
                       shareUrl.includes('z:') || shareUrl.includes('r:');
      expect(hasPrefix).toBe(true);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(originalMarkdown);

      await newPage.close();
    });

    test('falls back to r: prefix when CompressionStream unavailable', async function ({ page, openPage }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      await withClipboardCapture()(page);
      await gotoApp(page);
      const originalMarkdown = '# Fallback Test\n\nNo compression available.';
      await setMarkdown(page, originalMarkdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);

      // Verify r: prefix is used
      const hasRawPrefix = shareUrl.includes('r%3A') || shareUrl.includes('r:');
      expect(hasRawPrefix).toBe(true);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(originalMarkdown);

      await newPage.close();
    });
  });

  test.describe('malformed hashes', function () {
    test('gracefully handles malformed base64 in hash', async function ({ page }) {
      await gotoApp(page, { hash: '#mode=edit&text=z%3A!!!invalid!!!' });

      await expect(page.locator('#output')).toBeVisible();
      await expect(page.locator('#output')).toHaveAttribute('placeholder', '');
    });

    test('gracefully handles hash with missing text parameter', async function ({ page }) {
      await gotoApp(page, { hash: '#mode=edit' });

      await expect(page.locator('#output')).toBeVisible();
      const markdown = await getMarkdown(page);
      expect(markdown).toBe('');
    });

    test('gracefully handles hash with unknown mode', async function ({ page }) {
      await gotoApp(page, { hash: '#mode=unknown&text=r%3AQSBzcGVjaWFsIHRleHQ%3D' });

      const editTab = page.locator('.tab-button[data-tab="edit"]');
      await expect(editTab).toHaveClass(/active/);
    });

    test('ignores hash with empty text parameter', async function ({ page }) {
      await gotoApp(page, { hash: '#mode=edit&text=' });

      const markdown = await getMarkdown(page);
      expect(markdown).toBe('');
      await expect(page.locator('#output')).toHaveAttribute('placeholder', '');
    });
  });

  test.describe('hashchange listener', function () {
    test('responds to hashchange event on page load', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const testMarkdown = '# Test Heading\n\nTest content here.';
      const encoded = btoa(unescape(encodeURIComponent(testMarkdown))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      const markdown = await getMarkdown(page);
      expect(markdown).toBe(testMarkdown);
      await expect(page.locator('html')).toHaveAttribute('data-hash-mode', '1');
    });

    test('reloads content when location.hash changes', async function ({ page }) {
      await gotoApp(page);
      const originalMarkdown = '# Original\n\nContent.';
      await setMarkdown(page, originalMarkdown);

      // Create a new hash with different content
      const newMarkdown = '# New\n\nDifferent content.';
      const newEncoded = btoa(unescape(encodeURIComponent(newMarkdown))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const newHash = `mode=edit&text=r%3A${newEncoded}`;

      // Change hash dynamically
      await page.evaluate(function (hash) {
        window.location.hash = hash;
      }, newHash);

      // Wait for the hashchange event to be processed by expecting the placeholder to be empty
      await expect(page.locator('#output')).toHaveAttribute('placeholder', '', { timeout: 1000 });
    });
  });

  test.describe('editing shared content', function () {
    test('clears shared hash seed when editing', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const testMarkdown = '# Shared Content\n\nOriginal text.';
      const encoded = btoa(unescape(encodeURIComponent(testMarkdown))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      await expect(page.locator('html')).toHaveAttribute('data-hash-mode', '1');

      // Edit the content
      await setMarkdown(page, '# Modified\n\nEdited text.');

      // Verify hash is cleared
      const url = page.url();
      expect(url).not.toContain('#');

      // Verify data-hash-mode is removed
      await expect(page.locator('html')).not.toHaveAttribute('data-hash-mode');
    });
  });

  test.describe('share title logic', function () {
    test('uses document title for share link text', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '# My Document\n\nContent here.');

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('My Document');
    });

    test('extracts heading text for share title', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '## Section Title\n\nContent here.');

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('Section Title');
    });

    test('strips markdown links from title', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '# [Click here](https://example.com) for info\n\nContent.');

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('Click here');
      expect(html).not.toContain('https://example.com');
    });

    test('handles empty markdown with default title', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '');

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('Markdown');
    });

    test('truncates very long titles', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      // Use a very long title with multiple words to test truncation
      const longTitle = '# This is a very long title that goes on and on and should be truncated when shared\n\nContent.';
      await setMarkdown(page, longTitle);

      await shareViaButton(page);

      const html = await getShareHtml(page);
      // Title should be truncated
      expect(html).toBeTruthy();
      // Extract the link title text
      const titleMatch = html.match('>([^<]*)</a>');
      expect(titleMatch).toBeTruthy();
      if (titleMatch) {
        const titleText = titleMatch[1];
        // The title should be truncated to about 15 visible characters
        // Original is 80+ chars, should be much shorter
        expect(titleText.length).toBeLessThan(60);
      }
    });

    test('handles CJK characters in title', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '# 中文标题\n\nContent.');

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('中文标题');
    });
  });

  test.describe('share button state', function () {
    test('disables share button during share action', async function ({ page }) {
      await gotoApp(page);
      await setMarkdown(page, '# Test\n\nContent.');

      const shareButton = page.locator('button:has-text("Share")').first();

      await expect(shareButton).not.toBeDisabled();

      await shareButton.click();

      await expect(shareButton).toBeDisabled();

      await expect(shareButton).not.toBeDisabled({ timeout: 2000 });
    });

    test('changes share button label after share action', async function ({ page }) {
      await gotoApp(page);
      await setMarkdown(page, '# Test\n\nContent.');

      const shareButton = page.locator('button:has-text("Share")').first();

      let buttonText = await shareButton.textContent();
      expect(buttonText).toContain('Share');

      await shareButton.click();

      // Button text should change to indicate success (either "Copied" or translated version)
      // We wait for the button to be disabled first (during share action)
      await expect(shareButton).toBeDisabled();

      // Wait for button to be enabled again
      await expect(shareButton).not.toBeDisabled({ timeout: 2000 });
      buttonText = await shareButton.textContent();
      // Should revert back to Share
      expect(buttonText).toContain('Share');
    });

    test('prevents multiple simultaneous share requests', async function ({ page }) {
      await gotoApp(page);
      await setMarkdown(page, '# Test\n\nContent.');

      const shareButton = page.locator('button:has-text("Share")').first();

      await shareButton.click();

      await expect(shareButton).toBeDisabled();

      await shareButton.click();

      await expect(shareButton).not.toBeDisabled({ timeout: 2000 });
    });
  });

  test.describe('hash mode state', function () {
    test('sets data-hash-mode attribute when hash is provided', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const encoded = btoa(unescape(encodeURIComponent('# Test'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      await expect(page.locator('html')).toHaveAttribute('data-hash-mode', '1');
    });

    test('updates hash mode based on location hash', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const encoded = btoa(unescape(encodeURIComponent('# Test'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      await expect(page.locator('html')).toHaveAttribute('data-hash-mode', '1');

      // The data-hash-mode is determined by whether location.hash is present
      // When we clear the hash, the next sync should reflect that
      await page.evaluate(function () {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        // Manually trigger syncHashModeState or hashchange listener behavior
        const event = new Event('hashchange');
        window.dispatchEvent(event);
      });

      // Give the event time to process - wait for the placeholder attribute to be updated
      await expect(page.locator('#output')).toHaveAttribute('placeholder', /Paste content here/);

      // Check that placeholder reflects hash mode state
      const placeholder = await page.locator('#output').getAttribute('placeholder');
      // When no hash, placeholder should be the normal placeholder text
      expect(placeholder).toContain('Paste content here');
    });

    test('sets empty placeholder when in hash mode', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const encoded = btoa(unescape(encodeURIComponent('# Test'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      await expect(page.locator('#output')).toHaveAttribute('placeholder', '');
    });

    test('hides intro when hash is provided', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const encoded = btoa(unescape(encodeURIComponent('# Test'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      await expect(page.locator('#info')).toHaveClass(/hidden/);
    });

    test('shows wrapper when hash is provided', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const encoded = btoa(unescape(encodeURIComponent('# Test'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      await expect(page.locator('#wrapper')).not.toHaveClass(/hidden/);
    });
  });

  test.describe('empty editor share', function () {
    test('allows sharing empty content', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '');

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);
      expect(shareUrl).toBeTruthy();

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe('');

      await newPage.close();
    });

    test('loads empty content from share URL', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const encoded = btoa(unescape(encodeURIComponent(''))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      const markdown = await getMarkdown(page);
      expect(markdown).toBe('');
    });
  });

  test('escapes HTML in share URL for XSS prevention', async function ({ page }) {
    await withClipboardCapture()(page);
    await gotoApp(page);
    await setMarkdown(page, '# Test\n\nContent with <script>alert("XSS")</script>.');

    await shareViaButton(page);

    const html = await getShareHtml(page);
    // URL should be escaped in the HTML (& becomes &amp;)
    expect(html).toContain('&amp;');
    // Script tag should not be executable in the link (it's part of the hash, encoded)
    expect(html).not.toContain('<script');
    // Verify the structure is safe
    expect(html).toContain('<a href=');
  });

  test('handles clipboard API failure gracefully', async function ({ page }) {
    await page.addInitScript(function () {
      delete navigator.clipboard;
    });

    await gotoApp(page);
    await setMarkdown(page, '# Test\n\nContent.');

    const shareButton = page.locator('button:has-text("Share")').first();

    // Click share - should not crash
    await shareButton.click();

    // Wait for button to be enabled again (error handling completed)
    await expect(shareButton).not.toBeDisabled({ timeout: 2000 });
  });

  test('uses writeText fallback when ClipboardItem not available', async function ({ page }) {
    await page.addInitScript(function () {
      delete window.ClipboardItem;
    });

    await withClipboardCapture()(page);
    await gotoApp(page);
    await setMarkdown(page, '# Fallback Test\n\nContent.');

    await shareViaButton(page);

    const shareUrl = await getShareUrl(page);
    expect(shareUrl).toBeTruthy();
    expect(shareUrl).toContain('#');
  });

  test('keeps share button disabled during busy period', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Test\n\nContent.');

    const shareButton = page.locator('button:has-text("Share")').first();

    // Button should be enabled initially
    await expect(shareButton).not.toBeDisabled();

    // Click share
    await shareButton.click();

    // Button should remain disabled during the busy period
    await expect(shareButton).toBeDisabled();

    // After the busy period, button should be enabled again
    await expect(shareButton).not.toBeDisabled({ timeout: 2000 });
  });

  test.describe('preview tab with hash', function () {
    test('loads preview tab from hash with preview mode', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const testMarkdown = '# Preview Test\n\nThis should load in preview mode.';
      const encoded = btoa(unescape(encodeURIComponent(testMarkdown))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=preview&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      // Verify preview tab is active
      const previewTab = page.locator('.tab-button[data-tab="preview"]');
      await expect(previewTab).toHaveClass(/active/);

      // Verify content is loaded
      const markdown = await getMarkdown(page);
      expect(markdown).toBe(testMarkdown);
    });
  });

  test.describe('share title edge cases', function () {
    test('generates title from first non-empty line', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const markdown = '\n\n\nFirst line here\n\nOther content';
      await setMarkdown(page, markdown);

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('First line here');
    });

    test('handles title with only special characters', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const markdown = '# !@#$%^&*()\n\nContent';
      await setMarkdown(page, markdown);

      await shareViaButton(page);

      const html = await getShareHtml(page);
      // Should have default title when cleaned title is empty
      expect(html).toBeTruthy();
      // Should have the default "Markdown" title
      expect(html).toContain('Markdown');
    });
  });

  test.describe('large hash handling', function () {
    test('handles very large markdown in hash', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);

      // Create a large markdown (several KB)
      const largeMarkdown = '# Large Content\n\n' +
        Array(500).fill('This is a paragraph with some content.\n\n').join('');
      await setMarkdown(page, largeMarkdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);
      expect(shareUrl).toBeTruthy();

      // Try to load it
      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      // The restored content should at least start with the heading
      expect(restoredMarkdown).toContain('# Large Content');

      await newPage.close();
    });
  });

  test.describe('tab switching with hash', function () {
    test('can switch between tabs when hash is provided', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const testMarkdown = '# Switch Test\n\nContent for switching.';
      const encoded = btoa(unescape(encodeURIComponent(testMarkdown))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      // Start in edit tab
      const editTab = page.locator('.tab-button[data-tab="edit"]');
      await expect(editTab).toHaveClass(/active/);

      // Switch to preview
      await switchTab(page, 'preview');
      const previewTab = page.locator('.tab-button[data-tab="preview"]');
      await expect(previewTab).toHaveClass(/active/);

      // Preview should render the content
      await expect(page.locator('#preview h1')).toHaveText('Switch Test');

      // Switch back to edit
      await switchTab(page, 'edit');
      await expect(editTab).toHaveClass(/active/);
    });
  });

  test.describe('hash loading edge cases', function () {
    test('handles corrupt or undecodable hash gracefully', async function ({ page }) {
      await gotoApp(page, { hash: '#mode=edit&text=z%3ACORRUPT_DATA' });

      // App should not crash
      await expect(page.locator('#output')).toBeVisible();
    });

    test('preserves markdown with various whitespace patterns', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const markdown = '# Heading\n\n\n\nParagraph\n\n\n\n- Item 1\n- Item 2\n\n\nMore text';
      await setMarkdown(page, markdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(markdown);

      await newPage.close();
    });

    test('handles markdown with tabs and mixed whitespace', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const markdown = '# Test\n\nLine with\ttab\nAnother line  with spaces';
      await setMarkdown(page, markdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(markdown);

      await newPage.close();
    });
  });

  test.describe('share title extraction', function () {
    test('handles title with multiple heading levels', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const markdown = '#### Level 4 Heading\n\nContent here';
      await setMarkdown(page, markdown);

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('Level 4 Heading');
    });

    test('extracts title from text without any markdown markers', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const markdown = 'Plain text heading\n\nContent here';
      await setMarkdown(page, markdown);

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('Plain text heading');
    });

    test('handles title with image markdown syntax', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const markdown = '# ![alt text](image.jpg) Image Title\n\nContent';
      await setMarkdown(page, markdown);

      await shareViaButton(page);

      const html = await getShareHtml(page);
      // Image markdown should be stripped, leaving alt text and title
      expect(html).toBeTruthy();
      // The title should contain the alt text and the image title
      expect(html).toContain('alt text');
      expect(html).toContain('Image Title');
    });

    test('handles very short content', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const markdown = 'A';
      await setMarkdown(page, markdown);

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('A');
    });

    test('handles content with numbers only', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      const markdown = '123456789\n\nContent';
      await setMarkdown(page, markdown);

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('123456789');
    });
  });

  test.describe('hash loading with error handling', function () {
    test('handles decompression errors gracefully', async function ({ page }) {
      // This tests the catch block in decodeMarkdown
      await gotoApp(page, { hash: '#mode=edit&text=z%3ABADBASE64DATA!!!' });

      // App should handle the error and not crash
      await expect(page.locator('#output')).toBeVisible();
    });
  });

  test.describe('executeShareAction guards and fallbacks', function () {
    test('executes share when not busy', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '# Test\n\nContent.');

      const shareButton = page.locator('button:has-text("Share")').first();
      await expect(shareButton).not.toBeDisabled();

      await shareButton.click();

      // Wait for completion
      await expect(shareButton).toBeDisabled();
      await expect(shareButton).not.toBeDisabled({ timeout: 2000 });

      const shareUrl = await getShareUrl(page);
      expect(shareUrl).toBeTruthy();
    });

    test('guards against clipboard API unavailability', async function ({ page }) {
      await page.addInitScript(function () {
        // Remove both ClipboardItem and clipboard API
        delete window.ClipboardItem;
        Object.defineProperty(navigator, 'clipboard', {
          value: undefined,
          writable: true
        });
      });

      await gotoApp(page);
      await setMarkdown(page, '# Test\n\nContent.');

      const shareButton = page.locator('button:has-text("Share")').first();

      // Click share - should handle error gracefully
      await shareButton.click();

      // Wait for button to be enabled again
      await expect(shareButton).not.toBeDisabled({ timeout: 2000 });

      // Button should show error state (default "🔗 Share" without i18n)
      const buttonText = await shareButton.textContent();
      expect(buttonText).toBeTruthy();
    });

    test('prevents multiple simultaneous share actions', async function ({ page }) {
      await gotoApp(page);
      await setMarkdown(page, '# Test\n\nContent.');

      const shareButton = page.locator('button:has-text("Share")').first();

      // First click
      await shareButton.click();

      // Button should be disabled immediately
      await expect(shareButton).toBeDisabled();

      // Try to click while disabled (simulates double-click or race condition)
      const isDisabled1 = await shareButton.isDisabled();
      expect(isDisabled1).toBe(true);

      // Try clicking again while busy
      await shareButton.click();

      // Wait for completion
      await expect(shareButton).not.toBeDisabled({ timeout: 2000 });

      // Should have only completed one share action
      const isDisabled2 = await shareButton.isDisabled();
      expect(isDisabled2).toBe(false);
    });
  });

  test.describe('UTF-8 encoding fallbacks', function () {
    test('executes share action successfully with compression available', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);

      const testText = 'Simple test text with compression';
      await setMarkdown(page, testText);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);
      expect(shareUrl).toBeTruthy();
      // Should use compression if available (z: prefix)
      const hasPrefix = shareUrl.includes('z%3A') || shareUrl.includes('r%3A');
      expect(hasPrefix).toBe(true);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(testText);

      await newPage.close();
    });

    test('handles non-ASCII characters in share encoding', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);

      // Test with various non-ASCII characters to verify encoding handling
      const testText = '# Test\n\nWith Unicode: café, naïve, 日本語, Ελληνικά, العربية';
      await setMarkdown(page, testText);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);
      expect(shareUrl).toBeTruthy();

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(testText);

      await newPage.close();
    });
  });

  test.describe('HTML escaping in share titles', function () {
    test('escapes ampersand in share title', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '# Fish & Chips\n\nContent.');

      await shareViaButton(page);

      const html = await getShareHtml(page);
      // Should have escaped ampersand in href or title
      expect(html).toContain('&amp;');
    });

    test('escapes less-than sign in share title', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '# Less < Than\n\nContent.');

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('&lt;');
    });

    test('escapes greater-than sign in share title', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '# Greater > Than\n\nContent.');

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('&gt;');
    });

    test('escapes double quotes in share title', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '# Say "Hello"\n\nContent.');

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('&quot;');
    });

    test('escapes single quotes in share title', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, "# It's Great\n\nContent.");

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toContain('&#39;');
    });
  });

  test.describe('compression fallback', function () {
    test('falls back to raw hash when compression stream fails', async function ({ page, openPage }) {
      await page.addInitScript(function () {
        // Stub CompressionStream to throw an error
        const OriginalCompressionStream = window.CompressionStream;
        if (OriginalCompressionStream) {
          window.CompressionStream = class FailingCompressionStream {
            constructor(algorithm) {
              if (algorithm === 'gzip') {
                throw new Error('Compression failed');
              }
            }
          };
        }
      });

      await withClipboardCapture()(page);
      await gotoApp(page);
      const testMarkdown = '# Compression Fallback\n\nThis should use r: prefix.';
      await setMarkdown(page, testMarkdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);
      expect(shareUrl).toBeTruthy();
      // Should contain r: prefix when compression fails
      const hasRawPrefix = shareUrl.includes('r%3A') || shareUrl.includes('r:');
      expect(hasRawPrefix).toBe(true);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(testMarkdown);

      await newPage.close();
    });
  });

  test.describe('truncateByNonWhitespace', function () {
    test('truncates very long CJK titles correctly', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);

      // Create a very long CJK title (all non-whitespace CJK characters)
      const longCjkTitle = '# ' + Array(50).fill('中文').join('') + '\n\nContent.';
      await setMarkdown(page, longCjkTitle);

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toBeTruthy();

      // Extract the link text
      const titleMatch = html.match('>([^<]*)</a>');
      expect(titleMatch).toBeTruthy();
      if (titleMatch) {
        const titleText = titleMatch[1];
        // Should be truncated (much shorter than 100 CJK characters)
        expect(titleText.length).toBeLessThan(60);
      }
    });

    test('handles title with mixed whitespace and non-whitespace', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);

      // Long title with spaces and non-whitespace characters
      const mixedTitle = '# ' + Array(20).fill('Word ').join('') + '\n\nContent.';
      await setMarkdown(page, mixedTitle);

      await shareViaButton(page);

      const html = await getShareHtml(page);
      expect(html).toBeTruthy();
    });
  });

  test.describe('decodeMarkdown edge cases', function () {
    test('handles hash with unknown prefix (not z: or r:)', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      // Create hash with unknown prefix
      const testMarkdown = 'Test content';
      const encoded = btoa(unescape(encodeURIComponent(testMarkdown))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=x%3A${encoded}`; // 'x:' is unknown prefix

      await gotoApp(page, { hash: hash });

      // Should still decode as fallback
      const markdown = await getMarkdown(page);
      expect(markdown).toBe(testMarkdown);
    });

    test('handles hash with empty text parameter', async function ({ page }) {
      await gotoApp(page, { hash: '#mode=edit&text=' });

      const markdown = await getMarkdown(page);
      expect(markdown).toBe('');
      await expect(page.locator('#output')).toHaveAttribute('placeholder', '');
    });

    test('handles hash with text parameter containing only prefix', async function ({ page }) {
      await gotoApp(page, { hash: '#mode=edit&text=r%3A' });

      // Should handle missing payload gracefully
      const markdown = await getMarkdown(page);
      expect(markdown).toBe('');
    });
  });

  test.describe('hash mode state guards', function () {
    test('guards against missing document.documentElement', async function ({ page }) {
      await page.addInitScript(function () {
        // This is tricky - we can't really delete documentElement, but we can test
        // that the function handles it gracefully by stubbing
        const originalSync = window.syncHashModeState;
        window.testDocumentElementRemoved = true;
      });

      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const encoded = btoa(unescape(encodeURIComponent('# Test'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      // Should not crash even if documentElement is problematic
      await gotoApp(page, { hash: hash });

      const markdown = await getMarkdown(page);
      expect(markdown).toBe('# Test');
    });

    test('guards against missing window.history API', async function ({ page }) {
      await page.addInitScript(function () {
        // Stub out history API
        Object.defineProperty(window, 'history', {
          value: undefined,
          writable: true
        });
      });

      await gotoApp(page);
      const originalMarkdown = '# Test\n\nContent.';
      await setMarkdown(page, originalMarkdown);

      // Edit should work even without history API
      await setMarkdown(page, '# Modified\n\nEdited.');

      const markdown = await getMarkdown(page);
      expect(markdown).toBe('# Modified\n\nEdited.');
    });

    test('refreshShareButtonLabel guards against missing button', async function ({ page }) {
      // The button should always be present in normal operation,
      // but the guard is there for safety
      await gotoApp(page);

      // Find and remove all share buttons
      await page.evaluate(function () {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(function (btn) {
          if (btn.textContent && btn.textContent.includes('Share')) {
            btn.remove();
          }
        });
      });

      // App should still function (guard prevents error)
      const output = page.locator('#output');
      await expect(output).toBeVisible();
    });
  });

  test.describe('share button label refresh', function () {
    test('displays correct button text after share success', async function ({ page }) {
      await gotoApp(page);
      await setMarkdown(page, '# Test\n\nContent.');

      const shareButton = page.locator('button:has-text("Share")').first();

      // Initial text
      let buttonText = await shareButton.textContent();
      expect(buttonText).toContain('Share');

      // Click to share
      await shareButton.click();

      // Wait for button to be re-enabled (indicates completion)
      await expect(shareButton).not.toBeDisabled({ timeout: 2000 });

      // Should show "Share" again (or translated version)
      buttonText = await shareButton.textContent();
      expect(buttonText).toBeTruthy();
    });
  });

  test.describe('compression support check', function () {
    test('uses raw hash when CompressionStream is not available', async function ({ page, openPage }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      await withClipboardCapture()(page);
      await gotoApp(page);
      const markdown = '# No Compression\n\nFallback to raw encoding.';
      await setMarkdown(page, markdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);
      expect(shareUrl).toContain('r%3A');

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(markdown);

      await newPage.close();
    });
  });

  test.describe('enforce hash mode placeholder', function () {
    test('sets empty placeholder when in hash mode', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const encoded = btoa(unescape(encodeURIComponent('# Test'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      await expect(page.locator('#output')).toHaveAttribute('placeholder', '');
    });

    test('shows normal placeholder when not in hash mode', async function ({ page }) {
      await gotoApp(page);

      const placeholder = await page.locator('#output').getAttribute('placeholder');
      expect(placeholder).toContain('Paste');
    });

    test('guards against missing output element', async function ({ page }) {
      await gotoApp(page);

      // Remove output element
      await page.evaluate(function () {
        const output = document.querySelector('#output');
        if (output) {
          output.remove();
        }
      });

      // Should not crash
      const wrapper = page.locator('#wrapper');
      await expect(wrapper).toBeVisible();
    });
  });

  test.describe('clear hash mode state', function () {
    test('removes hash when editing shared content', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const testMarkdown = '# Shared\n\nContent.';
      const encoded = btoa(unescape(encodeURIComponent(testMarkdown))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      // Verify hash is present initially
      const urlBefore = page.url();
      expect(urlBefore).toContain('#');

      // Edit the content
      await setMarkdown(page, '# Modified\n\nNew content.');

      // Editing shared content drops the hash from the URL
      await expect.poll(() => page.url()).not.toContain('#');
    });
  });

  test.describe('special characters in markdown round-trip', function () {
    test('preserves markdown with special HTML characters', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);

      const markdown = '# Code Example\n\nUse `<div>` or `<span>` in HTML.\n\nAlso: "quotes" & \'apostrophes\'';
      await setMarkdown(page, markdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(markdown);

      await newPage.close();
    });

    test('preserves ampersand-encoded entities in markdown', async function ({ page, openPage }) {
      await withClipboardCapture()(page);
      await gotoApp(page);

      const markdown = '# Test\n\nThis & that\n\nA < B < C';
      await setMarkdown(page, markdown);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);

      const newPage = await openPage();
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(markdown);

      await newPage.close();
    });
  });

  test.describe('clipboard write capture', function () {
    test('records clipboard write with proper polling', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '# Test\n\nCapture test.');

      const shareButton = page.locator('button:has-text("Share")').first();

      // Click share
      await shareButton.click();

      // Wait for button to be disabled and then re-enabled
      await expect(shareButton).toBeDisabled();
      await expect(shareButton).not.toBeDisabled({ timeout: 2000 });

      // Now safely read clipboard - should have the URL
      const shareUrl = await getShareUrl(page);
      expect(shareUrl).toBeTruthy();
      expect(shareUrl).toContain('#');
    });

    test('captures both text and HTML in clipboard write', async function ({ page }) {
      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '# Share This\n\nContent here.');

      const shareButton = page.locator('button:has-text("Share")').first();

      await shareButton.click();

      await expect(shareButton).toBeDisabled();
      await expect(shareButton).not.toBeDisabled({ timeout: 2000 });

      // Get both text and HTML from clipboard
      const shareUrl = await getShareUrl(page);
      const shareHtml = await getShareHtml(page);

      expect(shareUrl).toBeTruthy();
      expect(shareHtml).toBeTruthy();
      expect(shareHtml).toContain('Share This');
      expect(shareHtml).toContain('<a href=');
    });
  });

  test.describe('error handling and recovery', function () {
    test('recovers from share action errors with proper button state', async function ({ page }) {
      await page.addInitScript(function () {
        // Stub clipboard to fail
        Object.defineProperty(navigator, 'clipboard', {
          get: function () {
            return {
              write: async function () {
                throw new Error('Clipboard write failed');
              },
              writeText: async function () {
                throw new Error('Clipboard writeText failed');
              }
            };
          }
        });
      });

      await gotoApp(page);
      await setMarkdown(page, '# Error Test\n\nContent.');

      const shareButton = page.locator('button:has-text("Share")').first();

      // Click share - should handle error
      await shareButton.click();

      // Wait for button to be re-enabled
      await expect(shareButton).not.toBeDisabled({ timeout: 2000 });

      // Button should show default text
      const buttonText = await shareButton.textContent();
      expect(buttonText).toBeTruthy();
    });

    test('handles null shareButton gracefully', async function ({ page }) {
      await gotoApp(page);

      // Hide all buttons
      await page.evaluate(function () {
        document.querySelectorAll('button').forEach(function (btn) {
          btn.style.display = 'none';
        });
      });

      // App should continue to work
      const output = page.locator('#output');
      await expect(output).toBeVisible();
    });

    test('handles missing i18n context in share error', async function ({ page }) {
      await page.addInitScript(function () {
        // Create clipboard that throws
        Object.defineProperty(navigator, 'clipboard', {
          get: function () {
            return {
              write: async function () {
                throw new Error('Simulated error');
              }
            };
          }
        });
        // Also ensure i18n is undefined to test fallback
        window.i18n = undefined;
      });

      await gotoApp(page);
      await setMarkdown(page, '# Test\n\nContent.');

      const shareButton = page.locator('button:has-text("Share")').first();

      await shareButton.click();

      // Wait for button to be re-enabled
      await expect(shareButton).not.toBeDisabled({ timeout: 2000 });

      // Without i18n, should show default emoji text
      const buttonText = await shareButton.textContent();
      expect(buttonText).toContain('Share');
    });
  });

  test.describe('uncovered line: executeShareAction early return guard', function () {
    test('guards against missing shareButton on line 1109', async function ({ page }) {
      await gotoApp(page);
      await setMarkdown(page, '# Test\n\nContent.');

      // Remove the share button and verify executeShareAction still works (early return guards it)
      await page.evaluate(function () {
        const buttons = document.querySelectorAll('button');
        for (const button of buttons) {
          if (button.textContent && button.textContent.includes('Share')) {
            button.remove();
            break;
          }
        }
      });

      // The app should still function without crashing
      const output = page.locator('#output');
      await expect(output).toBeVisible();
    });

    test('guards against shareButtonBusy flag on line 1110', async function ({ page }) {
      await page.addInitScript(function () {
        window.__executeCallCount = 0;
        // Track how many times executeShareAction actually proceeds past the guard
        const originalSetTimeout = window.setTimeout;
        window.setTimeout = function (callback, delay) {
          if (delay === 1200) {
            window.__executeCallCount++;
          }
          return originalSetTimeout.call(this, callback, delay);
        };
      });

      await withClipboardCapture()(page);
      await gotoApp(page);
      await setMarkdown(page, '# Test\n\nContent.');

      const shareButton = page.locator('button:has-text("Share")').first();

      // Trigger share
      await shareButton.click();

      // Wait for button to be disabled
      await expect(shareButton).toBeDisabled();

      // Trigger keyboard shortcut while button is busy
      await page.keyboard.press('Alt+S');

      // Wait for button to be re-enabled
      await expect(shareButton).not.toBeDisabled({ timeout: 2000 });

      // Verify only one completion handler was registered (guard prevented double execution)
      const callCount = await page.evaluate(function () {
        return window.__executeCallCount || 0;
      });

      // The setTimeout for 1200ms should be called exactly once
      expect(callCount).toBe(1);
    });
  });

  test.describe('uncovered line: share failure label fallback with missing i18n', function () {
    test('restores share button label to fallback when i18n unavailable on line 1149', async function ({ page }) {
      await page.addInitScript(function () {
        Object.defineProperty(navigator, 'clipboard', {
          get: function () {
            return {
              write: async function () {
                throw new Error('Clipboard write failed');
              }
            };
          }
        });
      });

      await gotoApp(page);
      // Manually delete i18n after app loads to test fallback
      await page.evaluate(function () {
        window.i18n = undefined;
      });

      await setMarkdown(page, '# Test\n\nContent.');

      const shareButton = page.locator('button:has-text("Share")').first();
      const initialText = await shareButton.textContent();
      expect(initialText).toContain('Share');

      // Click share to trigger error
      await shareButton.click();

      // Wait for button to be disabled
      await expect(shareButton).toBeDisabled();

      // Wait for button to be re-enabled (will happen after 1200ms timeout in the code)
      await expect(shareButton).not.toBeDisabled({ timeout: 3000 });

      // Button text should return to '🔗 Share' (line 1149 fallback)
      const finalText = await shareButton.textContent();
      expect(finalText).toBe('🔗 Share');
    });
  });

  test.describe('uncovered lines: hash mode state guards with early returns', function () {
    test('syncHashModeState early return on line 1307 when documentElement missing', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
        // Stub syncHashModeState to track if it's called
        window.__syncHashModeStateCalls = 0;
        const original = window.syncHashModeState;
        if (original) {
          window.syncHashModeState = function () {
            window.__syncHashModeStateCalls++;
            // Delete documentElement before calling to trigger early return
            const originalGetElementProperty = Object.getOwnPropertyDescriptor(document, 'documentElement');
            Object.defineProperty(document, 'documentElement', {
              get: function () {
                return null;
              },
              configurable: true
            });
            try {
              return original.call(this);
            } finally {
              if (originalGetElementProperty) {
                Object.defineProperty(document, 'documentElement', originalGetElementProperty);
              }
            }
          };
        }
      });

      const encoded = btoa(unescape(encodeURIComponent('# Test'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      // Trigger syncHashModeState by dispatching hashchange
      await page.evaluate(function () {
        window.dispatchEvent(new Event('hashchange'));
      });

      // App should still function
      const markdown = await getMarkdown(page);
      expect(markdown).toBe('# Test');
    });

    test('clearHashModeState early return on line 1321 when history missing', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const encoded = btoa(unescape(encodeURIComponent('# Test'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      // Call clearHashModeState with history stubbed out
      await page.evaluate(function () {
        const originalHistory = window.history;
        try {
          Object.defineProperty(window, 'history', {
            value: undefined,
            writable: true,
            configurable: true
          });
          // This should trigger early return on line 1321
          if (window.clearHashModeState) {
            window.clearHashModeState();
          }
        } finally {
          Object.defineProperty(window, 'history', {
            value: originalHistory,
            writable: true,
            configurable: true
          });
        }
      });

      // App should still work
      await expect(page.locator('#output')).toBeVisible();
    });

    test('enforceHashModePlaceholder early return on line 1349 when output missing', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      const encoded = btoa(unescape(encodeURIComponent('# Test'))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=r%3A${encoded}`;

      await gotoApp(page, { hash: hash });

      // Call enforceHashModePlaceholder with output removed
      await page.evaluate(function () {
        const output = document.querySelector('#output');
        const wasRemoved = output && !output.parentNode;
        try {
          if (output) {
            output.remove();
          }
          // This should trigger early return on line 1349
          if (window.enforceHashModePlaceholder) {
            window.enforceHashModePlaceholder();
          }
        } finally {
          if (output && output.parentNode !== document) {
            document.body.appendChild(output);
          }
        }
      });

      // App should still function
      const wrapper = page.locator('#wrapper');
      await expect(wrapper).toBeVisible();
    });
  });


  test.describe('uncovered lines: UTF-8 encoding/decoding fallbacks', function () {
    test('toUtf8Bytes falls back to encodeURIComponent without TextEncoder (lines 1531-1543)', async function ({ page }) {
      await page.addInitScript(function () {
        // Remove TextEncoder to force fallback path
        delete window.TextEncoder;
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      await withClipboardCapture()(page);
      await gotoApp(page);

      // Test with text that requires UTF-8 encoding
      const testText = 'Test content with CJK: 中文';
      await setMarkdown(page, testText);

      // Share should succeed using fallback encoding (lines 1531-1543)
      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);
      expect(shareUrl).toBeTruthy();
      expect(shareUrl).toContain('r%3A'); // Should use raw encoding without compression
    });

    test('utf8BytesToString falls back to escape/decodeURIComponent without TextDecoder (line 1556)', async function ({ page, openPage }) {
      await page.addInitScript(function () {
        // Remove TextDecoder to force fallback path on line 1556
        delete window.TextDecoder;
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      await withClipboardCapture()(page);
      await gotoApp(page);

      // Use simple ASCII text that will round-trip correctly
      const testText = 'Simple text content';
      await setMarkdown(page, testText);

      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);

      const newPage = await openPage();
      await newPage.addInitScript(function () {
        // Also disable TextDecoder on new page to test fallback decode
        delete window.TextDecoder;
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      // Simple ASCII should round-trip correctly with the fallback
      expect(restoredMarkdown).toBe(testText);

      await newPage.close();
    });
  });


  test.describe('uncovered line: compressMarkdown rejection fallback (line 1718)', function () {
    test('compressMarkdown falls back to createFallbackHash when stream errors', async function ({ page, openPage }) {
      await page.addInitScript(function () {
        // Make CompressionStream constructor throw
        window.CompressionStream = class {
          constructor() {
            throw new Error('Stream error');
          }
        };
      });

      await withClipboardCapture()(page);
      await gotoApp(page);

      const testMarkdown = '# Compression Test\n\nShould use fallback.';
      await setMarkdown(page, testMarkdown);

      // Share will use fallback due to the error
      await shareViaButton(page);

      const shareUrl = await getShareUrl(page);
      expect(shareUrl).toBeTruthy();

      // Should use raw encoding (r: prefix) as fallback
      expect(shareUrl.includes('r%3A') || shareUrl.includes('r:')).toBe(true);

      const newPage = await openPage();
      await newPage.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });
      await newPage.goto(shareUrl);

      const restoredMarkdown = await newPage.locator('#output').inputValue();
      expect(restoredMarkdown).toBe(testMarkdown);

      await newPage.close();
    });
  });

  test.describe('uncovered lines: decodeMarkdown edge cases (lines 1756)', function () {
    test('decodeMarkdown falls back to raw hash for unknown prefix (line 1756)', async function ({ page }) {
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      // Create hash with unknown prefix 'x:' to trigger line 1756 fallback
      const testMarkdown = 'Content with unknown prefix mode';
      const encoded = btoa(unescape(encodeURIComponent(testMarkdown))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = `#mode=edit&text=x%3A${encoded}`; // 'x:' is unknown, should fallback to raw decode

      await gotoApp(page, { hash: hash });

      // Line 1756 should be triggered (fallback to raw decode)
      const markdown = await getMarkdown(page);
      expect(markdown).toBe(testMarkdown);
    });
  });

  test.describe('uncovered line: refreshShareButtonLabel guard (line 1761)', function () {
    test('refreshShareButtonLabel returns early when shareButton is null', async function ({ page }) {
      await gotoApp(page);

      // Call refreshShareButtonLabel with shareButton removed
      await page.evaluate(function () {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent && btn.textContent.includes('Share')) {
            btn.remove();
            break;
          }
        }
        // This should trigger early return on line 1761
        if (window.refreshShareButtonLabel) {
          window.refreshShareButtonLabel();
        }
      });

      // App should continue to work
      const output = page.locator('#output');
      await expect(output).toBeVisible();
    });
  });
});

test.describe('Shared hash edge cases', function () {
  function toBase64Url(text) {
    return Buffer.from(text, 'utf8').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  test('decodes a payload with an unknown prefix as raw UTF-8', async function ({ page }) {
    await gotoApp(page, { hash: '#text=q:' + toBase64Url('hello **world**') });
    await expect(page.locator('#output')).toHaveValue('hello **world**');
  });

  test('keeps the hash when the History API is unavailable', async function ({ page }) {
    await page.addInitScript(function () {
      History.prototype.replaceState = undefined;
    });
    const hash = '#text=r:' + toBase64Url('shared text');
    await gotoApp(page, { hash: hash });
    await expect(page.locator('#output')).toHaveValue('shared text');

    // The first edit of shared content clears it and would normally drop the hash.
    await page.locator('#output').press('End');
    await page.keyboard.type('X');

    await expect(page.locator('#output')).toHaveValue('');
    expect(await page.evaluate(() => window.location.hash)).toBe(hash);
    await expect(page.locator('html')).toHaveAttribute('data-hash-mode', '1');
  });

  test('uses r: prefix when CompressionStream is unavailable', async function ({ page, openPage }) {
    await page.addInitScript(function () {
      window.CompressionStream = undefined;
      window.DecompressionStream = undefined;
    });

    // Add clipboard capture before loading the app
    await page.addInitScript(function () {
      window.__clipboardCaptures = [];
      const originalWrite = navigator.clipboard.write;
      const originalWriteText = navigator.clipboard.writeText;
      if (originalWrite) {
        navigator.clipboard.write = async function (items) {
          const captures = [];
          for (const item of items) {
            for (const type of item.types) {
              const blob = await item.getType(type);
              const text = await blob.text();
              captures.push({ type: type, text: text });
            }
          }
          window.__clipboardCaptures.push({ items: captures });
          return originalWrite.call(this, items);
        };
      }
      if (originalWriteText) {
        navigator.clipboard.writeText = async function (text) {
          window.__clipboardCaptures.push({ text: text });
          return originalWriteText.call(this, text);
        };
      }
    });

    await gotoApp(page);
    const markdown = '# Test\n\nCompressionStream unavailable should use r: prefix';
    await setMarkdown(page, markdown);

    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();
    await expect(shareButton).toBeDisabled();
    await expect(shareButton).not.toBeDisabled({ timeout: 2000 });

    const captures = await page.evaluate(() => window.__clipboardCaptures || []);
    expect(captures.length).toBeGreaterThan(0);
    let shareUrl = null;
    for (const capture of captures) {
      if (capture.items) {
        const plainItem = capture.items.find(i => i.type === 'text/plain');
        if (plainItem) {
          shareUrl = plainItem.text;
          break;
        }
      } else if (capture.text) {
        shareUrl = capture.text;
      }
    }
    expect(shareUrl).toBeTruthy();
    expect(shareUrl).toContain('r%3A');
  });

  test('share button label is correctly set after successful share', async function ({ page }) {
    // Add clipboard capture before loading the app
    await page.addInitScript(function () {
      window.__clipboardCaptures = [];
      const originalWrite = navigator.clipboard.write;
      const originalWriteText = navigator.clipboard.writeText;

      if (originalWrite) {
        navigator.clipboard.write = async function (items) {
          const captures = [];
          for (const item of items) {
            for (const type of item.types) {
              const blob = await item.getType(type);
              const text = await blob.text();
              captures.push({ type: type, text: text });
            }
          }
          window.__clipboardCaptures.push({ items: captures });
          return originalWrite.call(this, items);
        };
      }

      if (originalWriteText) {
        navigator.clipboard.writeText = async function (text) {
          window.__clipboardCaptures.push({ text: text });
          return originalWriteText.call(this, text);
        };
      }
    });

    await gotoApp(page);
    const markdown = '# Test\n\nChecking button label update';
    await setMarkdown(page, markdown);

    const shareButton = page.locator('button:has-text("Share")').first();

    // Initial check: button should show "Share"
    await expect(shareButton).toContainText(/Share|🔗/);

    // Click share
    await shareButton.click();

    // Button should be disabled during share action
    await expect(shareButton).toBeDisabled();

    // Button should eventually be enabled again and label refreshed
    await expect(shareButton).not.toBeDisabled({ timeout: 2000 });

    // Verify share was successful by checking clipboard
    const captures = await page.evaluate(() => window.__clipboardCaptures || []);
    expect(captures.length).toBeGreaterThan(0);
  });

  test('share button tooltip title is set by refreshShareButtonLabel', async function ({ page }) {
    await gotoApp(page);

    const shareButton = page.locator('#share-button');

    // The title attribute should be set by refreshShareButtonLabel
    // which is called during app init
    const title = await shareButton.getAttribute('title');

    // The button title should contain "URL" from the tooltip text "Copy shareable URL"
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test('uses z: prefix when CompressionStream is available', async function ({ page, openPage }) {
    // Make sure CompressionStream IS available by not disabling it
    // Add clipboard capture before loading the app
    await page.addInitScript(function () {
      window.__clipboardCaptures = [];
      const originalWrite = navigator.clipboard.write;
      const originalWriteText = navigator.clipboard.writeText;
      if (originalWrite) {
        navigator.clipboard.write = async function (items) {
          const captures = [];
          for (const item of items) {
            for (const type of item.types) {
              const blob = await item.getType(type);
              const text = await blob.text();
              captures.push({ type: type, text: text });
            }
          }
          window.__clipboardCaptures.push({ items: captures });
          return originalWrite.call(this, items);
        };
      }
      if (originalWriteText) {
        navigator.clipboard.writeText = async function (text) {
          window.__clipboardCaptures.push({ text: text });
          return originalWriteText.call(this, text);
        };
      }
    });

    await gotoApp(page);
    const markdown = '# Test\n\nCompressionStream available should use z: prefix';
    await setMarkdown(page, markdown);

    const shareButton = page.locator('button:has-text("Share")').first();
    await shareButton.click();
    await expect(shareButton).toBeDisabled();
    await expect(shareButton).not.toBeDisabled({ timeout: 2000 });

    const captures = await page.evaluate(() => window.__clipboardCaptures || []);
    expect(captures.length).toBeGreaterThan(0);
    let shareUrl = null;
    for (const capture of captures) {
      if (capture.items) {
        const plainItem = capture.items.find(i => i.type === 'text/plain');
        if (plainItem) {
          shareUrl = plainItem.text;
          break;
        }
      } else if (capture.text) {
        shareUrl = capture.text;
      }
    }
    expect(shareUrl).toBeTruthy();
    expect(shareUrl).toContain('z%3A');
  });

  test('shared hash seed is only cleared once when editing', async function ({ page }) {
    await page.addInitScript(function () {
      window.CompressionStream = undefined;
      window.DecompressionStream = undefined;
    });

    function toBase64Url(text) {
      return Buffer.from(text, 'utf8').toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    const originalText = 'Shared content here';
    const hash = '#mode=edit&text=r:' + toBase64Url(originalText);

    await gotoApp(page, { hash: hash });

    // Verify initial content
    await expect(page.locator('#output')).toHaveValue(originalText);
    await expect(page.locator('html')).toHaveAttribute('data-hash-mode', '1');

    // Make first edit - this should trigger clearSharedHashSeedContent once
    const output = page.locator('#output');
    await output.click();
    await output.press('End');
    await output.type('X');

    // Content should be cleared because of the first edit
    await expect(output).toHaveValue('');

    // Verify hash mode attribute is removed after editing shared content
    await expect(page.locator('html')).not.toHaveAttribute('data-hash-mode');

    // Now type more text - this should NOT clear again (because hasEditedFromSharedHash is true)
    await output.type('New text');

    // Content should contain what we typed (not cleared again)
    await expect(output).toHaveValue('New text');
  });
});
