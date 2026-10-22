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

開發環境與程式測試優先順序見[程式化測試指引](testing.md)。來源改動後在repo根目錄執行：

```sh
node scripts/build-editor.cjs
npm run verify:release
```

第一個命令更新內嵌程式與 `sw.js`，保留 HTML 結構與樣式。修改來源後一併提交產生的 `index.html` 及 `sw.js`；只修改產生區塊會在下次建置時被覆蓋。使用者下載的單一 HTML 已內嵌執行程式與知識，不需 Node.js 或遊戲資料表。

## Repo 知識圖譜

查詢架構、程式與研究文件的跨檔關係時，先用本機既有的 `graphify-out/graph.json` 找到入口，再依來源位置核對目前程式及文件。來源異動後依需要增量更新；新增或修改文件、圖片也需語意萃取。建圖方式、Windows 注意事項與完整性診斷集中於 [Repo 知識圖譜](research/repository-graph.md)。

`graphify-out/` 是可重建的本機導覽產物，已由 Git 忽略，也不在 Pages 發布白名單內。遊戲公式與寫入驗證仍以研究筆記、catalog 及 verification 為依據；圖譜的連線、社群或摘要不會開放可寫群組。

## 知識版本標示同步

遊戲知識版本以 `knowledge/catalog.json` 的 `gameVersion` 為唯一來源。`index.html` 的側欄遊戲版本、職業圖鑑標籤、職業資料來源說明、欄位圖鑑標籤、使用說明與更新紀錄開頭，共六處使用 `<span data-knowledge-version>…</span>`。`scripts/build-editor.cjs` 在建置時將版本做 HTML 跳脫後填入這些標記，再產生內嵌程式與 PWA 資產指紋；初始 HTML 與離線下載因此保有相同版本文字。新增遊戲知識版本標示時沿用此標記，避免另寫版本常數。

欄位圖鑑摘要由 `src/knowledge-ui.js` 讀取同一份內嵌知識的 `K.gameVersion`。摘要正確不代表其他標籤已同步：本次 V1.0.10.2 首次發布時曾出現摘要為新版、標籤仍為舊版，後由提交 `7adcb01` 修正。`tests/knowledge.test.cjs` 目前核對六個標記均等於內嵌的 `gameVersion`；新增或移除標示時，連同預期數量一起調整。`--check` 會重算產物，拒絕版本文字或 PWA 內容未同步的提交。

更新順序為核對來源與實測紀錄、重建 catalog、執行建置及測試，再提交 catalog、驗證紀錄與產生的 HTML／`sw.js`。版本標示只是呈現知識基準，開放寫入仍受完整來源指紋及 `verification.json` 限制。側欄以醒目的「遊戲版本」顯示這個標記，讓玩家確認存檔對應的遊戲版本；其下的「修改器 v2.8」是工具發布版本，用於對照更新說明、回報問題與確認 PWA 已更新，和 Mac runtime 相容版本一樣不隨此標記改寫。手機版隱藏側欄底部，遊戲版本仍可在職業與欄位圖鑑標籤看到。

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
3. 以 `scripts/verify-game.cjs --help` 查看隔離驗證入口。此工具需要 Windows 或 macOS、Node.js 22+、解包的遊戲、同平台 NW.js runtime 及已登入的 Steam；來源須與 catalog 的完整15個指紋（13個基礎加yx／tz）相符。Windows 傳入安裝目錄的 `game.exe`，工具會複製 runtime 至隔離遊戲目錄。用 `--catalog` 指定候選目錄、`--save-file` 指定唯讀來源存檔、`--artifacts` 指定已存在的 repo 外目錄；不能沿用不同 runtime 的驗證紀錄。
4. 確認遊戲載入、遊戲寫檔、停止測試程序後重啟讀回及來源存檔雜湊；測試只在獨立 app／遊戲／profile 中執行，保留授權初始化，Steam 寫入導向本機鏡像與紀錄。
5. 將去識別結果與相符指紋寫入 `verification.json`，再開啟對應群組。建置會核對全部來源指紋、檢查結果及群組覆蓋，未通過就停止。
6. 在 `scripts/verification-requirements.cjs` 加入群組的證明區段與必要 checks，在 `scripts/verification-suite.cjs` 指定重驗家族與每個 check 的步驟，並在 `scripts/migration-scenarios.cjs` 補代表情境。漏加時建置與 `tests/version-migration.test.cjs` 會失敗，避免改版後無法重驗。

v2.1 可使用 repo 外 `--scenario` JSON：`baseline` 為 `[x,y,z,value]` 陣列、`operations` 指定三項具名 API 的 `method`／`options`、`observe` 列出預期核對座標。`verify-game.cjs` 的候選旗標只存在隔離 VM，不修改公開 catalog；只有版本遷移流水線在下節條件下寫回。`--load` 等待主畫面，`--save`／`--assert` 確認布局就緒後執行；`scripts/verify-advanced.cjs --state /outside/state.json` 記錄原版屬性／加成，重啟後加 `--compare` 核對。原始 scenario、結果、SID 呼叫及玩家資料仍留在 repo 外。

完整解析輸出、遊戲內容、玩家存檔、測試 state 與原始 log 均留在 repo 外。`--setup` 產生的測試狀態包含本機路徑及玩家資料，不能作為公開驗證紀錄提交。

## 版本遷移重驗

遊戲正式分支更新後，事件或資料表指紋一變，重建 catalog 就會關閉全部新增群組。`scripts/verify-migration.cjs` 以代表子集一次重驗全部群組，規格與決策見 [SDD](../sdd/archive/2026-10-22-version-migration/proposal.md)。

1. 依上節核對 Steam 公告、`appmanifest_4267800.acf` 的 buildid，並以 `--audit-only` 取得 repo 外 audit；依 SID 比對各群組依賴的事件，確認後把新指紋加入 `extract-game.cjs` 的已核對清單並重建 catalog。
2. macOS 先確認 `launcher/prepare-macos.py` 的四處路徑修正位置仍在，把新腳本雜湊加入 `SCRIPT_SHA256`，再以 `--output` 準備獨立的驗證副本，不覆寫玩家的 `~/bandit-mac-port`。補丁後的 `c3runtime.js` 雜湊必然不同於 catalog；`verify-game.cjs` 只在 `--package` 指向原始安裝、且 `prepare-macos.py --verify-runtime` 證明差異只來自已核對替換時才接受。
3. 開啟並登入 Mac 版 Steam，執行流水線。Mac 的遊戲資料夾以 `cp -c` 建立 APFS clone，未修改的資源不另佔空間（`fs.cpSync` 即使指定 `COPYFILE_FICLONE` 仍會完整複製）；同一 artifacts 目錄的副本共用一份測試 App，來源 runtime 改變時才重建。通過的副本只保留 state、log 與證據 JSON，整輪完成後再刪共用 App；失敗的副本完整保留以便除錯，加 `--keep-copies` 可全部保留。一次完整排練約留下數 MB。Mac 副本不會佔用畫面：`package.json` 隱藏視窗並保留背景計時，測試 App 以固定 bundle ID 與 `LSBackgroundOnly` 執行，不出現在 Dock、不搶焦點，區域網路權限最多只詢問一次；`LSUIElement` 會讓 NW.js 載入 ICU 失敗而無法啟動，不能替代。遊戲找不到 `sys\sys.dat` 時預設全螢幕且有聲音，setup 會寫入不全螢幕、靜音的設定（Mac 路徑補丁不處理這個分隔符，檔名就是含反斜線的 `sys\sys.dat`）。

```sh
node scripts/verify-migration.cjs --source PREPARED_COPY/game --runtime PREPARED_COPY/runtime/nwjs-sdk-v0.82.0-osx-arm64/nwjs.app/Contents/MacOS/nwjs --save-file PREPARED_COPY/game/savedir/ea1save.dat --artifacts /outside/repo/artifacts --package STEAM_LIBRARY/steamapps/common/塔防山贼模拟器
```

生成器目前依基準存檔建立 15 個副本：成長、v2.1 一般上界／超限／後續操作、v2.2、v2.3 替換、v2.4 背包與選槽、品質四個庫別方向，以及一般隨機角色基礎資質與技藝上限各兩個代表／生命週期副本。每個副本依序執行原版載入、原生效果、原生存檔、新 PID 重啟讀回；標記的副本再跑後續原生操作並做第二輪讀寫重啟，品質副本另跑 6,592 組公式比對。基準存檔需有已放置的書院與校場、閒置的草席與木桩，以及第二名角色；尚未完成初建的等級 0 建築只在拋棄式副本設為等級 1。後續副本把第二名角色設為流民 4 級、差 1 點升級，原生自然經驗呼叫一次必須升到 5 級，再轉職為村民；`获得职业经验` 忽略「獲得量」參數，每次只給約十個工作間隔的經驗，不要用大量迴圈補足。

結果寫在 repo 外的 `results.json`，寫回規則如下：

- 全部副本完成、24 群組的原生 checks 都成立，且指紋與現有證明不同時，自動寫入 `knowledge/verification.json` 與 catalog 閘門，重建 HTML 並執行 `--check`。建置失敗會還原 catalog、證明、HTML 與 `sw.js`。不會自動提交或推送。
- 指紋與現有證明相同時只輸出比較報告，不以代表子集覆寫原本的完整矩陣證明。
- 任一步失敗或原生 checks 未全過時不寫入；報告列出失敗的副本、步驟與錯誤。

新版證明標示 `coverage: "representative"` 與各副本操作數，不沿用舊版案例數。首次選槽與品質升降的 UI check 只在 `verification-requirements.cjs` 宣告的 UI 事件摘要不變時沿用（`uiEvidence.source: "carried"`）；摘要不同就以關閉狀態寫入，再依 [UI 手冊](game-ui-testing.md#版本遷移後的-ui-補測)補最小案例。摘要只涵蓋宣告的事件，被呼叫但未列入的函式不在保證內。

## 離線 HTML 人工驗收

目前已通過內嵌相依性與禁止連線檢查；隔離 Chrome 已通過上述直接開檔資源流程。名稱、三類經驗與設定的完整直接開檔流程仍依下列步驟驗證；完成前保留 [SDD 任務 6](../sdd/save-knowledge/tasks.md) 的未完成狀態。

1. 從網站下載單一 HTML，使用一般 Chrome／Edge 開啟本機檔案，確認無網路時可進入欄位圖鑑。
2. 選取合成 `.dat`，測試資源、名稱及三類經驗編輯，核對跨級後的等級與餘額。
3. 預覽連動欄位，連續增加同一項經驗後整組還原，再驗證「復原一步」。
4. 匯出修改副本，重新載入並比對；確認原檔保留、修改值正確、自訂設定可匯入／匯出。
5. 記錄瀏覽器／版本、測試日期與結果，再更新研究筆記及任務狀態。單檔 HTTP 下載成功或相依性檢查通過，不能代替這項實測。

## 提交與發布

發布新版修改器時，同步更新側欄的「修改器 vX.Y · 日期」與 `index.html` 的「更新紀錄」對話框：在最上方加一筆，寫發布日期、對應遊戲版本，以及玩家看得懂的新增功能與限制。側欄版本文字與「更新紀錄」按鈕都會開啟這個對話框；`tests/changelog.test.cjs` 會核對第一筆與側欄版本、日期一致。手機版隱藏側欄底部，v2.6在主內容上方提供使用說明／更新紀錄入口，未載入存檔也能開啟；頁尾保留復原一步。

推送 `main` 會執行 Pages workflow，先檢查來源同步、全部Node與headless整合測試，再以白名單打包靜態檔案。確認對應提交的部署成功，核對正式首頁、離線下載內容及修改過的公開資產。網站異動另驗證桌面／手機流程、主控台錯誤、canonical、分享資訊與 sitemap；文件變更以連結、指令及描述與實作一致性為主。

正式驗收以本次提交的 SHA 找到相同 `headSha` 的 run，確認 build／deploy 都成功；HTTP 內容以 `git show SHA:PATH` 的原始 bytes 比對，避免 Windows checkout 行尾轉換造成誤判。需要正式DOM證據時，以獨立headless context開啟正式欄位圖鑑，同時確認版本標籤與索引摘要；例行PWA交接由暫存建置測試，使用者特定快取問題才採以下人工流程。若 PWA 顯示「新版已備妥」，先匯出尚未保存的修改，再關閉所有同站帳房分頁與 App 視窗後重開；重新整理可能仍由舊 Worker 提供內容。保留可看見版本的截圖於 repo 外，HTTP 成功與瀏覽器結果分別記錄。

2026-10-21 的 V1.0.10.2 正式發布已驗證至提交 `7adcb01f9f0ddef749c1474850877df79ad78dd9`；對應部署、資產比對、畫面結果及驗收範圍集中於 [V1.0.10.2 正式發布紀錄](research/v1.0.10.2-audit.md#正式發布驗證)。後續版本以自己的提交重做核對。


v2.1 的桌面／390px、精確匯出及隔離遊戲結果見 [進階修改實測](research/advanced-editing.md#2026-10-21-windows-隔離實測)。本輪 `file://` 被工具政策阻擋，直接開檔驗收保持待辦；不可引用舊版資源測試當作三項新功能已實測。

2026-10-21 v2.1 已於提交 `d98db49` 發布，正式 v2.1／V1.0.10.2、資產 Git blob 比對、PWA waiting→關閉重開與斷網編輯／精確匯出皆通過，詳細見 [正式發布紀錄](research/advanced-editing.md#v21-正式發布驗證)。JavaScript 與 Manifest 以 `.gitattributes` 固定 LF；提交前可用 Git blob 隔離副本檢查，避免 Windows 行尾改變已釘選的 PWA 雜湊。

## 第二批研究入口

裝備品質、詞條與丹藥資質增量的來源、候選範圍、限制及隔離遊戲驗證矩陣集中於[第二批研究](research/advanced-editing-batch2.md)，工作狀態見[提案與任務](../sdd/advanced-editing-batch2/tasks.md)。v2.2 已開放通過獨立隔離實測的既有詞條係數及丹藥增量；v2.2 的品質、詞條 ID 與超限維持唯讀；v2.3 的詞條替換另依獨立證明開放，不沿用 v2.1 裝備等級的證明或進階值域。所用新資料表須先納入來源覆蓋，品質／詞條的整件裝備交易與復原也須另驗證。

PWA 雜湊異常時，先比較實際 HTTP 回應與提交的 Git blob。本機 AdGuard 曾改寫首頁並注入 CSP／腳本，Worker 因內容不符而拒絕快取是預期行為；不要放寬 CSP 或略過指紋比對。BOM 保留則須在瀏覽器讀檔入口驗收，除了核心序列化測試，也要逐字核對真正下載的匯出檔。

## v2.2 核心與驗證入口

- `affixInfo(model,itemId,slot)`／`setEquipmentAffixCoefficient(model,{itemId,slot,coefficient})`：z9、已選洗練槽，1-based槽號，最多兩位小數。只改係數；與同件裝備等級共用還原群組，已修改係數時禁止再設超限等級。
- `pillInfo(model,characterId,aptitude,pillId)`／`setPillAptitudeBonus(model,{characterId,aptitude,pillId,bonus})`：aptitude1–3為力量／敏捷／智力，bonus為非負整數累積值，每1代表0.1點。pillId必須已持有且類型相符，作為上限依據，不扣材料。兩API的advanced只接受false。
- 範本0的隨機角色以存檔基礎及天賦為準；有名角色才要求js範本一致。完整穿戴及無結丹引用需重新檢查；既有小數增量先維持唯讀。細節與SID集中在第二批研究，不複製至技能。
- 生成器增加 `batch2Data`／`batch2Limits`／`batch2Fingerprints`。保留歷史13來源，第二批另涵蓋yx與tz；建置核對補充指紋、限制及資料SHA-256。擴充來源不能只更新catalog而沿用舊證明。
- `scripts/verify-game.cjs --scenario` 現在接受兩個新增具名操作；仍只在隔離VM啟用候選旗標，啟動前與assert核對13+2來源。`node scripts/verify-batch2.cjs --state /outside/state.json` 記錄原版三項資質及115項裝備效果，重啟後加 `--compare`。原生卸穿、洗練、服藥與重生另記後續證據；裝備格取wp資料，不可假設1。

重生呼叫僅驗證清除生命週期，不代替遊戲UI資格驗收；原生服藥可能產生小數增量，其後編輯停用是本版限制。來源檔、真實存檔與原始呼叫結果保持repo外。詳細已通過範圍及UI待辦見[第二批實作紀錄](research/advanced-editing-batch2.md#v22-實作與隔離驗證)。

## v2.3 精準洗練維護

- `equipmentAffixReplacementInfo(model,{itemId,slot})` 回傳範本合法池、目前值、限制、逐候選可用狀態及停用原因。
- `previewEquipmentAffixReplacement(model,{itemId,slot,attributeId,coefficient})` 唯讀驗證並預覽單件效果，含主屬性與其他槽對同一 ID 的貢獻；不推算角色面板。
- `setEquipmentAffix(model,{itemId,slot,attributeId,coefficient,advanced=false})` 重跑完整檢查，原子修改 ID 與係數。與等級及既有係數共用整件還原群組；拒絕超限、新重複、非唯一選槽及不一致穿戴。自訂座標仍不可改這些欄位。
- `affixReplacement` 儲存公式來源 SID、參數及單位；`affixReplacementLimits` 儲存範圍。`equipmentAffixReplacement` 是獨立驗證群組，建置核對 13+2 來源、限制及 `SHA256(JSON.stringify({rules:catalog.affixReplacement,items:catalog.batch2Data.items}))`。不得沿用係數群組的證明。
- z9 y0 是初始背包列號，原生搬移保留它，可與目前列號不同、也可能重複。有效性檢查使用正值且在陣列界內，加上範本、品質、選槽與穿戴雙向指標；不要回復錯誤的 y0 等於當前列限制，也不可自動重編 y0。
- `scripts/verify-game.cjs --scenario` 接受 `setEquipmentAffix`。`node scripts/verify-affixes.cjs --state /outside/state.json --scenario /outside/scenario.json` 比對原生單件效果及隔離角色裝備效果；重啟後使用 `--compare`。`node scripts/verify-affix-lifecycle.cjs --state /outside/state.json --scenario /outside/scenario.json` 驗證卸穿與同槽洗練，更新隔離 state 的後續預期，再完成原版存檔／停止／新程序讀回。只對 repo 外副本操作。

副詞條在原生公式內強制 L=0，主屬性保留等級；各槽分別取整再加總。主屬性重疊時 y8 須為原版區間安全整數。詳細公式、SID、380 組原生比對與後續 76 次洗練以[研究記錄](research/precise-affix-editing.md)為準。不得以原生函式回傳值宣稱角色 UI 即時快取也已驗收。

v2.3 已以功能提交 `a912466` 通過 [Pages 正式發布驗證](research/precise-affix-editing.md#v23-正式發布驗證)：50 項測試、Git index bytes 建置檢查、正式資產比對及 PWA 關閉重開／斷網兩入口匯出／讀回。直接 file:// 新功能保持待人工驗收；後續版本仍須核對自己的完整 SHA。

## Computer use 操作與確認框

遊戲驗證以合成測試、隔離原生函式、原版存檔與新程序重啟讀回為主；來源核對與寫入閘門要求不變。只有顯示／快取異常、選單或按鈕資格、輸入／視窗問題，或使用者明確要求時，才補做相關遊戲 UI 測試，不預設補齊全套操作路徑與截圖。詳細範圍與按需流程見[操作手冊](game-ui-testing.md)。編輯器網頁／PWA的互動驗收依變更優先由Node UI及獨立headless執行，依[程式化測試指引](testing.md)決定是否補computer use；遊戲原生函式證據不取代網頁驗收。已匯出後換檔的誤提示修正為與離頁相同的 revision 判斷；下載原檔備份不解除未匯出保護。不要把模態確認框造成的選檔逾時直接歸因於工具故障。

隔離驗證啟動器固定帶 `--mute-audio`，新建及重啟皆靜音；不動玩家音量、其他遊戲或 Discord。手動啟動副本也遵守此預設，只有使用者明確要求音訊驗收時才安排有聲測試，詳見[測試音量](game-ui-testing.md#測試音量)。

## v2.4 裝備操作

裝備具名操作的options增加`plane=9`；`editingInfo(model,kind,id,plane=9)`及`affixInfo(model,itemId,slot,plane=9)`於最後傳庫別。只接受7／9；省略保持z9相容。背包沒有進階模式，新增的普通範圍與新取得標記規則有獨立證明。

候選資訊增加`selectedSlot`、`selectableSlots`與`requiresInitialSelection`；預覽／套用增加`selectUnwashedSlot=false`，預覽回傳`selectionChange`。未選槽須明確true，已選槽再傳true拒絕。群組`editing:equipment:庫別:列號`避免同列號不同庫互相還原。旗標、詞條、係數為同一交易；首次純鎖槽不是無變更。

`knowledge/verification.json`的equipmentWorkflow核對完整15來源、規則與資料雜湊及逐群組checks；初次選槽另要求selectionUi=true。生成器來源或規則變動會撤銷新群組旗標。不要因原生矩陣通過手動打開欠缺UI證據的首次選槽。

`node scripts/verify-affixes.cjs --state /outside/state.json --scenario /outside/scenario.json`現在依options.plane讀取目標，z9才做穿戴公式比對。`node scripts/verify-equipment-workflow.cjs --state /outside/state.json --scenario /outside/scenario.json`驗證原生洗練、穿脫及排序並更新後續expected；再完成原版save／assert／stop／restart／load／assert後用`--compare`核對。原始狀態留repo外。

本版實際已通過範圍及發布狀態以[研究紀錄](research/equipment-workflow.md)及SDD任務為準。2026-10-22補齊遊戲選槽UI、桌面／390px、精確下載及PWA離線／版本交接證據；首次選槽的負向建置測試須明確將`selectionUi`設為false，不能依賴證明當時尚未通過的預設值。PWA受內容過濾器改寫時保留完整性檢查；使用者同意的測試網址例外須記錄範圍與測後還原或保留決定，不將例外當成網站安裝必要條件。更新交接先保留舊版未匯出變更，確認新版waiting不重載，再匯出、關閉全部同源視窗並重開核對版本；離線模擬完成後還原網路。

## v2.5 品質升降維護

`equipmentQualityInfo(model,{itemId,plane=9})`回傳完整普通裝備檢查、目前結構、六個目標的阻擋原因與驗證狀態。`previewEquipmentQualityChange(model,{itemId,plane=9,quality,addedAffixes=[]})`唯讀回傳欄位、增刪槽及54項單件效果。新增槽為`{slot,attributeId,coefficient}`；目標升品須完整連續尾槽。`setEquipmentQuality`接受相同參數及`confirmRemovedAffixes=false,advanced=false`，重跑所有檢查，降品須明確確認，與其他裝備操作共用`editing:equipment:庫別:列號`原子還原群組。自訂座標維持唯讀。

`scripts/equipment-quality-data.cjs`由原版資料建立243範本、主屬性設定、單位、公式與規則，與舊batch2資料分開。四個庫別／方向群組各需自己的load、save、restart、originalHashes、nativeEffects、lifecycle、qualityUi。建置核對完整15來源及`SHA256(JSON.stringify({quality:catalog.equipmentQuality,items:catalog.batch2Data.items,workflow:catalog.equipmentWorkflowLimits}))`，另核對核心`qualityAttributeEffect`函式原文（CRLF轉LF）的公式SHA-256。來源／規則／公式變動使證明失效，不複製v2.4旗標。

以下產生repo外合成候選，不接觸玩家原檔：

```sh
node scripts/prepare-quality-cases.cjs --output /existing/external/directory
node scripts/verify-game.cjs --setup --source /unpacked/game --runtime /installed/game.exe --save-file /original.dat --artifacts /external/directory --scenario /external/quality-7-Upgrade.json
node scripts/verify-game.cjs --state /external/state.json --load --mode 云存档
node scripts/verify-quality.cjs --state /external/state.json --scenario /external/quality-7-Upgrade.json
node scripts/verify-quality.cjs --state /external/state.json --scenario /external/quality-7-Upgrade.json --formulas
```

各庫／方向分開建立隔離副本，先完成原版save／assert／stop／restart／load（mode存档）／assert，再用`verify-quality --compare`比對。`verify-quality-lifecycle.cjs --state ... --scenario ...`執行原生洗練、精確成本、穿脫搬移／排序並建立經獨立核對的後續expected；再次完成原版IO與新PID，最後加`--compare`讀回。大型觀察陣列可使用`verify-game --quiet`保留PASS與錯誤而不輸出全陣列。原生`装备库取出`第三參數從0開始，否則漏搬y0。

公式測試涵蓋243範本及38候選，不把「可計算」當作「已原生比對」。完整6,592組、800件品質寫入、後續行為及代表UI證據見[品質研究](research/equipment-quality.md)，工具原始產物留repo外。UI操作後先核對只有允許的洗練變更與y24提示副作用，才採納後續IO基準。桌面、390px、兩入口下載及PWA離線／等待交接另驗收，直接file://維持獨立狀態。

正式v2.5已經PR #2合併及相符SHA Pages部署、Git blob資產比對與Edge版本／離線驗證。IAB遇到關閉後仍waiting時，先核對所有已知同源分頁與快取雜湊，保留實際差異；本次改用既有v2.4的Edge正常關閉重開完成交接，沒有清快取或強制啟用。不同瀏覽器的結果分別記錄，避免把一個環境成功寫成全部成功。Edge選檔若欠缺擴充檔案權限，保留限制，不為例行驗收變更權限；可用相符建置的已授權測試環境完成檔案流程，正式畫面仍獨立核對。

## v2.6 批次操作維護

`src/batch-ui.js`由`src/ui.js`的批次標記內嵌，新增來源時同步`build-editor.cjs`，勿直接改產物內嵌程式。`previewBatch(model, request, options)`／`applyBatch(model, request, options)`皆回傳Promise；request僅接受下列固定種類：

| kind | 參數 |
| --- | --- |
| characterExperience | characterIds（不重複ID陣列）、amount（正整數） |
| professionExperience | characterId、amount（正數，最多一位小數）；自動展開全部已習得職業 |
| skillExperience | characterId、amount（正整數）；固定展開九項技藝 |
| equipmentMax | plane（7或9）、includeEquipped（預設false）；只納入普通裝備 |
| technologyLevel | level（一般模式存檔值）；固定展開31–44 |

options可帶`signal`取消與`onProgress({done,total})`；套用可帶`preview`，核心會核對該預覽的模型及request快照，過期即拒絕。回傳`summary`含targets、changed、unchanged、excluded、blocked、changedCells，`rows`包含名稱、狀態、前後值／座標與原因，`canApply`表示有變更且全數合格。預覽不是可繞過驗證的寫入清單，套用仍重新呼叫具名API。

私有模型共用原始文字與陣列，只複製變更集合，約12ms讓出畫面；正式模型不跨await開啟同步交易。失敗／取消不動正式變更或歷史，成功只提交一筆；全批無變更不新增歷史。還原保留既有經驗／整件裝備累計群組，復原一步撤回整批。不可增加通用方法名稱、任意座標或略過失敗的路徑。

批次及全域預覽每頁最多50筆；單角色選單最多50個候選，超過以名稱／#ID搜尋，角色勾選跨頁保留。完整尺寸測試分別記錄Node VM耗時、事件迴圈回應、取消及精確匯出；瀏覽器另外核對DOM數量、桌面／390px操作與實際下載，不把同步核心速度當成手機效能承諾。

不新增驗證群組，22個既有群組繼續由三份驗證需求／清單／遷移情境共同覆蓋；批次測試另外確認各既有閘門不能繞過。未來若擴充寫入語意或值域，須重新判斷獨立群組並走開放寫入及版本遷移流程。

隔離冒煙沿用`verify-game.cjs --setup`，加`--batch-requests /outside/repo/requests.json`（1–20筆固定request的JSON陣列），先套用既有scenario，再逐批預覽／套用，將各批次結果與所有聯動座標併入state觀察。其餘載入、原生存檔、assert、停止、新PID重啟、讀回及assert照舊；不寫回catalog或verification。Mac必須先開啟並登入原生Steam，使用相符15指紋及已核對路徑補丁、副本背景隱藏／非全螢幕／靜音。原始request、scenario、state及log留repo外。

2026-10-22：V1.0.10.2隔離副本五種批次均通過，批次聯動55個欄位，併入既有scenario共觀察120個欄位；原生存檔與新PID讀回兩輪assert通過，15來源及原檔雜湊未變，測試程序已停止。完整尺寸與瀏覽器證據見[SDD驗收紀錄](../sdd/batch-editing/tasks.md)。本輪沒有新增遊戲UI、直接file開檔或正式部署驗收。


## v2.7 一般隨機角色基礎資質

來源與數值規則見[研究](research/random-character-growth.md)，驗收狀態見[SDD](../sdd/random-character-growth/tasks.md)。範本0、已招募、非在監、y50與z16階段紀錄全零，且完整資質來源可核對才開放；小數丹藥增量停用。有名角色載入依範本回填，不能用此功能或runtime補丁混處理。

`randomCharacterGrowthInfo(model,{characterId})`回資格／原因及三項來源；`previewCharacterBaseAptitudes(model,{characterId,baseRaw})`接受三項原始安全整數，回canApply、差異、前後A／B／總值／C及原因；`setCharacterBaseAptitudes`重跑相同檢查、原子寫三欄。一般模式要求同品質任一原生傾向可生成，三欄不能獨立套範圍。預覽及套用不接受任意方法／座標或超限；自訂座標維持唯讀。

資質與丹藥具名操作共用`aptitude:角色ID`六欄累計還原群組，包括有名角色既有丹藥操作的三欄還原；寫入值域維持原限制。復原一步仍按交易，失敗不留下變更。下調資質使現有B超出新C就阻擋，不默改B或依目前持有丹藥猜測歷史來源。

生成器`random-character-growth-data.cjs`核對招募SID與公式後建立`catalog.randomCharacterGrowth`；來源／規則／資質資料變動關閉新旗標。`randomCharacterBaseAptitudes`有獨立section、family、代表情境與逐項checks，建置核對15來源、規則及天賦／裝備必要資料SHA、核心資質／穿戴檢查計算區段SHA。新增欄位仍由三份驗證需求／清單／遷移情境及版本遷移測試共同覆蓋，v2.7共23個已開放群組；v2.8 A另增1個候選群組，B取得完整獨立證明後合併為第24個。

初次驗證用`verify-random-character-suite.cjs`，參數沿用`--source`、`--runtime`、`--save-file`、`--artifacts`與Mac的`--package`；未帶`--record`只驗證，全部成功後帶此參數才合併新section與旗標，保留原有22群組完整證明。`verify-random-character-growth.cjs`比對原生A／B／C；`verify-random-character-lifecycle.cjs`每階段原生存檔、停止、新PID讀回，另有`--compare`重查最後結果。新群組首次完整矩陣24角色及2角色生命週期；未來版本遷移採Q1／Q6代表子集，同指紋仍只比較。

2026-10-22本機Mac實測已完成24角色六品質／升降／天賦加成、原版IO及新PID讀回；生命週期另涵蓋數值更新、三項服藥、單次自然經驗達轉職門檻、下獄／召回、重生及解雇，各階段皆再次存讀。15來源與原始存檔雜湊未變，自己的程序已停止，副本背景隱藏／靜音／非全螢幕。沒有新增遊戲UI或真實Cloud／成就驗證。

桌面、390px、PWA斷網及一般Edge直接file開啟獨立HTML均已用2501×60×22合成檔完成新功能編輯、預覽及實際下載，逐字符合獨立token預期；桌面、390px與Edge file流程另完成群組還原及復原。直接file結果只涵蓋本版新功能，不代替`sdd/save-knowledge`其他歷史待辦；網路模擬與viewport測後恢復。2026-10-22依使用者授權，與v2.6一併以`5d5c55b`推送並完成[Pages正式發布驗證](research/random-character-growth.md#v27-正式發布驗證)；兩案SDD均保留原位置。

## v2.8 A 交付紀錄：技藝上限核心，當時尚未開放

詳見[研究與A／B界線](research/random-character-skill-caps.md)及[SDD任務](../sdd/random-character-skill-caps/tasks.md)。`randomCharacterSkillCapsInfo(model,{characterId})`查資格；`previewCharacterSkillCaps(model,{characterId,caps})`接受九個安全整數，回九列C／L／E、共同生成見證及差異；`setCharacterSkillCaps(model,request,{preview})`要求同模型、同請求且未過期的核心預覽，重驗後一次提交。同值不新增歷史；降低到有餘額的目前等級時阻擋。預覽物件的changes不具執行權限。

第一次有效cap調整後，該角色全部技藝cap／L／E累計一起還原；之前及之後的單項／九項經驗都納入。`restoreAll(model)`清除差異及私有群組模式；勿再直接clear changes來實作還原全部。undo回上一筆交易，含群組模式。已知z2 y22–48在未啟用列也維持唯讀，舊set／自訂座標不能繞過。

A交付時，生成器新增`random-character-skill-caps-data.cjs`，獨立群組`randomCharacterSkillCaps`保持false；沒有randomCharacterTalents寫入群組。proof綁15來源、最小規則／天賦選取資料及整份未嵌入知識的core摘要。當時原生family帶pendingReason，oracle／lifecycle與初次merge入口明確拒絕；既有23組證明保持原檔，包含候選群組的全套遷移無法完成。這是歷史狀態；B的實作及首次驗收見下節與[B任務](../sdd/random-character-skill-caps-b/tasks.md)。同指紋遷移仍只比較。

## v2.8 B：介面與首次獨立證明

此節接續上節A交付歷史，實際完成狀態見[B任務](../sdd/random-character-skill-caps-b/tasks.md)及[研究紀錄](research/random-character-skill-caps.md)。角色養成新增九上限輸入與完整九列C/L/E預覽，輸入／角色／模型變化使舊預覽失效；套用必須帶核心產生的原始preview，不能用自建changes執行。角色、批次及變更列表顯示27欄累計還原範圍，其他角色保留原分組。

首次開放入口：

```sh
node scripts/verify-skill-caps-suite.cjs --source PREPARED_GAME --runtime NWJS --save-file BASE.dat --artifacts OUTSIDE_REPO --package STEAM_GAME_DIR
```

Mac沿用已核對的準備副本，`--package`指向原始安裝目錄。未帶`--record`只產生repo外結果；完成完整驗收後才以同一入口的`--record`寫入，或由維護程式將本次實際`results.json`傳給匯出的`recordProof`，它會重新驗證完整結果與目前來源／資料／core摘要。正式CLI與匯出的合併介面都不能接受只有全true的checks。

首次矩陣108角色覆蓋六品質、九主位置、升降方向與不同次位置；另有兩角色生命週期副本、招募與有名回填對照。矩陣後九技藝批次與後續原生經驗、剛達cap／已封頂／提高後原生成長分開驗證。有效階段各自原版存檔、停止及新PID讀回，來源／原檔hash與階段PID／存檔SHA鏈必須相符。公開proof保留manifest／證據摘要，不提交原始report或玩家資料。

`random-character-skill-caps-proof.cjs`綁15來源、最小規則／天賦選取資料及整份未嵌入知識的core。修改共享核心後須重驗此群組；既有群組維持各自摘要及證明，不改hash冒充重驗。首次合併只加本群組及section，四產物寫入／建置／check任一步失敗會完整回滾。代表遷移維持Q1／Q6矩陣及兩角色生命週期，同指紋只比較（忽略fingerprint物件key排序）；沒有完整初次證明不能藉遷移第一次開放。天賦編輯仍另案。

新UI有Node事件與HTTP桌面／390px、file、PWA三種環境案例。閘門關閉時headless成功只代表預覽與停用；正式開放後須重新跑成功套用、交錯經驗、27欄還原／復原及實際下載重載。詳細流程及輸出在[測試指引](testing.md)。

2026-10-22 B首次完成108＋2完整隔離矩陣及13階段，正式合併為第24群組；該次來源為V1.0.10.2／build26094666。既有23群組紀錄完整保留，核心未更動；詳細實測與發布分層結果見[研究紀錄](research/random-character-skill-caps.md)及[B任務](../sdd/random-character-skill-caps-b/tasks.md)。其後更新至V1.0.11.2／build26126719，已完成15個Windows隔離副本、24群組代表遷移與必要UI補測，並保留首次完整矩陣證明；新版差異、測試工具收尾修正與發布範圍見[新版調查](research/v1.0.11.2-audit.md)。Windows遇到通過副本清理的檔案鎖時，可沿用`--keep-copies`保留診斷，等自己的程序完全退出後再清理repo外副本。
