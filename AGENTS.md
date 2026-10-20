# 專案工作指引

使用繁體中文。此 repo 包含山寨帳房靜態存檔修改器與《塔防山賊模擬器》的實驗性 macOS ARM64 啟動器。

- 維護存檔讀寫時，先讀 `README.md`、`index.html` 的 `save-core` 與 `tests/save-core.test.cjs`；保留未修改原始字元及大型整數 literal，匯出修改副本。核心驗證：`node --test tests/save-core.test.cjs`。
- 處理 Mac 啟動、存檔路徑或 CrossOver 時，先讀 `launcher/README.md` 與 `docs/research/macos-runtime-investigation.md`；沿用 repo 的準備工具，在隔離副本驗證，分開記錄 Steam 清單、實際讀寫與重啟續玩結果。
- 真實存檔、遊戲 payload、runtime、原始 log 與 crash dump 放 repo 外；repo 只維護程式、合成測試及去識別的研究筆記。
- 自建技能正本為 `~/.agents/skills/bandit-save-editor/SKILL.md`。環境有此技能時讀取它；其他環境以上述 repo 文件為入口。可重用的專案知識同步技能與 repo 文件，詳細證據以 repo 為準。
