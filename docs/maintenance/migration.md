# 版本遷移與本機開發快取

[維護索引](../maintenance.md)；只讀本次任務相關章節。版本與日期標示的實測紀錄只證明當時範圍，現行開放狀態以 catalog／verification 為準（輕量群組見 `knowledge/verification.json` 的 `lightweight`）。

遊戲改版的現行做法見[輕量流程的遊戲改版步驟](lightweight.md#遊戲改版v228-實例)；本頁保留本機快取、`--plan` 來源分析與 Windows 隔離操作等仍會用到的工具說明。2026-10-23–24 的按影響選跑與複合證明移到文末[舊複合遷移工具](#舊複合遷移工具歷史)，只供讀舊證據或診斷。

## 本機開發快取

開發新功能或補原生測試先讀 `.local/game-sources.json` 的 `preferredDevelopmentSourceId`，在 `entries` 取得完整 `source`、獨立 Windows `runtime`、`sourceManifest` 及 `runtimeManifest`。核對 manifest 的逐檔 SHA-256 與該版本 15 來源指紋後，直接沿用 `--source`／`--runtime`，不重新解包；精簡來源仍供版本分析。完整快取不作測試寫入，既有 `verify-game.cjs` 會複製到隱藏、靜音的隔離副本，另傳當次候選 catalog、固定存檔與 repo 外 artifacts。Steam 仍須登入。

完整資源以套件摘要、runtime 以其檔案集合摘要分別快取並保留版本配對，避免 Steam 更新改動舊版測試環境。來源 manifest 是 `source-cache.json`，runtime manifest 是 `runtime-cache.json`；索引可記本機準備工具入口。缺檔或摘要不符才修復相應快取，來源版本已改變先重新辨識版本。`integrityVerified` 只表示檔案核對；`executableVerified` 及功能驗證須以實際隔離測試結果另行記錄。

首次確認快取可執行時，只跑一份隱藏、靜音的隔離副本：確認真實 Steam 初始化、載入、原生存檔，再停止並以新 PID 重啟讀回，核對原始存檔及快取未變後停止程序。成功才更新本機 `executableVerified` 與 `nativeSmoke`，保存 repo 外報告位置、報告雜湊及來源／runtime 配對；這是環境冒煙，不開啟功能權限，也不需要全套或 computer use。之後核對快取時，來源、runtime 及報告雜湊相符就保留成功紀錄，不重跑冒煙。

## 日常更新入口

新工作階段先讀 `.local/game-sources.json`；人類可查 `.local/game-sources.md`。這是 Git 忽略的本機版本／路徑索引，包含來源種類、已核對 build、套件與 15 來源雜湊，以及固定快取根目錄。先查索引並核對檔案，不重掃磁碟或重解同一包；`--package` 沿用索引中的 artifacts 根目錄即可命中既有快取，舊版本比較直接使用記錄的 `--source`。套件已更新或快取缺失／不符時才補建並更新索引。索引只記 metadata，真實存檔及 payload 留在 repo 外，機器路徑不提交。

1. 核對正式分支公告、公告日期與 `appmanifest_4267800.acf` buildid。公告協助縮小範圍，實際判斷仍以來源差異為準。
2. 先跑下列 `--plan`。`--package` 可傳安裝目錄或 `package.nw`；只擷取 15 個分析來源，依整包 SHA 與逐檔雜湊重用 repo 外快取。相同來源不啟動遊戲，不必每次完整解包圖片、音樂及 runtime。
3. 未知事件／runtime 的知識生成仍須靜態查核：依 SID 確認後更新生成器來源清單、重建候選 catalog。`--plan` 可以先分析未知來源；真正寫回要求 `--catalog` 與實際 15 來源完全相符。格式無法解析就留下待查報告及既有發布版，不升級成 UI 操作或自行宣稱相容。
4. 依[遊戲改版步驟](lightweight.md#遊戲改版v228-實例)逐條比對事件、只對真改動跑冒煙；不再去掉 `--plan` 以代表副本寫回。

```sh
node scripts/verify-migration.cjs --package STEAM_GAME_DIR --artifacts EXTERNAL_DIR --plan
```

公告連結可加 `--announcement URL` 寫入分析報告；預設終端只印摘要及報告位置，需逐步 log 才加 `--verbose`。純知識更新本機用 `npm run verify:knowledge`，受影響功能另補相關 Node，完整 `verify:release` 僅於使用者要求或具體故障需要時執行；Pages 預設只檢查建置同步，手動 `full_verify` 才跑完整驗收。驗證框架或編輯器變更依[測試指引](../testing.md)跑相關測試。

Mac 啟動器不是每個 Windows 版本的固定驗收項。明確處理 Mac 時才依 [launcher 說明](../../launcher/README.md)核對路徑補丁與獨立準備來源；`--source` 傳補丁後完整副本，`--package` 指原安裝供驗證來源。Windows 沿用／原生結果不能擴張成 Mac 已實測。

## Windows 隔離遷移操作

冒煙使用相符的 15 來源、安裝所附 runtime 與固定基準存檔（`verify-game.cjs`／`verify-native-lifecycle.cjs`）；所有 artifacts 放 repo 外。Windows 建議加 `--keep-copies`，避免通過副本在清理階段因檔案鎖 `EPERM` 失敗，保留診斷直到自己的程序完全退出；不要清理玩家安裝或存檔。

`verify-game.cjs` 的 CDP 探索請求使用 `Connection: close`：NW.js 停止並以新 PID 重啟後，避免同一 Node 程序重用舊 HTTP socket，造成 checkpoint 重啟後連線中斷。這是驗證器的連線收尾，不需修改遊戲或系統網路設定。

本機瀏覽器過濾器（例如 AdGuard）若改寫 loopback 埠的 HTML，PWA 驗證會失敗；設定方式見[測試指引](../testing.md)，不調整全機過濾器，也不放寬 PWA 測試。故障背景見[V1.0.11.2 紀錄](../research/v1.0.11.2-audit.md#windows-隔離驗證)。

## 舊複合遷移工具（歷史）

2026-10-23 起依[已核准規格](../../sdd/selective-migration/proposal.md)使用、2026-10-24 由[輕量開發流程](lightweight.md)取代的規則；不再是預設流程或建置條件。`scripts/migration-proof.cjs` 等工具與舊證據仍保留，下列說明供讀舊紀錄與必要時診斷。

### 版本遷移重驗

2026-10-23 起依[已核准規格](../../sdd/selective-migration/proposal.md)按影響選跑。預設 `auto`：語意未變沿用，只有相關功能改變才啟動隱藏、靜音的隔離遊戲。例行更新不使用 computer use；UI 疑慮先記錄，實際故障再針對性複查，使用者明確要求才操作桌面。此次成本與重播結果見[精簡流程紀錄](../research/selective-migration.md)。

### 開發中的原生驗證

1. 開發分支修改 core 期間**不跑代表選跑**；只跑 Node／合成測試、新功能自己的原生探針（首次證明所需），以及 `node scripts/core-slice-report.cjs` 靜態影響評估。
2. 既有群組的重證每版只跑一次：功能 SDD 的「最終 core 確定後重證」任務；之後若再改 core，依切片報告只補跑受影響的 family，不重跑切片未變的副本。
3. 開發期間既有證明失效、`build-editor` 拒絕建置屬預期：只在本機分支提交，不推送，也不以關閉旗標繞過。需要瀏覽器驗收時，用 `tests/browser/site.cjs` 的候選站（`createSite({candidate})`），不寫入正式 `index.html`／`sw.js`。
4. 每個 SDD 停點記錄切片報告的變動 family 與預估副本數，讓原生成本在重證前就可見。
5. 選跑規劃、複合證明閘門都以 family 切片核對 core（[切片綁定](../research/core-ast-proof.md#第二階段功能切片)）；切片無法分析時退回整份 core。
6. **重證成本紀錄與改善提示**：每次實際跑完既有群組的原生重證（代表選跑、版本遷移、發布前全跑），立即記入 [`docs/research/reproof-ledger.json`](../research/reproof-ledger.json)：`node scripts/reproof-cost.cjs --record --trigger core-change|game-update|release|other --copies N --total 全部代表副本數 --minutes 實際分鐘`（可加 `--families`、`--note`）。新功能自己的首次證明探針不記。`node scripts/core-slice-report.cjs` 與 `node scripts/reproof-cost.cjs` 會依門檻（預設近 60 天 ≥2 次重跑過半副本、累計 ≥30 分鐘，或下一次重證預估過半且會是近期第 2 次）印出「提示：」，表示[並行副本](../../sdd/core-slice-reproof/proposal.md#3-執行層並行與情境合併)值得做。看到提示時主動向使用者提出；使用者暫緩記 `--decline`（下一次重證後才再提），做完記 `--done`。門檻改在紀錄檔的 `thresholds`。

代表寫回指令（歷史）：

```sh
node scripts/verify-migration.cjs --package STEAM_GAME_DIR --artifacts EXTERNAL_DIR --catalog CANDIDATE.json --runtime STEAM_GAME_DIR/game.exe --save-file BASE.dat
```

### 相依與證據

`migration-analysis.cjs` 宣告各家族的存讀、公式、生命週期、必要資料表與寫入區域。語意摘要解析 expression、物件與 bound-reference 編號、變數 SID／初值及被呼叫函式；保留常數、條件、寫入位置和未知項目。只排除已辨識的顯示操作與職業文案欄，並將已核對的套裝合成動態庫別限制在裝備範圍。未宣告、缺失或不支援的原生相依資訊不能當作未變。

`knowledge/migration-baseline.json` 只保存摘要與指紋，不含遊戲 payload。repo 已附 V1.0.11.2 基準；需要初建時，以相符已驗證來源執行 `--baseline`，工具先檢查現有建置證明，不能用未驗證的新來源建立沿用基準。

- 來源、相依與編輯器程式都未變：不跑原生測試，完整重跑也只比較，不覆寫首次完整矩陣。
- 公式／規則改變：跑該家族的效果及原版存讀；未變的生命週期沿用。生命週期改變只選對應副本；共用 IO 改變才擴大。
- 品質公式矩陣依相符來源／規則共用，未變省略，有變最多在一份完成副本執行一次。
- 新版複合證明逐項保存 `native`／`carried`／`deferred`；沿用直指原始實測版本與摘要，連續改版不堆疊證據鏈。未跑項目不填原生通過；UI 記為本版未重驗，不阻擋既有功能。
- 新增可寫群組仍走獨立首次證明，不能以代表遷移或 UI 未重驗政策首次開放。

建置與各獨立 proof 檢查器共用複合證據閘門，核對當前 15 來源、核心程式、規則摘要、原始證據與群組覆蓋。完成所有選跑及合法沿用後才更新 catalog／verification／基準，重建 HTML／SW；失敗還原五份檔案。不提交或推送。

### 擴大與續跑

`--mode full` 明確要求全部代表副本，目前為 15 份；UI 仍不自動操作。`--copies name,name` 供診斷，未知或重複名稱立即報錯，且不寫回正式證明。`--previous-source OLD_SOURCE --plan` 可重播兩版靜態分析，不能用來寫入證明。

原生執行每完成一份副本立即保存 repo 外 `checkpoint.json`。中斷後用原參數加 `--resume RUN_DIR`；來源、候選 catalog、驗證工具、核心程式、runtime、基準存檔及情境都須相符，完成證據檔也須逐一匹配，才重用成功副本；失敗／未跑的副本從頭重試。工具／輸入或證據改變就拒絕續用，不把舊成功帶到新條件。

清理只針對本輪外部目錄，失敗記為告警，不取消測試結果；`--keep-copies` 保留完整副本。原始存檔、state、checkpoint、原生觀察及 log 都不能提交。
