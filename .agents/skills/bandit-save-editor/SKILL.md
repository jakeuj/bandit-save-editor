---
name: bandit-save-editor
description: 維護 jakeuj/bandit-save-editor（山寨帳房／塔防山賊模擬器存檔修改器）的資源與成長編輯、存檔知識、離線版、SEO／分享預覽、GitHub Pages，以及 repo 內的實驗性 macOS ARM64 啟動器。用於此專案的開發、驗證、發布與 Mac／CrossOver 啟動調查；一般 GitHub 操作或其他遊戲不適用。
---

# 山寨帳房 Repo 維護

維護 [jakeuj/bandit-save-editor](https://github.com/jakeuj/bandit-save-editor)，使用台灣繁體中文。專案包含瀏覽器本機存檔修改器與實驗性 Mac 啟動器。

## 定位專案

此技能隨 repo 提供，位於 `.agents/skills/bandit-save-editor/`；`.claude/skills/bandit-save-editor` 是指向同一份的 symlink。以目前 checkout 的 repo 根目錄為工作位置，核對 Git remote 與工作目錄變更。

先讀 repo 的 `AGENTS.md`、`README.md` 與任務相關文件。技能提供入口與維護約束；公式、SID、指紋、實測證據及未完成項目以 repo 文件為準。舊對話 `outputs/` 的離線 HTML 不是開發來源。

## 依任務讀取

- 完整轉職表、職業條件與社群工作圖：讀 repo 的 `src/profession-ui.js`、`knowledge/profession-guide.json`；前置資料由 `extract-game.cjs` 重建，規則與來源界線見研究筆記「職業轉職圖鑑」。
- PWA 安裝、離線快取與更新：讀 repo 的 `docs/maintenance.md` 的 PWA 維護與驗收；來源為 `src/pwa.js`、`src/service-worker.js`，建置同步 HTML 與 `sw.js`。
- 存檔、名稱、角色／職業／技藝經驗、圖鑑或知識重建：讀 [references/save-format.md](references/save-format.md)，再讀 repo 的 `src/core.js`、`docs/research/save-knowledge.md`。
- 裝備等級、職業操練上限、進階科技或超限模式：讀 repo 的 `docs/research/advanced-editing.md` 與 `sdd/advanced-editing/tasks.md`；基礎資質、技藝上限、天賦回填或自然職業30級限制另讀 `sdd/runtime-patch/proposal.md`。
- 規劃下一個可寫功能或評估候選順序：先讀 repo 的 `docs/research/feature-roadmap.md`，排序、靜態證據與 V1.0.11.0 影響以該文件為準；開閘門仍依維護指引。範本0一般隨機角色的資質、技藝上限與天賦不受載入回填，與補丁提案範圍不同。
- 第二批詞條與丹藥資質增量：讀 repo 的 `docs/research/advanced-editing-batch2.md` 與 `sdd/advanced-editing-batch2/`。v2.2 已開放獨立驗證的既有詞條係數與丹藥增量；替換ID見v2.3，品質見v2.5，超限另行驗證。
- 精準洗練、替換已選槽詞條、單件裝備效果預覽或搬移識別：讀 repo 的 `docs/research/precise-affix-editing.md` 與 `sdd/precise-affix-editing/tasks.md`。v2.3 使用獨立替換驗證群組，不沿用係數證明；原生搬移後 y0 可不同於目前列號，不得據此拒絕合法裝備。
- 背包裝備、首次洗練選槽或新取得標記：讀 repo `docs/research/equipment-workflow.md` 與 `sdd/equipment-workflow/tasks.md`。v2.4已正式發布並開放首次選槽；具備代表遊戲選槽UI、原版存檔／新PID讀回、桌面／390px精確下載及PWA離線／更新交接證據。詳細範圍與SHA以repo紀錄為準；直接file://新流程仍待人工。
- 普通裝備品質升降、完整單件效果或y23語意：讀repo `docs/research/equipment-quality.md`、`sdd/equipment-quality/tasks.md`與維護指引v2.5段落。背包／z9的升品／降品有四個獨立證明，綁定15來源、規則／資料及公式雜湊；新增尾槽須明選，刪槽須確認且保留已選槽。取得事件分支與y23不可再簡化為目前品質。詳細公式、6,592組原生比對、UI及發布狀態留repo。
- 一般隨機角色基礎資質、三項組合值域或與丹藥的還原相依：讀 `docs/research/random-character-growth.md`、`sdd/random-character-growth/tasks.md` 與維護指引 v2.7 段落。v2.7 僅處理範本0基礎資質，技藝上限／天賦另案；開放狀態以獨立證明為準。
- 一般隨機角色九項技藝上限、27欄累計還原、原生封頂餘額或首次證明：讀 `docs/research/random-character-skill-caps.md`、`sdd/random-character-skill-caps-b/tasks.md` 與維護指引 v2.8 段落。A核心與B介面／完整矩陣分開驗收，首次開放走獨立suite，代表遷移不能取代；相符15來源、規則及整份core摘要才有效，天賦編輯另案。
- 批次經驗、普通裝備升滿、科技同值或大量變更預覽：讀`docs/maintenance.md`的v2.6段落與`sdd/batch-editing/`。批次沿用既有具名API及閘門，暫存模型分段檢查，全部合格才一次提交；復原一步撤回整批，個別還原維持累計群組。完整尺寸、瀏覽器及隔離冒煙證據以任務紀錄為準，發布狀態另查repo。
- 遊戲驗證先依下方「驗證與交付」選擇方式；只有確定需要操作遊戲UI時，才讀 repo `docs/game-ui-testing.md` 的「快速開始」及目標路徑、完成標記與故障表。工具API以當次computer-use技能為準，座標與視窗ID重新取得；編輯器選檔卡住則讀同檔確認框段落。
- 遊戲改版後重驗既有群組、Mac 隔離重驗或版本遷移流水線：讀 repo `docs/maintenance.md`「版本遷移重驗」與 `sdd/archive/2026-10-22-version-migration/`。流水線以代表子集重驗全部群組；指紋不同且原生 checks 全過才自動寫回，同指紋只比較。UI check 僅在宣告事件摘要不變時沿用，否則依 UI 手冊補最小案例。
- 核心 API、來源同步、知識驗證或驗收說明：讀 repo 的 `docs/maintenance.md`；待驗收狀態見 `sdd/save-knowledge/tasks.md`。
- 遊戲知識版本標示同步、SEO、分享預覽、正式網址、GitHub 專案網站連結或 Pages 發布驗證：讀 [references/pages.md](references/pages.md)。
- Mac 啟動、CrossOver、Steam 或存檔位置：讀 [references/macos.md](references/macos.md) 的來源定位與啟動約束，再讀 repo 的 `launcher/README.md`、`docs/research/macos-runtime-investigation.md`。

## 版本更新入口

處理新版相容性時，先查 [Steam 遊戲最新消息](https://store.steampowered.com/news/app/4267800)，核對公告日期、版本及正式／測試／相容分支，將當次公告的永久連結記入 repo 研究筆記。新聞頁無法取得正文時，改用 [Steam 官方新聞 API](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4267800&count=5&maxlength=0&feeds=steam_community_announcements)。

實際安裝版本另以 `appmanifest_4267800.acf` 的 `buildid` 與 `package.nw` 來源指紋確認；包內個別版本字串可能落後。未知來源先依 [save-format.md 的純分析流程](references/save-format.md#重建知識)取得 audit，再以 SID 查核規則。

新版 V1.0.11.2 的來源差異、Windows 遷移與必要 UI 補測見 repo 的 `docs/research/v1.0.11.2-audit.md`；前版歷史見 `docs/research/v1.0.10.2-audit.md`，實際開放版本以 catalog／verification 為準。公告與靜態分析各自記錄，只有完成相符來源的遊戲讀寫及重啟驗證後才更新實測標示；Windows 結果不代表新版 Mac 啟動器已相容。

## 編輯來源

- 讀寫、型別與成長交易改 `src/core.js`；一般操作改 `src/ui.js`；角色、裝備及欄位圖鑑改 `src/knowledge-ui.js`。
- `knowledge/catalog.json` 由 `scripts/extract-game.cjs` 產生；繁體名稱對照與寫入實測分別維護於 `knowledge/traditional-names.json`、`knowledge/verification.json`。
- HTML 結構、樣式與 SEO 改 `index.html`。其中的 `save-core`／`save-ui` 由 `node scripts/build-editor.cjs` 同步，修改程式來源後一併提交產生的 HTML；直接修改內嵌程式會被覆蓋。
- 維持單檔 HTML 內嵌程式與知識、本機處理及 CSP 禁止連線；使用者操作不需要 Node.js 或外部遊戲資料表。

## 寫入約束

- 匯出只替換指定值的 token，保留其他原始文字，包括大型整數 literal、BOM、空白及指數寫法。數值與字串皆須維持原型別；JSON 字串跳脫與 HTML 顯示跳脫各自處理。
- 欄位權限由 `resolveField`／`setField` 統一判斷；舊 `set` 與自訂座標不能繞過已知唯讀限制。
- 角色、已習得職業及九項技藝的經驗使用 `addExperience` 聯動結算；等級與餘額不單獨改寫。同一角色同一類經驗的累計變更整組還原，`undo` 則回到前一次交易；失敗交易全部回滾。
- 新增可寫群組需追查事件與關聯、完成合成測試及隔離遊戲載入／存檔／重啟驗證，再用相符的完整來源指紋開放 catalog 閘門。同時加入驗證需求表、重驗群組清單與代表情境，讓改版後能一次重驗。詳細流程見維護指引，不能只切換旗標或沿用不同來源的驗證證明。
- 真實存檔、遊戲 payload、runtime、驗證 state 與原始 log 留在 repo 外。使用固定副本驗證，修改玩家原檔依任務指示執行並保留備份。

## 驗證與交付

日常推送採快速流程：只檢查建置同步、提交及推送，不重跑全套 Node／瀏覽器／遊戲測試。Pages CI 只檢查建置同步並發布；完整驗收保留 `npm run verify:release`，使用者要求或具體故障需要時才執行。發布後只查對應 SHA 的部署結果；明確要求確認線上版本時，額外 GET 首頁核對版本。成功僅回報提交與部署連結，失敗才讀詳細日誌及擴大檢查。 開發測試分工見 `docs/testing.md`。

存檔修改預設以合成測試、隔離遊戲原生函式、原版存檔及停止／新 PID 重啟讀回為主，保留完整來源與原始存檔雜湊核對。一般功能驗證沿用上述流程及仍相符的既有證據。

僅在使用者明確要求，或有無法由原生函式／存檔證據回答的具體問題時操作遊戲UI，例如按鈕資格、選槽限制、即時顯示或實際輸入異常。開始前說明要補哪項證據，只跑最小代表案例，取得完成標記即停止；不為例行回歸重走導覽或重拍完整矩陣。工具受阻時記錄缺口，繼續可獨立完成的原生驗證；既有強制UI閘門仍須取得證據才開放。編輯器的原生選檔視窗、安裝流程、使用者特定瀏覽器或無法由程式回答的視覺問題，也依相同原則補最小computer use。詳細操作見 repo `docs/game-ui-testing.md`。

隔離遊戲測試一律預設靜音，沿用 `scripts/verify-game.cjs` 共用啟動器的 `--mute-audio`；既有副本重啟及手動啟動也須保留。不要調整 Windows 主音量、玩家遊戲或 Discord，也不要自行開聲音驗收；音訊測試須由使用者明確要求。

需要同步產物時從 repo 根目錄執行建置；完整驗收僅按上方條件執行：

```sh
node scripts/build-editor.cjs
npm run verify:release
```

依變更驗證選檔、修改、預覽、聯動還原／復原、下載及重新比對；完整尺寸使用分頁或搜尋，不把全部陣列渲染為 DOM。文件變更主要檢查連結、指令與實作一致性。

單檔相依性檢查與 HTTP 下載成功不代表直接開啟離線檔的 UI 已驗收。以headless直接file案例取得Chromium網頁證據；需要原生Chrome／Edge視窗證據時，再依維護指引補最小案例並分開記錄，才更新相符SDD狀態；不把歷史測試數量、玩家數值或舊差異筆數當成永久預期。

只在對話已授權的範圍推送或發布。交付區分核心測試、瀏覽器／離線 UI、正式部署、隔離遊戲讀寫及真實 Steam 功能；既有實測引用 repo 證據，新增變更不自動繼承全部驗證結論。
