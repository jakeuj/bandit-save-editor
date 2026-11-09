# 遊戲改版

[維護索引](../maintenance.md) · [輕量開發流程](lightweight.md) · [版本遷移與本機快取](migration.md)

遊戲改版依[輕量開發流程](lightweight.md#改-core-與遊戲改版)只對受影響的功能跑冒煙，不跑 `verify-migration.cjs` 的代表副本寫回。2026-10-25 V1.0.11.2→V1.0.12.2 第一次這樣做（[更新紀錄 v2.28](../releases.md#v228-遊戲-v10122)）；2026-10-27 V1.0.12.2→V1.0.13.0 在 Mac 做，舊版來源已不在本機（[v2.33](../releases.md#v233-遊戲-v10130)）；同日又更新到 V1.0.14.0，用 v2.33 留在 repo 外的精簡來源直接比對（[v2.34](../releases.md#v234-遊戲-v10140)）；2026-10-30 V1.0.15.0 只改資料（天賦係數、有名角色範本），寫入點與已審核摘要都沒變（[v2.36](../releases.md#v236-遊戲-v10150)）；2026-11-02 V1.0.17.0（跳過 V1.0.16.0）是第一次用 `game-update.cjs` 處理的特別版更：新 z23 備用套裝層、寫入點 860→877（[v2.37](../releases.md#v237-遊戲-v10170)）。2026-11-04 V1.0.18.0（正式公告 V1.0.18.2）再增加 z24 與 310 筆符文，裝備存取函式／事件重建；使用者同意特別版更後逐項審核，Windows 三份隔離冒煙通過（[v2.44](../releases.md#v244-遊戲-v10180)）。來源快取與 `--plan` 的操作見[版本遷移](migration.md)。

## 自動流程（「遊戲版更」）

遊戲幾乎每天更新，2026-11-02 起使用者說「遊戲版更」就照本節一路做完，不逐步詢問：這句話同時同意該次的隱藏隔離冒煙、提交與推送。只有判定為「特別」才停下來回報。Wiki、公告、Issue 仍預設不同步（第 9 步）。

1. **判定**：`node scripts/game-update.cjs check`。它讀 Steam `package.nw` 的 `gg.json` 版號與 appmanifest build，跟 `verification.json` 比；有新版就把精簡來源（含 `zddt.json`）解到 repo 外 `~/bandit-verification/artifacts/v<版本>-update-<日期>/source`，自動找上一版來源（data.json／c3runtime 指紋等於目前知識的那份），做下方第 2–4 步的比對，產生候選 catalog，結果寫 `report.json` 並印出結論：
   - **已是最新**：回一句結束，不提交。版號相同但 build 不同時照常比對；15 個來源都沒變就只更新 `verification.json` 的 build，不加修改器版號（公告版號與遊戲內版號不同的情形，見下方踩過的坑）。
   - **例行**：寫入點、函式參數、已審核事件、引用的 expression、Mac 路徑修正命中數都沒變，候選 catalog 也沒有關閉任何旗標（可以有新函式、新事件或資料表變動，報告會列出來）。
   - **資料變動**：同上，但修改器讀的資料（例如 `batch2Data` 的天賦係數、有名角色範本）有變，`mergeCatalog` 關了相關旗標（V1.0.15.0 屬於這類）。比較前先把舊 catalog 的 `fingerprints`、資料腳本摘要、`cityLayers.source` 與 expression 編號換成新版（`comparable`），只差編號不會關旗標；各資料腳本的 `canPreserve` 直接比這些欄位，改版時一定不同。
   - **特別**：報告的 ✖ 項目非空（寫入點增減、函式參數改變、陣列 `SetSize`、已審核事件內容改變、expression 找不到一致位移、Mac 命中數改變、候選 catalog 產生失敗）。
2. **登錄**（例行／資料變動）：`node scripts/game-update.cjs apply`。在 `extract-game.cjs` 的 `reviewedVersions` 與 `prepare-macos.py` 的 `SCRIPT_SHA256` 各加一行，重產 `knowledge/catalog.json`（舊旗標照抄，資料變動關的旗標維持關閉），`verification.json` 換版本、build、指紋，舊 `gameUpdate` 移進 `gameUpdateHistory`，新紀錄帶自動產生的靜態核對摘要；輕量群組記錄改成新版本。
3. **冒煙**：`node scripts/game-update.cjs smoke`（Mac）。它在 artifacts 準備 Mac 副本，拿上一輪冒煙由遊戲寫出的存檔當基準（保存在各版 `smoke/final-save.dat`），以修改器預設編輯做隱藏隔離的雲存檔載入、原版存檔、新 PID 讀回，確認沒有殘留程序、修改器重讀逐字元往返，把結果寫進 `gameUpdate.smokes`。資料變動時，另依[原生教訓](native-lessons.md#冒煙工具)對關閉旗標的功能各挑一個代表案例冒煙（V1.0.15.0 用 `talentEffects`），通過後把 catalog 的旗標開回、在 `smokes` 補一筆；代表案例可用 `smoke --save-file 基準存檔 --scenario 情境.json --name 名稱`，同樣隱藏、檢查殘留程序並寫進 `smokes`（V1.0.17.0 用例行冒煙寫出的 24 層存檔改穿戴寶物等級）。關閉的旗標若依規則根本不讀變動的資料（V1.0.17.0 只有寶物 674 改主屬性，卻因 `batch2Data.items` 整包比較關掉一般裝備、丹藥與武庫旗標），可靜態重開，理由寫進 `gameUpdate.carried`。
4. **測試**：`npm test`。只因綁舊資料值而失敗的測試，改成新值或改讀 catalog（V1.0.15.0 的天賦係數），仍算例行；其他失敗改判特別。
5. **發布文字**：修改器版號加一（`index.html` 側欄版號與日期、更新紀錄對話框加一則），`docs/releases.md` 加一節（變動來源、報告列出的資料變動與公告要點、冒煙雜湊），`README.md` 知識基準句與[進度入口](../research/next-version-plan.md)「剛完成」換新版；Mac 範圍字樣（`launcher/README.md`、技能的 Mac 參考與操作補充）延到新版本。改到 `src/` 或 `index.html` 後跑 `node scripts/build-editor.cjs`。
6. **提交推送**：[待提交快照檢查](release.md#待提交快照檢查)、提交、推送，推送成功即結束，回覆一段結論（判定、變動摘要、冒煙結果、提交連結）。

下列情況改走下方手動步驟，**不提交、不推送**，先回報 `report.json` 的 ✖ 項目、公告要點與建議做法，等使用者決定：判定為特別、例行／資料變動的冒煙失敗、要改核心來源（`src/core.js` 或 `src/core/`）或寫入規則、要新增驗證工具動作，或測試失敗不是因為資料值。已審核摘要只差物件編號時（候選 catalog 產生失敗的常見原因），依第 2 步正規化比對確認後登錄新摘要，再重跑 `check`。

使用者同意處理特別版更後：逐項看 ✖（`report.json` 有完整清單；攤平後的事件可用 `game-update.cjs` 匯出的 `flatten`／`normalize` 印出），需要時改 core、登錄摘要、補測試，再跑 `node scripts/game-update.cjs apply --reviewed`（仍需候選 catalog 產生成功），之後照第 3–6 步做完並推送；每個 ✖ 的結論寫進 `gameUpdate.staticReview`。

## 手動步驟（資料變動與特別版更）

`game-update.cjs check` 已涵蓋第 1–4 步的比對；特別版更要逐項看清楚改了什麼時，依下列步驟追查。

1. **查改了什麼**：`game-update.cjs check` 已解出精簡來源並列出變動檔案；舊做法 `verify-migration.cjs --plan` 也只該這樣用。它的語意摘要會把物件編號位移當成改變，幾乎所有 family 都會被選中，不能直接當成影響範圍。
2. **逐條比對事件**：把兩版每個事件的條件／動作攤平成一行一筆，物件 `[4,N]`／`[2,N,…]` 換成物件名稱、`sysNN(` 去掉編號，再 diff。剩下的才是真改動。各資料腳本的 `reviewedDigest` 用的 `eventDigest` 不正規化這些編號，所以摘要一定會變；對已審核 SID 做同樣正規化比對，確認只差編號後，把新摘要加進該腳本的已審核清單（舊摘要保留）。
3. **公式編號**：`c3runtime.js` 改變通常是 expression 清單插入新項。用函式本文比對兩版 `g.expressions`，確認 catalog 引用的 expression 都在、內容不變，再把 `extract-game.cjs` 的 `expressionOffset` 調成新位移。
4. **登錄新版**：在 `extract-game.cjs` 的 `reviewed` 加 data.json 指紋、版本與 runtime 指紋；`.local/game-sources.json` 先加一筆 static 項（`packageHash`、build、15 指紋），`prepare-development-cache.cjs` 才肯補完整來源。runtime 檔案集合沒變就直接沿用舊快取。
5. **冒煙**：依真改動挑代表案例。`verify-game.cjs` 會把載入的 catalog 旗標全部打開，候選 catalog 只要指紋對得上新來源。冒煙腳本放 repo 外，工具用法見[原生教訓](native-lessons.md#冒煙工具)。
6. **寫回**：重產 catalog（舊旗標照抄）；`verification.json` 換 `gameVersion`、build、指紋，加 `gameUpdate` 紀錄（變動來源、靜態核對結論、冒煙雜湊）。輕量群組的紀錄改成新版本，另記原冒煙版本 `smokeGameVersion` 與 `gameUpdate` 說明。
7. **歷史證明測試**：舊的複合證明綁 V1.0.11.2，測試會用目前 catalog 去核對它而失敗。V1.0.11.2 的 catalog／verification 已凍結在 `tests/fixtures/v1.0.11.2-release`（gzip），`tests/helpers/legacy-release.cjs` 與 `release-v1.0.11.2.cjs` 從那裡讀；下次改版不用再凍結，除非又寫了新的複合證明。直接比對「目前 catalog 的遊戲版本」的斷言改讀 `knowledge/catalog.json`。知識統計（函式數）照新版更新。
8. 更新紀錄加新版本、README 知識基準與進度入口。Mac 啟動器的 `SCRIPT_SHA256` 可在 Windows 對新版 `c3runtime.js` 做靜態核對後登錄（V1.0.12.2 於 2026-10-25 這樣做，見 [Mac 研究](../research/macos-runtime-investigation.md#v10122-靜態核對2026-10-25)），不必等換到 Mac；Mac 實機啟動與存讀補驗到換 OS 時再做，見 [launcher 說明](../../launcher/README.md)。在 Mac 補驗時先看 appmanifest 的 `buildid`：Steam 正式分支只留最新版，若已更新，就改驗新版（2026-10-27 原本要補 V1.0.12.2，結果改驗 V1.0.13.0）。
9. Wiki（首頁、操作教學、常見問題、開發進度）與公告 #3 的版本段每次改版都會過時，但預設不同步；使用者要求時依[發布](release.md#wiki-維護)、[公告](discussions.md)與 [Issues](issues.md) 的維護規則一次補齊（2026-10-27 v2.33 與 v2.34 一起補）。功能版本（例如 v2.35）也會讓這些版本段過時，同樣等使用者要求再補。改版時的 Issue：Mac 啟動器有登錄新版就在已關閉的 #13 補一則留言（新指紋、命中數、冒煙範圍），不重開；`数值更新`、回填 expressions 或有名角色 js 範本有變時，在 #4 本文的評估段補一行重核結果（2026-10-30 v2.36 這樣做）。回填 expressions 的位移要另外算，不能套用 `report.json` 的 `expressions.delta`：V1.0.17.0 修改器引用的公式 +107，回填的 548–567 卻是 −5（→543–562），用舊編號的函式本文在新版 `expressions` 裡找位置；常見問題有新限制時（例如 v2.37 備用套裝裝備不能改）Wiki 常見問題加一題。Project 卡片即 #4，Status 不變就不用動。

## 沒有舊版來源時

Steam 正式分支只留最新版，換機器後舊版來源可能已拿不到（V1.0.13.0 在 Mac 改版時就是）。先用 repo 內能精確代表舊版的資料比，不夠才回頭找舊快取：

- **函式、寫入點、表格、expression**：上一版的 `knowledge/catalog.json` 就是舊來源的萃取結果。對新來源跑 `inspectGame`，比 `functions`（名稱＋SID）、`evidence`（SID、actionSid、x／y／z，忽略 `refs` 的 expression 編號）與 `catalogs`；寫入點的增減就是存檔層面的全部改動。
- **表格**：先算本機任何舊來源的表格指紋，和上一版 catalog 的 `fingerprints` 相同就能直接逐格比（V1.0.10.2 的 kj／jz 與 V1.0.12.2 相同）。
- **已審核事件**：拿本機較舊的完整來源做正規化攤平比對（第 2 步），差異再用 `tests/fixtures/v1.0.11.2-release` 的凍結 catalog（寫入點）與工具註解歸屬到正確版本，不要全算在新版（`套装合成` 的選擇庫序號是 V1.0.11.2 的改動）。
- 正規化時，expression 節點裡的 `[4,N]` 是系統函式綁定（文件說的 sysNN），去掉編號，不是物件；`[2,N,…]` 才是物件；函式呼叫 ACE 的 `a[0]` 是 -2、`a[1]` 是函式名。
- 精簡來源沒有 `zddt.json`，版本改變時 `cityLayers` 會變 null：從 `package.nw` 取出 `zddt.json` 放進來源副本再重產（V1.0.13.0）。
- V1.0.13.0–V1.0.15.0 用的 repo 外分析腳本（`v1.0.15.0-update-20261030/analysis/*.cjs`）已併入 `scripts/game-update.cjs`（`flatten`、正規化比對、expression 位移、catalog 逐格比）。各版 artifacts 裡的精簡來源與 `smoke/final-save.dat` 請留著，下一版的 `check` 與 `smoke` 從那裡找上一版。重播舊改版用 `check --source 已解來源 --version V --build N --previous 上一版來源`（2026-11-02 用 V1.0.14.0→V1.0.15.0 重播，候選 catalog 除旗標外與 v2.36 相同）。

## 踩過的坑

- **check 的舊來源搜尋範圍**：自動尋找只查預設 artifacts 下各版的 source*；若同版本完整開發快取位於另一個已登錄目錄，先比 data.json 與 c3runtime 指紋，再以 `--previous` 傳入該來源，無需重解或下載舊版。
- **新種類共用舊資源座標**：新版新增材料列時核對 cl y5 的種類及真正寫入用途；符文共用 z0 y6，但其精通頁尚受開發模式守門。需連同新增層列為已知唯讀，不能因舊材料入口而自動開放；V1.0.18.0 的新 kind 與回歸測試見[本版紀錄](../releases.md#v244-遊戲-v10180)。

- **版本號在 `gg.json`**：精簡來源與 `data.json` 都沒有版本字串；`package.nw` 的 `gg.json` 第一段就是版本號與該版公告（`unzip -p package.nw gg.json`），用它確認版本並對照改動。解出的檔放 scratchpad 或 repo 外，不要放進 repo（V1.0.14.0）。
- **Steam 公告版號不等於遊戲內版號**：公告「正式更新 版本号1.0.14.2」（2026-10-27）就是 build 26234362，`gg.json` 只寫 V1.0.14.0，更新說明逐字相同，v2.34 已處理。收到新公告時先比 appmanifest 的 `buildid` 與已登錄 build，再拿公告條目對 `gg.json` 第三欄的更新說明；兩者都對得上就不用重做改版。第三方 build 查詢（api.steamcmd.net）可能落後，不能拿來當依據。
- **公式常數改了**：改版可能只改公式的底數（V1.0.14.0 魂魄 1.05→1.04）。資料腳本要依摘要區分新舊值，core 裡用同一公式做的可計算檢查也要跟著改；冒煙時從修改後的等級原生升一級，核對扣費等於新公式。
- **登錄新摘要時**：資料腳本的 `reviewedDigest` 是最新版摘要（測試拿它比 catalog 的 `sourceDigest`），舊的放進 `reviewedDigests`。若規則依摘要分版（寶物的魂魄底數），改用摘要集合判斷，不要再寫 `digest===reviewedDigest`（V1.0.17.0）。套裝品質的 `previousDigests` 可以是陣列；摘要可能剛好回到更早版本的值（V1.0.17.0 的 Q2–Q4 等於 V1.0.12.2）。
- **新的存檔層**：除了 `planeNames` 與 `resolveField` 唯讀，還要看新層有沒有改變既有的指標關係。V1.0.17.0 的 z23 讓 z9 裝備可以 owner 指向角色、z2 卻沒有指標，原本的「穿戴雙向指標」會擋下但訊息看不懂；用 `inBackupSet` 給出明確原因。順便查哪些函式讀這層，確認屬性計算是否算進去。
- **天賦不再生成**：tf y13–21 是隨機角色的主技藝排除。某天賦九項全排除代表不再生成，舊角色仍持有，技藝上限資料把它當成沒有排除（V1.0.16.0 的 36 工作擴大）。
- **只改資料表時**：函式、寫入點與已審核摘要都沒變，但 tf／js 之類的表格會進 catalog（`batch2Data`）。`check` 報告的 catalog 逐格差異就是這些值，找出修改器哪裡讀到它們；只影響顯示時，冒煙就核對原生計算等於修改器顯示（V1.0.15.0 用 `talentEffects`），並把綁舊數值的測試例改成新值。
- **Windows 的遊戲庫與換行**：遊戲可能裝在 C: 以外的 Steam 遊戲庫（本機是 `F:\SteamLibrary`），`check` 會讀 Steam 的 `libraryfolders.vdf` 逐一找，最後退回 `.local/game-sources.json` 的 `installedGameDirectory`；都找不到才要 `--package`。Windows checkout 是 CRLF，`apply` 的插入點依檔案換行比對（2026-11-03 前在 Windows 會「找不到插入位置」）。
- 新版從 `开始界面` 載入較慢，`--probe` 剛載入時讀到的是開始畫面的值；以 `--assert` 的通過為準（v2.28）。
- 背景指令的寫法陷阱見[原生教訓的 Shell 與寫檔](native-lessons.md#shell-與寫檔)。
- **原生函式多了參數**：新版在 `穿戴装备` 等函式末尾加參數時，驗證工具的舊呼叫少傳會變 0，函式靜默不動作。改版時先用 `v[1][2]` 比兩版參數清單，再補工具的呼叫（V1.0.13.0 的庫序號，見[原生教訓](native-lessons.md#冒煙工具)）。
- **先 fetch 再版更**：上一版可能在另一台機器處理並推送了。`check` 前先 `git fetch` 並確認 main 跟上 origin；2026-11-09 本機停在 V1.0.17.0，從 17 重做了一遍 V1.0.18.0 的核對，推送被拒才發現，最後改以遠端 V1.0.18.0 為基準重做。
- **上一版在別台處理（沒有它的來源）**：`check --previous 更舊版來源`。函式、寫入點與資料表照常對目前 catalog 比；已審核事件拿較舊來源比，再扣掉上一版 `gameUpdate.staticReview` 已審核的部分。旗標比較用相對目前知識的位移（report 的 `expressions.knowledgeDelta`，`apply` 也用它），否則會依 `--previous` 的位移誤關裝備旗標（V1.0.19.0：98 對 47）。冒煙用 `smoke --save-file` 指本機最近一份遊戲寫出的存檔（V1.0.19.0 用 V1.0.17.0 寫出的 24 層存檔）。
- **繁體對照**：Mac 的 `extract-game` 只轉換 `traditional-names.json` 缺少的名稱；在 Windows 補的對照（例如「彌漫」）不會被 Swift 轉換改掉（2026-11-09 前會）。
- **Mac 冒煙要 Mac 版 Steam**：`smoke` 的斷言要求 Greenworks 初始化成功；只開 CrossOver 裡的 Windows Steam 時 log 會出現 `SteamAPI_IsSteamRunning() did not locate a running instance of Steam`，在「存檔核對」失敗。請使用者開 `/Applications/Steam.app`；使用者正在 CrossOver 玩遊戲時不要自己啟動同帳號的 Mac Steam（V1.0.19.0）。
- **存檔層數會變**：新版可能在主場景開始時 `SetSize` 擴層（V1.0.13.0 由 22 變 23）。core 的深度檢查只要求下限，新層要在 `extract-game.cjs` 的 `planeNames` 登錄，並讓 `resolveField` 比照相近的層唯讀，否則它歸「未知層」，自訂座標寫得進去。
