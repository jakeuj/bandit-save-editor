# 遊戲改版

[維護索引](../maintenance.md) · [輕量開發流程](lightweight.md) · [版本遷移與本機快取](migration.md)

遊戲改版依[輕量開發流程](lightweight.md#改-core-與遊戲改版)只對受影響的功能跑冒煙，不跑 `verify-migration.cjs` 的代表副本寫回。2026-10-25 V1.0.11.2→V1.0.12.2 第一次這樣做；該次的變動來源、編號位移與冒煙案例見[更新紀錄 v2.28](../releases.md#v228-遊戲-v10122)。來源快取與 `--plan` 的操作見[版本遷移](migration.md)。

## 步驟

1. **查改了什麼**：`verify-migration.cjs --plan` 只用來解出精簡來源、列出變動檔案。它的語意摘要會把物件編號位移當成改變，幾乎所有 family 都會被選中，不能直接當成影響範圍。
2. **逐條比對事件**：把兩版每個事件的條件／動作攤平成一行一筆，物件 `[4,N]`／`[2,N,…]` 換成物件名稱、`sysNN(` 去掉編號，再 diff。剩下的才是真改動。各資料腳本的 `reviewedDigest` 用的 `eventDigest` 不正規化這些編號，所以摘要一定會變；對已審核 SID 做同樣正規化比對，確認只差編號後，把新摘要加進該腳本的已審核清單（舊摘要保留）。
3. **公式編號**：`c3runtime.js` 改變通常是 expression 清單插入新項。用函式本文比對兩版 `g.expressions`，確認 catalog 引用的 expression 都在、內容不變，再把 `extract-game.cjs` 的 `expressionOffset` 調成新位移。
4. **登錄新版**：在 `extract-game.cjs` 的 `reviewed` 加 data.json 指紋、版本與 runtime 指紋；`.local/game-sources.json` 先加一筆 static 項（`packageHash`、build、15 指紋），`prepare-development-cache.cjs` 才肯補完整來源。runtime 檔案集合沒變就直接沿用舊快取。
5. **冒煙**：依真改動挑代表案例。`verify-game.cjs` 會把載入的 catalog 旗標全部打開，候選 catalog 只要指紋對得上新來源。冒煙腳本放 repo 外，工具用法見[原生教訓](native-lessons.md#冒煙工具)。
6. **寫回**：重產 catalog（舊旗標照抄）；`verification.json` 換 `gameVersion`、build、指紋，加 `gameUpdate` 紀錄（變動來源、靜態核對結論、冒煙雜湊）。輕量群組的紀錄改成新版本，另記原冒煙版本 `smokeGameVersion` 與 `gameUpdate` 說明。
7. **歷史證明測試**：舊的複合證明綁 V1.0.11.2，測試會用目前 catalog 去核對它而失敗。V1.0.11.2 的 catalog／verification 已凍結在 `tests/fixtures/v1.0.11.2-release`（gzip），`tests/helpers/legacy-release.cjs` 與 `release-v1.0.11.2.cjs` 從那裡讀；下次改版不用再凍結，除非又寫了新的複合證明。直接比對「目前 catalog 的遊戲版本」的斷言改讀 `knowledge/catalog.json`。知識統計（函式數）照新版更新。
8. 更新紀錄加新版本、README 知識基準與進度入口。Mac 啟動器的 `SCRIPT_SHA256` 可在 Windows 對新版 `c3runtime.js` 做靜態核對後登錄（V1.0.12.2 於 2026-10-25 這樣做，見 [Mac 研究](../research/macos-runtime-investigation.md#v10122-靜態核對2026-10-25)），不必等換到 Mac；Mac 實機啟動與存讀補驗到換 OS 時再做，見 [launcher 說明](../../launcher/README.md)。在 Mac 補驗時先看 appmanifest 的 `buildid`：Steam 正式分支只留最新版，若已更新，就改驗新版（2026-10-27 原本要補 V1.0.12.2，結果改驗 V1.0.13.0）。

## 踩過的坑

- 新版從 `开始界面` 載入較慢，`--probe` 剛載入時讀到的是開始畫面的值；以 `--assert` 的通過為準（v2.28）。
- 背景指令的寫法陷阱見[原生教訓的 Shell 與寫檔](native-lessons.md#shell-與寫檔)。
