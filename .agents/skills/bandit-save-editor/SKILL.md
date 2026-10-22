---
name: bandit-save-editor
description: 維護 jakeuj/bandit-save-editor（山寨帳房／塔防山賊模擬器存檔修改器）的資源與成長編輯、存檔知識、離線版、SEO／分享預覽、GitHub Pages，以及 repo 內的實驗性 macOS ARM64 啟動器。用於此專案的開發、驗證、發布與 Mac／CrossOver 啟動調查；一般 GitHub 操作或其他遊戲不適用。
---

# 山寨帳房 Repo 維護

維護 [jakeuj/bandit-save-editor](https://github.com/jakeuj/bandit-save-editor)，使用台灣繁體中文。專案包含瀏覽器本機存檔修改器與實驗性 Mac 啟動器。

## 定位專案

此技能隨 repo 提供，位於 `.agents/skills/bandit-save-editor/`；`.claude/skills/bandit-save-editor` 是指向同一份的 symlink。以目前 checkout 的 repo 根目錄為工作位置，核對 Git remote 與工作目錄變更。

先讀 repo 的 `AGENTS.md`、`README.md` 與任務相關文件。技能提供入口與維護約束；公式、SID、指紋、實測證據及未完成項目以 repo 文件為準。舊對話 `outputs/` 的離線 HTML 不是開發來源。

## 規則同步檢查

更新此技能或使用者要求調整工作流程時，將下列檢查納入同一次修改：

1. 重讀目前磁碟上的技能正本及適用的 `AGENTS.md`（含上層與目標目錄的指引），以使用者最新要求核對同一行為的規則。搜尋相關技能參考文件與維護／測試指引，找出仍要求舊流程的段落。
2. 在已授權範圍內一併修正衝突或補足 AGENTS 的入口，保留無關修改。通用規則集中於適當入口，細節以連結指向主文件；涉及自動執行時也核對實際腳本或 workflow，區分文件規則與工具行為。若受其他適用指令或權限限制而無法同步，明確指出未完成處與實際影響。
3. 完成前重新搜尋舊措辭，核對會影響下一次決策的入口與例外一致。交付時簡述 AGENTS 已調整，或核對後不需調整及原因；區分已寫入本機、已提交／推送及實際驗證範圍。當前工作階段重讀新規則；後續工作階段從 repo 最新指引載入，不以只修改技能檔作為行為已驗證的證據。

## 依任務讀取

- 完整轉職表、職業條件與社群工作圖：讀 repo 的 `src/profession-ui.js`、`knowledge/profession-guide.json`；前置資料由 `extract-game.cjs` 重建，規則與來源界線見研究筆記「職業轉職圖鑑」。
- PWA 安裝、離線快取與更新：讀 repo 的 `docs/maintenance.md` 的 PWA 維護與驗收；來源為 `src/pwa.js`、`src/service-worker.js`，建置同步 HTML 與 `sw.js`。
- 存檔、名稱、角色／職業／技藝經驗、圖鑑或知識重建：讀 [references/save-format.md](references/save-format.md)，再讀 repo 的 `src/core.js`、`docs/research/save-knowledge.md`。
- 裝備等級、職業操練上限、進階科技或超限模式：讀 repo 的 `docs/research/advanced-editing.md` 與 `sdd/advanced-editing/tasks.md`；基礎資質、技藝上限、天賦回填或自然職業30級限制另讀 `sdd/runtime-patch/proposal.md`。v2.8.1 已在 `editingInfo` 的 z9 分支補普通／setLink 檢查，套裝等級唯讀；v2.8 及以前的可寫路徑是未證明缺口，舊存檔不追溯，該件等級不能由本版還原。
- 規劃下一版或評估候選順序：先讀 repo 的 `docs/research/next-version-plan.md`（已驗證事實、版本順序、v2.8.1 範圍、天賦與套裝等級研究清單、給新 session 的接續 prompt），需要單項排序理由再讀 `docs/research/feature-roadmap.md`；路線圖的「基準 V1.0.10.2」與 V1.0.11.0 影響段屬歷史敘述。不重做已記錄的盤點；開閘門仍依維護指引。範本0一般隨機角色的資質、技藝上限與天賦不受載入回填，與補丁提案範圍不同。
- v2.8.1 鞏固版（z9 套裝唯讀、文件對齊 V1.0.11.2、發布核對紀錄）：讀 `sdd/v2.8.1-consolidation/proposal.md` 與 `tasks.md`，2026-10-23 使用者已核准四項決定，實作及驗收見任務紀錄，提交與推送已授權，發布狀態見任務紀錄。本版不新增修改功能。任何 `src/core.js` 位元變動都會讓技藝上限群組的整份 core 摘要失效，改完後依維護指引重開，旗標關閉狀態不推送。
- 第二批詞條與丹藥資質增量：讀 repo 的 `docs/research/advanced-editing-batch2.md` 與 `sdd/advanced-editing-batch2/`。v2.2 已開放獨立驗證的既有詞條係數與丹藥增量；替換ID見v2.3，品質見v2.5，超限另行驗證。
- 精準洗練、替換已選槽詞條、單件裝備效果預覽或搬移識別：讀 repo 的 `docs/research/precise-affix-editing.md` 與 `sdd/precise-affix-editing/tasks.md`。v2.3 使用獨立替換驗證群組，不沿用係數證明；原生搬移後 y0 可不同於目前列號，不得據此拒絕合法裝備。
- 背包裝備、首次洗練選槽或新取得標記：讀 repo `docs/research/equipment-workflow.md` 與 `sdd/equipment-workflow/tasks.md`。v2.4已正式發布並開放首次選槽；具備代表遊戲選槽UI、原版存檔／新PID讀回、桌面／390px精確下載及PWA離線／更新交接證據。詳細範圍與SHA以repo紀錄為準；直接file://新流程仍待人工。
- 普通裝備品質升降、完整單件效果或y23語意：讀repo `docs/research/equipment-quality.md`、`sdd/equipment-quality/tasks.md`與維護指引v2.5段落。背包／z9的升品／降品有四個獨立證明，綁定15來源、規則／資料及公式雜湊；新增尾槽須明選，刪槽須確認且保留已選槽。取得事件分支與y23不可再簡化為目前品質。詳細公式、6,592組原生比對、UI及發布狀態留repo。
- 一般隨機角色基礎資質、三項組合值域或與丹藥的還原相依：讀 `docs/research/random-character-growth.md`、`sdd/random-character-growth/tasks.md` 與維護指引 v2.7 段落。v2.7 僅處理範本0基礎資質，技藝上限／天賦另案；開放狀態以獨立證明為準。
- 一般隨機角色九項技藝上限、27欄累計還原、原生封頂餘額或首次證明：讀 `docs/research/random-character-skill-caps.md`、`sdd/random-character-skill-caps-b/tasks.md` 與維護指引 v2.8 段落。A核心與B介面／完整矩陣分開驗收，首次開放走獨立suite，代表遷移不能取代；相符15來源、規則及整份core摘要才有效，天賦編輯另案。
- 一般隨機角色天賦等級（v2.9）、天賦效果公式、12欄資質／天賦合併還原或其首次證明：讀 `docs/research/random-character-talents.md`、`sdd/random-character-talents/proposal.md` 與 `tasks.md`。首版只改等級，ID、0/0 與池外等級唯讀；A 已凍結 `src/core.js`，B 不得再改 core。技藝上限群組整份 core 摘要因此失效，排在任務 9 唯一一次重開，在那之前建置會拒絕。
- 批次經驗、普通裝備升滿、科技同值或大量變更預覽：讀`docs/maintenance.md`的v2.6段落與`sdd/batch-editing/`。批次沿用既有具名API及閘門，暫存模型分段檢查，全部合格才一次提交；復原一步撤回整批，個別還原維持累計群組。完整尺寸、瀏覽器及隔離冒煙證據以任務紀錄為準，發布狀態另查repo。
- 使用者明確要求操作遊戲 UI 時，才讀 repo `docs/game-ui-testing.md` 的「快速開始」、目標路徑與完成標記；工具 API 以當次 computer-use 技能為準，座標與視窗 ID 重新取得。
- 遊戲改版／版本遷移：讀 repo `docs/maintenance.md`「版本遷移重驗」。先看正式公告，再跑 `verify-migration.cjs --plan`；預設 auto 按語意相依選跑，未變沿用，相關疑慮只補隱藏原生測試。UI 未重驗不阻擋既有功能，例行 computer use 為零。來源快取、基準、full／resume 與寫回細節以該文件為準；原代表全驗流程留在歷史 SDD。
- 核心 API、來源同步、知識驗證或驗收說明：讀 repo 的 `docs/maintenance.md`；待驗收狀態見 `sdd/save-knowledge/tasks.md`。
- 遊戲知識版本標示同步、SEO、分享預覽、正式網址、GitHub 專案網站連結或 Pages 發布驗證：讀 [references/pages.md](references/pages.md)。
- Mac 啟動、CrossOver、Steam 或存檔位置：讀 [references/macos.md](references/macos.md) 的來源定位與啟動約束，再讀 repo 的 `launcher/README.md`、`docs/research/macos-runtime-investigation.md`。

## 版本更新入口

開發新功能或補隱藏原生測試時，同樣先讀本機索引：以 `preferredDevelopmentSourceId` 找到完整來源、獨立 `runtime` 及兩份完整性 manifest，核對後直接傳給既有驗證工具的 `--source`／`--runtime`。完整快取保持原始唯讀用途，由 `verify-game.cjs` 複製到隔離測試目錄並套用隱藏、靜音與存檔隔離；固定測試存檔及候選 catalog 依當次任務指定。只有分析來源時才補建完整來源；runtime 依內容摘要快取，保留舊版配對，不依賴 Steam 安裝檔永遠不變。本機索引附有準備／重用指令時優先沿用；完整性通過與實際原生測試成功分開記錄。

先讀本機 `.local/game-sources.json` 與 `.local/game-sources.md`（若存在），取得已記錄版本、完整／精簡來源、快取根目錄及逐檔指紋。先確認路徑仍在且指紋相符，沿用原快取根目錄或直接傳 `--source`；不要為找資料重掃暫存目錄，或把同一包解到新的 artifacts 根目錄。套件雜湊確實改變、快取缺檔或內容不符時才補建。精簡來源供靜態分析，不能當成可執行遊戲。新增解包後更新本機索引；索引由 Git 忽略，機器路徑不寫進公開技能／文件。

處理新版相容性時，先查 [Steam 遊戲最新消息](https://store.steampowered.com/news/app/4267800)，核對公告日期、版本及正式／測試／相容分支，將當次公告的永久連結記入 repo 研究筆記。新聞頁無法取得正文時，改用 [Steam 官方新聞 API](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4267800&count=5&maxlength=0&feeds=steam_community_announcements)。

實際安裝版本另以 `appmanifest_4267800.acf` 的 `buildid` 與 `package.nw` 指紋確認；包內版本文字可能落後。先用遷移工具 `--package`／`--plan` 選取必要檔案分析，無關更新不完整解包或啟動遊戲；未知規則再依 [save-format.md 純分析流程](references/save-format.md#重建知識)查 SID。

V1.0.11.2 當次完整驗證見 `docs/research/v1.0.11.2-audit.md`；後續精簡政策及兩版重播見 `docs/research/selective-migration.md`。實際開放版本以 catalog／verification 為準，分清本版原生實測、沿用及 UI 未重驗；Windows 結果不代表 Mac 已實測。

## 編輯來源

- 讀寫、型別與成長交易改 `src/core.js`；一般操作改 `src/ui.js`；角色、裝備及欄位圖鑑改 `src/knowledge-ui.js`。
- `knowledge/catalog.json` 由 `scripts/extract-game.cjs` 產生；繁體名稱對照與寫入實測分別維護於 `knowledge/traditional-names.json`、`knowledge/verification.json`。
- HTML 結構、樣式與 SEO 改 `index.html`。其中的 `save-core`／`save-ui` 由 `node scripts/build-editor.cjs` 同步，修改程式來源後一併提交產生的 HTML；直接修改內嵌程式會被覆蓋。
- 維持單檔 HTML 內嵌程式與知識、本機處理及 CSP 禁止連線；使用者操作不需要 Node.js 或外部遊戲資料表。

## 寫入約束

- 匯出只替換指定值的 token，保留其他原始文字，包括大型整數 literal、BOM、空白及指數寫法。數值與字串皆須維持原型別；JSON 字串跳脫與 HTML 顯示跳脫各自處理。
- 欄位權限由 `resolveField`／`setField` 統一判斷；舊 `set` 與自訂座標不能繞過已知唯讀限制。
- 角色、已習得職業及九項技藝的經驗使用 `addExperience` 聯動結算；等級與餘額不單獨改寫。同一角色同一類經驗的累計變更整組還原，`undo` 則回到前一次交易；失敗交易全部回滾。
- 新增可寫群組保留首次獨立證明：追查關聯、完成合成及隔離原生存讀／重啟後，以相符完整來源開閘。同時擴充需求表、suite、情境及相依宣告；代表遷移與 UI 未重驗政策不能首次開放新群組。
- 真實存檔、遊戲 payload、runtime、驗證 state 與原始 log 留在 repo 外。使用固定副本驗證，修改玩家原檔依任務指示執行並保留備份。

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
