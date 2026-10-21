# 山寨帳房維護與驗收

適用於存檔修改器及其遊戲知識。遊戲公式、事件 SID 與實測證據以[存檔知識調查](research/save-knowledge.md)為準；原生 Mac 準備與存檔位置見 [launcher 說明](../launcher/README.md)。

## 編輯入口

| 內容 | 來源與維護方式 |
| --- | --- |
| 讀寫、欄位定義、經驗與交易 | `src/core.js` |
| 選檔、資源、比對、自訂欄位、預覽與匯出 | `src/ui.js` |
| 角色、山寨、裝備、欄位圖鑑 | `src/knowledge-ui.js` |
| 完整轉職表、職業清單與角色對照 | `src/profession-ui.js`；資料來源見研究筆記的「職業轉職圖鑑」 |
| 社群附圖的工作建議與已核對轉職門檻 | `knowledge/profession-guide.json`；由建置工具內嵌，不在重建遊戲目錄時覆寫 |
| 名稱、來源位置、版本及指紋 | `knowledge/catalog.json`；由 `scripts/extract-game.cjs` 產生 |
| 名稱繁體轉換對照 | `knowledge/traditional-names.json`；保留遊戲原始 ID |
| 可寫群組的實測證明 | `knowledge/verification.json` |
| HTML 結構、樣式、使用說明與 SEO | `index.html`；其中 `save-core`、`save-ui`、`save-pwa` 區塊由建置工具同步 |
| PWA 安裝、離線狀態及快取 | `src/pwa.js`、`src/service-worker.js`、`manifest.webmanifest`；建置產生 `sw.js` |

在 repo 根目錄執行：

```sh
node scripts/build-editor.cjs
node scripts/build-editor.cjs --check
node --test tests/*.test.cjs
```

第一個命令更新內嵌程式與 `sw.js`，保留 HTML 結構與樣式。修改來源後一併提交產生的 `index.html` 及 `sw.js`；只修改產生區塊會在下次建置時被覆蓋。使用者下載的單一 HTML 已內嵌執行程式與知識，不需 Node.js 或遊戲資料表。

## 知識版本標示同步

遊戲知識版本以 `knowledge/catalog.json` 的 `gameVersion` 為唯一來源。`index.html` 的職業圖鑑標籤、職業資料來源說明、欄位圖鑑標籤與使用說明，共四處使用 `<span data-knowledge-version>…</span>`。`scripts/build-editor.cjs` 在建置時將版本做 HTML 跳脫後填入這些標記，再產生內嵌程式與 PWA 資產指紋；初始 HTML 與離線下載因此保有相同版本文字。新增遊戲知識版本標示時沿用此標記，避免另寫版本常數。

欄位圖鑑摘要由 `src/knowledge-ui.js` 讀取同一份內嵌知識的 `K.gameVersion`。摘要正確不代表其他標籤已同步：本次 V1.0.10.2 首次發布時曾出現摘要為新版、標籤仍為舊版，後由提交 `7adcb01` 修正。`tests/knowledge.test.cjs` 目前核對四個標記均等於內嵌的 `gameVersion`；新增或移除標示時，連同預期數量一起調整。`--check` 會重算產物，拒絕版本文字或 PWA 內容未同步的提交。

更新順序為核對來源與實測紀錄、重建 catalog、執行建置及測試，再提交 catalog、驗證紀錄與產生的 HTML／`sw.js`。版本標示只是呈現知識基準，開放寫入仍受完整來源指紋及 `verification.json` 限制。側欄的編輯器版本 `v2.1` 與 Mac runtime 相容版本各有用途，不隨此標記改寫。

## PWA 維護與驗收

Manifest 的 `start_url` 與 `scope` 使用 `./`，省略 `id`，由瀏覽器以完整 `start_url` 作為識別。`id` 的相對路徑以 origin 解析，不能用 `id: "./"` 表示專案子路徑。CSP 的 `manifest-src`／`worker-src` 僅開放同源，頁面維持 `connect-src 'none'`。

建置的白名單只有首頁、Manifest、favicon、192／512 PNG、maskable 圖示及 Apple touch icon；不包含存檔、Mac 指南、工具或外部連結。圖示沿用 `assets/favicon.svg`，maskable 版本將 320px 圖樣置於 512px 不透明背景中央，各邊留 96px。更換來源圖示時須同步更新 PNG，再重建編輯器。

快取名稱包含完整 scope 與內容 SHA-256。Worker 完整下載並核對每個資產指紋後才寫入；失敗保留舊版，不呼叫 `skipWaiting`／`clients.claim`，也不重新載入使用中的頁面。首頁的 `/` 與 `index.html`（含查詢參數）共用已核對內容，其他 URL 不套用首頁 fallback。啟用新版只刪除同 scope 的舊快取。狀態透過 MessageChannel 核對完整快取，連線恢復時可重建相同版本；伺服器若已換版，須先匯出並關閉所有視窗，讓新版啟用。

本機驗收以 HTTP localhost 提供整個目錄，另以 `/bandit-save-editor/` 子路徑確認資產及識別。測試獨立 profile，使用合成存檔，暫存下載、截圖及 profile 放 repo 外。完成後移除測試安裝的 App。

2026-10-21：macOS 的 Chrome **155.0.8059.85**，以獨立 profile、Playwright／CDP 及本機子路徑伺服器實測：

- Manifest 解析、完整 App 識別、瀏覽器安裝條件均通過；完成實際安裝、`standalone` 視窗及離線啟動，結束後已解除測試安裝。
- 關閉編輯器後斷網並停用測試伺服器，重新開啟首頁與 `index.html` 成功；Mac 指南離線失敗，沒有被首頁取代。
- 2501 × 60 × 22 合成存檔在桌面與 390px 版面完成資源修改、預覽還原、匯出、重新載入；匯出逐字等於指定 token 替換結果，大型整數 literal 保留。390px 無水平溢出。
- 另在斷網且停用測試伺服器時完成存檔比對、CSV 匯出、欄位設定匯入／匯出；Cache Storage 僅含 7 個公開資產，沒有 `.dat` 或設定檔。
- 從實際下載連結取得單檔 HTML，獨立放置後在斷網下以 `file://` 開啟，同樣完成上述資源流程；PWA 初始化略過。圖示、Manifest 缺檔不影響編輯功能。
- 清除本專案 Cache Storage 後重新連線，快取可重建。兩個帳房視窗開啟時新版保持 waiting，未匯出的值及頁面不變；關閉其中一個仍等待，全部關閉後啟用新版並清除舊快取。
- 線上首頁無頁面例外或 CSP 違規，canonical 與分享網址保持正式子路徑。正式站發布、Edge、Safari／iOS 的安裝與離線流程尚未實測。

`node --test tests/*.test.cjs` 包含 Worker 的失敗回復、錯版拒絕、快取範圍、清除邊界及內容變動後的建置同步檢查；這些測試不取代實際瀏覽器驗收。若執行後續 UI 調整，重跑受影響的瀏覽器流程並更新此紀錄。

## 職業圖鑑維護

`scripts/extract-game.cjs` 從 `zy.json` 產生職業的 `tier`（第 3 欄）、`family`（第 4 欄）及 `prerequisites`（第 10–12 欄的非零 ID）。`src/profession-ui.js` 由前置關係組合六階路線，職業名稱不另建翻譯副本。工作方向由社群附圖整理，另存 `knowledge/profession-guide.json`；空陣列表示原圖虛線且未標工作，缺少項目表示第六階未涵蓋，兩者均不表示遊戲禁止工作。轉職等級與解鎖條件的事件證據見研究筆記。

路線表的工作搜尋以最深的原圖職業為準，避免流民涵蓋九種工作的共用標籤讓每條路線都命中。職業清單則搜尋個別職業名稱、ID、類別、系別及工作。名稱索引與角色養成可跳到職業詳情；載入存檔後可選角色對照，所有查閱均唯讀。

2026-10-21：內建瀏覽器以 localhost 實測未載入存檔的 16 條路線／47 個職業、系別／名稱／工作搜尋、空結果與清除、第五／六階詳情、名稱索引及角色養成跳轉。合成存檔對照已習得職業 Lv 9、前置需求 Lv 10、操練上限 15／0，顯示等級不足、已解鎖及未解鎖；待匯出變更維持 0。390px 的頁面寬度維持 390px，750px 路線表僅在自身容器水平捲動，無頁面例外。修改搜尋後另關閉舊版測試分頁，確認新版搜尋「建造」為 1 條路線。直接開啟 `file://` 被內建瀏覽器 URL 政策拒絕，未繞過；本次職業圖鑑只完成離線相依性檢查，沒有新增直接開檔實測結論。

## 核心 API 與相容性

核心公開為 `SaveCore`。座標皆為零起算的 `{x, y, z}`，不是畫面上的角色／職業名稱。

| 介面 | 用途與限制 |
| --- | --- |
| `parse(text, name)`／`serialize(model)` | 保留原始文字；匯出僅替換修改的值 token，未修改的大型整數、空白、BOM 與指數寫法保持原樣 |
| `resolveField(model, coord)` | 回傳 `FieldDescriptor`：型別、用途、關聯、來源、驗證狀態及直接編輯權限 |
| `setField(model, coord, value)` | 寫入已確認且開放的欄位，檢查原型別、字串限制及數值範圍 |
| `set(model, coord, value)` | 保留既有介面；已知欄位轉入相同限制，未辨識的數值座標維持手動整數功能 |
| `addExperience(model, options)` | `kind` 為 `character`、`profession` 或 `skill`；另帶 `characterId`、`amount`，職業／技藝另帶 `id` |
| `editingInfo(model, kind, id)` | `kind` 為 `equipment`／`training`／`technology`；回傳目前值、一般／進階上限與各自驗證狀態，無效實體或忙碌進程會拒絕 |
| `setEquipmentLevel(model, {itemId, level, advanced})` | 只改有效一般裝備等級，檢查完整穿戴互指，排除寶物／內丹 |
| `setProfessionTrainingCap(model, {professionId, cap, advanced})` | 阻擋操練中；下限為所有角色已取得的該職業最高等級；不解除自然成長30級 |
| `setAdvancedTechnologyLevel(model, {technologyId, level, advanced})` | 限31–44；輸入存檔值（遊戲提示Lv加一）；阻擋研究中，檢查容量與計算範圍 |
| `transaction(model, fn, label)` | 同步批次交易；失敗還原全部變更，成功形成一筆復原紀錄 |
| `restore(model, coord)`／`undo(model)` | 前者還原指定變更，經驗則還原同一項的累計關聯修改；後者回到前一筆交易 |

等級與經驗餘額由 `addExperience` 一起結算，不能透過 `setField` 或自訂座標單獨寫入。直接增加經驗不扣取得成本，也不改共用池投入／退款基數。欄位設定仍沿用 `version: 1`、`game: 'szmnqea'` 與 `fields` 格式；設定格式相容不代表可以繞過已知欄位限制。

三項進階修改的 `advanced` 預設 false，一般／進階各有獨立驗證群組。公開值域由 catalog 的 `editingLimits` 與 verification 完全比對，目前上限1000、科技33另限299。自訂座標及舊 `set` 保持唯讀，只能使用具名操作；相同目標的累計修改整組還原。來源、公式及本輪實測見 [v2.1 研究](research/advanced-editing.md)。瀏覽器讀取存檔使用 `TextDecoder` 的 `ignoreBOM:true` 保留 BOM，避免 `File.text()` 消去原字元。

玩家名稱與其他存檔字串進入 HTML 時使用文字節點或 HTML 跳脫；序列化則使用 JSON 字串跳脫，兩者用途不同。預覽、比對及唯讀檢視也要保留這項處理。

## 重建知識與開放寫入

遊戲更新資訊以 [Steam 最新消息](https://store.steampowered.com/news/app/4267800)為入口，核對公告日期、版本及正式／測試／相容分支，並在研究筆記保留當次公告的永久連結。頁面無法取得正文時可用 [Steam 官方新聞 API](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4267800&count=5&maxlength=0&feeds=steam_community_announcements)。本機安裝版本另核對 `appmanifest_4267800.acf` 的 `buildid` 及來源指紋，包內個別版本文字可能落後；公告與靜態分析不能代替隔離遊戲讀寫驗證。

```sh
node scripts/extract-game.cjs --source /path/to/unpacked/game --audit /tmp/bandit-audit.json
```

解析器只建立 expression factory 索引，不執行遊戲。事件／runtime 指紋不在已核對清單時停止；資料表指紋不同時，重建目錄不保留原本的新增可寫旗標。相同完整指紋重跑才保留既有旗標。繁體轉換在 macOS 使用 Foundation，其他平台重用提交的對照表。

新版指紋未知時，先用純分析模式取得 repo 外的 audit：

```sh
node scripts/extract-game.cjs --source /path/to/unpacked/game --audit-only --audit /outside/repo/audit.json
```

此模式輸出 13 個來源指紋、統計及事件／讀寫索引，略過 catalog 產生器，不修改 catalog、繁中對照或驗證旗標。一般重建的指紋限制維持不變；原始 audit 的 repo 外路徑會在寫入知識前檢查。比對時以 SID 定位，expression 編號可能因其他事件增刪而移動。2026-10-21 的新版分析與 Windows 讀寫／重啟結果見 [V1.0.10.2 調查](research/v1.0.10.2-audit.md)。

新增可寫功能需完成以下流程：

1. 追查初始化、讀寫、計算與刪除，記錄欄位型別、值域、關聯及來源 SID；複雜或未釐清項目維持唯讀。
2. 用合成資料測試非法型別、跨級、上限、交易回滾、完整復原及精確 token 替換。
3. 以 `scripts/verify-game.cjs --help` 查看隔離驗證入口。此工具需要 Windows 或 macOS、Node.js 22+、解包的遊戲、同平台 NW.js runtime 及已登入的 Steam；來源須與 catalog 的全部 13 個指紋相符。Windows 傳入安裝目錄的 `game.exe`，工具會複製 runtime 至隔離遊戲目錄。用 `--catalog` 指定候選目錄、`--save-file` 指定唯讀來源存檔、`--artifacts` 指定已存在的 repo 外目錄；不能沿用不同 runtime 的驗證紀錄。
4. 確認遊戲載入、遊戲寫檔、停止測試程序後重啟讀回及來源存檔雜湊；測試只在獨立 app／遊戲／profile 中執行，保留授權初始化，Steam 寫入導向本機鏡像與紀錄。
5. 將去識別結果與相符指紋寫入 `verification.json`，再開啟對應群組。建置會核對全部來源指紋、檢查結果及群組覆蓋，未通過就停止。

v2.1 可使用 repo 外 `--scenario` JSON：`baseline` 為 `[x,y,z,value]` 陣列、`operations` 指定三項具名 API 的 `method`／`options`、`observe` 列出預期核對座標。工具只接受這三項操作，候選旗標僅存在隔離 VM；不直接修改公開 catalog。`--load` 等待主畫面，`--save`／`--assert` 確認布局就緒後執行；`scripts/verify-advanced.cjs --state /outside/state.json` 記錄原版屬性／加成，重啟後加 `--compare` 核對。原始 scenario、結果、SID 呼叫及玩家資料仍留在 repo 外。

完整解析輸出、遊戲內容、玩家存檔、測試 state 與原始 log 均留在 repo 外。`--setup` 產生的測試狀態包含本機路徑及玩家資料，不能作為公開驗證紀錄提交。

## 離線 HTML 人工驗收

目前已通過內嵌相依性與禁止連線檢查；隔離 Chrome 已通過上述直接開檔資源流程。名稱、三類經驗與設定的完整直接開檔流程仍依下列步驟驗證；完成前保留 [SDD 任務 6](../sdd/save-knowledge/tasks.md) 的未完成狀態。

1. 從網站下載單一 HTML，使用一般 Chrome／Edge 開啟本機檔案，確認無網路時可進入欄位圖鑑。
2. 選取合成 `.dat`，測試資源、名稱及三類經驗編輯，核對跨級後的等級與餘額。
3. 預覽連動欄位，連續增加同一項經驗後整組還原，再驗證「復原一步」。
4. 匯出修改副本，重新載入並比對；確認原檔保留、修改值正確、自訂設定可匯入／匯出。
5. 記錄瀏覽器／版本、測試日期與結果，再更新研究筆記及任務狀態。單檔 HTTP 下載成功或相依性檢查通過，不能代替這項實測。

## 提交與發布

推送 `main` 會執行 Pages workflow，先檢查來源同步及核心測試，再以白名單打包靜態檔案。確認對應提交的部署成功，核對正式首頁、離線下載內容及修改過的公開資產。網站異動另驗證桌面／手機流程、主控台錯誤、canonical、分享資訊與 sitemap；文件變更以連結、指令及描述與實作一致性為主。

正式驗收以本次提交的 SHA 找到相同 `headSha` 的 run，確認 build／deploy 都成功；HTTP 內容以 `git show SHA:PATH` 的原始 bytes 比對，避免 Windows checkout 行尾轉換造成誤判。接著用瀏覽器開啟正式欄位圖鑑，同時確認版本標籤與索引摘要。若 PWA 顯示「新版已備妥」，先匯出尚未保存的修改，再關閉所有同站帳房分頁與 App 視窗後重開；重新整理可能仍由舊 Worker 提供內容。保留可看見版本的截圖於 repo 外，HTTP 成功與瀏覽器結果分別記錄。

2026-10-21 的 V1.0.10.2 正式發布已驗證至提交 `7adcb01f9f0ddef749c1474850877df79ad78dd9`；對應部署、資產比對、畫面結果及驗收範圍集中於 [V1.0.10.2 正式發布紀錄](research/v1.0.10.2-audit.md#正式發布驗證)。後續版本以自己的提交重做核對。


v2.1 的桌面／390px、精確匯出及隔離遊戲結果見 [進階修改實測](research/advanced-editing.md#2026-10-21-windows-隔離實測)。本輪 `file://` 被工具政策阻擋，直接開檔驗收保持待辦；不可引用舊版資源測試當作三項新功能已實測。
