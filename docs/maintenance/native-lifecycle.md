# 原生生命週期工具維護

[維護索引](../maintenance.md)；原生操作與各版實測限制見[原生教訓](native-lessons.md)。本頁只管工具程式的組合、分派與驗證。

## 入口與責任

既有 CLI 維持 `node scripts/verify-native-lifecycle.cjs --state EXTERNAL_STATE --scenario EXTERNAL_SCENARIO`。入口只接 `verify-game.cjs` 的 evaluate／waitMain、解析參數及處理失敗結束碼；require 時仍只回傳原有 27 個具名動作，不啟動遊戲或執行動作。

`scripts/native-lifecycle/index.cjs` 的 `createNativeLifecycle(host)` 每次建立新的動作集合與 runner，回傳 `{actions, run}`。各動作群組接收同一個 evaluate、prefix、pause 等明示能力，不自行 require 遊戲 adapter；因此重載 CLI 或以合成 adapter 建立第二組時，不會沿用上一組的連線替身。

| 檔案（位於 scripts/native-lifecycle/） | 責任 |
| --- | --- |
| `runner.cjs` | 外部副本路徑檢查、情境分派順序、收集 expected、寫出 state／結果及成功訊息 |
| `runtime.cjs` | 共用原生 prefix、pause、selectFacility；不連線 |
| `followup.cjs` | 穿卸、轉職、研究與操練的跨流程接續 |
| `cultivation.cjs` | 結丹備料、服丹／重生、資質超限、結丹品質、內丹／寶物備料與升級、天賦效果 |
| `equipment.cjs` | 背包超限、武庫存取與修改後穿卸、備用套裝交換 |
| `relics.cjs` | 擺放／取下、地圖穩定、置物台、靈氣、合成及精煉 |
| `settlement.cjs` | 城牆、城市、基礎／招募科技、建築等級 |
| `affixes.cjs` | 洗練備料、超限詞條及第六槽 |

host 的 evaluate／waitMain 使用既有遊戲 adapter；pause 預設沿用原等待時間，log 預設 console.log，合成測試可替換。scriptDir 指向原本的 `scripts/` 目錄，runner 的 repo 外路徑檢查與 soulUpgrade 的 catalog 讀取都用它。動作群組內的 `scriptDir: __dirname` 別名是為了保留原動作文字與原路徑語意。

## 保留的介面行為

- runner 的 `run(statePath, scenarioPath)` 先讀情境與檢查副本，再 waitMain，依原有順序執行。情境同時有 ascend 與 pills 時，略過結丹備料，讓服丹／重生檢查原紀錄。
- 情境鍵 pills／relics／wall／city 對應 pillsAndRebirth／relicPlacement／wallUpgrade／cityLayer；輸出的鍵名及順序沿用情境分派，不改成函式名。
- 每個動作繼續追加同一個 state.cells；全部動作成功後收集 state.expected，再寫 state 與副本內的 native-lifecycle.json，訊息格式維持 `PASS: native … follow-up actions`。
- 動作拋錯就停止後續動作、觀察與新結果寫出。遊戲內可能已發生前段動作，依既有規則從新的隔離副本重來。
- 共用原生模組只讀情境中的修改器預期值；預期公式、SID、遊戲呼叫參數與旗標開放仍依原研究及驗證紀錄。

## 修改與驗證

改動作時只讀命中的群組與功能研究；新增動作需同步群組回傳、index 的相容匯出、runner 的情境檢查／分派及相關測試。跨群組共用能力維護於 runtime 或明示 host，不以另一組動作的模組快取傳遞連線。

`tests/native-lifecycle.test.cjs` 以合成 adapter 驗分派、結果格式、失敗停止、路徑拒絕、host 隔離及 catalog 路徑；`tests/version-migration.test.cjs`、`tests/pill-ascended.test.cjs` 保留既有動作生成程式與原生回傳斷言測試。可選跑：

```sh
node --test tests/native-lifecycle.test.cjs tests/core-slice-roots.test.cjs tests/version-migration.test.cjs tests/pill-ascended.test.cjs
```

遷移續跑指紋由 `migration-cli.cjs` 遞迴納入 `scripts/**/*.cjs` 的排序路徑與 bytes；改子模組後舊 checkpoint 不再相符。`core-slice-roots.test.cjs` 同樣遞迴檢查 native-lifecycle 內的共用模組不引入 SaveCore 方法。合成測試不連遊戲，也不提供新的原生存讀證明。

2026-11-05 的拆分以 repo 外暫存來源逐字核對 33 個動作／輔助函式及六個共用宣告，保留生成的原生程式模板文字、27 個匯出與分派行為。產品 core／UI、HTML／PWA bytes 均不變；沒有重寫歷史證明或新增永久工具快照。
