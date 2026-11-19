'use strict';

const { test, expect } = require('./support/fixtures');
const { gotoApp, setMarkdown, switchTab } = require('./support/app');

/** Opens the app with `markdown` shown in the Preview tab. */
async function openPreview(page, markdown) {
  await gotoApp(page);
  await setMarkdown(page, markdown);
  await switchTab(page, 'preview');
}

/** A 13-row, 3-column table with status glyphs in the first column. */
function statusTable() {
  const rows = ['✅ 已完成 | 標籤列印 | Will', '⚠️ 注意 | 權限待確認 | Dora', '❌ 失敗 | 逾時 | Jason',
    '※ 註記 | 另行評估 | Sam', '部分 | 中標 | Kim', '其他 | 未分類 | Lee'];
  for (let i = 7; i <= 13; i += 1) rows.push('項目' + i + ' | 說明' + i + ' | 成員' + i);
  return '| 狀態 | 說明 | 負責 |\n| --- | --- | --- |\n' + rows.map((r) => '| ' + r + ' |').join('\n');
}

test.describe('adaptive presentation', function () {
  test('adds a reading time and marks CJK documents', async function ({ page }) {
    await openPreview(page, '# 標題\n\n' + '中文內容測試。'.repeat(30));
    await expect(page.locator('#preview .doc-meta')).toHaveCount(1);
    await expect(page.locator('#preview')).toHaveClass(/is-cjk/);
    const meta = await page.locator('#preview .doc-meta').textContent();
    expect(meta).toMatch(/About 1 min read · [\d,]+ chars/);
  });

  test('measures Latin documents and works without an h1', async function ({ page }) {
    await openPreview(page, 'Just prose here.\n\n'.repeat(20));
    await expect(page.locator('#preview')).toHaveClass(/doc-prose/);
    const meta = await page.locator('#preview .doc-meta').textContent();
    expect(meta).toMatch(/About 1 min read/);
    await expect(page.locator('#preview .doc-meta')).toHaveCount(1);
  });

  test('splits an em-dash h1 into title and subtitle', async function ({ page }) {
    await openPreview(page, '# 配送單標籤 — 開發參考手冊\n\nbody');
    await expect(page.locator('#preview h1 .doc-title')).toHaveText('配送單標籤');
    await expect(page.locator('#preview h1 .doc-subtitle')).toHaveText('開發參考手冊');
  });

  test('adds number badges and topic icons but skips emoji headings', async function ({ page }) {
    await openPreview(page, '# Doc\n\n## 2.1 需求摘要\n\nx\n\n## 疑難排解\n\ny\n\n## 🎉 Party\n\nz');
    await expect(page.locator('#preview .h-num')).toHaveText('2.1');
    await expect(page.locator('#preview h2 .h-icon').first()).toHaveText('📌');
    // The trouble keyword gets its own icon; the emoji heading gets none.
    await expect(page.locator('#preview .h-icon')).toHaveCount(2);
    await expect(page.locator('#preview h3 .h-icon, h4 .h-icon')).toHaveCount(0);
  });

  test('builds property grids from bold and plain label-value lists', async function ({ page }) {
    await openPreview(page, '# Doc\n\n- **專案背景**：Kinsus 專案\n- **撰寫日期**：2026-11-04\n\n' +
      '- 狀態：完成\n- 負責人：Will\n');
    // One loose list (blank-line separated items stay one list) with both key styles.
    await expect(page.locator('#preview ul.kv')).toHaveCount(1);
    await expect(page.locator('#preview .kv-key')).toHaveCount(4);
  });

  test('keeps reference code inline when a neighboring card wraps', async function ({ page }) {
    await page.setViewportSize({ width: 960, height: 800 });
    await openPreview(page, [
      '## 參考',
      '',
      '- **變更日誌**：`CHANGELOG.md` 的 `[Unreleased]` 段落',
      '- **實作分支**：`feat/agent-skills`（7 commits，28 個檔案，+3248 / -368）'
    ].join('\n'));
    const codes = page.locator('#preview ul.kv > li:first-child code');
    await expect(codes).toHaveCount(2);
    await expect(codes.first()).toHaveCSS('display', 'inline-block');
    await expect(codes.last()).toHaveCSS('display', 'inline-block');
  });

  test('turns short lists into cards and ordered lists into steps', async function ({ page }) {
    await openPreview(page, '# Doc\n\n- 快速結論一\n- 快速結論二\n- 快速結論三\n\n' +
      '1. 開啟表單\n2. 選擇客戶\n3. 按下列印\n');
    await expect(page.locator('#preview ul.cards')).toHaveCount(1);
    await expect(page.locator('#preview ol.cards.steps')).toHaveCount(1);
  });

  test('turns long bold-lead numbered points into finding panels', async function ({ page }) {
    const items = [
      '1. **效能瓶頸在 trigger**：整批更新時逐列觸發 trigger，造成大量 context switch，需要改為批次設計並延後處理。',
      '2. **鎖結逾時**：多工同時更新同一筆 master 資料時未使用 nowait，等待序列過長，應加入逾時與重試機制。',
      '3. **報表過大**：單次產出超過十萬列導致記憶體壓力，應改為分段產出並搭配 cursor 迴圈處理。'
    ];
    await openPreview(page, '# Doc\n\n' + items.join('\n\n') + '\n');
    await expect(page.locator('#preview ol.findings')).toHaveCount(1);
  });

  test('leaves short, nested and oversized lists alone', async function ({ page }) {
    await openPreview(page, '# Doc\n\n- 唯一項目\n\n- 有巢狀\n  - 子項\n- 兩項清單\n\n' +
      Array.from({ length: 9 }, (_, i) => '- 項目' + i).join('\n') + '\n');
    await expect(page.locator('#preview ul.kv, #preview ul.cards, #preview ol.cards, #preview ol.findings')).toHaveCount(0);
  });

  test('badges leading status glyphs in table cells', async function ({ page }) {
    await openPreview(page, '# Doc\n\n| a | b |\n| --- | --- |\n| ✅ ok | x |\n| ⚠️ warn | y |\n| ❌ bad | z |\n| ※ note | w |\n');
    await expect(page.locator('#preview .badge.ok')).toHaveCount(1);
    await expect(page.locator('#preview .badge.warn')).toHaveCount(1);
    await expect(page.locator('#preview .badge.bad')).toHaveCount(1);
    await expect(page.locator('#preview .badge.info')).toHaveCount(1);
  });

  test('classifies tables by shape and skips merged-cell tables', async function ({ page }) {
    const longRows = Array.from({ length: 16 }, (_, i) => '| a' + i + ' | b' + i + ' |').join('\n');
    await openPreview(page, '# Doc\n\n## 步驟時程\n\n| a | b |\n| --- | --- |\n' + longRows + '\n\n' +
      '<table><thead><tr><th>合併</th><th>b</th></tr></thead><tbody><tr><td colspan="2">merged</td></tr></tbody></table>\n');
    const wraps = page.locator('#preview .table-wrap');
    await expect(wraps).toHaveCount(2);
    await expect(page.locator('#preview .table-wrap.long.sequence')).toHaveCount(1);
    await expect(page.locator('#preview .table-wrap.dense')).toHaveCount(1);
    // Merged cells keep only the wrapper (no interaction classes).
    await expect(page.locator('#preview .table-wrap.sortable, #preview .table-wrap.filterable')).toHaveCount(1);
    await expect(page.locator('#preview .table-wrap:not(.sortable):not(.filterable)')).toHaveCount(1);
  });

  test('stacks long-text tables in narrow containers with labels', async function ({ page }) {
    const long = '很長的說明文字'.repeat(12);
    await openPreview(page, '# Doc\n\n| 名稱 | 說明 |\n| --- | --- |\n| alpha | ' + long + ' |\n| beta | ' + long + ' |\n');
    await expect(page.locator('#preview .table-wrap.stackable')).toHaveCount(1);
    const label = await page.locator('#preview .table-wrap.stackable td').first().getAttribute('data-label');
    expect(label).toBe('名稱');
  });

  test('sorts rows in three states with screen-reader announcements', async function ({ page }) {
    await openPreview(page, '# Doc\n\n| 狀態 | 說明 |\n| --- | --- |\n| b | 2 |\n| a | 1 |\n| c | 3 |\n| d | 4 |\n| e | 5 |\n');
    const wrap = page.locator('#preview .table-wrap.sortable');
    await expect(wrap).toHaveCount(1);
    const btn = page.locator('#preview .th-sort').first();
    await btn.click();
    await expect(page.locator('#preview th[aria-sort="ascending"]')).toHaveCount(1);
    await expect(page.locator('#preview .visually-hidden')).toHaveText('Sorted by 狀態, ascending');
    let first = await page.locator('#preview tbody td').first().textContent();
    expect(first.trim()).toBe('a');
    await btn.click();
    await expect(page.locator('#preview th[aria-sort="descending"]')).toHaveCount(1);
    await expect(page.locator('#preview .visually-hidden')).toHaveText('Sorted by 狀態, descending');
    first = await page.locator('#preview tbody td').first().textContent();
    expect(first.trim()).toBe('e');
    await btn.click();
    await expect(page.locator('#preview th[aria-sort]')).toHaveCount(0);
    await expect(page.locator('#preview .visually-hidden')).toHaveText('Original order restored');
    first = await page.locator('#preview tbody td').first().textContent();
    expect(first.trim()).toBe('b');
  });

  test('sorts numeric columns as numbers', async function ({ page }) {
    await openPreview(page, '# Doc\n\n| n |\n| --- |\n| 10 |\n| 9 |\n| 100 |\n| 20 |\n| 30 |\n');
    await page.locator('#preview .th-sort').first().click();
    const values = await page.locator('#preview tbody td').allTextContents();
    expect(values.map((v) => v.trim())).toEqual(['9', '10', '20', '30', '100']);
  });

  test('filters rows and announces the visible count', async function ({ page }) {
    await openPreview(page, '# Doc\n\n' + statusTable() + '\n');
    await expect(page.locator('#preview .table-wrap.filterable')).toHaveCount(1);
    await page.fill('#preview .table-filter', 'Dora');
    const visible = await page.locator('#preview tbody tr:not([hidden])').count();
    expect(visible).toBe(1);
    await expect(page.locator('#preview .table-count')).toHaveText('1 of 13 rows');
  });

  test('resizes columns by drag, keyboard and double-click reset', async function ({ page }) {
    await openPreview(page, '# Doc\n\n| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n');
    const grip = page.locator('#preview .col-resize').first();
    const box = await grip.boundingBox();
    const before = await page.locator('#preview thead th').first().evaluate((el) => el.offsetWidth);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    const afterDrag = await page.locator('#preview thead th').first().evaluate((el) => el.offsetWidth);
    expect(afterDrag).toBeGreaterThan(before);
    await grip.focus();
    await page.keyboard.press('ArrowRight');
    const afterKey = await page.locator('#preview thead th').first().evaluate((el) => el.offsetWidth);
    expect(afterKey).toBeGreaterThan(afterDrag);
    await grip.dblclick();
    await expect(page.locator('#preview .table-wrap.is-resized')).toHaveCount(0);
  });

  test('reset restores order and widths and announces it', async function ({ page }) {
    await openPreview(page, '# Doc\n\n| a | b | c |\n| --- | --- | --- |\n| 2 | x | y |\n| 1 | x | y |\n| 3 | x | y |\n| 4 | x | y |\n| 5 | x | y |\n');
    await page.locator('#preview .th-sort').first().click();
    await page.locator('#preview .col-resize').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#preview .table-wrap.is-resized')).toHaveCount(1);
    await page.click('#preview .table-reset');
    await expect(page.locator('#preview .table-wrap.is-resized')).toHaveCount(0);
    await expect(page.locator('#preview th[aria-sort]')).toHaveCount(0);
    const first = await page.locator('#preview tbody td').first().textContent();
    expect(first.trim()).toBe('2');
    await expect(page.locator('#preview .visually-hidden')).toHaveText('Original order and widths restored');
  });

  test('offers a scroll hint and a keyboard region on sideways overflow', async function ({ page }) {
    const wide = 'x'.repeat(90);
    await openPreview(page, '# Doc\n\n| A | B | C | D |\n| --- | --- | --- | --- |\n| ' +
      [wide, wide, wide, wide].join(' | ') + ' |\n');
    const wrap = page.locator('#preview .table-wrap');
    await expect(page.locator('#preview .scroll-hint')).toBeVisible();
    await expect(wrap).toHaveAttribute('role', 'region');
    await expect(wrap).toHaveAttribute('tabindex', '0');
  });

  test('tracks reading progress and offers a back-to-top button', async function ({ page }) {
    await openPreview(page, '# Doc\n\n' + 'filler paragraph for scrolling. '.repeat(400));
    // The panel grows with its content here, so the window is the scroller.
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(page.locator('.back-to-top')).toHaveClass(/is-visible/);
    const width = await page.locator('.reading-progress').evaluate((el) => el.style.width);
    expect(parseInt(width, 10)).toBeGreaterThan(0);
    await page.click('.back-to-top');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator('.back-to-top')).not.toHaveClass(/is-visible/);
  });

  test('uses localized strings when the language is Chinese', async function ({ page }) {
    await gotoApp(page, { storage: { 'preferred-lang': 'zh' } });
    await setMarkdown(page, '# 標題\n\n中文內容。'.repeat(20) + '\n\n' + statusTable() + '\n');
    await switchTab(page, 'preview');
    const meta = await page.locator('#preview .doc-meta').textContent();
    expect(meta).toContain('分鐘閱讀');
    await expect(page.locator('#preview .table-reset')).toHaveText('還原順序與欄寬');
    await expect(page.locator('#preview .table-filter')).toHaveAttribute('placeholder', '篩選表格內容…');
  });
});

test.describe('adaptive presentation – column order', function () {
  test('sorts small tables too (two rows, no 5-row gate)', async function ({ page }) {
    await openPreview(page, '# Doc\n\n| a |\n| --- |\n| 2 |\n| 1 |\n');
    await expect(page.locator('#preview .table-wrap.sortable')).toHaveCount(1);
    await page.locator('#preview .th-sort').first().click();
    const values = await page.locator('#preview tbody td').allTextContents();
    expect(values.map((v) => v.trim())).toEqual(['1', '2']);
  });

  test('reorders columns by dragging a header without sorting', async function ({ page }) {
    await openPreview(page, '# Doc\n\n| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n');
    const headers = page.locator('#preview thead th');
    const first = await headers.first().boundingBox();
    const third = await headers.nth(2).boundingBox();
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(third.x + third.width - 4, third.y + third.height / 2, { steps: 6 });
    await page.mouse.up();
    const texts = await headers.allTextContents();
    expect(texts.map((v) => v.trim())).toEqual(['b', 'c', 'a']);
    await expect(page.locator('#preview .visually-hidden')).toHaveText('a column moved to position 3');
    // The drag's trailing click must not sort: rows keep their original order.
    const row = await page.locator('#preview tbody tr').first().locator('td').allTextContents();
    expect(row.map((v) => v.trim())).toEqual(['2', '3', '1']);
  });

  test('moves columns with Alt+Arrow keys from the sort button', async function ({ page }) {
    await openPreview(page, '# Doc\n\n| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n');
    await page.locator('#preview .th-sort').first().focus();
    await page.keyboard.press('Alt+ArrowRight');
    const texts = await page.locator('#preview thead th').allTextContents();
    expect(texts.map((v) => v.trim())).toEqual(['b', 'a', 'c']);
    await expect(page.locator('#preview .visually-hidden')).toHaveText('a column moved to position 2');
  });

  test('reset restores column order along with rows and widths', async function ({ page }) {
    await openPreview(page, '# Doc\n\n| a | b | c |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n');
    await page.locator('#preview .th-sort').first().focus();
    await page.keyboard.press('Alt+ArrowRight');
    await expect(page.locator('#preview thead th').first()).toHaveText('b');
    await page.click('#preview .table-reset');
    const texts = await page.locator('#preview thead th').allTextContents();
    expect(texts.map((v) => v.trim())).toEqual(['a', 'b', 'c']);
    await expect(page.locator('#preview .visually-hidden')).toHaveText('Original order and widths restored');
  });

  test('keeps clicking a header to sort after a previous drag', async function ({ page }) {
    await openPreview(page, '# Doc\n\n| a | b |\n| --- | --- |\n| 2 | x |\n| 1 | y |\n');
    const headers = page.locator('#preview thead th');
    const first = await headers.first().boundingBox();
    const second = await headers.nth(1).boundingBox();
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(second.x + second.width - 2, second.y + second.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(page.locator('#preview thead th').first()).toHaveText('b');
    await page.locator('#preview .th-sort').first().click();
    await expect(page.locator('#preview th[aria-sort="ascending"]')).toHaveCount(1);
  });
});
