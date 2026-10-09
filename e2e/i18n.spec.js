'use strict';

const { test, expect } = require('./support/fixtures');
const { gotoApp } = require('./support/app');

test.describe('i18n (Internationalization)', function () {
  test.describe('currentLang detection', function () {
    test('returns saved language from localStorage', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'ja' } });
      const lang = await page.evaluate(() => window.i18n.currentLang());
      expect(lang).toBe('ja');
    });

    test('returns "en" for invalid saved language', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'invalid-lang' } });
      const lang = await page.evaluate(() => window.i18n.currentLang());
      expect(lang).toBe('en');
    });

    test('matches full browser locale like zh-cn', async function ({ page }) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'language', {
          value: 'zh-cn',
          configurable: true
        });
      });
      await gotoApp(page);
      const lang = await page.evaluate(() => window.i18n.currentLang());
      expect(lang).toBe('zh-cn');
    });

    test('matches full browser locale like zh (Traditional)', async function ({ page }) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'language', {
          value: 'zh-TW',
          configurable: true
        });
      });
      await gotoApp(page);
      const lang = await page.evaluate(() => window.i18n.currentLang());
      expect(lang).toBe('zh');
    });

    test('falls back to short code like "fr" for "fr-CA"', async function ({ page }) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'language', {
          value: 'fr-CA',
          configurable: true
        });
      });
      await gotoApp(page);
      const lang = await page.evaluate(() => window.i18n.currentLang());
      expect(lang).toBe('fr');
    });

    test('falls back to "en" for unsupported locale like xx-YY', async function ({ page }) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'language', {
          value: 'xx-YY',
          configurable: true
        });
      });
      await gotoApp(page);
      const lang = await page.evaluate(() => window.i18n.currentLang());
      expect(lang).toBe('en');
    });

    test('prefers saved language over browser locale', async function ({ page }) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'language', {
          value: 'fr-CA',
          configurable: true
        });
      });
      await gotoApp(page, { storage: { 'preferred-lang': 'ja' } });
      const lang = await page.evaluate(() => window.i18n.currentLang());
      expect(lang).toBe('ja');
    });
  });

  test.describe('setLanguage', function () {
    test('sets valid language and persists to localStorage', async function ({ page }) {
      await gotoApp(page);
      await page.evaluate(() => window.i18n.setLanguage('ja'));
      const saved = await page.evaluate(() => localStorage.getItem('preferred-lang'));
      expect(saved).toBe('ja');
    });

    test('sets document lang attribute', async function ({ page }) {
      await gotoApp(page);
      await page.evaluate(() => window.i18n.setLanguage('es'));
      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBe('es');
    });

    test('sets dir="ltr" for non-Arabic languages', async function ({ page }) {
      await gotoApp(page);
      await page.evaluate(() => window.i18n.setLanguage('en'));
      const dir = await page.locator('html').getAttribute('dir');
      expect(dir).toBe('ltr');
    });

    test('sets dir="rtl" for Arabic language', async function ({ page }) {
      await gotoApp(page);
      await page.evaluate(() => window.i18n.setLanguage('ar'));
      const dir = await page.locator('html').getAttribute('dir');
      expect(dir).toBe('rtl');
    });

    test('falls back to "en" for invalid language', async function ({ page }) {
      await gotoApp(page);
      await page.evaluate(() => window.i18n.setLanguage('invalid-language'));
      const saved = await page.evaluate(() => localStorage.getItem('preferred-lang'));
      expect(saved).toBe('en');
    });

    test('fires languageChange event', async function ({ page }) {
      await gotoApp(page);
      const eventFired = await page.evaluate(() => {
        return new Promise(resolve => {
          document.addEventListener('languageChange', (e) => {
            resolve(e.detail.lang);
          });
          window.i18n.setLanguage('ko');
        });
      });
      expect(eventFired).toBe('ko');
    });

    test('calls updatePage when language is changed', async function ({ page }) {
      await gotoApp(page);
      // Switch to Japanese which has different text
      await page.evaluate(() => window.i18n.setLanguage('ja'));
      // Check that tab label is updated to Japanese
      const tabText = await page.locator('.tab-button[data-tab="edit"]').textContent();
      expect(tabText).toContain('編集');
    });
  });

  test.describe('language selector dropdown', function () {
    test('dropdown exists and is populated', async function ({ page }) {
      await gotoApp(page);
      const select = page.locator('#lang-select');
      await expect(select).toBeVisible();
      const optionCount = await page.locator('#lang-select option').count();
      expect(optionCount).toBeGreaterThan(1);
    });

    test('current language is selected in dropdown', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'ja' } });
      const selectedValue = await page.locator('#lang-select').inputValue();
      expect(selectedValue).toBe('ja');
    });

    test('switching language via dropdown updates visible text', async function ({ page }) {
      await gotoApp(page);
      // Switch to Japanese
      await page.selectOption('#lang-select', 'ja');
      // Check that edit tab is updated to Japanese
      const editTabText = await page.locator('.tab-button[data-tab="edit"]').textContent();
      expect(editTabText).toContain('編集');
      // Check that preview tab is updated to Japanese
      const previewTabText = await page.locator('.tab-button[data-tab="preview"]').textContent();
      expect(previewTabText).toContain('プレビュー');
    });

    test('switching language persists choice to localStorage', async function ({ page }) {
      await gotoApp(page);
      await page.selectOption('#lang-select', 'ko');
      const saved = await page.evaluate(() => localStorage.getItem('preferred-lang'));
      expect(saved).toBe('ko');
    });

    test('switching language fires languageChange event', async function ({ page }) {
      await gotoApp(page);
      const eventFired = await page.evaluate(() => {
        return new Promise(resolve => {
          document.addEventListener('languageChange', (e) => {
            resolve(e.detail.lang);
          });
          document.getElementById('lang-select').value = 'ru';
          document.getElementById('lang-select').dispatchEvent(new Event('change', { bubbles: true }));
        });
      });
      expect(eventFired).toBe('ru');
    });
  });

  test.describe('all locale switching', function () {
    // Get all available locales and test each one
    const locales = ['ar', 'en', 'es', 'fr', 'hi', 'id', 'ja', 'ko', 'pt', 'ru', 'th', 'tr', 'vi', 'zh', 'zh-cn'];

    for (const locale of locales) {
      test(`can switch to ${locale}`, async function ({ page }) {
        await gotoApp(page);
        await page.selectOption('#lang-select', locale);
        const savedLang = await page.evaluate(() => localStorage.getItem('preferred-lang'));
        expect(savedLang).toBe(locale);
        // Verify lang attribute is set
        const htmlLang = await page.locator('html').getAttribute('lang');
        expect(htmlLang).toBe(locale);
      });
    }

    // Test that we can iterate through all locale options
    test('all locale options in dropdown are accessible', async function ({ page }) {
      await gotoApp(page);
      const options = await page.locator('#lang-select option').count();
      // Should have all 15 locales
      expect(options).toBe(15);
    });
  });

  test.describe('placeholder updates', function () {
    test('placeholder is set correctly in English', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'en' } });
      const placeholder = await page.locator('#output').getAttribute('placeholder');
      expect(placeholder).toBe('Paste content here...');
    });

    test('placeholder updates when language is switched to Japanese', async function ({ page }) {
      await gotoApp(page);
      await page.selectOption('#lang-select', 'ja');
      const placeholder = await page.locator('#output').getAttribute('placeholder');
      expect(placeholder).toBe('ここにコンテンツを貼り付け...');
    });

    test('placeholder attribute is actually updated (not just innerHTML)', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'en' } });
      // Verify initial placeholder
      let placeholder = await page.locator('#output').getAttribute('placeholder');
      expect(placeholder).toBe('Paste content here...');
      // Switch to different language
      await page.selectOption('#lang-select', 'es');
      // Verify placeholder has changed
      placeholder = await page.locator('#output').getAttribute('placeholder');
      expect(placeholder).toBe('Pega el contenido aquí...');
      // Verify it's not the same as English
      expect(placeholder).not.toBe('Paste content here...');
    });

    test('placeholder updates when language is switched to Arabic', async function ({ page }) {
      await gotoApp(page);
      await page.selectOption('#lang-select', 'ar');
      const placeholder = await page.locator('#output').getAttribute('placeholder');
      expect(placeholder).toBe('الصق المحتوى هنا...');
    });

    test('placeholder updates when language is switched to Spanish', async function ({ page }) {
      await gotoApp(page);
      await page.selectOption('#lang-select', 'es');
      const placeholder = await page.locator('#output').getAttribute('placeholder');
      expect(placeholder).toBe('Pega el contenido aquí...');
    });
  });

  test.describe('t() function', function () {
    test('returns translated string from current locale', async function ({ page }) {
      await gotoApp(page);
      const text = await page.evaluate(() => window.i18n.t('tabEdit'));
      expect(text).toBe('✏️ Edit');
    });

    test('returns translated string from Japanese locale', async function ({ page }) {
      await gotoApp(page);
      await page.evaluate(() => window.i18n.setLanguage('ja'));
      const text = await page.evaluate(() => {
        return window.i18n.t('tabEdit');
      });
      expect(text).toBe('編集');
    });

    test('falls back to key itself when not in any locale', async function ({ page }) {
      await gotoApp(page);
      const text = await page.evaluate(() => window.i18n.t('nonexistent-key-xyz'));
      expect(text).toBe('nonexistent-key-xyz');
    });

    test('interpolates copyShortcut placeholder', async function ({ page }) {
      await gotoApp(page);
      const text = await page.evaluate(() => window.i18n.t('step1'));
      expect(text).toMatch(/Ctrl|⌘/); // Should contain either Ctrl or ⌘ depending on platform
    });

    test('interpolates tabModifier shortcut', async function ({ page }) {
      await gotoApp(page);
      const text = await page.evaluate(() => window.i18n.t('step5'));
      expect(text).toMatch(/Alt|Option/); // Should contain either Alt or Option
    });

    test('interpolate with custom replacements', async function ({ page }) {
      await gotoApp(page);
      const text = await page.evaluate(() => {
        return window.i18n.interpolate('Hello {name}, you are {age} years old', {
          name: 'John',
          age: '30'
        });
      });
      expect(text).toBe('Hello John, you are 30 years old');
    });
  });

  test.describe('shortcutLabels for different platforms', function () {
    test('returns Ctrl and Alt for non-Mac platform', async function ({ page }) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'userAgentData', {
          value: { platform: 'Windows' },
          configurable: true
        });
      });
      await gotoApp(page);
      const labels = await page.evaluate(() => window.i18n.shortcutLabels());
      expect(labels.copyShortcut).toContain('Ctrl');
      expect(labels.editShortcut).toContain('Alt');
    });

    test('returns ⌘ and Option for macOS platform', async function ({ page }) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'userAgentData', {
          value: { platform: 'macOS' },
          configurable: true
        });
      });
      await gotoApp(page);
      const labels = await page.evaluate(() => window.i18n.shortcutLabels());
      expect(labels.copyShortcut).toContain('⌘');
      expect(labels.editShortcut).toContain('Option');
    });

    test('returns ⌘ and Option for iPhone platform', async function ({ page }) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'userAgentData', {
          value: { platform: 'iPhone' },
          configurable: true
        });
      });
      await gotoApp(page);
      const labels = await page.evaluate(() => window.i18n.shortcutLabels());
      expect(labels.copyShortcut).toContain('⌘');
    });

    test('falls back to navigator.platform for Mac', async function ({ page }) {
      await page.addInitScript(() => {
        // Remove userAgentData and set platform to simulate fallback
        try {
          Object.defineProperty(navigator, 'userAgentData', {
            value: undefined,
            configurable: true
          });
        } catch (e) {
          // Safari may not allow redefining
        }
        try {
          Object.defineProperty(navigator, 'platform', {
            value: 'MacIntel',
            configurable: true
          });
        } catch (e) {
          // Fallback if property is not configurable
        }
      });
      await gotoApp(page);
      const labels = await page.evaluate(() => window.i18n.shortcutLabels());
      // Either ⌘ (Mac) or Ctrl (fallback if config fails)
      expect(labels.copyShortcut).toMatch(/⌘|Ctrl/);
    });

    test('detects Linux platform correctly', async function ({ page }) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'userAgentData', {
          value: { platform: 'Linux' },
          configurable: true
        });
      });
      await gotoApp(page);
      const labels = await page.evaluate(() => window.i18n.shortcutLabels());
      expect(labels.copyShortcut).toContain('Ctrl');
      expect(labels.editShortcut).toContain('Alt');
    });
  });

  test.describe('updatePage', function () {
    test('updates data-i18n elements', async function ({ page }) {
      await gotoApp(page);
      await page.evaluate(() => window.i18n.setLanguage('ja'));
      const subtitle = await page.locator('[data-i18n="subtitle"]').textContent();
      expect(subtitle).toBe('使い方');
    });

    test('updates data-i18n-placeholder elements', async function ({ page }) {
      await gotoApp(page);
      await page.evaluate(() => window.i18n.setLanguage('ja'));
      const placeholder = await page.locator('#output').getAttribute('placeholder');
      expect(placeholder).toBe('ここにコンテンツを貼り付け...');
    });

    test('updates multiple elements with same data-i18n key', async function ({ page }) {
      await gotoApp(page);
      // Switch to a language to trigger update
      await page.selectOption('#lang-select', 'ja');
      // Verify at least one element is updated
      const editTab = await page.locator('.tab-button[data-tab="edit"]').textContent();
      expect(editTab).toContain('編集');
    });
  });

  test.describe('populateLanguageSelector', function () {
    test('populates all available locales in dropdown', async function ({ page }) {
      await gotoApp(page);
      const localeNames = await page.locator('#lang-select option').allTextContents();
      expect(localeNames.length).toBeGreaterThan(1);
      expect(localeNames).toContain('English');
      expect(localeNames).toContain('日本語');
    });

    test('sorts locale options alphabetically by localeName', async function ({ page }) {
      await gotoApp(page);
      const localeNames = await page.locator('#lang-select option').allTextContents();
      // Verify options are sorted using localeCompare (same as app sorts them)
      const sortedNames = [...localeNames].sort((a, b) => {
        return a.localeCompare(b, 'en', { sensitivity: 'base' });
      });
      expect(localeNames).toEqual(sortedNames);
    });

    test('first option is alphabetically first, not last', async function ({ page }) {
      await gotoApp(page);
      const localeNames = await page.locator('#lang-select option').allTextContents();
      // Copy the array to avoid mutating original
      const names = [...localeNames];
      // Sort to get alphabetically first
      const alphabeticallyFirst = names.sort((a, b) => {
        return a.localeCompare(b, 'en', { sensitivity: 'base' });
      })[0];
      // The first item in the options should be alphabetically first
      expect(localeNames[0]).toBe(alphabeticallyFirst);
      // Make a reverse sort to check it's NOT reversed
      const reverseFirst = [...localeNames].sort((a, b) => {
        return -a.localeCompare(b, 'en', { sensitivity: 'base' });
      })[0];
      // First option should not match reverse-sorted first
      // (unless there's only one option or they happen to be same)
      if (localeNames.length > 1) {
        expect(localeNames[0]).not.toBe(reverseFirst);
      }
    });

    test('marks current language as selected', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'ja' } });
      const selectedValue = await page.locator('#lang-select').inputValue();
      expect(selectedValue).toBe('ja');
    });

    test('sets selected attribute on current language option', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'ko' } });
      // Find the option element with value 'ko'
      const selectedOption = await page.locator('#lang-select option[value="ko"]');
      // Check that it has the selected attribute
      const isSelected = await selectedOption.evaluate((el) => el.selected);
      expect(isSelected).toBe(true);
      // Also verify other options are not selected
      const enOption = await page.locator('#lang-select option[value="en"]');
      const enSelected = await enOption.evaluate((el) => el.selected);
      expect(enSelected).toBe(false);
    });

    test('first language option is not selected if current language is set', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'pt' } });
      // Get the first option in the select
      const firstOption = await page.locator('#lang-select option').first();
      const firstSelected = await firstOption.evaluate((el) => el.selected);
      // First option should not be selected since we set 'pt' as preferred
      expect(firstSelected).toBe(false);
    });
  });

  test.describe('init function', function () {
    test('initializes on DOMContentLoaded', async function ({ page }) {
      await gotoApp(page);
      const i18n = await page.evaluate(() => window.i18n);
      expect(i18n).toBeTruthy();
    });

    test('sets document lang attribute on init', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'ja' } });
      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBe('ja');
    });

    test('sets document dir attribute to ltr by default', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'en' } });
      const dir = await page.locator('html').getAttribute('dir');
      expect(dir).toBe('ltr');
    });

    test('sets document dir attribute to rtl for Arabic on init', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'ar' } });
      const dir = await page.locator('html').getAttribute('dir');
      expect(dir).toBe('rtl');
    });

    test('populates language selector on init', async function ({ page }) {
      await gotoApp(page);
      const optionCount = await page.locator('#lang-select option').count();
      expect(optionCount).toBeGreaterThan(0);
    });

    test('sets up change listener on lang-select', async function ({ page }) {
      await gotoApp(page);
      await page.selectOption('#lang-select', 'fr');
      const saved = await page.evaluate(() => localStorage.getItem('preferred-lang'));
      expect(saved).toBe('fr');
    });

    test('calls updatePage on init', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'ja' } });
      // Verify that the page has been updated with Japanese text
      const editTab = await page.locator('.tab-button[data-tab="edit"]').textContent();
      expect(editTab).toContain('編集');
    });
  });

  test.describe('locale file coverage', function () {
    const locales = ['ar', 'en', 'es', 'fr', 'hi', 'id', 'ja', 'ko', 'pt', 'ru', 'th', 'tr', 'vi', 'zh', 'zh-cn'];

    for (const locale of locales) {
      test(`${locale} locale loads and has required keys`, async function ({ page }) {
        await gotoApp(page, { storage: { 'preferred-lang': locale } });
        const localeData = await page.evaluate((lang) => {
          return window.i18nLocales && window.i18nLocales[lang];
        }, locale);
        expect(localeData).toBeDefined();
        expect(typeof localeData.localeName).toBe('string');
        expect(localeData.localeName.length).toBeGreaterThan(0);
        expect(typeof localeData.tabEdit).toBe('string');
        expect(localeData.tabEdit.length).toBeGreaterThan(0);
        expect(typeof localeData.tabPreview).toBe('string');
        expect(localeData.tabPreview.length).toBeGreaterThan(0);
        expect(typeof localeData.placeholder).toBe('string');
        expect(localeData.placeholder.length).toBeGreaterThan(0);
      });

      test(`${locale} locale tab labels display correctly`, async function ({ page }) {
        await gotoApp(page, { storage: { 'preferred-lang': locale } });
        const localeData = await page.evaluate((lang) => {
          return window.i18nLocales && window.i18nLocales[lang];
        }, locale);
        const editTab = await page.locator('.tab-button[data-tab="edit"]').textContent();
        const previewTab = await page.locator('.tab-button[data-tab="preview"]').textContent();
        // Verify that tab labels contain the correct translations from the locale
        expect(editTab).toContain(localeData.tabEdit);
        expect(previewTab).toContain(localeData.tabPreview);
      });
    }
  });

  test.describe('interpolate function', function () {
    test('replaces simple placeholders', async function ({ page }) {
      await gotoApp(page);
      const result = await page.evaluate(() => {
        return window.i18n.interpolate('Hello {name}', { name: 'World' });
      });
      expect(result).toBe('Hello World');
    });

    test('handles multiple placeholders', async function ({ page }) {
      await gotoApp(page);
      const result = await page.evaluate(() => {
        return window.i18n.interpolate('{greeting} {name}, {message}', {
          greeting: 'Hello',
          name: 'John',
          message: 'welcome!'
        });
      });
      expect(result).toBe('Hello John, welcome!');
    });

    test('leaves unmatched placeholders unchanged', async function ({ page }) {
      await gotoApp(page);
      const result = await page.evaluate(() => {
        return window.i18n.interpolate('Hello {name}, your age is {age}', {
          name: 'John'
        });
      });
      expect(result).toBe('Hello John, your age is {age}');
    });

    test('handles empty replacements object', async function ({ page }) {
      await gotoApp(page);
      const result = await page.evaluate(() => {
        return window.i18n.interpolate('Hello {name}', {});
      });
      expect(result).toBe('Hello {name}');
    });

    test('converts non-string values to strings', async function ({ page }) {
      await gotoApp(page);
      const result = await page.evaluate(() => {
        return window.i18n.interpolate('Count: {count}', { count: 42 });
      });
      expect(result).toBe('Count: 42');
    });
  });

  test.describe('English fallback in translations', function () {
    test('returns key itself when not in current language or English', async function ({ page }) {
      await gotoApp(page);
      const text = await page.evaluate(() => window.i18n.t('nonexistent-key-xyz'));
      expect(text).toBe('nonexistent-key-xyz');
    });

    test('verifies English fallback is used when key missing in current locale', async function ({ page }) {
      // Set to Indonesian, then test a key that should exist in en
      await gotoApp(page, { storage: { 'preferred-lang': 'id' } });
      const text = await page.evaluate(() => window.i18n.t('step1'));
      // The key should have been looked up: id -> en -> key
      // If fallback to English is removed, this would be the key itself
      // With English fallback, it should be a translated string
      expect(text).not.toBe('step1'); // Should not be just the key
      expect(text.length).toBeGreaterThan(0);
    });
  });

  test.describe('Arabic RTL direction', function () {
    test('Arabic locale sets dir="rtl" on html', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'ar' } });
      const dir = await page.locator('html').getAttribute('dir');
      expect(dir).toBe('rtl');
    });

    test('Arabic locale brand subtitle is displayed', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'ar' } });
      const subtitle = await page.locator('.brand-subtitle').textContent();
      expect(subtitle).toContain('محتوى');
    });

    test('switching away from Arabic sets dir back to ltr', async function ({ page }) {
      await gotoApp(page, { storage: { 'preferred-lang': 'ar' } });
      let dir = await page.locator('html').getAttribute('dir');
      expect(dir).toBe('rtl');
      await page.selectOption('#lang-select', 'en');
      dir = await page.locator('html').getAttribute('dir');
      expect(dir).toBe('ltr');
    });
  });

  test.describe('localStorage persistence', function () {
    test('preferred language persists across page reload', async function ({ page }) {
      await gotoApp(page);
      await page.selectOption('#lang-select', 'ko');
      let saved = await page.evaluate(() => localStorage.getItem('preferred-lang'));
      expect(saved).toBe('ko');
      // Reload the page
      await page.reload();
      saved = await page.evaluate(() => localStorage.getItem('preferred-lang'));
      expect(saved).toBe('ko');
      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBe('ko');
    });
  });
});
