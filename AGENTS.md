# 專案工作指引

使用繁體中文。此 repo 包含山寨帳房靜態存檔修改器與《塔防山賊模擬器》的實驗性 macOS ARM64 啟動器。

- 查詢架構與跨檔關係時，若有 `graphify-out/graph.json` 先查圖譜並核對目前來源；圖譜建立、更新與完整性限制見 `docs/research/repository-graph.md`。
- 維護存檔讀寫時，先讀 `README.md`、`src/core.js` 與 `docs/research/save-knowledge.md`。`src/` 與 `knowledge/catalog.json` 是來源，執行 `node scripts/build-editor.cjs` 同步 `index.html` 的內嵌程式；單檔 HTML 供線上及離線使用。驗證：`node --test tests/*.test.cjs`、`node scripts/build-editor.cjs --check`。
- 更新核心 API、知識重建流程、驗證或發布說明時，讀 `docs/maintenance.md`；公式與實測證據維護在研究筆記，避免在技能複製完整規則。文件區分離線相依性檢查與直接開檔 UI 實測，依實際結果更新 `sdd/save-knowledge/tasks.md`。
- 日常推送採快速流程：只檢查建置同步、提交及推送，不重跑全套 Node／瀏覽器／遊戲測試。純技能、文件或忽略規則更新，推送成功即結束，回報提交連結；即使自動觸發 Pages，也不查詢或等待部署。只有影響網站產物、發布設定，或使用者明確要求時，才追蹤對應 SHA 的部署結果並回報部署連結；明確要求確認線上版本時，才額外 GET 首頁。Pages CI 只檢查建置同步並發布；完整驗收保留 `npm run verify:release`，使用者要求或具體故障需要時才執行。失敗才讀詳細日誌及擴大檢查。開發測試入口及隔離見 `docs/testing.md`；新增可寫群組的首次證明要求不變。
- 實際遊戲 UI／computer use 測試時，先讀 `docs/game-ui-testing.md` 的「快速開始」及目標操作路徑；沿用完成標記與隔離測試資料，座標依當次畫面重新辨識。工具 API 以當次可用的 computer-use 技能為準。
- 保留所有未修改原始字元與大型整數 literal；已知唯讀欄位套用統一規則，經驗聯動必須整組可復原。新增寫入需符合 `knowledge/verification.json` 的來源指紋與隔離遊戲實測，才開啟 catalog 閘門。
- 遊戲改版先讀本機 `.local/game-sources.json`（若存在）定位版本、解包來源與快取根目錄，核對來源雜湊後沿用，不重新掃描或解包相同來源；本機索引不提交。再核對正式公告，用 `scripts/verify-migration.cjs --plan` 看影響；預設 auto，按相依語意沿用或只驗相關功能。例行更新不使用 computer use，UI 未重驗不阻擋既有群組，實際問題發生後再針對性複查；使用者明確要求才操作遊戲桌面。基準、續跑與寫回條件見 `docs/maintenance.md`「版本遷移重驗」。新增寫入保留首次證明，同步擴充需求表、suite、情境及相依宣告。
- 處理 Mac 啟動、存檔路徑或 CrossOver 時，先讀 `launcher/README.md` 與 `docs/research/macos-runtime-investigation.md`；沿用 repo 的準備工具，在隔離副本驗證，分開記錄 Steam 清單、實際讀寫與重啟續玩結果。
- 真實存檔、遊戲 payload、runtime、原始 log 與 crash dump 放 repo 外；repo 只維護程式、合成測試及去識別的研究筆記。
- 開發功能的隱藏原生測試先讀本機 `.local/game-sources.json` 的 `preferredDevelopmentSourceId`，沿用完整來源及獨立 runtime；完整性核對、隔離副本與重用方式見 `docs/maintenance.md`「本機開發快取」。
- 專案技能正本為 `.agents/skills/bandit-save-editor/SKILL.md`（Codex 直接掃描）；`.claude/skills/bandit-save-editor` 是給 Claude Code 的相對 symlink，不另存副本。可重用的專案知識同步技能與 repo 文件，詳細證據以 repo 為準；技能隨 repo 公開，不寫入機器路徑、真實存檔位置或私人資料。
- 更新技能或工作流程規則時，同步核對適用的 `AGENTS.md` 與相關指引，依技能「規則同步檢查」消除衝突；完成時說明 AGENTS 已調整或核對後不需調整，不能只改技能便宣稱規則已生效。
- 開始處理本專案任務時，若技能清單沒有 `bandit-save-editor`，先直接讀技能正本照做，再修復連結：`.claude/skills/bandit-save-editor` 若是內容為相對路徑的一般檔案（常見於 Windows `core.symlinks=false`），執行 `git config core.symlinks true`、刪除該檔並 `git checkout -- .claude/skills/bandit-save-editor`；建立 symlink 權限不足時，改在本機建 directory junction 指向 `.agents/skills/bandit-save-editor`，但不提交 junction，也不在 repo 另存副本。確認可經連結讀到 `SKILL.md` 後，告知使用者需開新工作階段才會重新載入技能。
