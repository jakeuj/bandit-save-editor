# 來源快取、驗證與交付補充

遊戲改版、原生驗證或交付時讀相應章節；日常任務不需全文載入。主流程依 repo `docs/maintenance/migration.md`、`docs/maintenance/release.md` 與 `docs/testing.md`。

## 版本更新入口

開發新功能或補隱藏原生測試時，同樣先讀本機索引：以 `preferredDevelopmentSourceId` 找到完整來源、獨立 `runtime` 及兩份完整性 manifest，核對後直接傳給既有驗證工具的 `--source`／`--runtime`。完整快取保持原始唯讀用途，由 `verify-game.cjs` 複製到隔離測試目錄並套用隱藏、靜音與存檔隔離；固定測試存檔及候選 catalog 依當次任務指定。只有分析來源時才補建完整來源；runtime 依內容摘要快取，保留舊版配對，不依賴 Steam 安裝檔永遠不變。本機索引附有準備／重用指令時優先沿用；完整性通過與實際原生測試成功分開記錄。

先讀本機 `.local/game-sources.json` 與 `.local/game-sources.md`（若存在），取得已記錄版本、完整／精簡來源、快取根目錄及逐檔指紋。先確認路徑仍在且指紋相符，沿用原快取根目錄或直接傳 `--source`；不要為找資料重掃暫存目錄，或把同一包解到新的 artifacts 根目錄。套件雜湊確實改變、快取缺檔或內容不符時才補建。精簡來源供靜態分析，不能當成可執行遊戲。新增解包後更新本機索引；索引由 Git 忽略，機器路徑不寫進公開技能／文件。

處理新版相容性時，先查 [Steam 遊戲最新消息](https://store.steampowered.com/news/app/4267800)，核對公告日期、版本及正式／測試／相容分支，將當次公告的永久連結記入 repo 研究筆記。新聞頁無法取得正文時，改用 [Steam 官方新聞 API](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4267800&count=5&maxlength=0&feeds=steam_community_announcements)。

實際安裝版本另以 `appmanifest_4267800.acf` 的 `buildid` 與 `package.nw` 指紋確認；包內版本文字可能落後。先用遷移工具 `--package`／`--plan` 選取必要檔案分析，無關更新不完整解包或啟動遊戲；未知規則再依 [save-format.md 純分析流程](save-format.md#重建知識)查 SID。

V1.0.11.2 當次完整驗證見 `docs/research/v1.0.11.2-audit.md`；後續精簡政策及兩版重播見 `docs/research/selective-migration.md`。實際開放版本以 catalog／verification 為準，分清本版原生實測、沿用及 UI 未重驗；Windows 結果不代表 Mac 已實測。


## 驗證與交付

日常推送採快速流程：只檢查建置同步、提交及推送，不重跑全套 Node／瀏覽器／遊戲測試。純技能、文件或忽略規則更新，推送成功即結束，回報提交連結；即使自動觸發 Pages，也不查詢或等待部署。只有影響網站產物、發布設定，或使用者明確要求時，才追蹤對應 SHA 的部署結果並回報部署連結；明確要求確認線上版本時，才額外 GET 首頁。Pages CI 只檢查建置同步並發布；完整驗收保留 `npm run verify:release`，使用者要求或具體故障需要時才執行。失敗才讀詳細日誌及擴大檢查。開發測試分工見 `docs/testing.md`。

遊戲遷移先依相依摘要沿用／選跑，只有受影響部分補隔離原生函式、原版存檔／新 PID 讀回；保留來源與原始存檔雜湊。已完成副本可依相同輸入續跑，公式共用，清理告警不推翻結果。

例行更新不使用 computer use。遊戲 UI 變動先記錄，實際故障後先查原生／存檔證據；使用者明確要求桌面操作時，說明缺口並只跑最小案例。既有群組不因 UI 未重驗關閉；新增功能首次證明另依原規格。編輯器的原生選檔、安裝或特定使用者瀏覽器問題，也先用程式化證據縮小範圍。

隔離遊戲測試一律預設靜音，沿用 `scripts/verify-game.cjs` 共用啟動器的 `--mute-audio`；既有副本重啟及手動啟動也須保留。不要調整 Windows 主音量、玩家遊戲或 Discord，也不要自行開聲音驗收；音訊測試須由使用者明確要求。

需要同步產物時從 repo 根目錄執行建置；完整驗收僅按上方條件執行：

```sh
node scripts/build-editor.cjs
npm run verify:release
```

依變更驗證選檔、修改、預覽、聯動還原／復原、下載及重新比對；完整尺寸使用分頁或搜尋，不把全部陣列渲染為 DOM。文件變更主要檢查連結、指令與實作一致性。

單檔相依性檢查與 HTTP 下載成功不代表直接開啟離線檔的 UI 已驗收。以headless直接file案例取得Chromium網頁證據；需要原生Chrome／Edge視窗證據時，再依維護指引補最小案例並分開記錄，才更新相符SDD狀態；不把歷史測試數量、玩家數值或舊差異筆數當成永久預期。

只在對話已授權的範圍推送或發布。交付區分核心測試、瀏覽器／離線 UI、正式部署、隔離遊戲讀寫及真實 Steam 功能；既有實測引用 repo 證據，新增變更不自動繼承全部驗證結論。
