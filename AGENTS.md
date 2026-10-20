# 專案工作指引

使用繁體中文。此 repo 包含山寨帳房靜態存檔修改器與《塔防山賊模擬器》的實驗性 macOS ARM64 啟動器。

- 維護存檔讀寫時，先讀 `README.md`、`src/core.js` 與 `docs/research/save-knowledge.md`。`src/` 與 `knowledge/catalog.json` 是來源，執行 `node scripts/build-editor.cjs` 同步 `index.html` 的內嵌程式；單檔 HTML 供線上及離線使用。驗證：`node --test tests/*.test.cjs`、`node scripts/build-editor.cjs --check`。
- 更新核心 API、知識重建流程、驗證或發布說明時，讀 `docs/maintenance.md`；公式與實測證據維護在研究筆記，避免在技能複製完整規則。文件區分離線相依性檢查與直接開檔 UI 實測，依實際結果更新 `sdd/save-knowledge/tasks.md`。
- 保留所有未修改原始字元與大型整數 literal；已知唯讀欄位套用統一規則，經驗聯動必須整組可復原。新增寫入需符合 `knowledge/verification.json` 的來源指紋與隔離遊戲實測，才開啟 catalog 閘門。
- 處理 Mac 啟動、存檔路徑或 CrossOver 時，先讀 `launcher/README.md` 與 `docs/research/macos-runtime-investigation.md`；沿用 repo 的準備工具，在隔離副本驗證，分開記錄 Steam 清單、實際讀寫與重啟續玩結果。
- 真實存檔、遊戲 payload、runtime、原始 log 與 crash dump 放 repo 外；repo 只維護程式、合成測試及去識別的研究筆記。
- 自建技能正本為 `~/.agents/skills/bandit-save-editor/SKILL.md`。環境有此技能時讀取它；其他環境以上述 repo 文件為入口。可重用的專案知識同步技能與 repo 文件，詳細證據以 repo 為準。
