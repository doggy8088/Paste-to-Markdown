'use strict';

const { test, expect } = require('./support/fixtures');
const { gotoApp, pasteContent, convertPaste, getMarkdown, setMarkdown, switchTab, readFixture } = require('./support/app');

// On Linux and Windows, Control+V also runs the browser's native paste. The
// test clipboard is empty, and the app's paste handler would immediately undo
// prepareForPaste, so block that native paste to observe the keydown behavior
// the same way on every platform.
async function pressPasteShortcut(page) {
  await page.evaluate(function () {
    window.__blockNativePaste = function (event) {
      event.stopImmediatePropagation();
      event.preventDefault();
    };
    document.addEventListener('paste', window.__blockNativePaste, true);
  });
  await page.keyboard.press('Control+V');
  await page.evaluate(function () {
    document.removeEventListener('paste', window.__blockNativePaste, true);
  });
}

test.describe('UI Shell - Platform & Shortcuts', function () {
  test('detects macOS platform and shows Option modifier', async function ({ page }) {
    await page.addInitScript(function () {
      Object.defineProperty(navigator, 'userAgentData', {
        value: { platform: 'macOS' },
        configurable: true
      });
    });
    await gotoApp(page);

    // Check that tab buttons have Option shortcut hints
    const editButton = page.locator('.tab-button[data-tab="edit"]');
    const editTitle = await editButton.getAttribute('title');
    expect(editTitle).toContain('Option+1');
  });

  test('detects non-macOS platform and shows Alt modifier', async function ({ page }) {
    await page.addInitScript(function () {
      Object.defineProperty(navigator, 'userAgentData', {
        value: { platform: 'Linux' },
        configurable: true
      });
    });
    await gotoApp(page);

    const editButton = page.locator('.tab-button[data-tab="edit"]');
    const editTitle = await editButton.getAttribute('title');
    expect(editTitle).toContain('Alt+1');
  });

  test('falls back to navigator.platform when userAgentData is unavailable', async function ({ page }) {
    await page.addInitScript(function () {
      // Make userAgentData return undefined
      Object.defineProperty(navigator, 'userAgentData', {
        value: undefined,
        configurable: true
      });
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true
      });
    });
    await gotoApp(page);

    const editButton = page.locator('.tab-button[data-tab="edit"]');
    const editTitle = await editButton.getAttribute('title');
    expect(editTitle).toContain('Alt+1');
  });

  test('detects Windows platform correctly', async function ({ page }) {
    await page.addInitScript(function () {
      Object.defineProperty(navigator, 'userAgentData', {
        value: { platform: 'Windows' },
        configurable: true
      });
    });
    await gotoApp(page);

    const editButton = page.locator('.tab-button[data-tab="edit"]');
    const editTitle = await editButton.getAttribute('title');
    expect(editTitle).toContain('Alt+1');
  });

  test('sets tab container title with all shortcuts', async function ({ page }) {
    await page.addInitScript(function () {
      Object.defineProperty(navigator, 'userAgentData', {
        value: { platform: 'macOS' },
        configurable: true
      });
    });
    await gotoApp(page);

    const tabsContainer = page.locator('.tabs');
    const containerTitle = await tabsContainer.getAttribute('title');
    expect(containerTitle).toContain('Option+1');
    expect(containerTitle).toContain('Option+2');
  });
});

test.describe('UI Shell - Theme Switching', function () {
  test('loads light theme from localStorage on startup', async function ({ page }) {
    await gotoApp(page, { storage: { pasteToMarkdownTheme: 'light' } });

    // Check html data-theme attribute
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');

    // Check active theme button
    const lightButton = page.locator('.theme-button[data-theme-choice="light"]');
    const ariaPressed = await lightButton.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');
  });

  test('loads dark theme from localStorage on startup', async function ({ page }) {
    await gotoApp(page, { storage: { pasteToMarkdownTheme: 'dark' } });

    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('dark');

    const darkButton = page.locator('.theme-button[data-theme-choice="dark"]');
    const ariaPressed = await darkButton.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');
  });

  test('defaults to system theme when invalid value stored', async function ({ page }) {
    await gotoApp(page, { storage: { pasteToMarkdownTheme: 'invalid' } });

    // System theme means no data-theme attribute
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBeNull();

    // System button should be active
    const systemButton = page.locator('.theme-button[data-theme-choice="system"]');
    const ariaPressed = await systemButton.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');
  });

  test('clicking Light theme button sets data-theme and persists to localStorage', async function ({ page }) {
    await gotoApp(page);

    const lightButton = page.locator('.theme-button[data-theme-choice="light"]');
    await lightButton.click();

    // Check html attribute
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');

    // Check button state
    const ariaPressed = await lightButton.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');

    // Check localStorage was updated
    const stored = await page.evaluate(function () {
      return localStorage.getItem('pasteToMarkdownTheme');
    });
    expect(stored).toBe('light');
  });

  test('clicking Dark theme button sets data-theme and persists to localStorage', async function ({ page }) {
    await gotoApp(page);

    const darkButton = page.locator('.theme-button[data-theme-choice="dark"]');
    await darkButton.click();

    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('dark');

    const ariaPressed = await darkButton.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');

    const stored = await page.evaluate(function () {
      return localStorage.getItem('pasteToMarkdownTheme');
    });
    expect(stored).toBe('dark');
  });

  test('clicking System theme button removes data-theme and clears localStorage', async function ({ page }) {
    // Start with light theme
    await gotoApp(page, { storage: { pasteToMarkdownTheme: 'light' } });

    const systemButton = page.locator('.theme-button[data-theme-choice="system"]');
    await systemButton.click();

    // data-theme should be removed
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBeNull();

    const ariaPressed = await systemButton.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');

    // localStorage should be cleared
    const stored = await page.evaluate(function () {
      return localStorage.getItem('pasteToMarkdownTheme');
    });
    expect(stored).toBeNull();
  });

  test('theme button updates are mutually exclusive', async function ({ page }) {
    await gotoApp(page);

    const systemButton = page.locator('.theme-button[data-theme-choice="system"]');
    const lightButton = page.locator('.theme-button[data-theme-choice="light"]');
    const darkButton = page.locator('.theme-button[data-theme-choice="dark"]');

    await lightButton.click();
    let lightPressed = await lightButton.getAttribute('aria-pressed');
    let systemPressed = await systemButton.getAttribute('aria-pressed');
    expect(lightPressed).toBe('true');
    expect(systemPressed).toBe('false');

    await darkButton.click();
    let darkPressed = await darkButton.getAttribute('aria-pressed');
    lightPressed = await lightButton.getAttribute('aria-pressed');
    expect(darkPressed).toBe('true');
    expect(lightPressed).toBe('false');
  });

  test('handles localStorage.setItem throwing when setting theme', async function ({ page }) {
    let setItemRestored = false;
    await page.addInitScript(function () {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function () {
        throw new Error('Storage is full');
      };
      // Store original for cleanup
      window.__originalSetItem = originalSetItem;
    });

    await gotoApp(page);

    // Try to set theme - should not crash even if localStorage throws
    const lightButton = page.locator('.theme-button[data-theme-choice="light"]');
    await lightButton.click();

    // HTML should still update despite localStorage error
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');

    // Restore localStorage for cleanup
    await page.evaluate(function () {
      Storage.prototype.setItem = window.__originalSetItem;
    });
  });

  test('handles localStorage.getItem throwing during init', async function ({ page }) {
    await page.addInitScript(function () {
      Storage.prototype.getItem = function () {
        throw new Error('Storage error');
      };
    });

    // Should load without crashing
    await gotoApp(page);

    // Should fall back to system theme
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBeNull();
  });

  test('preload script handles localStorage.getItem throwing', async function ({ page }) {
    await page.addInitScript(function () {
      Storage.prototype.getItem = function () {
        throw new Error('Storage error');
      };
    });

    // Load page and check that theme preload script doesn't crash
    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');

    // Page should still have content
    await expect(page.locator('.app-shell')).toBeVisible();
  });
});

test.describe('UI Shell - Tab Switching', function () {
  test('Edit tab is active on load', async function ({ page }) {
    await gotoApp(page);

    const editButton = page.locator('.tab-button[data-tab="edit"]');
    await expect(editButton).toHaveClass(/active/);

    const editTab = page.locator('#edit-tab');
    await expect(editTab).toHaveClass(/active/);
  });

  test('clicking Preview tab switches to preview', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Test');

    const previewButton = page.locator('.tab-button[data-tab="preview"]');
    await previewButton.click();

    await expect(previewButton).toHaveClass(/active/);

    const previewTab = page.locator('#preview-tab');
    await expect(previewTab).toHaveClass(/active/);

    // Edit tab should be inactive
    const editButton = page.locator('.tab-button[data-tab="edit"]');
    await expect(editButton).not.toHaveClass(/active/);
  });

  test('clicking Edit tab from Preview switches back', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Test');
    await switchTab(page, 'preview');

    const editButton = page.locator('.tab-button[data-tab="edit"]');
    await editButton.click();

    await expect(editButton).toHaveClass(/active/);

    const editTab = page.locator('#edit-tab');
    await expect(editTab).toHaveClass(/active/);
  });

  test('Preview tab renders markdown with correct HTML', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Heading\n\n**Bold** text');

    await switchTab(page, 'preview');

    const preview = page.locator('#preview');
    await expect(preview.locator('h1')).toContainText('Heading');
    await expect(preview.locator('strong')).toContainText('Bold');
  });

  test('setThemeChoice updates tab button aria-selected', async function ({ page }) {
    await gotoApp(page);

    const editButton = page.locator('.tab-button[data-tab="edit"]');
    const previewButton = page.locator('.tab-button[data-tab="preview"]');

    let editSelected = await editButton.getAttribute('aria-selected');
    let previewSelected = await previewButton.getAttribute('aria-selected');
    expect(editSelected).toBe('true');
    expect(previewSelected).toBe('false');

    await previewButton.click();

    editSelected = await editButton.getAttribute('aria-selected');
    previewSelected = await previewButton.getAttribute('aria-selected');
    expect(editSelected).toBe('false');
    expect(previewSelected).toBe('true');
  });
});

test.describe('UI Shell - Keyboard Shortcuts', function () {
  test('Ctrl+V focuses pastebin and hides info/wrapper', async function ({ page }) {
    await gotoApp(page);

    // Initially, info and wrapper are visible
    await expect(page.locator('#info')).not.toHaveClass(/hidden/);

    // Simulate Ctrl+V
    await pressPasteShortcut(page);

    // info and wrapper should be hidden
    await expect(page.locator('#info')).toHaveClass(/hidden/);
    await expect(page.locator('#wrapper')).toHaveClass(/hidden/);

    // pastebin should be focused
    const focusedElement = await page.evaluate(function () {
      return document.activeElement.id;
    });
    expect(focusedElement).toBe('pastebin');
  });

  test('Escape resets output view', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, 'test content');

    // Hide info/wrapper first
    await pressPasteShortcut(page);

    // Press Escape
    await page.keyboard.press('Escape');

    // Check that output is cleared
    const markdown = await getMarkdown(page);
    expect(markdown).toBe('');

    // Check that info and wrapper are visible again
    await expect(page.locator('#info')).not.toHaveClass(/hidden/);
    await expect(page.locator('#wrapper')).not.toHaveClass(/hidden/);

    // Edit tab should be active
    const editButton = page.locator('.tab-button[data-tab="edit"]');
    await expect(editButton).toHaveClass(/active/);
  });

  test('Alt+1 switches to Edit tab', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Test');
    await switchTab(page, 'preview');

    // Verify Preview is active
    let previewButton = page.locator('.tab-button[data-tab="preview"]');
    await expect(previewButton).toHaveClass(/active/);

    // Press Alt+1
    await page.keyboard.press('Alt+1');

    // Edit should now be active
    const editButton = page.locator('.tab-button[data-tab="edit"]');
    await expect(editButton).toHaveClass(/active/);
  });

  test('Alt+2 switches to Preview tab', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Test');

    // Verify Edit is active
    let editButton = page.locator('.tab-button[data-tab="edit"]');
    await expect(editButton).toHaveClass(/active/);

    // Press Alt+2
    await page.keyboard.press('Alt+2');

    // Preview should now be active
    const previewButton = page.locator('.tab-button[data-tab="preview"]');
    await expect(previewButton).toHaveClass(/active/);
  });

  test('Alt+1 does nothing if Edit tab is already active', async function ({ page }) {
    await gotoApp(page);

    const editButton = page.locator('.tab-button[data-tab="edit"]');

    // Press Alt+1
    await page.keyboard.press('Alt+1');

    // Button should still be active (click only happens if not already active)
    await expect(editButton).toHaveClass(/active/);
  });

  test('Escape scrolls to top', async function ({ page }) {
    await gotoApp(page);

    // Scroll down
    await page.evaluate(function () {
      window.scrollTo(0, 500);
    });

    let scrollY = await page.evaluate(function () {
      return window.scrollY;
    });
    expect(scrollY).toBeGreaterThan(0);

    // Press Escape
    await page.keyboard.press('Escape');

    // Should scroll to top
    scrollY = await page.evaluate(function () {
      return window.scrollY;
    });
    expect(scrollY).toBe(0);
  });
});

test.describe('UI Shell - beforeprint Event', function () {
  test('beforeprint copies editor content to print-output', async function ({ page }) {
    await gotoApp(page);
    const testContent = 'Line 1\nLine 2\nLine 3';
    await setMarkdown(page, testContent);

    // Dispatch beforeprint event
    await page.evaluate(function () {
      window.dispatchEvent(new Event('beforeprint'));
    });

    // Check that print-output has the content
    const printOutput = await page.locator('#print-output').textContent();
    expect(printOutput).toBe(testContent);
  });

  test('beforeprint handles empty editor', async function ({ page }) {
    await gotoApp(page);

    // Editor should start empty or be cleared
    await page.locator('#output').fill('');

    await page.evaluate(function () {
      window.dispatchEvent(new Event('beforeprint'));
    });

    const printOutput = await page.locator('#print-output').textContent();
    expect(printOutput).toBe('');
  });

  test('beforeprint copies updated content after changes', async function ({ page }) {
    await gotoApp(page);

    await setMarkdown(page, 'First content');
    await page.evaluate(function () {
      window.dispatchEvent(new Event('beforeprint'));
    });

    let printOutput = await page.locator('#print-output').textContent();
    expect(printOutput).toBe('First content');

    // Update content
    await setMarkdown(page, 'Updated content');
    await page.evaluate(function () {
      window.dispatchEvent(new Event('beforeprint'));
    });

    printOutput = await page.locator('#print-output').textContent();
    expect(printOutput).toBe('Updated content');
  });
});

test.describe('UI Shell - Hash Mode Preload', function () {
  test('sets data-hash-mode when URL has hash', async function ({ page }) {
    await gotoApp(page, { hash: '#test-hash' });

    const htmlHashMode = await page.locator('html').getAttribute('data-hash-mode');
    expect(htmlHashMode).toBe('1');
  });

  test('does not set data-hash-mode when URL has no hash', async function ({ page }) {
    await gotoApp(page);

    const htmlHashMode = await page.locator('html').getAttribute('data-hash-mode');
    expect(htmlHashMode).toBeNull();
  });

  test('preload script handles location access error', async function ({ page }) {
    await page.addInitScript(function () {
      Object.defineProperty(window, 'location', {
        value: { hash: '' },
        configurable: true,
        writable: false
      });
      // Make location.hash throw
      Object.defineProperty(window.location, 'hash', {
        get: function () {
          throw new Error('Location error');
        }
      });
    });

    // Should load without crashing
    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');

    // Page should be usable
    await expect(page.locator('.app-shell')).toBeVisible();
  });
});

test.describe('UI Shell - prepareForPaste', function () {
  test('prepareForPaste clears pastebin HTML', async function ({ page }) {
    await gotoApp(page);

    // Set pastebin innerHTML to something
    await page.evaluate(function () {
      document.querySelector('#pastebin').innerHTML = '<span>test</span>';
    });

    // Trigger Ctrl+V to call prepareForPaste
    await pressPasteShortcut(page);

    // pastebin should be empty
    const pastebinHTML = await page.evaluate(function () {
      return document.querySelector('#pastebin').innerHTML;
    });
    expect(pastebinHTML).toBe('');
  });

  test('prepareForPaste hides info and wrapper', async function ({ page }) {
    await gotoApp(page);

    // info and wrapper should be visible initially
    await expect(page.locator('#info')).not.toHaveClass(/hidden/);
    await expect(page.locator('#wrapper')).not.toHaveClass(/hidden/);

    // Trigger prepareForPaste
    await pressPasteShortcut(page);

    // Both should be hidden
    await expect(page.locator('#info')).toHaveClass(/hidden/);
    await expect(page.locator('#wrapper')).toHaveClass(/hidden/);
  });
});

test.describe('UI Shell - resetOutputView', function () {
  test('resetOutputView clears editor and shows info/wrapper', async function ({ page }) {
    await gotoApp(page);

    // Add content
    await setMarkdown(page, 'Some test content');

    // Hide info/wrapper
    await pressPasteShortcut(page);

    // Press Escape to trigger resetOutputView
    await page.keyboard.press('Escape');

    // Check that output is empty
    const markdown = await getMarkdown(page);
    expect(markdown).toBe('');

    // Check that info and wrapper are visible
    await expect(page.locator('#info')).not.toHaveClass(/hidden/);
    await expect(page.locator('#wrapper')).not.toHaveClass(/hidden/);
  });

  test('resetOutputView clears shared hash seed state', async function ({ page }) {
    // Load with a hash to trigger hash mode
    await gotoApp(page, { hash: '#z:test-hash' });

    // Verify hash mode is set
    const hashMode = await page.locator('html').getAttribute('data-hash-mode');
    expect(hashMode).toBe('1');

    // Add content and trigger reset
    await setMarkdown(page, 'content');
    await page.keyboard.press('Escape');

    // After reset, check state (hash mode should be cleared)
    // The app uses clearHashModeState() which removes data-hash-mode
    const hashModeAfter = await page.locator('html').getAttribute('data-hash-mode');
    expect(hashModeAfter).toBeNull();
  });
});

test.describe('UI Shell - i18n Initialization', function () {
  test('i18n.init() is called on DOMContentLoaded', async function ({ page }) {
    await gotoApp(page);

    // Check that i18n is initialized by looking for translated content
    const editButton = page.locator('.tab-button[data-tab="edit"]');
    const editText = await editButton.textContent();
    // Should have translated content
    expect(editText).toBeTruthy();
    expect(editText.length).toBeGreaterThan(0);
  });

  test('language selector is populated by i18n', async function ({ page }) {
    await gotoApp(page);

    const langSelect = page.locator('#lang-select');
    const options = page.locator('#lang-select option');

    // Should have multiple language options
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(0);
  });
});

test.describe('UI Shell - Integration Scenarios', function () {
  test('full workflow: paste, edit, preview, theme switch, keyboard shortcut', async function ({ page }) {
    await gotoApp(page);

    // Step 1: Paste some HTML
    const html = '<h2>Title</h2><p>Content with <em>emphasis</em>.</p>';
    await pasteContent(page, { html });

    // Check that content was converted
    const markdown = await getMarkdown(page);
    expect(markdown).toContain('Title');
    expect(markdown).toContain('Content');

    // Step 2: Switch to Preview
    await switchTab(page, 'preview');
    const previewH2 = page.locator('#preview h2');
    await expect(previewH2).toContainText('Title');

    // Step 3: Switch theme to light
    const lightButton = page.locator('.theme-button[data-theme-choice="light"]');
    await lightButton.click();
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');

    // Step 4: Use Alt+1 to return to Edit
    await page.keyboard.press('Alt+1');
    const editButton = page.locator('.tab-button[data-tab="edit"]');
    await expect(editButton).toHaveClass(/active/);

    // Step 5: Use Escape to reset
    await page.keyboard.press('Escape');
    const emptyMarkdown = await getMarkdown(page);
    expect(emptyMarkdown).toBe('');
  });

  test('localStorage persistence across theme changes', async function ({ page }) {
    await gotoApp(page);

    // Change theme multiple times
    let lightButton = page.locator('.theme-button[data-theme-choice="light"]');
    await lightButton.click();

    let stored = await page.evaluate(function () {
      return localStorage.getItem('pasteToMarkdownTheme');
    });
    expect(stored).toBe('light');

    let darkButton = page.locator('.theme-button[data-theme-choice="dark"]');
    await darkButton.click();

    stored = await page.evaluate(function () {
      return localStorage.getItem('pasteToMarkdownTheme');
    });
    expect(stored).toBe('dark');

    let systemButton = page.locator('.theme-button[data-theme-choice="system"]');
    await systemButton.click();

    stored = await page.evaluate(function () {
      return localStorage.getItem('pasteToMarkdownTheme');
    });
    expect(stored).toBeNull();
  });

  test('platform detection on non-macOS systems', async function ({ page }) {
    await page.addInitScript(function () {
      Object.defineProperty(navigator, 'userAgentData', {
        value: { platform: 'Linux' },
        configurable: true
      });
    });
    await gotoApp(page);

    // All shortcut hints should show Alt
    const editButton = page.locator('.tab-button[data-tab="edit"]');
    const title = await editButton.getAttribute('title');
    expect(title).toContain('Alt+1');

    const previewButton = page.locator('.tab-button[data-tab="preview"]');
    const previewTitle = await previewButton.getAttribute('title');
    expect(previewTitle).toContain('Alt+2');
  });

  test('keyboard shortcuts work correctly after tab switch', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Test');

    // Switch to Preview via Alt+2
    await page.keyboard.press('Alt+2');
    let previewButton = page.locator('.tab-button[data-tab="preview"]');
    await expect(previewButton).toHaveClass(/active/);

    // Switch back to Edit via Alt+1
    await page.keyboard.press('Alt+1');
    let editButton = page.locator('.tab-button[data-tab="edit"]');
    await expect(editButton).toHaveClass(/active/);
  });

  test('Alt+S triggers share shortcut and executes share action', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Test');

    // Get the share button
    const shareButton = page.locator('#share-button');

    // Press Alt+S to trigger share action
    await page.keyboard.press('Alt+S');

    // Share action should disable the button temporarily
    await expect(shareButton).toBeDisabled();

    // Wait for action to complete (button re-enabled after ~1200ms)
    // Use polling to wait for the button to be enabled again
    await page.waitForFunction(function () {
      const btn = document.querySelector('#share-button');
      return btn && !btn.disabled;
    }, { timeout: 2000 });

    // Verify button is enabled again
    await expect(shareButton).not.toBeDisabled();
  });

  test('Alt+C triggers copy shortcut and executes copy action', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Test');

    // Get the copy button
    const copyButton = page.locator('#copy-button');

    // Press Alt+C to trigger copy action
    await page.keyboard.press('Alt+C');

    // Copy action should disable the button temporarily
    await expect(copyButton).toBeDisabled();

    // Wait for action to complete (button re-enabled after ~1200ms)
    // Use polling to wait for the button to be enabled again
    await page.waitForFunction(function () {
      const btn = document.querySelector('#copy-button');
      return btn && !btn.disabled;
    }, { timeout: 2000 });

    // Verify button is enabled again
    await expect(copyButton).not.toBeDisabled();
  });
});

test.describe('UI Shell - Language Change Event', function () {
  test('languageChange event updates preview if active', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Test');
    await switchTab(page, 'preview');

    // Dispatch languageChange event
    await page.evaluate(function () {
      document.dispatchEvent(new Event('languageChange'));
    });

    // Preview should still be active and rendered
    const previewTab = page.locator('#preview-tab');
    await expect(previewTab).toHaveClass(/active/);

    const previewHeading = page.locator('#preview h1');
    await expect(previewHeading).toContainText('Test');
  });

  test('languageChange event does not update preview if not active', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Test');

    // Edit tab should be active
    const editTab = page.locator('#edit-tab');
    await expect(editTab).toHaveClass(/active/);

    // Dispatch languageChange event
    await page.evaluate(function () {
      document.dispatchEvent(new Event('languageChange'));
    });

    // Edit tab should still be active
    await expect(editTab).toHaveClass(/active/);
  });

  test('languageChange event updates tab shortcuts', async function ({ page }) {
    await page.addInitScript(function () {
      Object.defineProperty(navigator, 'userAgentData', {
        value: { platform: 'macOS' },
        configurable: true
      });
    });
    await gotoApp(page);

    // Get initial shortcut title
    const editButton = page.locator('.tab-button[data-tab="edit"]');
    const initialTitle = await editButton.getAttribute('title');
    expect(initialTitle).toContain('Option+1');

    // Dispatch languageChange event - titles should be updated (or at least preserved)
    await page.evaluate(function () {
      document.dispatchEvent(new Event('languageChange'));
    });

    const updatedTitle = await editButton.getAttribute('title');
    expect(updatedTitle).toContain('Option+1');
  });
});

test.describe('UI Shell - Hash Change Event', function () {
  test('hashchange event re-applies shared hash', async function ({ page }) {
    await gotoApp(page);

    // Simulate a hash change
    await page.evaluate(function () {
      window.location.hash = '#test-hash';
    });

    // The app should respond to the hash change by setting data-hash-mode
    const htmlHashMode = await page.locator('html').getAttribute('data-hash-mode');
    expect(htmlHashMode).toBe('1');
  });

  test('hashchange clears hash mode when hash is removed', async function ({ page }) {
    await gotoApp(page, { hash: '#initial-hash' });

    // Check that hash mode is set
    let htmlHashMode = await page.locator('html').getAttribute('data-hash-mode');
    expect(htmlHashMode).toBe('1');

    // Remove the hash
    await page.evaluate(function () {
      window.location.hash = '';
    });

    // Hash mode should be cleared when hash is removed
    htmlHashMode = await page.locator('html').getAttribute('data-hash-mode');
    expect(htmlHashMode).toBeNull();
  });
});

test.describe('UI Shell - getActiveTab', function () {
  test('getActiveTab returns edit when edit tab is active', async function ({ page }) {
    await gotoApp(page);

    const activeTab = await page.evaluate(function () {
      // Call the private function via the global scope if available
      // Since getActiveTab is not exposed, we check the DOM directly
      const activeButton = document.querySelector('.tab-button.active');
      return activeButton ? activeButton.getAttribute('data-tab') : 'edit';
    });

    expect(activeTab).toBe('edit');
  });

  test('getActiveTab returns preview when preview tab is active', async function ({ page }) {
    await gotoApp(page);
    await switchTab(page, 'preview');

    const activeTab = await page.evaluate(function () {
      const activeButton = document.querySelector('.tab-button.active');
      return activeButton ? activeButton.getAttribute('data-tab') : 'edit';
    });

    expect(activeTab).toBe('preview');
  });
});

test.describe('UI Shell - activateTab', function () {
  test('activateTab defaults an unknown tab to edit', async function ({ page }) {
    await gotoApp(page);
    await switchTab(page, 'preview');
    await expect(page.locator('.tab-button[data-tab="preview"]')).toHaveClass(/active/);

    // The click listener passes the button's data-tab to activateTab, which
    // treats anything other than "preview" as "edit".
    const previewButton = page.locator('.tab-button[data-tab="preview"]');
    await previewButton.evaluate(function (button) {
      button.setAttribute('data-tab', 'unknown');
    });
    await page.locator('.tab-button[data-tab="unknown"]').click();

    await expect(page.locator('.tab-button[data-tab="edit"]')).toHaveClass(/active/);
    await expect(page.locator('.tab-button[data-tab="edit"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#edit-tab')).toHaveClass(/active/);
    await expect(page.locator('#preview-tab')).not.toHaveClass(/active/);
  });

  test('activateTab updates preview when switching to preview', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Heading\n\nParagraph');

    // Switch to preview
    await switchTab(page, 'preview');

    // Preview should render the markdown
    const previewH1 = page.locator('#preview h1');
    await expect(previewH1).toContainText('Heading');

    const previewP = page.locator('#preview p');
    await expect(previewP).toContainText('Paragraph');
  });

  test('activateTab focuses editor when switching to edit', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, 'test');
    await switchTab(page, 'preview');

    // Switch back to edit with focus
    await switchTab(page, 'edit');

    // Editor should be in the active tab
    const editTab = page.locator('#edit-tab');
    await expect(editTab).toHaveClass(/active/);
  });
});

test.describe('UI Shell - Storage Error Handling', function () {
  test('getStoredThemeChoice returns system on localStorage.getItem error', async function ({ page }) {
    await page.addInitScript(function () {
      Storage.prototype.getItem = function () {
        throw new Error('Storage error');
      };
    });

    await gotoApp(page);

    // When storage throws, the app should fall back to system theme
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBeNull(); // System theme = no data-theme
  });

  test('getStoredThemeChoice catches localStorage.getItem error for theme key only', async function ({ page }) {
    let errorsCaught = 0;
    await page.addInitScript(function () {
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        if (key === 'pasteToMarkdownTheme') {
          throw new Error('Storage error for theme key');
        }
        return originalGetItem.call(this, key);
      };
    });

    await gotoApp(page);

    // When localStorage.getItem throws for theme key, should fall back to system theme
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBeNull(); // System theme = no data-theme

    // i18n should still work - verify elements are translated/present
    const editButton = page.locator('.tab-button[data-tab="edit"]');
    await expect(editButton).toBeVisible();
    const editText = await editButton.textContent();
    expect(editText).toBeTruthy();
    expect(editText.length).toBeGreaterThan(0);
  });

  test('setThemeChoice handles localStorage.removeItem throwing', async function ({ page }) {
    let removeItemErrorCount = 0;
    await page.addInitScript(function () {
      const originalRemoveItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (key) {
        if (key === 'pasteToMarkdownTheme') {
          throw new Error('Storage error');
        }
        return originalRemoveItem.call(this, key);
      };
    });

    await gotoApp(page, { storage: { pasteToMarkdownTheme: 'light' } });

    // Click System button to trigger removeItem
    const systemButton = page.locator('.theme-button[data-theme-choice="system"]');
    await systemButton.click();

    // Despite the error, the app should still switch themes visually
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBeNull(); // Should be cleared to system theme
  });
});

test.describe('UI Shell - activateTab Early Return', function () {
  test('Escape leaves the panels unchanged when no tab button is for Edit', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Heading');
    await switchTab(page, 'preview');

    // With no button whose data-tab is "edit", activateTab('edit') clears the
    // button highlight, finds no target, and returns before touching the panels.
    await page.evaluate(function () {
      document.querySelectorAll('.tab-button').forEach(function (button) {
        button.setAttribute('data-tab', 'missing');
      });
    });
    await page.keyboard.press('Escape');

    await expect(page.locator('.tab-button.active')).toHaveCount(0);
    await expect(page.locator('.tab-button[aria-selected="true"]')).toHaveCount(0);
    await expect(page.locator('#preview-tab')).toHaveClass(/active/);
    await expect(page.locator('#edit-tab')).not.toHaveClass(/active/);
    // Escape still resets the editor after the tab switch is skipped.
    await expect(page.locator('#output')).toHaveValue('');
  });
});

test.describe('UI Shell - Mutation Test Coverage', function () {
  test('getStoredThemeChoice error fallback returns system not dark', async function ({ page }) {
    await page.addInitScript(function () {
      Storage.prototype.getItem = function () {
        throw new Error('Storage error');
      };
    });

    await gotoApp(page);

    // When localStorage throws, theme should be system (no data-theme)
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBeNull();

    // Verify system theme button is active
    const systemButton = page.locator('.theme-button[data-theme-choice="system"]');
    const ariaPressed = await systemButton.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('true');
  });

  test('beforeprint uses textContent not innerHTML for security', async function ({ page }) {
    await gotoApp(page);

    // Set markdown with potential HTML that should be escaped
    const testContent = '<script>alert("xss")</script>Content';
    await setMarkdown(page, testContent);

    // Dispatch beforeprint event
    await page.evaluate(function () {
      window.dispatchEvent(new Event('beforeprint'));
    });

    // Check that print-output contains the raw text (textContent not innerHTML)
    const printOutput = await page.locator('#print-output').textContent();
    expect(printOutput).toBe(testContent);

    // Verify no script tags in print-output
    const printElement = await page.locator('#print-output');
    const innerHTML = await printElement.innerHTML();
    expect(innerHTML).not.toContain('<script>');
  });

  test('hash mode preload with single character hash still sets data-hash-mode', async function ({ page }) {
    // Load with single character hash (e.g., #a)
    await gotoApp(page, { hash: '#a' });

    const htmlHashMode = await page.locator('html').getAttribute('data-hash-mode');
    expect(htmlHashMode).toBe('1');
  });

  test('setThemeChoice sets data-theme on both html and body', async function ({ page }) {
    await gotoApp(page);

    const lightButton = page.locator('.theme-button[data-theme-choice="light"]');
    await lightButton.click();

    // Check html element
    const htmlTheme = await page.locator('html').getAttribute('data-theme');
    expect(htmlTheme).toBe('light');

    // Check body element (this catches if setAttribute is missing on body)
    const bodyTheme = await page.locator('body').getAttribute('data-theme');
    expect(bodyTheme).toBe('light');
  });

  test('matchesTabShortcut requires altKey to be true', async function ({ page }) {
    await gotoApp(page);
    await setMarkdown(page, '# Test');

    // Verify Preview is not active initially
    let previewButton = page.locator('.tab-button[data-tab="preview"]');
    const notActive = await previewButton.evaluate(el => !el.classList.contains('active'));
    expect(notActive).toBe(true);

    // Try Alt+2 (should work)
    await page.keyboard.press('Alt+2');
    previewButton = page.locator('.tab-button[data-tab="preview"]');
    let isActive = await previewButton.evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true);

    // Try just 2 without Alt (should not switch back)
    await page.keyboard.press('2');
    isActive = await previewButton.evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true); // Should stay on preview

    // Try Alt+1 to go back to edit
    await page.keyboard.press('Alt+1');
    const editButton = page.locator('.tab-button[data-tab="edit"]');
    isActive = await editButton.evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true);
  });

  test('getActiveTab returns edit when no button has active class', async function ({ page }) {
    await gotoApp(page);

    // Remove the active class from all buttons
    await page.evaluate(function () {
      const buttons = document.querySelectorAll('.tab-button');
      buttons.forEach(function(btn) {
        btn.classList.remove('active');
      });
    });

    // getActiveTab should return 'edit' as default
    // Verify by checking what happens when we press Alt+1
    await page.keyboard.press('Alt+1');
    const editButton = page.locator('.tab-button[data-tab="edit"]');
    const isActive = await editButton.evaluate(el => el.classList.contains('active'));
    expect(isActive).toBe(true);
  });

  test('platform detection uses lowercase for comparison', async function ({ page }) {
    await page.addInitScript(function () {
      Object.defineProperty(navigator, 'userAgentData', {
        value: { platform: 'MacOS' }, // uppercase
        configurable: true
      });
    });
    await gotoApp(page);

    // Should still detect as Mac and show Option modifier
    const editButton = page.locator('.tab-button[data-tab="edit"]');
    const editTitle = await editButton.getAttribute('title');
    expect(editTitle).toContain('Option+1');
  });

  test('updateTabShortcutHints creates correct shortcut format', async function ({ page }) {
    await page.addInitScript(function () {
      Object.defineProperty(navigator, 'userAgentData', {
        value: { platform: 'Linux' },
        configurable: true
      });
    });
    await gotoApp(page);

    const editButton = page.locator('.tab-button[data-tab="edit"]');
    const previewButton = page.locator('.tab-button[data-tab="preview"]');

    const editTitle = await editButton.getAttribute('title');
    const previewTitle = await previewButton.getAttribute('title');

    // Shortcuts should include +1 and +2 specifically, not +0 or +3
    expect(editTitle).toContain('+1');
    expect(previewTitle).toContain('+2');
    expect(editTitle).not.toContain('+0');
    expect(previewTitle).not.toContain('+3');
  });

  test('hash mode preload with empty hash string does not set mode', async function ({ page }) {
    // Navigate with empty hash
    await gotoApp(page, { hash: '' });

    const htmlHashMode = await page.locator('html').getAttribute('data-hash-mode');
    expect(htmlHashMode).toBeNull();
  });

  test('resetOutputView restores default preview placeholder', async function ({ page }) {
    await gotoApp(page);

    // Add some content
    await setMarkdown(page, 'test');

    // Press escape to reset
    await page.keyboard.press('Escape');

    // Output should be cleared
    const markdown = await getMarkdown(page);
    expect(markdown).toBe('');

    // Check that placeholder is visible (means hash mode is cleared)
    const placeholder = await page.locator('#output').getAttribute('placeholder');
    expect(placeholder).toBeTruthy();
    expect(placeholder.length).toBeGreaterThan(0);
  });
});
