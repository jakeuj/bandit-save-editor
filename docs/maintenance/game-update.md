# 遊戲改版

[維護索引](../maintenance.md) · [輕量開發流程](lightweight.md) · [版本遷移與本機快取](migration.md)

遊戲改版依[輕量開發流程](lightweight.md#改-core-與遊戲改版)只對受影響的功能跑冒煙，不跑 `verify-migration.cjs` 的代表副本寫回。2026-10-25 V1.0.11.2→V1.0.12.2 第一次這樣做（[更新紀錄 v2.28](../releases.md#v228-遊戲-v10122)）；2026-10-27 V1.0.12.2→V1.0.13.0 在 Mac 做，舊版來源已不在本機（[v2.33](../releases.md#v233-遊戲-v10130)）；同日又更新到 V1.0.14.0，用 v2.33 留在 repo 外的精簡來源直接比對（[v2.34](../releases.md#v234-遊戲-v10140)）；2026-10-30 V1.0.15.0 只改資料（天賦係數、有名角色範本），寫入點與已審核摘要都沒變（[v2.36](../releases.md#v236-遊戲-v10150)）。來源快取與 `--plan` 的操作見[版本遷移](migration.md)。

## 步驟

1. **查改了什麼**：`verify-migration.cjs --plan` 只用來解出精簡來源、列出變動檔案。它的語意摘要會把物件編號位移當成改變，幾乎所有 family 都會被選中，不能直接當成影響範圍。
2. **逐條比對事件**：把兩版每個事件的條件／動作攤平成一行一筆，物件 `[4,N]`／`[2,N,…]` 換成物件名稱、`sysNN(` 去掉編號，再 diff。剩下的才是真改動。各資料腳本的 `reviewedDigest` 用的 `eventDigest` 不正規化這些編號，所以摘要一定會變；對已審核 SID 做同樣正規化比對，確認只差編號後，把新摘要加進該腳本的已審核清單（舊摘要保留）。
3. **公式編號**：`c3runtime.js` 改變通常是 expression 清單插入新項。用函式本文比對兩版 `g.expressions`，確認 catalog 引用的 expression 都在、內容不變，再把 `extract-game.cjs` 的 `expressionOffset` 調成新位移。
4. **登錄新版**：在 `extract-game.cjs` 的 `reviewed` 加 data.json 指紋、版本與 runtime 指紋；`.local/game-sources.json` 先加一筆 static 項（`packageHash`、build、15 指紋），`prepare-development-cache.cjs` 才肯補完整來源。runtime 檔案集合沒變就直接沿用舊快取。
5. **冒煙**：依真改動挑代表案例。`verify-game.cjs` 會把載入的 catalog 旗標全部打開，候選 catalog 只要指紋對得上新來源。冒煙腳本放 repo 外，工具用法見[原生教訓](native-lessons.md#冒煙工具)。
6. **寫回**：重產 catalog（舊旗標照抄）；`verification.json` 換 `gameVersion`、build、指紋，加 `gameUpdate` 紀錄（變動來源、靜態核對結論、冒煙雜湊）。輕量群組的紀錄改成新版本，另記原冒煙版本 `smokeGameVersion` 與 `gameUpdate` 說明。
7. **歷史證明測試**：舊的複合證明綁 V1.0.11.2，測試會用目前 catalog 去核對它而失敗。V1.0.11.2 的 catalog／verification 已凍結在 `tests/fixtures/v1.0.11.2-release`（gzip），`tests/helpers/legacy-release.cjs` 與 `release-v1.0.11.2.cjs` 從那裡讀；下次改版不用再凍結，除非又寫了新的複合證明。直接比對「目前 catalog 的遊戲版本」的斷言改讀 `knowledge/catalog.json`。知識統計（函式數）照新版更新。
8. 更新紀錄加新版本、README 知識基準與進度入口。Mac 啟動器的 `SCRIPT_SHA256` 可在 Windows 對新版 `c3runtime.js` 做靜態核對後登錄（V1.0.12.2 於 2026-10-25 這樣做，見 [Mac 研究](../research/macos-runtime-investigation.md#v10122-靜態核對2026-10-25)），不必等換到 Mac；Mac 實機啟動與存讀補驗到換 OS 時再做，見 [launcher 說明](../../launcher/README.md)。在 Mac 補驗時先看 appmanifest 的 `buildid`：Steam 正式分支只留最新版，若已更新，就改驗新版（2026-10-27 原本要補 V1.0.12.2，結果改驗 V1.0.13.0）。
9. Wiki（首頁、操作教學、常見問題、開發進度）與公告 #3 的版本段每次改版都會過時，但預設不同步；使用者要求時依[發布](release.md#wiki-維護)、[公告](discussions.md)與 [Issues](issues.md) 的維護規則一次補齊（2026-10-27 v2.33 與 v2.34 一起補）。功能版本（例如 v2.35）也會讓這些版本段過時，同樣等使用者要求再補。

## 沒有舊版來源時

Steam 正式分支只留最新版，換機器後舊版來源可能已拿不到（V1.0.13.0 在 Mac 改版時就是）。先用 repo 內能精確代表舊版的資料比，不夠才回頭找舊快取：

- **函式、寫入點、表格、expression**：上一版的 `knowledge/catalog.json` 就是舊來源的萃取結果。對新來源跑 `inspectGame`，比 `functions`（名稱＋SID）、`evidence`（SID、actionSid、x／y／z，忽略 `refs` 的 expression 編號）與 `catalogs`；寫入點的增減就是存檔層面的全部改動。
- **表格**：先算本機任何舊來源的表格指紋，和上一版 catalog 的 `fingerprints` 相同就能直接逐格比（V1.0.10.2 的 kj／jz 與 V1.0.12.2 相同）。
- **已審核事件**：拿本機較舊的完整來源做正規化攤平比對（第 2 步），差異再用 `tests/fixtures/v1.0.11.2-release` 的凍結 catalog（寫入點）與工具註解歸屬到正確版本，不要全算在新版（`套装合成` 的選擇庫序號是 V1.0.11.2 的改動）。
- 正規化時，expression 節點裡的 `[4,N]` 是系統函式綁定（文件說的 sysNN），去掉編號，不是物件；`[2,N,…]` 才是物件；函式呼叫 ACE 的 `a[0]` 是 -2、`a[1]` 是函式名。
- 精簡來源沒有 `zddt.json`，版本改變時 `cityLayers` 會變 null：從 `package.nw` 取出 `zddt.json` 放進來源副本再重產（V1.0.13.0）。
- 分析腳本留在 repo 外的改版資料夾（V1.0.13.0：`v1.0.13.0-update-20261027/analysis/`）。下次改版把整個資料夾的 `analysis/*.cjs` 複製過去，以上一版精簡來源當舊版即可（V1.0.14.0、V1.0.15.0 這樣做；`step1.cjs` 的 expression 比對要把舊編號加上上一版的 `expressionOffset`）；精簡來源請留著。

## 踩過的坑

- **版本號在 `gg.json`**：精簡來源與 `data.json` 都沒有版本字串；`package.nw` 的 `gg.json` 第一段就是版本號與該版公告（`unzip -p package.nw gg.json`），用它確認版本並對照改動。解出的檔放 scratchpad 或 repo 外，不要放進 repo（V1.0.14.0）。
- **Steam 公告版號不等於遊戲內版號**：公告「正式更新 版本号1.0.14.2」（2026-10-27）就是 build 26234362，`gg.json` 只寫 V1.0.14.0，更新說明逐字相同，v2.34 已處理。收到新公告時先比 appmanifest 的 `buildid` 與已登錄 build，再拿公告條目對 `gg.json` 第三欄的更新說明；兩者都對得上就不用重做改版。第三方 build 查詢（api.steamcmd.net）可能落後，不能拿來當依據。
- **公式常數改了**：改版可能只改公式的底數（V1.0.14.0 魂魄 1.05→1.04）。資料腳本要依摘要區分新舊值，core 裡用同一公式做的可計算檢查也要跟著改；冒煙時從修改後的等級原生升一級，核對扣費等於新公式。
- **只改資料表時**：函式、寫入點與已審核摘要都沒變，但 tf／js 之類的表格會進 catalog（`batch2Data`）。用 `tables.cjs` 逐格比，找出修改器哪裡讀到這些值；只影響顯示時，冒煙就核對原生計算等於修改器顯示（V1.0.15.0 用 `talentEffects`），並把綁舊數值的測試例改成新值。
- 新版從 `开始界面` 載入較慢，`--probe` 剛載入時讀到的是開始畫面的值；以 `--assert` 的通過為準（v2.28）。
- 背景指令的寫法陷阱見[原生教訓的 Shell 與寫檔](native-lessons.md#shell-與寫檔)。
- **原生函式多了參數**：新版在 `穿戴装备` 等函式末尾加參數時，驗證工具的舊呼叫少傳會變 0，函式靜默不動作。改版時先用 `v[1][2]` 比兩版參數清單，再補工具的呼叫（V1.0.13.0 的庫序號，見[原生教訓](native-lessons.md#冒煙工具)）。
- **存檔層數會變**：新版可能在主場景開始時 `SetSize` 擴層（V1.0.13.0 由 22 變 23）。core 的深度檢查只要求下限，新層要在 `extract-game.cjs` 的 `planeNames` 登錄，並讓 `resolveField` 比照相近的層唯讀，否則它歸「未知層」，自訂座標寫得進去。
