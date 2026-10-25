# 程式化測試與按需人工驗收

遊戲與編輯器都優先使用可重複的程式驗證。程式修改先跑相關 Node，再跑需要的獨立 headless；純文件／技能修改檢查連結、規則與實作一致性，不跑產品測試。新增功能依[輕量開發流程](maintenance/lightweight.md)驗收：合成測試、一次瀏覽器測試與一次隔離遊戲冒煙。日常推送、Pages CI 與部署追蹤依[提交與發布](maintenance/release.md#提交與發布)，不重複執行已完成的開發驗收。完整 `npm run verify:release` 僅在使用者要求或具體故障需要時執行。失敗才讀詳細日誌及擴大檢查。遊戲改版依[遊戲改版步驟](maintenance/game-update.md)只對真改動跑冒煙，computer use 為零；原生視窗或實際 UI 故障先查程式證據，使用者明確要求才操作遊戲桌面。自動測試失敗先讀摘要／trace，不自動改用使用者瀏覽器重走流程。

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

開發中修改 core 時跑該功能的 Node 測試；改動牽涉存檔讀寫行為時，再補該功能的隔離遊戲冒煙（[輕量開發流程](maintenance/lightweight.md#改-core-與遊戲改版)）。`node scripts/core-slice-report.cjs` 只當參考，不決定要不要重證。

- 核心及Node UI事件：共用合成資料與獨立token renderer，不由待測serialize或changes反推預期。UI harness實際執行src處理函式，捕捉Blob的arrayBuffer，逐byte核對BOM、空白、指數、大型整數literal、MIME與檔名。這層不宣稱真實DOM排版或瀏覽器下載已驗收。
- HTTP headless：在127.0.0.1隨機port只提供發布用HTML／PWA資產，測試真正建置HTML與DOM控制項。桌面／390px各有完整尺寸基礎資質及批次代表案例，核對搜尋、分頁、套用、還原／復原、下載及重載。基礎資質覆蓋有名／在監停用、非法組合與預覽過期；批次跨頁選51名，以50筆分頁並檢查一次復原整批。
- file headless：直接導覽暫存HTML的file URL，完成完整尺寸預覽、下載及重載，確認PWA入口隱藏。這是直接開檔的Chromium網頁流程，沒有操作macOS／Windows原生選檔對話框。v2.6 以前的舊功能（資源、名稱、三類經驗、自訂欄位設定、比對／CSV、v2.1–v2.6）集中在 `tests/browser/legacy-file.spec.cjs`，2026-10-25 驗收範圍見[PWA 文件](maintenance/pwa.md#2026-10-25-舊功能直接開檔驗收紀錄)；改到這些流程時跑 `npm run test:browser -- --grep "file legacy"`。
- PWA headless：分別檢查斷網後首頁與index.html仍能編輯／下載，與新建置waiting→保留未匯出修改→匯出→關閉同源頁→重開接手。新版在暫存副本加入測試標記並跑正式builder及check，保留全部資產雜湊驗證；不強制skipWaiting或清快取。
- 遊戲：新功能與遊戲改版只跑受影響功能的隔離遊戲冒煙（代表案例原版存檔、新程序讀回），維持隱藏、靜音及隔離。網頁測試不能代替遊戲冒煙；UI 未重驗不阻擋既有功能。

新增功能時擴充對應層的代表案例，完整數值矩陣留Node。Headless桌面／手機viewport只證明該Chromium引擎的結果；Safari、真實手機、PWA原生安裝視窗及個人瀏覽器擴充影響各自按需驗證。CSS視覺品質可先檢視自動截圖，不必開啟使用者瀏覽器。

九項技藝上限另有 `tests/skill-caps-ui.test.cjs` 與 `tests/browser/skill-caps.spec.cjs`。UI事件用測試VM中的單一候選旗標覆蓋成功及關閉分支；它不是原生開放證明。Headless讀真正建置與catalog：關閉時只驗預覽／停用；相符獨立proof開放後才驗實際套用、交錯經驗、27欄還原／復原、下載及重載。兩種結果須分開記錄，不能把關閉分支通過宣稱發布完成。新增合法fixture保留舊全50上限fixture的原用途；HTTP兩寬度、直接file、PWA離線與兩頁waiting交接各自有案例。

天賦等級另有 `tests/talent-levels-ui.test.cjs` 與 `tests/browser/talent-levels.spec.cjs`（`talentLevelsFixture`）：HTTP 1280／390px 驗排除原因、Q6 無可調整值、資質天賦的 A／C 預覽、輸入變更使預覽失效、與基礎資質同群組還原／復原、實際下載與重載；直接 file 與 PWA 斷網兩入口驗預覽與套用下載。閘門關閉時同樣只驗預覽與停用。

## 隔離、輸出與清理

預設單worker、headless及每案獨立context，所有輸入都是合成檔。測試以setInputFiles指定暫存檔，等待真實download事件並saveAs到暫存目錄；實際檔案bytes對照獨立預期，重載也使用該下載檔。正式程式沒有測試後門或被替換的SaveCore API。

執行器使用OS暫存目錄下的`bandit-browser-*`儲存摘要及Playwright結果，站點副本使用`bandit-site-*`。正常結束關閉自己建立的瀏覽器、伺服器及副本；全部成功會刪除結果目錄。失敗保留summary.json、trace、錯誤DOM摘要及可取得的截圖，並印出路徑；`--visual`也保留成功截圖。強制終止程序可能留下暫存資料，只清理確認屬於本次執行的目錄。使用者瀏覽器設定、分頁、Downloads與真實存檔不參與。

工作目錄的 `npm test` 只有 PWA 建置／快取雜湊案例失敗、`git status` 卻乾淨時，先查工作檔是否被寫成 CRLF，排查與還原見[換行差異的處理](maintenance/release.md#待提交快照檢查)。

預設由OS選擇隨機loopback埠；需要沿用使用者既有的本機內容過濾器例外時，可在該次測試程序設定`BANDIT_BROWSER_PORT`，埠被占用就直接失敗，不連接既有服務。隨機埠若落在 Chromium 封鎖的 unsafe port（例如 5060、6566，清單在 `tests/browser/loopback.cjs`），站點與開跑前檢查都會關掉重新 listen，最多 20 次，避免單一案例以 `net::ERR_UNSAFE_PORT` 失敗；指定 `BANDIT_BROWSER_PORT` 時照原值使用，不重試也不換埠。2026-10-22新版對齊時，隨機埠被AdGuard注入腳本，四個PWA案例因資產完整性檢查失敗；沿用文件記錄的8942例外後四案通過。PowerShell可用`$env:BANDIT_BROWSER_PORT='8942'; npm run verify:release`；只設定測試程序環境，不修改使用者過濾器、瀏覽器設定或PWA雜湊規則。2026-10-24 起 `scripts/test-browser.cjs` 開跑前先用同一個埠設定提供一次 `index.html`，以頁面導覽與子資源兩種請求比對原檔位元組；被改寫就印出原因與改埠／加例外的提示，以 exit 1 停下，不再跑出一整批「離線準備失敗」。同日使用者在 AdGuard 使用者規則調整 127.0.0.1 例外後，隨機埠已不再被改寫（41 項瀏覽器測試未設埠即通過）；若之後又被改寫，以開跑前檢查的訊息為準。過濾器改寫首頁並注入 CSP／腳本時，Worker 因內容不符而拒絕快取是預期行為；先比較實際 HTTP 回應與提交的 Git blob，不要放寬 CSP 或略過指紋比對。

平時只讀通過數／耗時與失敗摘要；失敗時才開對應trace或截圖。需要查看trace可用`npx playwright show-trace /temporary/path/trace.zip`，這是明確的除錯操作，不是預設驗收。CI失敗會保留瀏覽器診斷artifact七天，Pages仍只發布原有靜態白名單。

## 發布與紀錄

發布檢查依[提交與發布](maintenance/release.md#提交與發布)按變更範圍執行：純文件推送後即結束，影響網站產物或發布設定才追蹤相符 SHA 的部署；明確要求確認線上版本才 GET 首頁，多頁 HTTP bytes／metadata 僅在使用者要求或故障需要時核對。需要正式DOM證據時使用獨立headless context，使用者既有快取或安裝問題才升級computer use；PWA更新交接的例行回歸由上述暫存建置測試負責。記錄實際環境與通過層級，保留歷史未測範圍，不將單次自動測試擴張成所有瀏覽器已驗收。

測試分層的建立紀錄見[程式化測試SDD](../sdd/programmatic-testing/tasks.md)（歷史）；當時 v2.8 的 138 Node／12 headless 數字只代表該版，目前數量以各版[更新紀錄](releases.md)為準。


套裝等級的首次原生完整矩陣、12副本生命週期與合併入口見[核心維護](maintenance/core.md#套裝等級首次證明與遷移)；`set-equipment-level-*.test.cjs` 驗證核心、oracle、manifest與proof拒絕條件，`tests/browser/set-equipment-level.spec.cjs` 驗兩庫介面、下載、file與PWA。Node／瀏覽器合成存檔不替代遊戲冒煙；該段的首次證明與代表遷移是輕量流程前的歷史紀錄。


## 介面導覽與收合維護

- 手機（760px 以下）透過「全部功能」原生 dialog 切換，桌面保留側欄。兩個功能清單與目前項目須同步；選單關閉回到開啟按鈕，選取功能則移入內容標題。角色頁內跳轉展開目標後聚焦 summary，保留 summary 原有的鍵盤操作。
- 角色的五個 `data-character-section` 外層由 HTML 固定持有；重繪只更新內部編輯器。不要以重新建立外層或 toggle 事件呼叫 render 的方式收合，否則會清掉草稿、預覽或展開狀態。只有成功載入另一份存檔才重設收合狀態。
- 空物品清單應在呼叫核心資格檢查前顯示空狀態；已有但不支援、未知範本或異常記錄仍須可見並呈現拒絕原因，不得為了隱藏錯誤而過濾。超限後果、首次選槽確認及動態阻擋原因保留在操作旁；公式與完整還原規則可收進詳細規則。
- 固定底列的高度由 ResizeObserver 寫入 `--footer-space`，內容留白與 toast 共用此值，包含裝置安全區。未載入時隱藏底列；改底列文字或按鈕時要檢查 320px 的換行與遮擋。
- `tests/browser/actions.cjs` 的 `navigate` 走實際桌面側欄或手機選單；`selectCharacter` 額外展開編輯區，供既有功能回歸使用。預設收合、焦點、草稿保留與換檔重設由 `ux-navigation.spec.cjs` 獨立驗證，不能以回歸 helper 取代。使用 `npm run test:browser -- --grep "UX " --visual` 可保留四種寬度及角色頁截圖。
