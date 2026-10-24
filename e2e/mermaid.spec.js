'use strict';

const { test, expect } = require('./support/fixtures');
const { gotoApp, setMarkdown, switchTab } = require('./support/app');

const FLOWCHART = '```mermaid\nflowchart LR\n  A[Paste] --> B{Convert}\n  B --> C[Markdown]\n```';

test.describe('mermaid preview (Ondine)', function () {
  test.beforeEach(async function ({ page }) {
    await gotoApp(page);
  });

  test('renders a flowchart as an SVG in the preview', async function ({ page }) {
    await setMarkdown(page, FLOWCHART);
    await switchTab(page, 'preview');

    const svg = page.locator('#preview .mermaid-diagram.mermaid-rendered svg.ondine-flowchart');
    await expect(svg).toBeVisible();
    await expect(svg.locator('text', { hasText: 'Paste' })).toHaveCount(1);
    await expect(svg.locator('text', { hasText: 'Markdown' })).toHaveCount(1);
    await expect(page.locator('#preview .mermaid-diagram pre')).toHaveCount(0);
  });

  test('renders other diagram types', async function ({ page }) {
    await setMarkdown(page, '```mermaid\nsequenceDiagram\n  Browser->>Server: GET /orders\n  Server-->>Browser: 200 OK\n```');
    await switchTab(page, 'preview');

    await expect(page.locator('#preview svg.ondine-sequence')).toBeVisible();
  });

  test('renders several diagrams next to ordinary code blocks', async function ({ page }) {
    await setMarkdown(page, [
      FLOWCHART,
      '',
      '```js\nconst a = 1;\n```',
      '',
      '```mermaid\nstateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy\n```'
    ].join('\n'));
    await switchTab(page, 'preview');

    await expect(page.locator('#preview .mermaid-diagram.mermaid-rendered')).toHaveCount(2);
    await expect(page.locator('#preview svg.ondine-flowchart')).toHaveCount(1);
    await expect(page.locator('#preview svg.ondine-state')).toHaveCount(1);
    await expect(page.locator('#preview pre code')).toHaveText('const a = 1;\n');
  });

  test('accepts extra words after the mermaid info string', async function ({ page }) {
    await setMarkdown(page, '```mermaid title="Flow"\nflowchart LR\n  A --> B\n```');
    await switchTab(page, 'preview');

    await expect(page.locator('#preview svg.ondine-flowchart')).toBeVisible();
  });

  test('keeps the source and shows the error when the diagram is invalid', async function ({ page }) {
    await setMarkdown(page, '```mermaid\nflowchart LR\n  A -->\n```');
    await switchTab(page, 'preview');

    const diagram = page.locator('#preview .mermaid-diagram.mermaid-failed');
    await expect(diagram.locator('.mermaid-error-message')).toContainText('Parse error');
    await expect(diagram.locator('pre code')).toContainText('A -->');
    await expect(diagram.locator('svg')).toHaveCount(0);
  });

  test('keeps the source when no diagram type is detected', async function ({ page }) {
    await setMarkdown(page, '```mermaid\nnot a diagram\n```');
    await switchTab(page, 'preview');

    await expect(page.locator('#preview .mermaid-diagram .mermaid-error-message'))
      .toContainText('No diagram type detected');
    await expect(page.locator('#preview .mermaid-diagram pre code')).toHaveText('not a diagram\n');
  });

  test('does not load Ondine when the preview has no mermaid block', async function ({ page }) {
    const requests = [];
    page.on('request', function (request) {
      if (request.url().includes('/vendor/ondine/')) {
        requests.push(request.url());
      }
    });

    await setMarkdown(page, '# Plain\n\n```js\nconsole.log(1);\n```');
    await switchTab(page, 'preview');

    await expect(page.locator('#preview h1')).toHaveText('Plain');
    expect(requests).toEqual([]);
  });

  test('loads the renderer once for repeated previews', async function ({ page }) {
    const wasmRequests = [];
    page.on('request', function (request) {
      if (request.url().endsWith('all.generated.wasm')) {
        wasmRequests.push(request.url());
      }
    });

    await setMarkdown(page, FLOWCHART);
    await switchTab(page, 'preview');
    await expect(page.locator('#preview svg.ondine-flowchart')).toBeVisible();

    await switchTab(page, 'edit');
    await setMarkdown(page, FLOWCHART + '\n\nMore text.');
    await switchTab(page, 'preview');
    await expect(page.locator('#preview p', { hasText: 'More text.' })).toBeVisible();
    await expect(page.locator('#preview svg.ondine-flowchart')).toBeVisible();

    expect(wasmRequests).toHaveLength(1);
  });

  test('re-rendering the preview while the WASM loads leaves no stale diagram', async function ({ page }) {
    let release;
    const gate = new Promise(function (resolve) { release = resolve; });
    await page.route('**/vendor/ondine/internal/all.generated.wasm', async function (route) {
      await gate;
      await route.continue();
    });

    await setMarkdown(page, FLOWCHART);
    await switchTab(page, 'preview');
    await expect(page.locator('#preview .mermaid-diagram pre code')).toContainText('flowchart LR');

    // Replace the preview before the first renderer is ready.
    await switchTab(page, 'edit');
    await setMarkdown(page, '```mermaid\nflowchart LR\n  X --> Y\n```');
    await switchTab(page, 'preview');
    release();

    const svg = page.locator('#preview svg.ondine-flowchart');
    await expect(svg).toHaveCount(1);
    await expect(svg.locator('text', { hasText: 'X' })).toHaveCount(1);
    await expect(svg.locator('text', { hasText: 'Paste' })).toHaveCount(0);
  });

  test('keeps the source and retries later when the WASM cannot be fetched', async function ({ page }) {
    const errors = [];
    page.on('console', function (message) {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    let failing = true;
    await page.route('**/vendor/ondine/internal/all.generated.wasm', async function (route) {
      if (failing) {
        await route.fulfill({ status: 500, body: 'nope' });
      } else {
        await route.continue();
      }
    });

    await setMarkdown(page, FLOWCHART);
    await switchTab(page, 'preview');
    await expect.poll(function () {
      return errors.some(function (text) { return text.includes('Failed to load the Mermaid renderer'); });
    }).toBe(true);
    await expect(page.locator('#preview .mermaid-diagram pre code')).toContainText('flowchart LR');
    await expect(page.locator('#preview svg')).toHaveCount(0);

    failing = false;
    await switchTab(page, 'edit');
    await switchTab(page, 'preview');
    await expect(page.locator('#preview svg.ondine-flowchart')).toBeVisible();
  });

  test('the diagram follows the light and dark theme colors', async function ({ page }) {
    await setMarkdown(page, FLOWCHART);
    await switchTab(page, 'preview');
    const svg = page.locator('#preview svg.ondine-flowchart');
    await expect(svg).toBeVisible();

    const readColors = function () {
      return svg.evaluate(function (element) {
        const style = getComputedStyle(element);
        return { fg: style.getPropertyValue('--ondine-fg').trim(), color: style.color };
      });
    };

    await page.evaluate(function () { document.documentElement.setAttribute('data-theme', 'light'); });
    const light = await readColors();
    await page.evaluate(function () { document.documentElement.setAttribute('data-theme', 'dark'); });
    const dark = await readColors();

    expect(light.fg).toBe('#17202e');
    expect(dark.fg).not.toBe(light.fg);
    expect(dark.color).not.toBe(light.color);
  });

  test.describe('security', function () {
    async function renderAndCheck(page, markdown) {
      await page.evaluate(function () { window.__mermaidXss = undefined; });
      await setMarkdown(page, markdown);
      await switchTab(page, 'preview');
      await expect(page.locator('#preview .mermaid-diagram.mermaid-rendered, #preview .mermaid-diagram.mermaid-failed'))
        .not.toHaveCount(0);
    }

    test('HTML in labels is shown as text and never becomes markup', async function ({ page }) {
      await renderAndCheck(page, '```mermaid\nsequenceDiagram\n  A->>B: <img src=x onerror="window.__mermaidXss=1">\n  A->>B: <script>window.__mermaidXss=2</script>\n```');

      await expect(page.locator('#preview .mermaid-diagram img')).toHaveCount(0);
      await expect(page.locator('#preview .mermaid-diagram script')).toHaveCount(0);
      expect(await page.evaluate(function () { return window.__mermaidXss; })).toBeUndefined();
    });

    test('javascript: click links are not left in the SVG', async function ({ page }) {
      await renderAndCheck(page, '```mermaid\nflowchart LR\n  A[Go] --> B\n  click A "javascript:window.__mermaidXss=3"\n```');

      const hrefs = await page.locator('#preview .mermaid-diagram [href], #preview .mermaid-diagram [xlink\\:href]')
        .evaluateAll(function (nodes) {
          return nodes.map(function (node) { return node.getAttribute('href') || node.getAttribute('xlink:href'); });
        });
      hrefs.forEach(function (href) {
        expect(href.toLowerCase()).not.toContain('javascript:');
      });
      await page.locator('#preview .mermaid-diagram svg').click();
      expect(await page.evaluate(function () { return window.__mermaidXss; })).toBeUndefined();
    });

    test('the SVG has no script, event handler or embedded document', async function ({ page }) {
      await renderAndCheck(page, FLOWCHART);

      const unsafe = await page.locator('#preview .mermaid-diagram').evaluate(function (diagram) {
        const elements = Array.from(diagram.querySelectorAll('*'));
        return {
          blocked: elements.filter(function (element) {
            return ['script', 'foreignobject', 'iframe', 'style', 'animate', 'set'].includes(element.localName.toLowerCase());
          }).length,
          handlers: elements.filter(function (element) {
            return Array.from(element.attributes).some(function (attribute) { return /^on/i.test(attribute.name); });
          }).length
        };
      });
      expect(unsafe).toEqual({ blocked: 0, handlers: 0 });
    });

    test('a hand-written mermaid-diagram wrapper cannot smuggle markup past the sanitizer', async function ({ page }) {
      await renderAndCheck(page, '<div class="mermaid-diagram"><img src=x onerror="window.__mermaidXss=4"></div>\n\n```mermaid\nflowchart LR\n  A --> B\n```');

      expect(await page.evaluate(function () { return window.__mermaidXss; })).toBeUndefined();
      await expect(page.locator('#preview svg.ondine-flowchart')).toHaveCount(1);
      await expect(page.locator('#preview [onerror]')).toHaveCount(0);
    });
  });

  test('Copy keeps the mermaid source as a code block', async function ({ page }) {
    await page.addInitScript(function () {
      window.__clipboardWrites = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: function (text) {
            window.__clipboardWrites.push({ 'text/plain': text });
            return Promise.resolve();
          }
        }
      });
    });
    await page.reload();
    await setMarkdown(page, FLOWCHART);
    await page.locator('#copy-button').click();

    await expect.poll(function () {
      return page.evaluate(function () { return window.__clipboardWrites.length; });
    }).toBeGreaterThan(0);
    const written = await page.evaluate(function () { return window.__clipboardWrites[0]['text/plain']; });
    expect(written).toBe(FLOWCHART);
  });
});
