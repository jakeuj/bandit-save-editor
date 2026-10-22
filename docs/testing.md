# 程式化測試與按需人工驗收

遊戲與編輯器都優先使用可重複的程式驗證。日常修改先跑相關 Node，再跑需要的獨立 headless。日常推送採快速流程：只檢查建置同步、提交及推送，不重跑全套 Node／瀏覽器／遊戲測試。Pages CI 只檢查建置同步並發布；完整驗收保留 `npm run verify:release`，使用者要求或具體故障需要時才執行。純技能、文件或忽略規則更新，推送成功即結束，回報提交連結；即使自動觸發 Pages，也不查詢或等待部署。只有影響網站產物、發布設定，或使用者明確要求時，才追蹤對應 SHA 的部署結果並回報部署連結；明確要求確認線上版本時，才額外 GET 首頁。失敗才讀詳細日誌及擴大檢查。例行遊戲遷移依[維護指引](maintenance.md#版本遷移重驗)選跑，computer use 為零；原生視窗或實際 UI 故障先查程式證據，使用者明確要求才操作遊戲桌面。自動測試失敗先讀摘要／trace，不自動改用使用者瀏覽器重走流程。

## 安裝與入口

開發使用Node.js 22以上；CI固定Node 24。網站使用者仍只需HTML。第一次或鎖定依賴更新後：

```sh
npm ci --ignore-scripts
npx playwright install --only-shell chromium
```

Linux CI另加`--with-deps`安裝系統函式庫。Playwright版本由package與lockfile共同釘選，瀏覽器由對應版本管理；不使用系統Edge／Chrome或個人profile。

| 入口 | 適用範圍 |
| --- | --- |
| `npm run test:ui` | 快速UI事件、實際Blob bytes、匯出revision及既有裝備介面／更新紀錄 |
| `npm test` | 全部Node測試，含公式、資格、交易、精確token、完整尺寸與驗證閘門 |
| `npm run test:browser` | 建置同步預檢＋全部獨立headless整合案例 |
| `npm run verify:knowledge` | 純遊戲知識更新的本機檢查：建置同步＋生成／知識／選跑／快取測試；受影響功能另補相關 Node |
| `npm run verify:release` | 建置同步＋全部Node＋全部headless；按需手動使用 |

來源異動先執行`node scripts/build-editor.cjs`；驗證入口只檢查同步，不自動修改發布產物。日常可加Playwright篩選，例如`npm run test:browser -- --grep 'HTTP 390px'`。排版異動使用`npm run test:browser -- --visual --grep 'base aptitude'`產生兩種寬度的完整頁面截圖，再按需要檢視。

## 證據分工

- 核心及Node UI事件：共用合成資料與獨立token renderer，不由待測serialize或changes反推預期。UI harness實際執行src處理函式，捕捉Blob的arrayBuffer，逐byte核對BOM、空白、指數、大型整數literal、MIME與檔名。這層不宣稱真實DOM排版或瀏覽器下載已驗收。
- HTTP headless：在127.0.0.1隨機port只提供發布用HTML／PWA資產，測試真正建置HTML與DOM控制項。桌面／390px各有完整尺寸基礎資質及批次代表案例，核對搜尋、分頁、套用、還原／復原、下載及重載。基礎資質覆蓋有名／在監停用、非法組合與預覽過期；批次跨頁選51名，以50筆分頁並檢查一次復原整批。
- file headless：直接導覽暫存HTML的file URL，完成完整尺寸預覽、下載及重載，確認PWA入口隱藏。這是直接開檔的Chromium網頁流程，沒有操作macOS／Windows原生選檔對話框。
- PWA headless：分別檢查斷網後首頁與index.html仍能編輯／下載，與新建置waiting→保留未匯出修改→匯出→關閉同源頁→重開接手。新版在暫存副本加入測試標記並跑正式builder及check，保留全部資產雜湊驗證；不強制skipWaiting或清快取。
- 遊戲：既有功能的版本遷移分開記錄本版原生實測、相依未變而沿用、UI 未重驗；只選受影響的原生家族／階段，維持隱藏、靜音及隔離。網頁測試不能新增遊戲寫入證明；新增功能仍須首次證明，例行遷移的 UI 未重驗不阻擋既有功能。

新增功能時擴充對應層的代表案例，完整數值矩陣留Node。Headless桌面／手機viewport只證明該Chromium引擎的結果；Safari、真實手機、PWA原生安裝視窗及個人瀏覽器擴充影響各自按需驗證。CSS視覺品質可先檢視自動截圖，不必開啟使用者瀏覽器。

九項技藝上限另有 `tests/skill-caps-ui.test.cjs` 與 `tests/browser/skill-caps.spec.cjs`。UI事件用測試VM中的單一候選旗標覆蓋成功及關閉分支；它不是原生開放證明。Headless讀真正建置與catalog：關閉時只驗預覽／停用；相符獨立proof開放後才驗實際套用、交錯經驗、27欄還原／復原、下載及重載。兩種結果須分開記錄，不能把關閉分支通過宣稱發布完成。新增合法fixture保留舊全50上限fixture的原用途；HTTP兩寬度、直接file、PWA離線與兩頁waiting交接各自有案例。

## 隔離、輸出與清理

預設單worker、headless及每案獨立context，所有輸入都是合成檔。測試以setInputFiles指定暫存檔，等待真實download事件並saveAs到暫存目錄；實際檔案bytes對照獨立預期，重載也使用該下載檔。正式程式沒有測試後門或被替換的SaveCore API。

執行器使用OS暫存目錄下的`bandit-browser-*`儲存摘要及Playwright結果，站點副本使用`bandit-site-*`。正常結束關閉自己建立的瀏覽器、伺服器及副本；全部成功會刪除結果目錄。失敗保留summary.json、trace、錯誤DOM摘要及可取得的截圖，並印出路徑；`--visual`也保留成功截圖。強制終止程序可能留下暫存資料，只清理確認屬於本次執行的目錄。使用者瀏覽器設定、分頁、Downloads與真實存檔不參與。

預設由OS選擇隨機loopback埠；需要沿用使用者既有的本機內容過濾器例外時，可在該次測試程序設定`BANDIT_BROWSER_PORT`，埠被占用就直接失敗，不連接既有服務。2026-10-22新版對齊時，隨機埠被AdGuard注入腳本，四個PWA案例因資產完整性檢查失敗；沿用文件記錄的8942例外後四案通過。PowerShell可用`$env:BANDIT_BROWSER_PORT='8942'; npm run verify:release`；只設定測試程序環境，不修改使用者過濾器、瀏覽器設定或PWA雜湊規則。

平時只讀通過數／耗時與失敗摘要；失敗時才開對應trace或截圖。需要查看trace可用`npx playwright show-trace /temporary/path/trace.zip`，這是明確的除錯操作，不是預設驗收。CI失敗會保留瀏覽器診斷artifact七天，Pages仍只發布原有靜態白名單。

## 發布與紀錄

正式發布先核對相符SHA的CI／deploy、公開HTTP bytes及metadata。需要正式DOM證據時使用獨立headless context，使用者既有快取或安裝問題才升級computer use；PWA更新交接的例行回歸由上述暫存建置測試負責。記錄實際環境與通過層級，保留歷史未測範圍，不將單次自動測試擴張成所有瀏覽器已驗收。

測試基線見[程式化測試SDD](../sdd/programmatic-testing/tasks.md)；v2.8新增介面在正式開閘後通過138 Node／12 headless，完整分層結果見[B驗收](../sdd/random-character-skill-caps-b/tasks.md)。
