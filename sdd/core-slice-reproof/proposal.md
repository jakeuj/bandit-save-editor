# 降低原生重證成本：core 功能切片與執行層

類型：研究提案（尚未核准實作）。2026-10-23 建立；只新增本文件與進度入口一行，沒有修改程式、證明、基準、旗標或產物，也沒有執行原生遊戲。寶物等級任務 9 的進行中重證不受本提案影響，也不得以本提案的結論改寫其範圍。

## 為什麼做

`scripts/migration-analysis.cjs` 的 `checkDigest` 把整份 core 的 AST 識別（`Core.identity(snap.coreHash,…)`）放進每個群組每個檢查的摘要。只要 `src/core.js` 有可執行語法變動，10 個已開放 family、19 份代表副本全部被標成 native（寶物主線實測 `migration-plan.json`：273 native／5 carried）。

已實測成本：每份副本固定約 20–30 秒（load 約 7 秒；stop／restart／reload 約 12 秒），技藝上限 lifecycle 約 90–110 秒、一般隨機角色成長 lifecycle 約 50–70 秒；19 份依序單執行緒約 10–13 分鐘。開發一個新功能時，只要碰到 core，就得付這一整批，而且 `build-editor` 與 12 項既有測試會因整份 core 綁定失效而失敗（見寶物 SDD 任務 4–8 的阻擋紀錄）。

目標：局部可執行修改只選跑能到達該修改的 family；並把「整批重證」集中到發布前一次。

## 現況盤點

### 三層 core 綁定

| 層 | 位置 | 綁定範圍 | core 局部修改的影響 |
| --- | --- | --- | --- |
| 選跑規劃 | `migration-analysis.cjs` `checkDigest` | 整份 core AST | 19 份全選 |
| 複合證明閘門 | `migration-proof.cjs` `problem`（`Core.matches(source,m.snapshot.coreHash,…)`） | 整份 core AST | 寫回時重產 snapshot 即可；但目前 0 副本時 CLI 直接 `UNCHANGED` 不寫回 |
| 各群組獨立 proof | 技藝上限 `Caps.binding` 的 `formulaHash`、套裝等級 `SetLevel.binding` 的 `coreHash` | 整份 core AST | 這兩組必定失效，build 拒絕 |
| 各群組獨立 proof | 天賦（`// Talent level rules.` 區塊＋成長切片）、成長（`// Exact recruitment feasibility.` 區段＋裝備）、品質（`qualityAttributeEffect` 正則切片） | 原始文字區段 | 區段外修改不失效；但區段內註解也會失效 |

因此只改選跑規劃不夠：技藝上限與套裝等級 proof 仍綁整份 core，任何 core 修改都會讓它們（4 份副本）重跑且 build 拒絕。三層必須一起切片。

### 呼叫圖實測

以 repo 內已鎖版的 `scripts/vendor/acorn.cjs` 解析目前 `src/core.js`（main `cde642f`）：IIFE 內 95 個頂層綁定（函式宣告與 `const`），另有 4 個非宣告頂層敘述（`'use strict'`、`MATERIALS` 繁體化迴圈、`evidenceIndex` 建立迴圈、`globalThis.SaveCore={…}` 匯出）。以各 family 原生情境實際呼叫的公開方法為根（加上共用的 `parse`、`serialize`、`diff`、`transaction`、`undo`、`restoreAll`、`listEntities`），只計識別字參照（不把非計算成員屬性名與物件鍵當參照）：

| 被幾個 family 到達 | 函式數 | 例 |
| --- | --- | --- |
| 1 | 40 | 天賦區塊 8 個、技藝上限與批次 16 個、品質 4 個、成長資質 4 個、丹藥／係數 5 個 |
| 2–3 | 17 | `addExperience`（成長＋技藝上限）、`setEditingValue`（進階＋技藝上限＋套裝）、`characterAptitudeSource`（第二批＋成長資質＋天賦）、`setEquipmentLevel`（套裝＋技藝上限批次） |
| 10 | 34 | `parse`、`serialize`、`put`、`labelFor`、`resolveField`、`editingInfo`、`ordinaryEquipment`、`transaction`、座標與格存取等 |

關鍵路徑：`put → labelFor → resolveField → editingInfo`，以及 `characterAptitudeSource／equipmentQualityInfo → ordinaryEquipment → editingInfo`。也就是說 `editingInfo` 與 `resolveField` 是所有寫入都會經過的樞紐。

用同一方法讀寶物分支（`wip/treasure-level-tasks-4-6`）的 core：寶物修改了 `editingInfo`、`setEditingValue` 與匯出物件，所以**即使已有切片，這次仍會選全部 19 份**。這並非切片無效，而是新功能接入共用分派，實際改變了其他群組的欄位解析路徑（例如 z9 y6 的寶物從一般裝備分支改走寶物分支）。第 2 節的開發規範就是為了避免這種情況。

此實測是研究用的近似：根集合由情境推得，未包含 UI 呼叫與 `C[operation.method]` 白名單核對；正式實作須依下文宣告並測試根集合。

## 1. 依功能切片綁定 core

### 演算法

新增演算法版本 `core-slice-acorn-8.15.0-es2024-v1`（不覆蓋整份 AST 的 v1；舊識別仍可讀）：

1. 用同一鎖版 Acorn 解析整份 core。任何解析失敗、未知語法或下述不可分析構造，**整份 core 退回 v1 全檔摘要**（fail closed）。
2. 取 IIFE 內頂層綁定為節點：`FunctionDeclaration`，以及 `const`／`let` 的識別字宣告（含其初始值，例如 `experienceNeed`、`batchLabels`、`catalogMaps`、`skillGrowthModes`）。解構宣告或其他無法歸屬單一名稱的宣告，歸入共用前導。
3. 邊：節點子樹內所有指向頂層名稱的 `Identifier`；略過非計算成員屬性名與非簡寫物件鍵。不做作用域分析，內層同名遮蔽一律視為參照，屬於安全的過度近似。
4. 共用前導（每個切片都包含）：所有非宣告頂層敘述、指令序言，以及 2. 無法歸屬的宣告。匯出物件 `globalThis.SaveCore={…}` 例外：它只是名稱對照，改以「該 family 根名稱 → 實際綁定名稱」的配對納入切片。新增匯出名稱不影響既有 family；改變既有名稱的指向則會影響。
5. family 切片摘要 = `sha({algorithm, prelude: AST, exports: 根配對, bindings: [[名稱, 正規化 AST]…依名稱排序]})`，AST 正規化沿用 `core-source-proof.cjs` 的 `canonical`（排除位置與 Literal 拼寫，因此註解與排版仍不影響）。

不可分析構造（出現即整份退回 v1）：`eval`、`Function`／`new Function`、`with`、`arguments` 外洩、以非字面值鍵存取頂層函式表以外的頂層綁定、`this` 指向模組物件、讀取函式原始文字（`.toString()` 於函式值）。`core-ast-proof.md` 已規定 core 不得以原始文字反射決定寫入；切片版沿用並加上檢查器。

### 根集合

在 `migration-analysis.cjs` 的 `dependencies` 旁新增 `coreRoots`，每個 family 明列：

- 原生情境操作的公開方法（`verify-game.cjs` 允許的 `scenario.operations` 方法、`C.addExperience`、`C.setField`、`C.applyBatch`、`C.previewBatch` 等）。
- 該 family 的 oracle／lifecycle 腳本經 `SaveCore` 呼叫的方法。
- 共用 I/O 根：`parse`、`serialize`、`diff`、`transaction`、`undo`、`restore`、`restoreAll`、`listEntities`。

測試要求：從 `verify-game.cjs`、各情境產生器與 family 腳本，以 AST 收集所有 `C.xxx`／`SaveCore.xxx`／白名單方法，**每一個都必須出現在對應 family 的根集合**，否則測試失敗；動態 `C[name]` 只允許白名單常數陣列，並逐項比對。

### 共用入口的處理

- `editingInfo`、`setEditingValue`、`resolveField`、`setField`、`put`、`labelFor`、`parse`、`serialize`、`transaction` 與其他 34 個全 family 樞紐不做特例。它們變動時，切片自然讓全部 family 失效，等同現況，不會漏驗。
- 不採用「新分支只對新物品種類生效，所以舊 family 不受影響」的人工豁免。守衛條件是否對舊情境永遠為假，屬於語意問題，靜態工具無法機械證明；加上人工審閱旗標會破壞目前「工具決定、不靠人工宣告」的證據鏈。
- `labelFor` 雖然只產生顯示標籤，但它會呼叫 `resolveField`（可能拋錯），因此仍屬寫入路徑，不排除。

### 三層一起改

1. 選跑規劃：`snapshot` 為每個 family 記錄 `coreSlices[family]`；`checkDigest` 以「本檢查所有 owners 的切片聯集」取代 `coreHash`。
2. 技藝上限與套裝等級 proof：binding 新增 `coreSliceHash`／`coreSliceAlgorithm`；舊 `formulaHash`／`coreHash` 證明仍以舊識別判斷，不改寫首次證明原文。天賦、成長、品質的文字區段 binding 維持不變（它們已比切片寬鬆，由規劃層補足樞紐相依）。
3. 複合證明閘門：`problem` 改為核對每個開放群組所屬 family 的切片，而不是整份 core。CLI 在「同來源、0 副本、但 core 有變」時也須重產 snapshot 並走 `writeSelective`，不能只印 `UNCHANGED` 卻留下不符的 snapshot。

### 安全界線（相對於 `core-ast-proof.md`「可執行語法仍全檔保護」）

第一階段全檔保護的理由是：不需要歸屬分析，不會因間接相依、共用可變狀態或動態分派而漏驗。切片後的保證改為：

- **涵蓋**：family 根集合可經靜態識別字參照到達的頂層綁定、所有共用前導與匯出對照。共用可變狀態（`skillGrowthModes`、`historyStates`、`batchStages`、`catalogMaps`）是頂層 `const`，被參照就納入；它們的初始化敘述變動會影響所有參照者。
- **不涵蓋，由他層負責**：`KNOWLEDGE` 內容（catalog 資料，已由 tables／dataHash 綁定）、`src/ui.js`／`knowledge-ui.js`（UI 檢查另有事件摘要；原生副本本來就不經 UI）、遊戲來源（15 來源指紋）。
- **退回全檔**：任何不可分析構造、解析失敗、根集合測試失敗，或切片演算法版本未知。
- 切片仍不是程式等價證明；它證明的是「這個 family 的原生證據所依賴的 core 程式碼在語法上沒有變」。這與 v1 整份 AST 的保證強度相同，只是範圍縮小到可到達的部分。
- 續跑 checkpoint 的 `inputIdentity` 仍綁精確 core bytes，不改。

### 首次採用

切片摘要須有可信的「前一版」才能比較。既有基準只存整份 `coreHash`，沒有原始碼。比照 `prepare-core-ast-baseline.cjs`：提供工具讀取**精確舊 core**，核對 `Core.hash(old)===snapshot.coreHash` 後計算各 family 切片，寫入新的對照檔。只接受 AST 完全相符的原文，拒絕覆寫。若無相符原文，第一次採用就等同一次全量重證；建議與下一次本來就要全跑的時點（遊戲改版或發布前批次）合併，不另外增加原生成本。

## 2. 開發規範：讓切片真的省下選跑

切片只有在修改落在少數 family 專屬函式時才省得到。規範（建議寫入 `docs/maintenance/core.md`「重建知識與開放寫入」，並在技能「編輯來源」加一行指向）：

1. 新功能以**獨立具名入口**提供資格、預覽與交易（如 `treasureLevelInfo`／`previewTreasureLevel`／`setTreasureLevel`），UI 直接呼叫該入口；不在 `editingInfo`／`setEditingValue` 新增分支。
2. 新功能的唯讀保護若必須進入 `resolveField`（例如自訂座標不可繞過），先在一次預定的全量重證中，把 `resolveField` 的欄位分類改為**資料驅動**：分類規則放進 `KNOWLEDGE`（由 catalog 生成、已有 dataHash 綁定），之後新增欄位分類只改 catalog 規則與新功能自己的入口，不改樞紐程式。此重構本身會讓 19 份全跑一次，須排在已需全跑的時點。
3. 共用工具（座標、格存取、`put`、`transaction`）只在發布前批次修改；開發中需要的輔助函式放在新功能自己的區塊。
4. 每次修改 core 後先跑 `verify-migration.cjs --plan`（純靜態、秒級），在 SDD 停點記錄「本修改會選跑哪些 family、幾份」，碰到樞紐即可提早發現。

估計效果（以目前 19 份、每份平均 30–40 秒計，未實測）：

| 修改位置 | 現況 | 切片後 |
| --- | --- | --- |
| 只改註解／排版 | 0 | 0 |
| 天賦區塊專屬函式 | 19 份／10–13 分 | 2 份／約 2–3 分 |
| 技藝上限或批次專屬函式 | 19 | 2 份／約 2–3 分 |
| 品質專屬函式 | 19 | 4 份／約 2.5 分 |
| `characterAptitudeSource` | 19 | 5 份（第二批、成長資質、天賦）／約 4 分 |
| `setEditingValue` | 19 | 7 份（進階、技藝上限、套裝）／約 5 分 |
| 34 個樞紐之一（含 `editingInfo`） | 19 | 19 |
| 寶物分支現行寫法（改 `editingInfo`） | 19 | 19 |
| 新功能完全走獨立入口（只增匯出名稱） | 19 | 既有 0 份，只跑新功能自己的首次證明 |

## 3. 執行層：並行與情境合併

### 並行 2–4 份隔離副本

目前每份副本已有獨立的 `mkdtemp` 目錄、`game/` 複本、`--user-data-dir` profile、`steam-writes.jsonl`、`cloud-mirror` 與證據 JSON，因此**檔案層面的證據已互相隔離**。阻礙並行的是：

| 項目 | 現況 | 必要調整 |
| --- | --- | --- |
| port | `runMigration` 的 `setupArgs` 不帶 `--port`，所有副本用預設 19384 | 每個 worker 固定配一個 port，寫入 state |
| 錯接風險 | `connect()` 只看 port，不核對該 port 屬於哪個 PID | 連線時核對監聽 port 的 PID 等於 `state.pid` 且命令列含本副本 profile（`--stop` 已有同類檢查）；不符即失敗。並行前必加，否則可能拿到別份副本的證據 |
| 阻塞 | `exec` 是 `spawnSync`，整個 Node 事件迴圈被阻塞 | 改為非同步 `spawn` 與有上限的 worker pool；測試注入的假 `exec` 改成可回傳 Promise |
| 失敗語意 | 依序執行，遇第一個失敗就 `break` | 停止排入新副本、等執行中的副本結束；結果仍標 `completed:false` |
| 結果順序 | `records` 依執行順序 | 依 manifest 順序輸出；UI digests 取 manifest 順序中第一個通過的副本，保持決定性 |
| checkpoint | 每完成一份即寫 | 在單一 Node 程序中序列化寫入（原子 rename 不變）；續跑判定不變 |
| macOS 測試 app | 每份 setup 可能重建共用的 `BANDIT Editor Test.app` | fan-out 前先建好一次；setup 只讀，避免 `rm -rf` 競態 |
| Windows runtime | 每份複製進 `game/` | 磁碟 I/O 隨並行數倍增，需實測 |
| Steam | 每份都真實初始化 greenworks | 同 appid 多程序同時初始化是否被 Steam 拒絕、互相影響 cloud／統計，**未驗證**；必須先以 2 份做探針 |
| 負載 | 載入重試 6 次 × 5 秒 | 並行可能讓 load 變慢、重試耗盡而誤判失敗（屬於安全的失敗，但會增加重跑） |

排程：長副本優先（技藝上限 lifecycle、成長 lifecycle、品質公式矩陣），以縮短關鍵路徑。估計（未實測）：3 個 worker 時，19 份約 5–6 分鐘；下限受最長副本（約 2 分鐘）與 CPU／GPU 爭用限制。並行數用 `--parallel N` 明確指定，預設 1，維持現行行為。

### 同 family 多情境合併到同一副本

不建議第一階段實作：

- 證據格式以「一份副本一個情境」為單位：套裝等級 `provenChecks` 要求每群組恰好一份指定名稱的副本；技藝上限、天賦、寶物的 `validateMigrationCopy`／`readEvidence` 都對單一情境的 scenario hash、manifest 與 state 斷言做核對。合併後必須提升證據格式版本，舊證明無法直接沿用。
- 交互污染：lifecycle 動作（轉職、下獄、重生、解雇、穿卸）會重算衍生值，可能改變同一存檔中其他情境的 oracle 前提；品質 up／down、進階 normal／overcap 也可能落在同類欄位。
- 收益有限：最多可合併的是品質 4→2、進階 3→2 等約 3 份，每份省下固定成本約 20–30 秒，合計約 1–1.5 分鐘。
- 若日後要做，只限沒有 lifecycle、格位互斥且使用同一個 oracle 的代表副本，並且在並行實作之後再評估。

## 4. 開發迴圈規範

規則（建議放在 `docs/maintenance/migration.md` 新增「開發中的原生驗證」小節，並在技能「依任務讀取」的「遊戲改版、來源快取、原生驗證」一列與 `docs/testing.md` 加入連結；本提案不直接改動這些檔案）：

1. 開發分支修改 core 期間，**不跑代表選跑**；只跑 Node／合成測試、該功能自己的原生探針（首次證明所需），以及 `--plan` 靜態影響評估。
2. 既有群組的整批重證只在兩個時點各跑一次：功能 SDD 的「最終 core 確定後重證」任務（寶物為任務 9），以及發布前。最終 core 之後若再改 core，依 `--plan` 補跑受影響的副本，不重跑已通過且切片未變的副本。
3. 開發期間既有證明失效、`build-editor` 拒絕建置屬預期狀態：只能在本機分支提交，不推送，也不以關閉旗標的方式繞過（沿用技能既有規則）。開發中需要瀏覽器驗收時，用測試專用的建置路徑（例如在暫存目錄以候選 catalog 建置），不寫入正式 `index.html`／`sw.js`。是否新增這種開發建置入口列為本提案的待決事項。
4. 每個停點在 SDD 記錄 `--plan` 的選跑數，讓「這次會付多少原生成本」在重證前就可見。

## 風險

| 風險 | 影響 | 緩解 |
| --- | --- | --- |
| 根集合漏列動態入口 | 漏驗 | 根集合覆蓋測試；動態 `C[name]` 只允許常數白名單；不可分析構造整份退回 |
| 頂層可變狀態跨 family 共用 | 漏驗 | 狀態宣告是被參照的頂層綁定，必定納入；前導敘述全部納入 |
| 切片與文字區段 binding 並存，規則變複雜 | 維護成本 | 只在技藝上限、套裝等級改用切片；其他區段 binding 不動，並在 `core-ast-proof.md` 增加對照表 |
| 首次採用缺少精確舊 core | 不得不全跑一次 | 與發布前或改版的全跑合併 |
| 並行時連到錯誤 port | 證據錯置 | PID／profile 核對為並行的前置條件，並加測試 |
| Steam 多實例初始化 | 原生副本失敗或副作用 | 先做 2 份探針；未通過則並行只用於不需 Steam 的步驟，或維持依序 |
| 樞紐修改仍全跑 | 省不到 | 開發規範第 1–3 條；寶物這類接入共用分派的寫法須在設計階段避免 |

## 需調整的測試

- `tests/core-source-proof.test.cjs`：新增切片演算法案例（專屬函式變動只影響一個 family；樞紐變動影響全部；前導敘述變動影響全部；只新增匯出名稱不影響；`eval`／`with`／非字面值鍵存取退回 v1；註解與排版不影響）。
- `tests/selective-migration.test.cjs`：目前斷言「可執行語法變動仍影響全部相關檢查」，改為依切片分流；補充 v1 ↔ 切片識別無法對應時視為變動；0 副本但 core 變動時仍重產 snapshot。
- `tests/version-migration.test.cjs`、`tests/random-character-skill-caps-proof.test.cjs`、`tests/set-equipment-level-proof.test.cjs`：binding 新欄位與舊證明相容讀取。
- 新增 `tests/core-slice-roots.test.cjs`：所有原生腳本使用的 `SaveCore` 方法都必須在對應 family 的根集合中。
- 新增並行測試：假 `exec` 非同步、port 唯一、錯 PID 拒絕、manifest 順序輸出、失敗後停止排入、checkpoint 續跑。
- 首次證明原文（108＋2、535 值、套裝矩陣等）與 `initialVerification` 一律不改。

## 任務草案（待核准）

1. 切片演算法與不可分析構造檢查器（`core-source-proof.cjs` 新版本），以及根集合覆蓋測試。
2. 規劃層改用切片；CLI 處理 0 副本但 core 變動的情況。
3. 技藝上限與套裝等級 binding 加入切片，並相容讀取舊證明；複合閘門改為切片核對。
4. 精確舊 core → 切片對照工具（只新建檔、拒絕覆寫）。
5. `connect()` 的 PID／profile 核對；之後才做非同步 worker pool 與 `--parallel`；2 份 Steam 探針。
6. 開發規範與開發迴圈文件（`core.md`、`migration.md`、技能、`testing.md`），依技能「規則同步檢查」核對 AGENTS 入口。
7. 首次採用：在下一次本來就要全跑的時點建立切片基準，並記錄實際選跑數與時間，驗證本提案的估計。

## 影響範圍

`scripts/core-source-proof.cjs`、`migration-analysis.cjs`、`migration-proof.cjs`、`migration-cli.cjs`、`verify-migration.cjs`、`verify-game.cjs`（`connect`）、技藝上限與套裝等級 proof、相應測試與維護文件。不改 `src/core.js` 的行為、不改遊戲寫入、不改首次證明；真實來源、存檔與原始結果仍留在 repo 外。
