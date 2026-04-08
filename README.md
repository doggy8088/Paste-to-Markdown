# Paste to Markdown

將剪貼簿中的 HTML 內容貼上，即時轉換為 Markdown 格式。所有轉換皆在瀏覽器端完成，不會傳送任何資料到後端。

🔗 **線上使用**：<https://p2m.gh.miniasp.com>

## 使用方式

1. 在任意網頁透過 `Ctrl+C` / `⌘+C` 複製內容
2. 在本頁按下 `Ctrl+V` / `⌘+V` 貼上
3. 取得 Markdown 結果，直接 `Ctrl+C` / `⌘+C` 複製使用
4. 按 `Escape` 重設狀態

## 支援的貼上來源

- 一般網頁 HTML
- VS Code 編輯器（自動移除共同前綴空白）
- Microsoft Word / RTF

## 技術細節

- 轉換引擎：[Turndown](https://github.com/mixmark-io/turndown)
- 純前端，零後端依賴
- 支援深色模式

## 致謝

- 原始專案：[Paste to Markdown](https://euangoddard.github.io/clipboard2markdown/) by Euan Goddard
- Fork 來源：[doggy8088/Paste-to-Markdown](https://github.com/doggy8088/Paste-to-Markdown) by Will 保哥

## 授權

MIT
