# 整份 core 語法樹證明：第一階段

2026-10-23，使用者授權實作第一階段。範圍是整份 `src/core.js` 的程式綁定；不縮小功能相依、不修改遊戲寫入行為、不重開候選群組。本次在獨立工作樹進行，其他套裝功能開發不納入。

## 演算法與適用界線

共用實作為 `scripts/core-source-proof.cjs`，演算法識別為 `core-estree-acorn-8.15.0-es2024-v1`。Acorn 8.15.0 固定以 ECMAScript 2024、script 模式解析整份程式；解析器附 MIT 授權隨 repo 保存，啟動時核對其版本與檔案 SHA-256。建置及測試副本不需要新增 npm 安裝，網站也不內嵌解析器。

保留整棵語法樹，只排除解析位置與 Literal 的原始拼寫；一般註解不進入 AST。指令序言（如 `use strict`）、字串值、BigInt、非有限數值、正則 pattern／flags、模板 raw／cooked、運算子、順序及函式結構保留。會改變 ASI 行為的換行仍產生不同語法樹，不當作純排版。語法無效、超出支援語法或未知摘要版本均拒絕沿用；新增語法／升級解析器須另增演算法版本，不覆蓋 v1 定義。

此摘要不是任意 JavaScript 程式等價性的證明。原 core 沒有用 eval、Function constructor 或函式原始文字反射決定遊戲寫入；後續不得將這類依賴原始字元的行為視為註解無關。新增這類行為須重新設計摘要政策，不能只以 AST 相同宣稱可沿用。行號、除錯來源位置等不屬於這份遊戲寫入證明的保護目標。

第一階段仍保護整份 core：即使修改其他功能的可執行語法，也會使整份摘要失效。天賦、資質及品質各自原有的區段文字摘要不在本階段改造；若註解變動落在它們綁定的區段，仍可能由該群組拒絕，不能當成整份 AST 檢查的失敗或直接忽略。

## 舊證明與歷史證據

既有 `knowledge/verification.json`、`knowledge/migration-baseline.json` 與首次 108＋2 `initialVerification` 原文保留。新增 `knowledge/core-ast-baselines.json`，只記錄已核對的舊 LF 文字 SHA-256、同一份原始程式的 AST SHA-256，以及來源證明物件摘要。

建立對照時必須拿到與舊證明及遷移基準都完全相符的原始 core，並通過現有證明檢查。不能拿只有 AST 相同、但原始文字已改過的檔案冒充原始證據：

```sh
node scripts/prepare-core-ast-baseline.cjs --source EXACT_LEGACY_CORE --output NEW_BASELINES.json
```

工具只建立新檔，拒絕覆寫；不修改 catalog、原生證明、基準或產物。對照是經核對來源的格式遷移紀錄，不是新一輪遊戲實測。若未持有相符原文，舊格式繼續精確比對文字摘要，不猜測 AST、不靜默升級。新對照檔與其他驗證中繼資料一樣須審閱，不能手動填任意對應關係以略過驗證。

新產生的獨立證明帶 `formulaHashAlgorithm`，遷移快照帶 `coreHashAlgorithm`；未標記者依舊 LF 文字格式判斷。新舊證明比較時使用共用 identity：已核對對照才能將舊 hash 對應至 AST。原生 checks、15 來源、資料摘要、首次矩陣、manifest／evidence hash、版本及生命週期檢查全部保留。

## 三個入口與續跑

- 技藝上限獨立 proof：新 binding 使用 AST，讀舊 proof／結果時保留原 binding 與證據摘要，不重寫首次證明。
- 遷移規劃：snapshot／checkDigest 使用同一版本化 identity；純註解／排版不選原生副本，可執行語法變動仍保守影響全部相關檢查。新舊 identity 無法對應時視為變動。
- 複合 proof：比對當前 core 的 AST；歷史 anchors 的原內容、ID、來源與 native／carried／deferred 證據鏈保持原樣，不把沿用改成實測。
- CLI 的同來源比較與基準檢查也使用共用 identity。續跑 `inputIdentity`、腳本及測試資料則保留精確 bytes；即使只有註解改動，也不得中途接用另一份原始輸入的 checkpoint。

## 驗證

新增 `tests/core-source-proof.test.cjs`，核對註解、縮排、LF／CRLF，以及不能忽略的 return 換行、strict directive、正則、BigInt、模板原文、optional chaining 和語法錯誤。對真實 core 的資格公式、交易、undo／restoreAll、序列化、欄位權限、經驗及批次注入語法變更，要求全部失效。

獨立 proof 與 selective migration 測試同步覆蓋註解沿用、程式變更阻擋、舊格式對照、未知版本拒絕，以及既有的偽造 checks、缺矩陣、錯來源／證據、首次開放限制和寫回回滾。原生遊戲與瀏覽器 UI 本次未重驗；沒有修改產品 core 或產物，不新增遊戲實測宣稱。

本輪驗證：186 項 Node 全部通過（包含實際 builder 的註解沿用／語法變動阻擋案例），建置同步及技能格式檢查通過。既有 `verification.json`、遷移基準、catalog、core、HTML 與 service worker 均未修改；原始工作樹的套裝開發未納入。

## 第二階段：功能切片

2026-10-23 依[降低原生重證成本提案](../../sdd/core-slice-reproof/proposal.md)實作，演算法識別 `core-slice-acorn-8.15.0-es2024-v1`（`scripts/core-source-proof.cjs` 的 `slices`）。第一階段的整份 AST 摘要不變，仍記在快照與證明；切片是額外的比對方式。

- **切片**：同一鎖版 Acorn 解析 core 的單一 IIFE；頂層函式宣告與 `const`／`let` 識別字宣告各為一個節點，其他頂層敘述（指令序言、繁體化與索引迴圈、解構宣告）歸入共用前導。family 切片＝從 `scripts/migration-analysis.cjs` 的 `coreRoots`（經 `SaveCore` 匯出對照）與前導出發，靜態識別字參照可到達的所有頂層綁定；非計算成員屬性名、物件鍵與標籤不算參照，內層同名遮蔽一律視為參照（安全的過度近似）。摘要納入前導、根名稱→綁定名稱配對與排序後的節點 AST，因此註解與排版仍不影響。
- **退回整份 core**：`eval`、`Function`、`with`、`import()`、對頂層函式 `.toString()`、IIFE 以外的頂層敘述、非單純的 `SaveCore` 匯出或重複頂層名稱，任何一項出現即整份不可切片，規劃與閘門改用第一階段整份 AST 比對。
- **規劃層**：快照記錄 `coreSlices`；`checkDigest` 以「該檢查所有 owner family 的切片」取代整份 core 識別。
- **閘門**：`migration-proof.cjs` 的 `problem` 只要求開放群組所屬 owner family 的切片與快照相同；沒有任何開放 family 到達的程式（UI 專用的 `undo`、`restore`、`listEntities` 等）可修改而不需原生重證。
- **既有快照**：v2.11 的快照早於切片，由 `scripts/prepare-core-slice-baseline.cjs` 以 AST 完全相符的已證明 core 計算切片，寫入 `knowledge/core-slice-baselines.json`（只接受精確相符原文、拒絕重複）。之後新寫回的快照直接帶 `coreSlices`。
- **影響報告**：`node scripts/core-slice-report.cjs` 秒級比對目前 core 與證明快照，列出切片改變的 family 與預估代表副本數。
- **根集合覆蓋**：`tests/core-slice-roots.test.cjs` 核對每份代表副本的操作、批次請求、`verify-game.cjs` 的共用步驟與各 family 的 oracle／lifecycle／情境模組使用的 `SaveCore` 方法都在對應 family 的根集合。

實測（每個頂層函式各插入一個無作用敘述）：UI 專用 6 個函式 0 份；品質專屬 4 個函式只選品質 family（4 份）；技藝上限／天賦專屬 19 個函式各 1 個 family（2 份）；`setEditingValue` 5 個 family（10 份）；`ordinaryEquipment` 10 個 family；`parse`、`editingInfo`、`resolveField`、`put` 等 14 個樞紐仍選全部。並行副本（提案第 3 節）尚未實作。

技藝上限、套裝等級、寶物等級的舊式（非複合）證明 binding 仍綁整份 core；目前證明為複合格式，建置閘門統一經 `migration-proof.cjs` 判斷，因此不受影響。天賦、成長資質、品質的文字區段摘要不變。
