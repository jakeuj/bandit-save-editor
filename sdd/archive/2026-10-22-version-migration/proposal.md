# 版本遷移重驗流水線

需求類型：新功能（維護工具）。對應[功能路線圖](../../../docs/research/feature-roadmap.md#0-版本遷移重驗流水線)第 0 項。2026-10-22 使用者確認四項決策：在這台 Mac 執行、UI 事件未變就沿用 UI 證據、每組跑代表子集、全部通過時自動寫入。

## 為什麼做

遊戲事件或資料表指紋一變，重建就不保留可寫旗標，目前開放的 22 個群組會同時關閉。現有驗證分散在 `verify-game.cjs` 與 7 支專用腳本，每組要手動串十幾個 CLI 步驟；scenario 放在 Windows 機器的 repo 外，品質以外的群組沒有 repo 內生成器。V1.0.11.0 已在測試分支，正式化後若仍逐組手動重驗，修改器會長時間停用；而且之後每新增一個群組，改版成本都會再增加。

Mac 是使用者指定的執行平台，但 `~/bandit-mac-port` 仍是 V1.0.9.1，`launcher/prepare-macos.py` 只接受 V1.0.9.1 腳本指紋。補丁後的 `c3runtime.js` 雜湊也必然不同於 catalog，現行 `verify-game.cjs --setup` 會直接拒絕。

## 要改什麼

- **Mac 指紋鏈**：`prepare-macos.py` 改用已核對腳本指紋清單（V1.0.9.1、V1.0.10.2；V1.0.10.2 的四處路徑替換次數已靜態確認為 1／1／4／4），預設來源改為 `塔防山贼模拟器` 安裝目錄。新增 `--verify-runtime GAME_DIR`，確認副本的 runtime 恰好等於「原始 package.nw 腳本套用已核對替換」的結果。工具仍是單一檔案，Pages 下載不受影響。`verify-game.cjs --setup` 在 darwin 改為：原始 package.nw 的 15 個指紋全符合 catalog，且 `--verify-runtime` 通過，才接受補丁後 runtime；state 同時記錄原始與補丁雜湊。驗證副本輸出到 repo 外的獨立目錄，不覆寫玩家的 `~/bandit-mac-port`。
- **群組清單**：新增 `scripts/verification-suite.cjs`，列出 22 個群組各自使用的 scenario 生成器、原生 oracle／生命週期腳本、必要 checks 與 UI 事件 SID。必要 checks 抽成 build-editor 與清單共用的單一來源。合成測試要求 `catalog.verification` 的每個群組都在清單內，新增群組時忘了加入重驗會直接失敗。
- **代表子集生成器**：依 catalog 決定性產生各家族的代表 scenario，涵蓋邊界與每個開放維度（例如品質每庫每方向：Q1↔Q2、Q5↔Q6 × T1／T9 × 係數兩端；詞條替換：戰鬥／生產／通用池 × Q2／Q6 × 兩端；進階組：一般上界與 1000、科技 #33 的 299）。總共約 10 個隔離副本，取代原本數百件的完整矩陣。verification 標示 `coverage: "representative"` 與實際件數，不沿用舊件數。`prepare-quality-cases.cjs` 的建構邏輯改為共用。
- **後續原生操作**：v2.1／v2.2 的必要 checks 包含後續操作，當初是臨時呼叫，repo 內沒有腳本。2026-10-22 使用者決定全部補寫：新增 `scripts/verify-native-lifecycle.cjs`，以原生函式執行裝備卸下再穿回、轉職與後續職業經驗、建立書院／校場設施後研究與操練啟動再取消、同槽再洗練、服用丹藥及重生清零，維持現有 check 名稱。
- **UI 事件摘要**：`extract-game.cjs` 新增 `eventDigest(game, sids)`，對宣告的 UI 事件子樹產生正規化雜湊。SID 不變；expression 編號換成 factory 原文，物件與 ref 索引換成名稱，避免版本間編號位移造成誤判。在 V1.0.10.2 計算首次選槽與 4 個品質群組的摘要，補記到現有證明。改版時摘要相同，就沿用 UI check 並記錄 `ui.source: "carried"`、來源版本與摘要；不同則該群組維持關閉，並輸出最小 UI 測試清單。只涵蓋宣告的 SID，被呼叫但未列入的函式不在保證內，文件須明載這項限制。
- **流水線**：新增 `scripts/verify-migration.cjs`。依序對每個副本以子程序執行既有 CLI：setup → 載入雲存檔 → oracle → 原生存檔 → assert → 停止 → 新 PID 重啟 → 載入存檔 → assert → oracle `--compare`；需要時再跑生命週期腳本與第二輪讀寫重啟。任一步失敗即停止，並只結束自己的測試 PID。結果 JSON 與原始輸出留在 repo 外。
- **自動寫回**：所有原生 checks 通過，且現有證明的指紋與本次不同時，才寫入 `knowledge/verification.json` 各區段與 `catalog.verification` 旗標，接著執行 `build-editor.cjs` 及 `--check`；建置失敗就還原兩個檔案。UI 摘要不符的群組不算失敗，以關閉狀態寫入並附原生證據。指紋與現有證明相同時（例如本版排練）只輸出比較報告，不覆寫既有的 Windows 完整矩陣證明。不自動提交或推送。
- **規則與文件**：更新 AGENTS.md、`docs/maintenance.md`、`docs/game-ui-testing.md`、專案技能與路線圖，載明三項政策變更：UI 摘要相同可沿用、代表子集可作為新版證明、流水線可寫入公開 verification／catalog。

## 影響範圍

修改 `launcher/prepare-macos.py`、`launcher/README.md`、`scripts/verify-game.cjs`、`scripts/extract-game.cjs`、`scripts/build-editor.cjs`、`scripts/prepare-quality-cases.cjs`、`knowledge/verification.json`、AGENTS.md、`docs/maintenance.md`、`docs/game-ui-testing.md`、`docs/research/feature-roadmap.md` 與專案技能。新增 `scripts/verification-suite.cjs`、`scripts/verify-native-lifecycle.cjs`、`scripts/verify-migration.cjs` 及對應合成測試。不改 `src/` 編輯行為與現有群組的值域。

不在本版：Windows 執行路徑（保留既有手動流程）、遊戲 UI 自動操作、V1.0.11.x 新增欄位的研究，以及真實 Cloud／成就驗證。遊戲 payload、Mac 副本、state、log 與玩家存檔一律留在 repo 外。
