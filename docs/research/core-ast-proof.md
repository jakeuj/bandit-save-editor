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
