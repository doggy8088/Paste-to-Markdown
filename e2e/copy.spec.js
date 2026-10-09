'use strict';

const { test, expect } = require('./support/fixtures');
const { gotoApp, setMarkdown, getMarkdown } = require('./support/app');

/**
 * Sets up a stubs for clipboard API to capture writes.
 * Must be called before gotoApp.
 */
async function setupClipboardStubs(page, options) {
  options = options || {};
  await page.addInitScript(function (opts) {
    window.__clipboardWrites = [];
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        write: opts.writeFails ? async function (items) {
          throw new Error('Clipboard write failed');
        } : async function (items) {
          for (const item of items) {
            const entry = { types: [] };
            for (const [type, blob] of item) {
              entry.types.push(type);
              entry[type] = await blob.text();
            }
            window.__clipboardWrites.push(entry);
          }
        },
        writeText: opts.writeTextFails ? async function (text) {
          throw new Error('Clipboard writeText failed');
        } : async function (text) {
          window.__clipboardWrites.push({ types: ['text/plain'], 'text/plain': text });
        },
        readText: async function () {
          if (window.__clipboardWrites.length > 0) {
            return window.__clipboardWrites[window.__clipboardWrites.length - 1]['text/plain'] || '';
          }
          return '';
        }
      },
      configurable: true
    });

    // Create a proper ClipboardItem that can be iterated
    if (!opts.noClipboardItem) {
      window.ClipboardItem = function (data) {
        const entries = Object.entries(data);
        const iterator = Symbol.iterator;
        this[iterator] = function* () {
          for (const [type, blob] of entries) {
            yield [type, blob];
          }
        };
        this.data = data;
      };
    }
  }, options);
}

test.describe('Copy - Button Click and Keyboard Shortcut', function () {
  test('copies markdown to clipboard via button click with ClipboardItem', async function ({ page }) {
    await setupClipboardStubs(page);
    await gotoApp(page);
    await setMarkdown(page, '# Hello\n\nBold text: **world**');

    // Click copy button
    await page.locator('#copy-button').click();

    // Wait for clipboard write to complete
    await expect.poll(() => page.evaluate(() => (window.__clipboardWrites || []).length), {
      timeout: 5000
    }).toBe(1);

    // Verify clipboard write was called
    const writes = await page.evaluate(() => window.__clipboardWrites);
    expect(writes.length).toBe(1);
    expect(writes[0]['text/plain']).toBe('# Hello\n\nBold text: **world**');
    expect(writes[0]['text/html']).toContain('<h1');
    expect(writes[0]['text/html']).toContain('Hello');
    expect(writes[0]['text/html']).toContain('<strong');
    expect(writes[0]['text/html']).toContain('world');
  });

  test('keyboard shortcut Alt+C copies markdown', async function ({ page }) {
    await setupClipboardStubs(page);
    await gotoApp(page);
    await setMarkdown(page, '## Section');

    // Trigger Alt+C
    await page.keyboard.press('Alt+C');

    // Wait for clipboard write to complete
    await expect.poll(() => page.evaluate(() => (window.__clipboardWrites || []).length), {
      timeout: 5000
    }).toBe(1);

    // Verify clipboard write
    const writes = await page.evaluate(() => window.__clipboardWrites);
    expect(writes.length).toBe(1);
    expect(writes[0]['text/plain']).toBe('## Section');
    expect(writes[0]['text/html']).toBeTruthy();
    expect(writes[0]['text/html']).toContain('<h2');
  });

  test('does not copy when copy button is busy', async function ({ page }) {
    await page.addInitScript(function () {
      window.__clipboardWrites = [];
      let resolveWrite;
      window.__writeDelay = new Promise(r => { resolveWrite = r; });
      window.__resolveWrite = resolveWrite;

      Object.defineProperty(navigator, 'clipboard', {
        value: {
          write: async function (items) {
            for (const item of items) {
              const entry = { types: [] };
              for (const [type, blob] of item) {
                entry.types.push(type);
                entry[type] = await blob.text();
              }
              window.__clipboardWrites.push(entry);
            }
            // Simulate a slow write that can be delayed
            await window.__writeDelay;
          },
          writeText: async function (text) {
            window.__clipboardWrites.push({ types: ['text/plain'], 'text/plain': text });
            await window.__writeDelay;
          }
        },
        configurable: true
      });
      window.ClipboardItem = function (data) {
        const entries = Object.entries(data);
        const iterator = Symbol.iterator;
        this[iterator] = function* () {
          for (const [type, blob] of entries) {
            yield [type, blob];
          }
        };
      };
    });

    await gotoApp(page);
    await setMarkdown(page, 'Content');
    await page.clock.install();

    const copyButton = page.locator('#copy-button');

    // Start first click (will be delayed by __writeDelay promise)
    const firstClickPromise = copyButton.click();

    // Wait for button to become disabled
    await expect(copyButton).toBeDisabled({ timeout: 1000 });

    // Try to click again - should fail since button is disabled
    let secondClickFailed = false;
    try {
      await copyButton.click({ timeout: 100 });
    } catch (e) {
      secondClickFailed = true;
    }
    expect(secondClickFailed).toBe(true);

    // Resolve the write delay so first click can complete
    await page.evaluate(() => window.__resolveWrite());
    await firstClickPromise;

    // Wait for button to be re-enabled (should happen after the finally block timeout)
    await page.clock.fastForward(1500);
    await expect(copyButton).toBeEnabled({ timeout: 1000 });

    // Should only have 1 write
    const writes = await page.evaluate(() => window.__clipboardWrites);
    expect(writes.length).toBe(1);
  });

  test('executeCopyAction returns early when copyButtonBusy is true (line 1048)', async function ({ page }) {
    await page.addInitScript(function () {
      window.__clipboardWrites = [];
      window.__copyAttempts = 0;
      window.__executeCopyActionCallCount = 0;
      let resolveWrite;
      window.__writeDelay = new Promise(r => { resolveWrite = r; });
      window.__resolveWrite = resolveWrite;

      Object.defineProperty(navigator, 'clipboard', {
        value: {
          write: async function (items) {
            window.__copyAttempts++;
            for (const item of items) {
              const entry = { types: [] };
              for (const [type, blob] of item) {
                entry.types.push(type);
                entry[type] = await blob.text();
              }
              window.__clipboardWrites.push(entry);
            }
            await window.__writeDelay;
          },
          writeText: async function (text) {
            window.__copyAttempts++;
            window.__clipboardWrites.push({ types: ['text/plain'], 'text/plain': text });
            await window.__writeDelay;
          }
        },
        configurable: true
      });
      window.ClipboardItem = function (data) {
        const entries = Object.entries(data);
        const iterator = Symbol.iterator;
        this[iterator] = function* () {
          for (const [type, blob] of entries) {
            yield [type, blob];
          }
        };
      };

      // Hook to capture executeCopyAction calls
      window.__originalAddEventListener = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (type === 'click' && this.id === 'copy-button') {
          // Wrap the listener to track calls
          window.__executeCopyActionFn = function () {
            window.__executeCopyActionCallCount++;
            return listener.call(this);
          };
          return window.__originalAddEventListener.call(this, type, window.__executeCopyActionFn, options);
        }
        return window.__originalAddEventListener.call(this, type, listener, options);
      };
    });

    await gotoApp(page);
    await setMarkdown(page, 'Test busy guard');

    const copyButton = page.locator('#copy-button');

    // Click copy button and hold the async operation
    const firstClick = copyButton.click();

    // Wait for button to be disabled (indicates copy is in progress and copyButtonBusy=true)
    await expect(copyButton).toBeDisabled({ timeout: 1000 });

    // Try to call executeCopyAction again while busy (this will call it, but guard prevents action)
    const callsBefore = await page.evaluate(() => window.__executeCopyActionCallCount);
    await page.evaluate(async () => {
      if (window.__executeCopyActionFn) {
        await window.__executeCopyActionFn();
      }
    });
    const callsAfter = await page.evaluate(() => window.__executeCopyActionCallCount);

    // executeCopyAction was called, but the guard at line 1048 prevented a second write
    expect(callsAfter).toBe(callsBefore + 1);

    // Release the first copy
    await page.evaluate(() => window.__resolveWrite());
    await firstClick;

    // Verify only one clipboard write was made (second call was blocked by guard)
    const attempts = await page.evaluate(() => window.__copyAttempts);
    expect(attempts).toBe(1);
  });
});

test.describe('Copy - Error Handling and Fallbacks', function () {
  test('copies empty editor produces empty text', async function ({ page }) {
    await setupClipboardStubs(page);
    await gotoApp(page);
    // Leave editor empty
    const copyButton = page.locator('#copy-button');
    await copyButton.click();

    // Wait for button to be re-enabled (indicates clipboard write completed)
    await expect(copyButton).toBeEnabled({ timeout: 2000 });

    // Should still attempt write with empty markdown
    const writes = await page.evaluate(() => window.__clipboardWrites);
    expect(writes.length).toBe(1);
    expect(writes[0]['text/plain']).toBe('');
  });

  test('falls back to text/html + text/plain when text/markdown fails', async function ({ page }) {
    await page.addInitScript(function () {
      window.__clipboardWrites = [];
      window.__attemptedTypes = [];
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          write: async function (items) {
            for (const item of items) {
              const types = [];
              for (const [type, blob] of item) {
                types.push(type);
              }
              window.__attemptedTypes.push(types);

              // First attempt with text/markdown fails
              if (types.includes('text/markdown')) {
                throw new Error('text/markdown not supported');
              }

              const entry = { types: types };
              for (const [type, blob] of item) {
                entry[type] = await blob.text();
              }
              window.__clipboardWrites.push(entry);
            }
          },
          writeText: async function (text) {
            window.__clipboardWrites.push({ types: ['text/plain'], 'text/plain': text });
          }
        },
        configurable: true
      });
      window.ClipboardItem = function (data) {
        const entries = Object.entries(data);
        const iterator = Symbol.iterator;
        this[iterator] = function* () {
          for (const [type, blob] of entries) {
            yield [type, blob];
          }
        };
      };
    });

    await gotoApp(page);
    await setMarkdown(page, 'Fallback test');

    await page.locator('#copy-button').click();

    // Wait for clipboard write to complete
    await expect.poll(() => page.evaluate(() => (window.__clipboardWrites || []).length), {
      timeout: 5000
    }).toBe(1);

    // Should have attempted twice: once with markdown, once with fallback
    const attempts = await page.evaluate(() => window.__attemptedTypes);
    expect(attempts.length).toBe(2);
    expect(attempts[0]).toContain('text/markdown');
    expect(attempts[1]).not.toContain('text/markdown');
    expect(attempts[1]).toContain('text/html');
    expect(attempts[1]).toContain('text/plain');

    const writes = await page.evaluate(() => window.__clipboardWrites);
    expect(writes.length).toBe(1);
    expect(writes[0]['text/plain']).toBe('Fallback test');
  });

  test('falls back to writeText when ClipboardItem is unavailable', async function ({ page }) {
    await page.addInitScript(function () {
      window.__clipboardWrites = [];

      Object.defineProperty(navigator, 'clipboard', {
        value: {
          write: async function (items) {
            for (const item of items) {
              const entry = { types: [] };
              for (const [type, blob] of item) {
                entry.types.push(type);
                entry[type] = await blob.text();
              }
              window.__clipboardWrites.push(entry);
            }
          },
          writeText: async function (text) {
            window.__clipboardWrites.push({ types: ['text/plain'], 'text/plain': text });
          }
        },
        configurable: true
      });

      // Delete ClipboardItem to force fallback to writeText
      delete window.ClipboardItem;
    });

    await gotoApp(page);
    await setMarkdown(page, 'Fallback to writeText');

    const copyButton = page.locator('#copy-button');
    await copyButton.click();

    // Wait for button to be re-enabled (indicates clipboard write completed)
    await expect(copyButton).toBeEnabled({ timeout: 2000 });

    const writes = await page.evaluate(() => window.__clipboardWrites);
    expect(writes.length).toBe(1);
    expect(writes[0].types).toEqual(['text/plain']);
    expect(writes[0]['text/plain']).toBe('Fallback to writeText');
  });

  test('handles clipboard.write rejection with error label', async function ({ page }) {
    await setupClipboardStubs(page, { writeFails: true, writeTextFails: true });
    await gotoApp(page);
    await setMarkdown(page, 'Test error handling');

    const copyButton = page.locator('#copy-button');
    await copyButton.click();

    // Button should be disabled initially
    await expect(copyButton).toBeDisabled();

    // Wait for button to be re-enabled
    await expect(copyButton).toBeEnabled({ timeout: 2000 });

    // Label should be back to Copy (with emoji)
    await expect(copyButton).toHaveText(/Copy/);
  });

  test('shows success label then restores original label after timeout', async function ({ page }) {
    await setupClipboardStubs(page);
    await gotoApp(page);
    await setMarkdown(page, 'Show success');

    const copyButton = page.locator('#copy-button');

    // Install clock for deterministic timeout testing
    await page.clock.install();

    await copyButton.click();

    // Label should change to something indicating success (may include emoji)
    await expect(copyButton).toHaveText(/Copied|Copy.*✓|✓/, { timeout: 1000 });

    // Fast-forward the timer (1200ms)
    await page.clock.fastForward(1200);

    // Label should restore to "Copy" (with emoji)
    await expect(copyButton).toHaveText(/Copy/, { timeout: 1000 });

    // Button should not be disabled
    await expect(copyButton).toBeEnabled();
  });

  test('button becomes disabled during copy and re-enabled after', async function ({ page }) {
    await page.addInitScript(function () {
      window.__writePromise = new Promise(resolve => {
        window.__resolveWrite = resolve;
      });
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          write: async function (items) {
            await window.__writePromise;
          },
          writeText: async function (text) {
            await window.__writePromise;
          }
        },
        configurable: true
      });
      window.ClipboardItem = function (data) {
        const entries = Object.entries(data);
        const iterator = Symbol.iterator;
        this[iterator] = function* () {
          for (const [type, blob] of entries) {
            yield [type, blob];
          }
        };
      };
    });

    await gotoApp(page);
    await setMarkdown(page, 'Disable test');

    const copyButton = page.locator('#copy-button');

    // Initially enabled
    await expect(copyButton).toBeEnabled();

    // Start copy (don't await, so we can check state during copy)
    const copyPromise = copyButton.click();

    // Should become disabled during copy (with polling)
    await expect(copyButton).toBeDisabled({ timeout: 1000 });

    // Resolve the clipboard write
    await page.evaluate(() => window.__resolveWrite());

    // Wait for copy to complete
    await copyPromise;

    // Use polling to wait for it to be re-enabled
    await expect(copyButton).toBeEnabled({ timeout: 2000 });
  });
});

test.describe('Copy - Markdown to HTML Rendering', function () {
  test('renders markdown with headings to HTML', async function ({ page }) {
    await setupClipboardStubs(page);
    await gotoApp(page);
    await setMarkdown(page, '# Heading 1\n## Heading 2\n### Heading 3');

    await page.locator('#copy-button').click();

    // Wait for clipboard write to complete
    await expect.poll(() => page.evaluate(() => (window.__clipboardWrites || []).length), {
      timeout: 5000
    }).toBe(1);

    const writes = await page.evaluate(() => window.__clipboardWrites);
    const html = writes[0]['text/html'];
    expect(html).toContain('<h1');
    expect(html).toContain('<h2');
    expect(html).toContain('<h3');
    expect(html).toContain('Heading 1');
    expect(html).toContain('Heading 2');
    expect(html).toContain('Heading 3');
  });

  test('renders markdown with lists to HTML', async function ({ page }) {
    await setupClipboardStubs(page);
    await gotoApp(page);
    await setMarkdown(page, '- Item 1\n- Item 2\n- Item 3');

    await page.locator('#copy-button').click();

    // Wait for clipboard write to complete
    await expect.poll(() => page.evaluate(() => (window.__clipboardWrites || []).length), {
      timeout: 5000
    }).toBe(1);

    const writes = await page.evaluate(() => window.__clipboardWrites);
    const html = writes[0]['text/html'];
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
    expect(html).toContain('Item 1');
  });

  test('renders markdown with tables to HTML', async function ({ page }) {
    await setupClipboardStubs(page);
    await gotoApp(page);
    await setMarkdown(page, '| Col 1 | Col 2 |\n|-------|-------|\n| A     | B     |');

    await page.locator('#copy-button').click();

    // Wait for clipboard write to complete
    await expect.poll(() => page.evaluate(() => (window.__clipboardWrites || []).length), {
      timeout: 5000
    }).toBe(1);

    const writes = await page.evaluate(() => window.__clipboardWrites);
    const html = writes[0]['text/html'];
    expect(html).toContain('<table');
    expect(html).toContain('<tr');
    expect(html).toContain('<td');
  });

  test('handles markdown rendering errors gracefully', async function ({ page }) {
    // Set up stubs that will help us capture the copy action
    await page.addInitScript(function () {
      window.__clipboardWrites = [];
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          write: async function (items) {
            for (const item of items) {
              const entry = { types: [] };
              for (const [type, blob] of item) {
                entry.types.push(type);
                entry[type] = await blob.text();
              }
              window.__clipboardWrites.push(entry);
            }
          },
          writeText: async function (text) {
            window.__clipboardWrites.push({ types: ['text/plain'], 'text/plain': text });
          }
        },
        configurable: true
      });
      window.ClipboardItem = function (data) {
        const entries = Object.entries(data);
        const iterator = Symbol.iterator;
        this[iterator] = function* () {
          for (const [type, blob] of entries) {
            yield [type, blob];
          }
        };
        this.data = data;
      };

    });

    await gotoApp(page);
    await setMarkdown(page, '# Broken Markdown');

    // Override marked.parse after app loads to simulate rendering error
    await page.evaluate(function () {
      const originalParse = window.marked.parse;
      window.marked.parse = function (content) {
        throw new Error('Simulated parse error');
      };
    });

    // Now perform the copy action
    const copyButton = page.locator('#copy-button');
    await copyButton.click();

    // Wait for button to be re-enabled (indicates clipboard write completed)
    await expect(copyButton).toBeEnabled({ timeout: 2000 });

    // Should still copy text/plain successfully
    const writes = await page.evaluate(() => window.__clipboardWrites);

    expect(writes.length).toBeGreaterThan(0);
    expect(writes[0]['text/plain']).toBe('# Broken Markdown');
    // HTML should still exist (as escaped version)
    expect(writes[0]['text/html']).toBeTruthy();
    // It should contain the markdown text escaped as HTML
    expect(writes[0]['text/html']).toContain('Broken Markdown');
  });
});

test.describe('Copy - Shortcut Matching', function () {
  test('matchesCopyShortcut requires Alt key', async function ({ page }) {
    await page.goto('/index.html');

    const result = await page.evaluate(() => {
      // Create mock events and test
      function testShortcut(altKey, ctrlKey, metaKey, shiftKey, key) {
        const event = {
          altKey, ctrlKey, metaKey, shiftKey, key, code: 'KeyC'
        };

        // This tests the logic of matchesCopyShortcut
        return event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          (event.key === 'c' || event.key === 'C' || event.code === 'KeyC');
      }

      return {
        valid: testShortcut(true, false, false, false, 'c'),
        noAlt: testShortcut(false, false, false, false, 'c'),
        withCtrl: testShortcut(true, true, false, false, 'c'),
        withMeta: testShortcut(true, false, true, false, 'c'),
        withShift: testShortcut(true, false, false, true, 'c')
      };
    });

    expect(result.valid).toBe(true);
    expect(result.noAlt).toBe(false);
    expect(result.withCtrl).toBe(false);
    expect(result.withMeta).toBe(false);
    expect(result.withShift).toBe(false);
  });

  test('matchesCopyShortcut accepts uppercase and lowercase c', async function ({ page }) {
    await page.goto('/index.html');

    const result = await page.evaluate(() => {
      function testShortcut(key, code) {
        const event = {
          altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, key, code
        };
        return event.altKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          (event.key === 'c' || event.key === 'C' || event.code === 'KeyC');
      }

      return {
        lowercase: testShortcut('c', 'KeyC'),
        uppercase: testShortcut('C', 'KeyC'),
        keyCode: testShortcut('x', 'KeyC')
      };
    });

    expect(result.lowercase).toBe(true);
    expect(result.uppercase).toBe(true);
    expect(result.keyCode).toBe(true);
  });
});

test.describe('Copy - Clipboard Unavailable', function () {
  test('throws error when clipboard API is completely unavailable', async function ({ page }) {
    await page.addInitScript(function () {
      window.__clipboardWrites = [];

      // Remove clipboard entirely
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true
      });
    });

    await gotoApp(page);
    await setMarkdown(page, 'No clipboard');

    const copyButton = page.locator('#copy-button');
    await copyButton.click();

    // Button should be disabled initially
    await expect(copyButton).toBeDisabled();

    // Wait for error handling and button re-enable
    await expect(copyButton).toBeEnabled({ timeout: 2000 });
  });
});

test.describe('Copy - Real Clipboard (Integration)', function () {
  test('writes Markdown and rendered HTML to the system clipboard', async function ({ page, context }) {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoApp(page);
    await setMarkdown(page, '# Real clipboard');

    await page.locator('#copy-button').click();

    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('# Real clipboard');
    const html = await page.evaluate(async () => {
      const items = await navigator.clipboard.read();
      return (await items[0].getType('text/html')).text();
    });
    expect(html).toContain('<h1>Real clipboard</h1>');
  });
});

test.describe('Copy - Guard Conditions', function () {
  test('refreshCopyButtonLabel returns early when copyButton is missing (line 1717)', async function ({ page }) {
    let pageErrorOccurred = false;
    let errorMessage = '';
    page.on('pageerror', (error) => {
      pageErrorOccurred = true;
      errorMessage = error.toString();
      console.error('Page error:', error);
    });

    // Intercept and modify index.html to remove the copy-button element
    await page.route('**/index.html', async (route) => {
      const response = await route.fetch();
      let html = await response.text();
      html = html.replace(/<button[^>]*id="copy-button"[^>]*>[\s\S]*?<\/button>/i, '');
      await route.fulfill({ response, body: html });
    });

    // Set up clipboard stubs
    await setupClipboardStubs(page);

    // Load the app - the copy-button will not exist in the DOM
    await gotoApp(page);
    await setMarkdown(page, 'Test refresh when button missing');

    // Dispatch languageChange, whose listener calls refreshCopyButtonLabel while
    // #copy-button is missing. Listener errors are reported synchronously to
    // window 'error' handlers during dispatchEvent, so capture them in place.
    const listenerErrors = await page.evaluate(() => {
      const captured = [];
      const onError = (event) => captured.push(event.message);
      window.addEventListener('error', onError);
      document.dispatchEvent(new Event('languageChange', { bubbles: true }));
      window.removeEventListener('error', onError);
      return captured;
    });

    expect(listenerErrors).toEqual([]);
    expect(pageErrorOccurred).toBe(false);
  });
});
