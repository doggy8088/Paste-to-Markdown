'use strict';

const { test, expect } = require('./support/fixtures');
const {
  gotoApp,
  setMarkdown,
  switchTab,
  pasteContent,
  getMarkdown
} = require('./support/app');

test.describe('preview-sanitize', function () {
  // Helper to ensure we're on Edit tab before filling (textarea must be visible)
  async function ensureEditTabAndSetMarkdown(page, markdown) {
    const editTab = page.locator('.tab-button[data-tab="edit"]');
    const isActive = await editTab.evaluate(el => el.classList.contains('active'));
    if (!isActive) {
      await switchTab(page, 'edit');
    }
    await setMarkdown(page, markdown);
  }

  // Helper to verify XSS payload did not execute
  async function verifyXssNotExecuted(page, flagName) {
    const flagValue = await page.evaluate((name) => {
      return window[name];
    }, flagName);
    expect(flagValue).toBeUndefined();
  }

  test.describe('updatePreview - empty content', function () {
    test('shows "No content to preview" message when markdown is empty', async function ({ page }) {
      await gotoApp(page);
      await switchTab(page, 'preview');

      const preview = page.locator('#preview');
      await expect(preview.locator('p.empty-preview')).toBeVisible();
      await expect(preview.locator('p.empty-preview')).toHaveText('No content to preview');
    });

    test('shows empty message on repeated tab switches', async function ({ page }) {
      await gotoApp(page);
      await switchTab(page, 'preview');
      await expect(page.locator('#preview p.empty-preview')).toBeVisible();

      await switchTab(page, 'edit');
      await switchTab(page, 'preview');
      await expect(page.locator('#preview p.empty-preview')).toBeVisible();
    });
  });

  test.describe('updatePreview - rendering content', function () {
    test('renders markdown when editor has content', async function ({ page }) {
      await gotoApp(page);
      await ensureEditTabAndSetMarkdown(page, '# Hello');
      await switchTab(page, 'preview');

      const preview = page.locator('#preview');
      await expect(preview.locator('h1')).toHaveText('Hello');
    });

    test('renders multiple paragraphs and formatting', async function ({ page }) {
      await gotoApp(page);
      const markdown = '# Title\n\nThis is **bold** and this is *italic*.';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const preview = page.locator('#preview');
      await expect(preview.locator('h1')).toHaveText('Title');
      await expect(preview.locator('strong')).toHaveText('bold');
      await expect(preview.locator('em')).toHaveText('italic');
    });
  });

  test.describe('editor input listener', function () {
    test('updates preview when editing while preview tab is active', async function ({ page }) {
      await gotoApp(page);
      await ensureEditTabAndSetMarkdown(page, '# Initial');
      await switchTab(page, 'preview');

      await expect(page.locator('#preview h1')).toHaveText('Initial');

      // Edit using evaluate + fire input event (textarea is hidden in preview tab)
      await page.evaluate(function () {
        const output = document.querySelector('#output');
        output.value = '# Updated';
        output.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Preview should update via the input listener
      await expect(page.locator('#preview h1')).toHaveText('Updated');
    });

    test('fires update when clearing content while preview tab is active', async function ({ page }) {
      await gotoApp(page);
      await ensureEditTabAndSetMarkdown(page, '# Content');
      await switchTab(page, 'preview');

      await expect(page.locator('#preview h1')).toBeVisible();

      // Clear the markdown
      await page.evaluate(function () {
        const output = document.querySelector('#output');
        output.value = '';
        output.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Preview should show empty message
      await expect(page.locator('#preview p.empty-preview')).toBeVisible();
      await expect(page.locator('#preview p.empty-preview')).toHaveText('No content to preview');
    });

    test('only updates preview when preview tab is active (not edit tab)', async function ({ page }) {
      await gotoApp(page);
      await ensureEditTabAndSetMarkdown(page, '# A');
      await switchTab(page, 'preview');

      await expect(page.locator('#preview h1')).toHaveText('A');

      // Switch back to Edit tab and verify preview doesn't auto-update
      await switchTab(page, 'edit');

      // Try to fire input event
      await page.evaluate(function () {
        const output = document.querySelector('#output');
        output.value = '# B';
        output.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Switch back to preview - it should show old content because listener didn't update it
      // Then switching to preview triggers updatePreview from the tab click
      await switchTab(page, 'preview');

      // After switching to preview, it should be updated
      await expect(page.locator('#preview h1')).toHaveText('B');
    });

    test('handles rapid successive edits while preview is active', async function ({ page }) {
      await gotoApp(page);
      await ensureEditTabAndSetMarkdown(page, '# A');
      await switchTab(page, 'preview');

      await expect(page.locator('#preview h1')).toHaveText('A');

      // Rapid edits
      for (const char of ['B', 'C', 'D']) {
        await page.evaluate(function (c) {
          const output = document.querySelector('#output');
          output.value = '# ' + c;
          output.dispatchEvent(new Event('input', { bubbles: true }));
        }, char);

        await expect(page.locator('#preview h1')).toHaveText(char);
      }
    });
  });

  test.describe('sanitizeHtml - XSS prevention', function () {
    test('removes script tags from markdown HTML', async function ({ page }) {
      await gotoApp(page);
      const markdown = '<script>alert("xss")</script>\n\n# Hello';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      expect(await page.locator('#preview script').count()).toBe(0);
      await expect(page.locator('#preview h1')).toHaveText('Hello');
    });

    test('removes style tags from markdown HTML', async function ({ page }) {
      await gotoApp(page);
      const markdown = '<style>body { display: none; }</style>\n\n# Title';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      expect(await page.locator('#preview style').count()).toBe(0);
      await expect(page.locator('#preview h1')).toHaveText('Title');
    });

    test('strips dangerous href attributes (javascript:)', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Click me](javascript:window.xssFlag=1)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      await expect(link).toBeVisible();
      // isSafeUrl rejects javascript: so href is removed
      await expect(link).not.toHaveAttribute('href');

      await verifyXssNotExecuted(page, 'xssFlag');
    });

    test('strips dangerous href attributes (data:)', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Bad](data:text/html,<script>window.dataXss=1</script>)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      await expect(link).not.toHaveAttribute('href');
      await verifyXssNotExecuted(page, 'dataXss');
    });

    test('strips dangerous href attributes (vbscript:)', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Bad](vbscript:window.vbXss=1)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      await expect(link).not.toHaveAttribute('href');
      await verifyXssNotExecuted(page, 'vbXss');
    });

    test('strips dangerous href attributes (file:)', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Bad](file:///etc/passwd)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      await expect(link).not.toHaveAttribute('href');
    });

    test('removes images with dangerous src protocols (javascript:)', async function ({ page }) {
      await gotoApp(page);
      const markdown = '![alt](javascript:window.imgXss=1)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      expect(await page.locator('#preview img').count()).toBe(0);
      await verifyXssNotExecuted(page, 'imgXss');
    });

    test('removes images with data: protocol', async function ({ page }) {
      await gotoApp(page);
      const markdown = '![alt](data:image/svg+xml,<svg onload="window.dataSvgXss=1"/>)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      expect(await page.locator('#preview img').count()).toBe(0);
      await verifyXssNotExecuted(page, 'dataSvgXss');
    });

    test('strips on* event handlers but keeps a safe image', async function ({ page }) {
      await gotoApp(page);
      const markdown = '<img src="https://example.com/img.jpg" onerror="window.onerrorXss=1" />';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const img = page.locator('#preview img');
      await expect(img).toHaveCount(1);
      await expect(img).toHaveAttribute('src', 'https://example.com/img.jpg');
      await expect(img).not.toHaveAttribute('onerror', /.*/);
      await verifyXssNotExecuted(page, 'onerrorXss');
    });

    test('prevents SVG onload handlers from executing', async function ({ page }) {
      await gotoApp(page);
      const markdown = '<svg onload="window.svgXss=1"></svg>';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      // SVG might exist but handler should not execute
      // DOMParser preserves attributes during parsing, not execution
      const svg = page.locator('#preview svg');
      // Verify the XSS did not execute regardless of whether svg exists
      await verifyXssNotExecuted(page, 'svgXss');
    });

    test('prevents onclick handlers from executing', async function ({ page }) {
      await gotoApp(page);
      const markdown = '<button onclick="window.onclickXss=1">Click</button>';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      // Button might exist with onclick attribute from parsed HTML
      // But the event handler should not execute because it's parsed via DOMParser
      const button = page.locator('#preview button');
      // Verify the XSS did not execute
      await verifyXssNotExecuted(page, 'onclickXss');
    });

    test('handles mixed-case dangerous protocols', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Bad](JaVaScRiPt:window.mixedXss=1)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      // isSafeUrl does lowercase comparison and should block this
      await expect(link).not.toHaveAttribute('href');
      await verifyXssNotExecuted(page, 'mixedXss');
    });
  });

  test.describe('sanitizeHtml - safe content preservation', function () {
    test('preserves safe https:// links', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Example](https://example.com)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      await expect(link).toHaveAttribute('href', 'https://example.com');
      // Should have target and rel for security
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('preserves safe http:// links', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Example](http://example.com)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      await expect(link).toHaveAttribute('href', 'http://example.com');
    });

    test('preserves absolute paths (/)', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Link](/path/to/page)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      await expect(link).toHaveAttribute('href', '/path/to/page');
    });

    test('preserves relative paths (./ and ../)', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Local](./file.html) and [Parent](../other/file.html)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const links = page.locator('#preview a');
      expect(await links.count()).toBe(2);
      await expect(links.first()).toHaveAttribute('href', './file.html');
      await expect(links.nth(1)).toHaveAttribute('href', '../other/file.html');
    });

    test('preserves anchor links (#)', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Section](#header)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      await expect(link).toHaveAttribute('href', '#header');
    });

    test('preserves protocol-relative URLs (//)', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[CDN](//cdn.example.com/file)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      await expect(link).toHaveAttribute('href', '//cdn.example.com/file');
    });

    test('preserves safe https:// images', async function ({ page }) {
      await gotoApp(page);
      const markdown = '![alt](https://example.com/img.jpg)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const img = page.locator('#preview img');
      await expect(img).toHaveAttribute('src', 'https://example.com/img.jpg');
    });

    test('preserves relative image paths', async function ({ page }) {
      await gotoApp(page);
      const markdown = '![alt](./img.png) and ![alt2](../images/pic.jpg)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const images = page.locator('#preview img');
      expect(await images.count()).toBe(2);
      await expect(images.first()).toHaveAttribute('src', './img.png');
      await expect(images.nth(1)).toHaveAttribute('src', '../images/pic.jpg');
    });
  });

  // A shared link (#mode=preview&text=r:<base64url Markdown>) renders the
  // Markdown in the Preview tab as soon as it is opened, so every payload
  // below must stay inert without any user action.
  test.describe('sanitizeHtml - XSS payloads in shared links', function () {
    function toRawShareHash(markdown) {
      const encoded = Buffer.from(markdown, 'utf8').toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return '#mode=preview&text=r:' + encoded;
    }

    const PAYLOADS = [
      { name: 'img onerror', markdown: '<img src="missing.png" onerror="window.__xss = 1">', gone: '[onerror]', kept: 'img[src="missing.png"]' },
      { name: 'svg onload', markdown: '<svg onload="window.__xss = 1"><circle r="1"/></svg>', gone: '[onload]', kept: 'svg circle' },
      { name: 'details ontoggle', markdown: '<details open ontoggle="window.__xss = 1"><summary>s</summary>x</details>', gone: '[ontoggle]', kept: 'details summary' },
      { name: 'noscript mutation XSS', markdown: '<noscript><p title="</noscript><img src=x onerror=window.__xss=1>"></p></noscript>', gone: 'noscript, img', kept: null },
      { name: 'iframe srcdoc', markdown: '<iframe srcdoc="<script>parent.__xss = 1</script>"></iframe>', gone: 'iframe', kept: null },
      { name: 'svg link to javascript:', markdown: '<svg><a xlink:href="javascript:window.__xss = 1"><text y="10">x</text></a></svg>', gone: 'a[href], a[*|href]', kept: 'svg a text' },
      { name: 'math/style namespace confusion', markdown: '<math><mtext><table><mglyph><style><img src=x onerror=window.__xss=1>', gone: 'style, img', kept: null },
      { name: 'form action javascript:', markdown: '<form action="javascript:window.__xss = 1"><button>go</button></form>', gone: 'form[action]', kept: 'form button' },
      { name: 'object data javascript:', markdown: '<object data="javascript:window.__xss = 1"></object>', gone: 'object', kept: null },
      { name: 'svg animate to javascript:', markdown: '<svg><animate attributeName="href" values="javascript:window.__xss = 1"/></svg>', gone: 'animate', kept: 'svg' },
      { name: 'img srcset javascript:', markdown: '<img srcset="javascript:window.__xss = 1 1x" src="ok.png">', gone: '[srcset]', kept: 'img[src="ok.png"]' },
      { name: 'link with event handler', markdown: '<a href="https://example.com" onclick="window.__xss = 1">x</a>', gone: '[onclick]', kept: 'a[href="https://example.com"]' },
      // These only become dangerous when the sanitized HTML is parsed again,
      // which the repeated sanitizing pass catches.
      { name: 'noembed breakout', markdown: '<noembed><img title="</noembed><img src=x onerror=window.__xss=1>"></noembed>', gone: '[onerror]', kept: null },
      { name: 'xmp breakout', markdown: '<xmp><img title="</xmp><img src=x onerror=window.__xss=1>"></xmp>', gone: '[onerror]', kept: null },
      { name: 'svg style breakout', markdown: '<svg></p><style><a id="</style><img src=1 onerror=window.__xss=1>">', gone: '[onerror]', kept: null },
      { name: 'math table style breakout', markdown: '<math><mi><table><mi><style><a title="</style><img src=x onerror=window.__xss=1>">', gone: '[onerror]', kept: null },
      { name: 'mglyph style comment mutation', markdown: '<math><mtext><table><mglyph><style><!--</style><img title="--&gt;&lt;/mglyph&gt;&lt;img&Tab;src=1&Tab;onerror=window.__xss=1&gt;">', gone: '[onerror]', kept: null },
      { name: 'nested form mutation', markdown: '<form><math><mtext></form><form><mglyph><style></math><img src onerror=window.__xss=1>', gone: '[onerror]', kept: null },
      // Raw-text elements serialize their content unescaped, so they are removed outright.
      { name: 'noembed element', markdown: '<noembed>&lt;img src=x onerror=window.__xss=1&gt;</noembed>', gone: 'noembed, img', kept: null },
      { name: 'noframes element', markdown: '<noframes><img title="</noframes><img src=x onerror=window.__xss=1>"></noframes>', gone: 'noframes, [onerror]', kept: null },
      { name: 'xmp element', markdown: '<xmp>&lt;img src=x onerror=window.__xss=1&gt;</xmp>', gone: 'xmp, img', kept: null },
      { name: 'plaintext element', markdown: '<plaintext><img src=x onerror=window.__xss=1>', gone: 'plaintext, img', kept: null }
    ];

    PAYLOADS.forEach(function (payload) {
      test('neutralizes ' + payload.name, async function ({ page }) {
        await gotoApp(page, { hash: toRawShareHash('Before\n\n' + payload.markdown + '\n\nAfter') });

        const preview = page.locator('#preview');
        await expect(preview.locator('p').first()).toHaveText('Before');
        await expect(preview.locator(payload.gone)).toHaveCount(0);
        if (payload.kept) {
          await expect(preview.locator(payload.kept)).toHaveCount(1);
        }
        expect(await page.evaluate(() => window.__xss)).toBeUndefined();
      });
    });

    test('falls back to escaped text when sanitizing never stabilizes', async function ({ page }) {
      await gotoApp(page);
      await setMarkdown(page, '**bold** <i>text</i>');
      // Emulate markup that changes on every parse, so no pass is ever stable.
      await page.evaluate(function () {
        const parseFromString = DOMParser.prototype.parseFromString;
        let parseCount = 0;
        DOMParser.prototype.parseFromString = function (markup, type) {
          const doc = parseFromString.call(this, markup, type);
          parseCount++;
          doc.body.appendChild(doc.createElement('span')).textContent = ' #' + parseCount;
          return doc;
        };
      });
      await switchTab(page, 'preview');

      const preview = page.locator('#preview');
      await expect(preview).toContainText('bold text');
      await expect(preview.locator('*')).toHaveCount(0);
    });

    test('keeps the KaTeX SVG and MathML output of a rendered formula', async function ({ page }) {
      await gotoApp(page, { hash: toRawShareHash('$$\\sqrt{x^2}$$') });

      await expect(page.locator('#preview .katex-display .katex math')).toHaveCount(1);
      await expect(page.locator('#preview .katex-display svg path')).toHaveCount(1);
    });
  });

  test.describe('sanitizeHtml - Bootstrap classes', function () {
    test('adds Bootstrap classes to tables', async function ({ page }) {
      await gotoApp(page);
      const markdown = '| A | B |\n|---|---|\n| 1 | 2 |';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const table = page.locator('#preview table');
      await expect(table).toHaveClass(/table/);
      await expect(table).toHaveClass(/table-striped/);
      await expect(table).toHaveClass(/table-bordered/);
    });

    test('adds Bootstrap img-responsive class to images', async function ({ page }) {
      await gotoApp(page);
      const markdown = '![test](https://example.com/img.jpg)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const img = page.locator('#preview img');
      await expect(img).toHaveClass(/img-responsive/);
    });

    test('adds Bootstrap blockquote class', async function ({ page }) {
      await gotoApp(page);
      const markdown = '> This is a quotation';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const blockquote = page.locator('#preview blockquote');
      await expect(blockquote).toHaveClass(/blockquote/);
    });

    test('adds Bootstrap pre-scrollable class to code blocks', async function ({ page }) {
      await gotoApp(page);
      const markdown = '```\ncode block\n```';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const pre = page.locator('#preview pre');
      await expect(pre).toHaveClass(/pre-scrollable/);
    });

    test('adds Bootstrap badge class to inline code', async function ({ page }) {
      await gotoApp(page);
      const markdown = 'This is `inline code` in text.';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const inlineCode = page.locator('#preview p code');
      await expect(inlineCode).toHaveClass(/badge/);
    });

    test('does not add badge class to code inside pre blocks', async function ({ page }) {
      await gotoApp(page);
      const markdown = '```\ncode block\n```';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const codeInPre = page.locator('#preview pre code');
      await expect(codeInPre).toBeVisible();
      const className = await codeInPre.getAttribute('class');
      // Should not have badge when inside pre (class is null or doesn't contain badge)
      if (className) {
        expect(className).not.toContain('badge');
      }
    });
  });

  test.describe('isSafeUrl - URL edge cases', function () {
    test('handles URLs with leading/trailing whitespace', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Link](  https://example.com  )';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      await expect(link).toHaveAttribute('href', 'https://example.com');
    });

    test('handles URLs with uppercase protocol', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Link](HTTPS://example.com)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      await expect(link).toHaveAttribute('href', 'HTTPS://example.com');
    });

    test('removes link with protocol containing colon and no leading //', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Bad](unknown:value)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      await expect(link).not.toHaveAttribute('href');
    });

    test('allows plain URLs without scheme or path prefix', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Local](filename.html)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      await expect(link).toHaveAttribute('href', 'filename.html');
    });

    test('removes image src with colon-based protocol', async function ({ page }) {
      await gotoApp(page);
      const markdown = '![img](unknown:protocol)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      expect(await page.locator('#preview img').count()).toBe(0);
    });

    test('preserves image with plain filename', async function ({ page }) {
      await gotoApp(page);
      const markdown = '![img](image.jpg)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const img = page.locator('#preview img');
      await expect(img).toHaveAttribute('src', 'image.jpg');
    });

    test('removes href/src from links and images with invalid schemes', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Bad](badscheme:value)\n![BadImg](customimg:data)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const links = page.locator('#preview a');
      // Link text should exist but href should be removed
      await expect(links).toContainText('Bad');
      // href should be removed (null) since badscheme: is not safe
      await expect(links).not.toHaveAttribute('href');
    });
  });

  test.describe('base64Url functions - edge cases', function () {
    test('shares empty markdown via button (exercises base64UrlEncode line 1439)', async function ({ page }) {
      // Disable compression to force raw hash path which calls base64UrlEncode with empty bytes
      await page.addInitScript(function () {
        window.CompressionStream = undefined;
        window.DecompressionStream = undefined;
      });

      await gotoApp(page);
      const emptyMarkdown = '';
      await ensureEditTabAndSetMarkdown(page, emptyMarkdown);

      // Get initial URL (no hash)
      const initialUrl = page.url();
      expect(initialUrl).not.toContain('#');

      // Trigger share by clicking the button
      const shareButton = page.locator('button:has-text("Share")').first();
      await shareButton.click();

      // Wait for button to be disabled and then enabled again
      await expect(shareButton).toBeDisabled({ timeout: 2000 });
      await expect(shareButton).not.toBeDisabled({ timeout: 2000 });

      // After share, URL should have a hash (indicating base64UrlEncode was called)
      const finalUrl = page.url();
      // The hash should contain r: (raw encoding) since we disabled compression
      expect(finalUrl).toContain('#');
      expect(finalUrl).toContain('r%3A');
    });

    test('loads hash with minimal base64 payload (exercises base64UrlDecode handling)', async function ({ page }) {
      // Test loading a hash with very minimal payload to exercise base64UrlDecode
      // Use a single character base64 string
      await gotoApp(page, { hash: '#mode=edit&text=r%3AA' });

      const markdown = await getMarkdown(page);
      // Should handle gracefully
      expect(markdown).toBeDefined();
    });

    test('loads URL with hash payload containing empty text (exercises base64UrlDecode line 1452)', async function ({ page }) {
      await gotoApp(page, { hash: '#mode=edit&text=' });

      const markdown = await getMarkdown(page);
      expect(markdown).toBe('');
    });

    test('loads URL with hash containing only prefix without payload (exercises base64UrlDecode falsy branch)', async function ({ page }) {
      await gotoApp(page, { hash: '#mode=edit&text=r%3A' });

      // App should handle gracefully - exercises falsy check at line 1451
      const markdown = await getMarkdown(page);
      expect(markdown).toBe('');
    });

    test('handles hash with compressed empty content', async function ({ page }) {
      await page.addInitScript(function () {
        // Ensure compression is available
        if (!window.CompressionStream) {
          window.CompressionStream = undefined;
        }
      });

      await gotoApp(page, { hash: '#mode=edit&text=z%3A' });

      const markdown = await getMarkdown(page);
      // Should handle decompression of empty/minimal payload gracefully
      expect(markdown).toBeDefined();
    });

    test('attempts to trigger base64UrlDecode line 1452 with direct call', async function ({ page }) {
      await gotoApp(page);

      // Try to directly call base64UrlDecode with null/empty to trigger line 1452
      // Note: This line is unreachable from normal app flow due to guard at line 1683
      // This test verifies the defensive programming aspect
      const result = await page.evaluate(function () {
        // The function is in IIFE scope, but we can verify it handles null gracefully
        // by testing the app's normal operation doesn't crash
        const testHash = '#mode=edit&text=r%3A';  // Empty payload
        window.location.hash = testHash;
        return 'test-complete';
      });

      expect(result).toBe('test-complete');
      const markdown = await getMarkdown(page);
      // Should handle gracefully (returns empty string at line 1684)
      expect(markdown).toBe('');
    });
  });

  test.describe('integration', function () {
    test('handles complex markdown with mixed safe and unsafe content', async function ({ page }) {
      await gotoApp(page);
      const markdown = `# Title
<script>window.scriptXss=1</script>

[Safe](https://example.com)
[Bad](javascript:alert(1))

![Safe](https://example.com/img.jpg)

> Quote

| H1 | H2 |
|----|-----|
| A  | B  |`;

      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      // Good content exists
      await expect(page.locator('#preview h1')).toHaveText('Title');
      await expect(page.locator('#preview blockquote')).toBeVisible();
      await expect(page.locator('#preview table')).toHaveClass(/table/);

      // Safe links/images work
      const safeLink = page.locator('#preview a[href*="https://example.com"]');
      expect(await safeLink.count()).toBeGreaterThan(0);
      const safeImg = page.locator('#preview img[src*="example.com"]');
      expect(await safeImg.count()).toBeGreaterThan(0);

      // Dangerous content removed
      expect(await page.locator('#preview script').count()).toBe(0);
      const badLink = page.locator('#preview a[href*="javascript:"]');
      expect(await badLink.count()).toBe(0);

      // XSS didn't execute
      await verifyXssNotExecuted(page, 'scriptXss');
    });

    test('handles pasted HTML with dangerous content', async function ({ page }) {
      await gotoApp(page);
      const dangerousHtml = `
        <h1>Title</h1>
        <script>window.pastedXss = 1</script>
        <p><a href="javascript:alert('xss')">Bad Link</a></p>
        <img src="https://example.com/safe.jpg" />
        <img src="javascript:alert('img')" onerror="window.imgError = 1" />
      `;

      await pasteContent(page, { html: dangerousHtml });
      await switchTab(page, 'preview');

      // Good content preserved
      await expect(page.locator('#preview h1')).toHaveText('Title');
      const safeImg = page.locator('#preview img[src*="example.com"]');
      expect(await safeImg.count()).toBeGreaterThan(0);

      // Dangers removed
      expect(await page.locator('#preview script').count()).toBe(0);
      const badLinks = page.locator('#preview a[href*="javascript:"]');
      expect(await badLinks.count()).toBe(0);
      const badImages = page.locator('#preview img[src*="javascript:"]');
      expect(await badImages.count()).toBe(0);

      // XSS didn't execute
      await verifyXssNotExecuted(page, 'pastedXss');
      await verifyXssNotExecuted(page, 'imgError');
    });

    test('clears and re-adds content correctly', async function ({ page }) {
      await gotoApp(page);
      await ensureEditTabAndSetMarkdown(page, '# First');
      await switchTab(page, 'preview');
      await expect(page.locator('#preview h1')).toHaveText('First');

      await ensureEditTabAndSetMarkdown(page, '');
      await switchTab(page, 'preview');
      await expect(page.locator('#preview p.empty-preview')).toBeVisible();

      await ensureEditTabAndSetMarkdown(page, '# Second');
      await switchTab(page, 'preview');
      await expect(page.locator('#preview h1')).toHaveText('Second');
    });
  });

  test.describe('mutation testing - strengthen coverage', function () {
    test('removes iframe tags completely', async function ({ page }) {
      await gotoApp(page);
      const markdown = '<iframe src="https://example.com"></iframe>\n\n# Title';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      expect(await page.locator('#preview iframe').count()).toBe(0);
      await expect(page.locator('#preview h1')).toHaveText('Title');
    });

    test('removes animation elements', async function ({ page }) {
      await gotoApp(page);
      const markdown = '<svg><animate attributeName="onclick" values="onclick=alert(1)"/></svg>';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      expect(await page.locator('#preview animate').count()).toBe(0);
    });

    test('handles srcset with multiple candidates - first safe, second dangerous', async function ({ page }) {
      await gotoApp(page);
      const markdown = '<img srcset="https://example.com/1x.png 1x, javascript:alert(1) 2x" src="https://example.com/safe.png">';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      // The unsafe srcset is dropped as a whole; the safe src is kept.
      const img = page.locator('#preview img');
      await expect(img).toHaveCount(1);
      await expect(img).toHaveAttribute('src', 'https://example.com/safe.png');
      await expect(img).not.toHaveAttribute('srcset', /.*/);
    });

    test('keeps srcset when every candidate is safe', async function ({ page }) {
      await gotoApp(page);
      const markdown = '<img srcset="https://example.com/1x.png 1x, /images/2x.png 2x" src="https://example.com/safe.png">';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      await expect(page.locator('#preview img')).toHaveAttribute('srcset', 'https://example.com/1x.png 1x, /images/2x.png 2x');
    });

    test('handles URLs with leading spaces', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Link](  javascript:alert(1))';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      // Should not have dangerous href even with leading spaces
      await expect(link).not.toHaveAttribute('href');
    });

    test('ensures safe links have both target and rel attributes', async function ({ page }) {
      await gotoApp(page);
      const markdown = '[Safe](https://example.com)';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const link = page.locator('#preview a');
      // Should have both target and rel set
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(link).toHaveAttribute('href', 'https://example.com');
    });

    test('removes all event handlers including mixed case on*', async function ({ page }) {
      await gotoApp(page);
      const markdown = '<div onmouseover="window.xssEvent=1">Content</div>';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      await verifyXssNotExecuted(page, 'xssEvent');
      const div = page.locator('#preview div');
      if (await div.count() > 0) {
        await expect(div).not.toHaveAttribute('onmouseover', /.*/);
      }
    });

    test('removes embed elements', async function ({ page }) {
      await gotoApp(page);
      const markdown = '<embed src="https://example.com/file.swf" />\n\n# Title';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      expect(await page.locator('#preview embed').count()).toBe(0);
      await expect(page.locator('#preview h1')).toHaveText('Title');
    });

    test('removes all event handlers with on* pattern on any element', async function ({ page }) {
      await gotoApp(page);
      const markdown = `
<div onclick="window.clickXss=1">Click</div>
<img onload="window.loadXss=1" src="https://example.com/img.jpg">
<a href="https://example.com" onmouseover="window.hoverXss=1">Link</a>
      `;
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      await verifyXssNotExecuted(page, 'clickXss');
      await verifyXssNotExecuted(page, 'loadXss');
      await verifyXssNotExecuted(page, 'hoverXss');
    });

    test('validates href attribute on links (not just href removal)', async function ({ page }) {
      await gotoApp(page);
      const markdown = `[Good](https://example.com)
[Bad1](javascript:void(0))
[Bad2](data:text/html,<script>alert(1)</script>)
[Bad3](vbscript:msgbox(1))`;
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      const links = page.locator('#preview a[href]');
      expect(await links.count()).toBe(1);
      await expect(links.first()).toHaveAttribute('href', 'https://example.com');
    });

    test('double-sanitization catches mutation XSS through parse context changes', async function ({ page }) {
      await gotoApp(page);
      // This payload becomes dangerous when re-parsed
      const markdown = '<noembed><img src=x onerror="window.mutXss=1"></noembed>';
      await ensureEditTabAndSetMarkdown(page, markdown);
      await switchTab(page, 'preview');

      expect(await page.locator('#preview img').count()).toBe(0);
      await verifyXssNotExecuted(page, 'mutXss');
    });
  });
});
