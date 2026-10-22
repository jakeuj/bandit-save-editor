# 程式化測試與按需人工驗收

遊戲與編輯器都優先使用可重複的程式驗證。日常修改先跑相關Node測試，再跑需要的獨立headless案例；交付前跑完整檢查。Computer use留給原生視窗、安裝、特定使用者環境或程式無法回答的視覺／互動問題；開始前說明證據缺口，只跑最小案例。自動測試失敗時先讀摘要、trace與截圖並修正，不自動改用使用者瀏覽器重走全部流程。

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
| `npm run verify:release` | 建置同步＋全部Node＋全部headless；CI部署前使用 |

來源異動先執行`node scripts/build-editor.cjs`；驗證入口只檢查同步，不自動修改發布產物。日常可加Playwright篩選，例如`npm run test:browser -- --grep 'HTTP 390px'`。排版異動使用`npm run test:browser -- --visual --grep 'base aptitude'`產生兩種寬度的完整頁面截圖，再按需要檢視。

## 證據分工

- 核心及Node UI事件：共用合成資料與獨立token renderer，不由待測serialize或changes反推預期。UI harness實際執行src處理函式，捕捉Blob的arrayBuffer，逐byte核對BOM、空白、指數、大型整數literal、MIME與檔名。這層不宣稱真實DOM排版或瀏覽器下載已驗收。
- HTTP headless：在127.0.0.1隨機port只提供發布用HTML／PWA資產，測試真正建置HTML與DOM控制項。桌面／390px各有完整尺寸基礎資質及批次代表案例，核對搜尋、分頁、套用、還原／復原、下載及重載。基礎資質覆蓋有名／在監停用、非法組合與預覽過期；批次跨頁選51名，以50筆分頁並檢查一次復原整批。
- file headless：直接導覽暫存HTML的file URL，完成完整尺寸預覽、下載及重載，確認PWA入口隱藏。這是直接開檔的Chromium網頁流程，沒有操作macOS／Windows原生選檔對話框。
- PWA headless：分別檢查斷網後首頁與index.html仍能編輯／下載，與新建置waiting→保留未匯出修改→匯出→關閉同源頁→重開接手。新版在暫存副本加入測試標記並跑正式builder及check，保留全部資產雜湊驗證；不強制skipWaiting或清快取。
- 遊戲：沿用相符來源的隔離原生函式、原版存檔與新PID讀回；網頁測試不能新增或取代遊戲群組證明。既有明示遊戲UI資格閘門仍須取得該項證據。

新增功能時擴充對應層的代表案例，完整數值矩陣留Node。Headless桌面／手機viewport只證明該Chromium引擎的結果；Safari、真實手機、PWA原生安裝視窗及個人瀏覽器擴充影響各自按需驗證。CSS視覺品質可先檢視自動截圖，不必開啟使用者瀏覽器。

## 隔離、輸出與清理

預設單worker、headless及每案獨立context，所有輸入都是合成檔。測試以setInputFiles指定暫存檔，等待真實download事件並saveAs到暫存目錄；實際檔案bytes對照獨立預期，重載也使用該下載檔。正式程式沒有測試後門或被替換的SaveCore API。

執行器使用OS暫存目錄下的`bandit-browser-*`儲存摘要及Playwright結果，站點副本使用`bandit-site-*`。正常結束關閉自己建立的瀏覽器、伺服器及副本；全部成功會刪除結果目錄。失敗保留summary.json、trace、錯誤DOM摘要及可取得的截圖，並印出路徑；`--visual`也保留成功截圖。強制終止程序可能留下暫存資料，只清理確認屬於本次執行的目錄。使用者瀏覽器設定、分頁、Downloads與真實存檔不參與。

平時只讀通過數／耗時與失敗摘要；失敗時才開對應trace或截圖。需要查看trace可用`npx playwright show-trace /temporary/path/trace.zip`，這是明確的除錯操作，不是預設驗收。CI失敗會保留瀏覽器診斷artifact七天，Pages仍只發布原有靜態白名單。

## 發布與紀錄

正式發布先核對相符SHA的CI／deploy、公開HTTP bytes及metadata。需要正式DOM證據時使用獨立headless context，使用者既有快取或安裝問題才升級computer use；PWA更新交接的例行回歸由上述暫存建置測試負責。記錄實際環境與通過層級，保留歷史未測範圍，不將單次自動測試擴張成所有瀏覽器已驗收。

本次實作與完整結果見[程式化測試SDD](../sdd/programmatic-testing/tasks.md)。
