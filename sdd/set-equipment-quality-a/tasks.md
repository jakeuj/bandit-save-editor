# 套裝品質 A 任務

狀態：目前主線；A1–A5、A7–A9 已授權並完成（2026-10-23），其餘逐段明確授權。[子提案](proposal.md)／[母規格與全案驗收](../set-equipment-quality/tasks.md)／[進度入口](../../docs/research/next-version-plan.md)。

每項工程操作目標 30–60 分鐘；超時先再拆子 SDD。自動矩陣執行另記分片／checkpoint，完成全部分母才可勾選。

- [x] A1. 核對來源與重用工具：記錄完整來源／runtime manifest、15 指紋、既有生成／測試工具及基準缺口；未知來源或缺表拒絕。
- [x] A2. 擴充最小資料：產出 P原／P套、品質規則與 Q1–Q10 相依摘要；缺來源、錯同階／部位及雙池差異有合成案例，原始表不入 repo。
- [x] A3. 隔離候選共同資格：未選槽限 P原，唯一已選槽可用聯集；測試正式等級及其他入口仍拒絕未補證的新範圍，普通裝備權限不變。
- [x] A4. 實作候選資訊與預覽：驗主副 roll 平移、槽數、雙池、cap 及四方向分派；不寫存檔，正式群組保持關閉。
- [x] A5. 實作候選升品交易：明選新增 P原 尾槽且旗標 0、禁止新增重複，保留原有重複及非交易欄；精確 token 與失敗回滾有合成案例。
- [ ] A6. 實作候選降品與整件還原：刪尾槽確認、刪已選槽／目標超 cap 拒絕；品質→等級→品質、undo、累計還原與無變更合成案例通過。
- [x] A7. 建立獨立交易與生成可達性預期：不讀被測 core 預覽，明列來源生成規則與原生見證待辦；不杜撰原生升品函式或偽造生成結果。
- [x] A8. 建立獨立效果及生命週期預期：涵蓋攻擊 L×Q、取整、主副重疊、舊效果移除、S／N，列兩輪 IO、搬移 50 欄及尾十欄斷言。
- [x] A9. 固定 manifest 與分片契約：列 19,440 基礎案、至少 864 組效果及母規格全部額外維度，拆四群組分母、合法／拒絕／未知／不適用，checkpoint 綁精確輸入。
- [ ] A10. 接線拒絕未證明的 proof 流程：requirements／suite／migration／摘要綁定測試拒絕漏案、重複、錯方向、過期、缺 IO／UI 及僅代表遷移；四群組關閉，交付 B 準備清單。

## 分派

依[任務分派與下一步 prompt](../../docs/maintenance/dispatch.md)產出各段 prompt。思考程度未註明即為「中」。

| 段 | 任務 | 模型 | 思考 | 前置 | 可同時跑 | 改動範圍 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | A4 候選資訊與預覽 | Opus 5.5 | 中 | A3 | 2、3 | `src/core.js` 新入口、候選測試、重建 HTML |
| 2 | A7 獨立交易與生成可達性預期 | Sonnet 5.5 | 中 | A2 | 1、3 | 新 oracle 腳本與測試（不讀被測 core） |
| 3 | A8 獨立效果與生命週期預期 | Sonnet 5.5 | 中 | A2 | 1、2 | 新 oracle 腳本與測試（不讀被測 core） |
| 4 | A5 候選升品交易 | Opus 5.5 | **高**（精確 token、回滾） | A4 | 2、3 | `src/core.js` 新入口 |
| 5 | A6 候選降品與整件還原 | Opus 5.5 | **高**（還原、undo 交錯） | A5 | 2、3 | `src/core.js` 新入口 |
| 6 | A9 manifest 與分片契約 | Sonnet 5.5 | 中 | A7、A8 | 4、5 | 新 scenarios 腳本與測試 |
| 7 | A10 拒絕未證明的 proof 接線 | Sonnet 5.5 | 中 | A6、A9 | — | requirements／suite／migration／proof、catalog 旗標（false） |
| 8 | A 階段交接 | Haiku 5.5 | 低 | A10 | — | 只更新文件：A 收尾紀錄、B 準備清單、進度入口 |

段 1、4、5 依序改 `src/core.js`，一律走新入口、不改共用函式（[core 開發規範](../../docs/maintenance/core.md#新功能的-core-開發規範)）；每段結束時切片報告應為「未變」。段 2、3 與 core 鏈互不重疊，可在各自 worktree 同時跑。

## 驗收條件

- 情境：候選跨池合成測試通過，正式等級入口仍拒絕未證明新範圍，四品質群組仍關閉。
- 情境：交易、預期及 manifest 能交給 B 接續；沒有原生執行也不宣稱原生通過。
- 情境：母規格的完整驗收條件仍須逐項滿足；拆分不減少矩陣、拒絕案例或證據要求。

## 執行紀錄

### A1（2026-10-23）

- 來源：依 `.local/game-sources.json` 的 `preferredDevelopmentSourceId`（`v1.0.11.2-full`）。來源 manifest 274／274、runtime manifest 18／18 的 SHA-256 相符；15 個分析來源指紋與該條目及 catalog 主／補充指紋全部相符。僅讀檔，未重解包、未執行 runtime、未掃描安裝版本。
- 可重用：套裝等級 `set-equipment-level-{data,scenarios,oracle,native,proof}.cjs` 與 `verify-set-equipment-level-*`、`set-level-migration-scenarios.cjs`；寶物 `treasure-level-*` 對應檔（資料模組模式、證據重算）；`equipment-quality-data.cjs`／`prepare-quality-cases.cjs`／`verify-quality*.cjs`（普通品質平移與刪槽結構）；`verification-requirements/suite`、`migration-scenarios/proof` 的 family 註冊模式。
- 缺口：沒有任何套裝品質專用的 oracle、scenarios、native、proof、lifecycle 腳本，也沒有 requirements／suite／migration 註冊（A7–A10）。沒有品質變更後的原生基準：只有套裝等級 B 的 1,944 份取得／合成基準與 12 份生命週期（`H:/bandit-audit/selective-migration-20261023/set-equipment-level-B`，留 repo 外）可作待核對輸入，不計入本案；跨池洗練見證、品質後等級回歸、四群組 IO 皆為 0。
- 未發現未知來源或缺表，無停點。

### A2（2026-10-23）

- 新增 `scripts/set-equipment-quality-data.cjs`：Q1–Q10 各自的 SID／expression 與事件子樹摘要（`reviewedDigests`，來源事件改變即拒絕）、品質規則（主／副係數區間、平移 30／10、槽數、等級上限）、216 個套裝範本的 P套（依 wp23 取自既有 batch2 池），P原沿用 `setEquipmentLevel.origins`；`classify` 供候選測試判斷 origin／set／both／none，並拒絕未知範本與同階／同部位不符；另有 `canPreserve`、`requireClosed`。
- 接進 `scripts/extract-game.cjs` 並以原位附加寫入 `knowledge/catalog.json` 的 `setEquipmentQuality`（只增不刪，其他鍵逐字不變）。**未新增 verification 旗標**；`groups` 四個新名稱尚不在 verification，旗標註冊留到 A10。
- 新增 `tests/set-equipment-quality-data.test.cjs`（合成表，從 catalog 規則重建）：重建一致、缺來源／事件改變／池空或重複／池類型錯誤、錯同階／同部位、雙池 origin／set／both 皆存在、保留條件。原始遊戲表不入 repo。
- `node scripts/core-slice-report.cjs`：core 切片未變；未改 src。

### A3（2026-10-23）

- 新增獨立入口 `setEquipmentQualityCandidateInfo(m,{itemId,plane})`（`src/core.js`，只新增 `globalThis.SaveCore` 匯出名稱）。只讀、不寫存檔、不建交易；沒有修改 `editingInfo`、`setEditingValue`、`resolveField`、`ordinaryEquipment`、`setEquipmentLevelInfo`、`equipmentQualityInfo` 等既有函式，共同檢查在新區塊內另寫。
- 資格規則（資料取自 catalog `setEquipmentQuality` 與 `setEquipmentLevel`）：y27 必須指向 `setEquipmentLevel.origins`（P原），且與 `setEquipmentQuality.pools[y1]`（P套）同階同部位；未選槽 ID 只能來自 P原；唯一已選槽可來自 P原 或 P套，旗標保留並回報 `source`（origin／set／both）。拒絕：多旗標、品質外槽有 ID／係數／旗標、缺或非整數 y27、來源錯同階／部位、P原／P套 皆不含的 ID，以及沿用套裝等級的識別、數量、等階、品質／等級、metadata、主係數與穿戴互指檢查。回傳四群組名稱與 `verified`（目前皆 false）。
- 新增 `tests/set-equipment-quality-candidate.test.cjs`（合成存檔，範本 #28／原裝備 #2，P原 專有、P套 專有、交集 ID 皆存在）：兩庫與穿戴狀態下兩池各自合法、已選槽頭／尾、Q1–Q6 槽數；跨池錯位（P套 放未選槽）、池外 ID、多旗標、缺 y27、錯同階、錯部位、品質外尾槽資料與旗標；正式 `setEquipmentLevelInfo`／`editingInfo`／`setEquipmentLevel`（等級旗標開啟下）、`equipmentQualityInfo`／`previewEquipmentQualityChange`／`setEquipmentQuality` 與 `set`／`setField` 對新跨池範圍仍拒絕且存檔不變；套裝等級合法寫入、關閉旗標拒絕及寶物等級分派不變；候選入口拒絕寶物與普通裝備；四品質群組未註冊、`requireClosed` 仍擋開啟。
- `node scripts/core-slice-report.cjs`：core 切片未變；既有群組沿用，不需選跑。

### A4（2026-10-23）

- 新增獨立入口 `previewSetEquipmentQualityCandidate(m,{itemId,plane,quality,addedAffixes})`（`src/core.js`，緊接 A3 入口，只新增 `globalThis.SaveCore` 匯出名稱）。先跑 A3 候選資格，再回傳預覽：y5 目標、y8 加 `30×ΔQ`、保留槽係數以百分之一整數加 `10×ΔQ`、目標槽數 Q−1、目標 cap `10+5(Q−1)`、每槽 retained／added／removed 及來源（origin／set／both）、兩池、changes 座標與 `requiresRemovalConfirmation`。分派：z7／z9 × 升／降對應四群組名稱，`verified` 讀 verification（目前皆 false）；同品質為 `unchanged`、`group:null`。只回傳預覽，不寫存檔、不建交易，沒有新增寫入入口。
- 拒絕：目標品質非 1–6 整數、等級超過目標 cap（提示先用套裝等級降低，y6 永不在 changes）、已選槽會被移除、新增尾槽數量不符或非連續尾槽、新增 ID 不在 P原（含 P套 專有）、新增與保留槽或彼此重複、新增係數超出目標區間或超過兩位小數；保留既有重複。未修改 `editingInfo`、`setEditingValue`、`ordinaryEquipment`、`equipmentQualityInfo`、`previewEquipmentQualityChange` 等既有函式；效果計算留給 A8 獨立 oracle，本入口不估效果。
- 新增 `tests/set-equipment-quality-preview.test.cjs`（合成存檔，預期值依母規格公式直接寫出，不讀被測預覽）：四方向分派且 changes 只落在 y5／y8／詞條／係數／旗標、升品平移與 P原 尾槽旗標 0、百分之一精度、降品刪尾槽清零、已選 P套 槽保留旗標、既有重複保留／新增重複拒絕、cap 擋降品、各類拒絕、同品質無變更；正式等級／品質入口與 `set`／`setField` 對跨池範圍仍拒絕，SaveCore 只有兩個候選名稱，四群組未註冊。
- `node scripts/core-slice-report.cjs`：core 切片未變；既有群組沿用，不需選跑。`npm test` 267／267、`npm run test:browser` 25／25 通過。未跑原生。

### A5（2026-10-23）

- 新增獨立入口 `applySetEquipmentQualityCandidate(m,{itemId,plane,quality,addedAffixes,advanced})`（`src/core.js`，緊接 A4 入口，只新增 `globalThis.SaveCore` 匯出名稱）。先取 A4 預覽，只接受升品：同品質直接回傳、不建交易與歷史；降品回「降品交易尚未實作」留給 A6；`advanced` 非 false 拒絕；群組旗標（`verification[UP]`）非 true 拒絕。交易沿用 `editing:equipment:庫別:列號`，只 `put` 預覽 changes（y5、y8、保留槽係數、新增尾槽 ID／係數；旗標 0 本即 0 不產生變更），寫入後在同一交易內重讀候選資格與每格值，不符即丟錯回滾。沒有修改 `transaction`、`put`、`setEquipmentQuality`、`previewEquipmentQualityChange` 等既有函式。
- 新增 `tests/set-equipment-quality-transaction.test.cjs`（7 項，旗標只在隔離知識副本開啟；預期 bytes 依母規格公式由獨立 renderer 產生）：兩庫與穿戴升品輸出精確 token、BOM／空白／大型整數／指數保留、changes 不碰非交易欄；已選 P套 槽 ID 與旗標保留、既有重複保留、新增重複／P套／池外拒絕；四群組各自獨立（只開另一庫或降品旗標仍拒絕）、降品與超限拒絕、出貨 catalog 拒絕；同品質無歷史；失敗保留先前等級變更、外層交易丟錯整筆回滾、undo 逐筆回前一交易；連續升品以百分之一累加。正式等級／品質入口與 `set`／`setField` 對跨池範圍仍拒絕。A4 測試的 SaveCore 候選名稱清單同步加入新入口。
- `node scripts/core-slice-report.cjs`：core 切片未變；既有群組沿用，不需選跑。`npm test` 311／311、`npm run test:browser` 25／25 通過。未跑原生；四品質群組未註冊。

### A7（2026-10-23）

- 新增 `scripts/set-equipment-quality-oracle.cjs`：不引入 SaveCore／core／預覽／fixture；規則以來源式（Q1 區間 80+30(Q-1)..80+30Q、10(Q-1)..60+10Q、槽數 Q-1；Q2 上限 10+5(Q-1)）自行計算，池資料以參數傳入。含來源有效性檢查、`transition`（主 +30ΔQ／保留槽 +10ΔQ 的百分之一整數運算、明選 P原 尾槽旗標 0、降品清尾槽、拒絕理由）、30 種轉換列舉、保留欄斷言、可達性普查（216 範本 × 同階同部位原裝備，共 1,458 列；本版資料有 486 列缺原池專有 ID、486 列缺套裝池專有 ID，不假設每套三池）及 `witnessTodo`（W1–W7，全為 pending-native）。`nativeFunctionKnown=null`，不杜撰原生升降品函式，也不產生生成結果。
- 新增 `tests/set-equipment-quality-oracle.test.cjs`（14 項）：區間公式對照 catalog、升降平移與清槽、兩位小數精確、端點平移、30 轉換、拒絕案、雙池、既有重複、失敗不改來源、往返、普查、待辦、獨立性。
- 未改 src／catalog／index.html／sw.js／verification；未跑原生；四品質群組仍關閉。

### A8（2026-10-23）

- 新增 `scripts/set-equipment-quality-effects-oracle.cjs`：不讀被測 core、預覽或原生觀測；單件效果沿用獨立的套裝等級 oracle，品質規則（Q1 主／副係數區間與槽數、Q2 等級上限）、平移、尾槽與 S／N 不變式在本檔另寫。涵蓋 `transition`（主係數 +30·ΔQ、保留槽 +10·ΔQ 以百分之一整數運算、升品明選連續尾槽且旗標 0、降品需確認、拒絕刪已選槽／超目標 cap／新增重複／超範圍或超過兩位小數係數／品質外槽資料）、攻擊 L×Q、取整、主副重疊累加、移除槽的舊效果消失，以及 `assertSetInvariant`（y1／y23、S、N、部位數與額外套裝效果不隨品質或槽內容變動）。
- 生命週期預期：`ioRounds` 列兩輪 IO（編輯後載入→存原格式→停止→重啟→新 PID 讀回；搬移週期後同樣一輪），`validateIO` 檢查兩輪皆為不同 PID 且讀回相同、首輪等於預期；`validateCycle` 斷言搬移 y0–49（owner 依階段）與來源清除，`validateTail`／`monitorTail` 斷言尾十欄 y50–59 留在來源、不進目的列；`lifecycleStarts` 列 3 狀態×升降 6 類起點，加 T1／T9、Q1↔Q6、Q5↔Q6、池、選槽與兩種原位合成路徑等額外軸（實際副本數留 A9）。
- 新增 `tests/set-equipment-quality-effects.test.cjs`（合成紀錄，含正反案例）。這些都是預期值與驗證器，**沒有原生執行，不宣稱原生通過**；原生生成／洗練見證仍待 B。與 A7 的 `set-equipment-quality-oracle` 互不重疊（A7 管交易／可達性，本段管效果／生命週期，檔名加 `-effects`）。未改 src、catalog、index.html、sw.js、verification。

### A9（2026-10-23）

- 新增 `scripts/set-equipment-quality-scenarios.cjs`：固定 manifest（80,110 案）。分類四種：`legal`／`policy-rejection`／`unknown-native`／`not-applicable`（附理由，不計入可執行也不計通過）；目前 63,756 未知原生、4,015 政策拒絕、12,339 不適用，沒有任何案例標為原生通過。
- 維度：基礎 19,440（216 範本 × 30 轉換 × 3 狀態；z7 升／降各 3,240、z9 升／降各 6,480，z9 含未穿戴與穿戴各半）；套裝效果 864 可執行（54 套 × 1–4 部位 × 同／混積分 × 升／降）另列 432 筆五／六件不適用，不造假自然六件；係數端點 630、等級 cap 邊界 270（降品超目標 cap 為拒絕）；雙池 × 選槽 58,320（依 1,458 列真實同階同部位原裝備，缺少專有／交集 ID 的組合列不適用）；生命週期 50（A8 的 6 類起點加 11 個額外軸 × 四群組）；等級回歸 16（兩個既有等級群組的跨池補證，不計入品質群組）；拒絕 88（22 種 × 四群組，升降專屬者在另一方向列不適用）。
- 四群組分母（總數／可執行）：z7 升 18,004／15,053、z7 降 18,004／15,039、z9 升 22,043／18,846、z9 降 22,043／18,817；`denominators` 逐群組逐類型逐分類可對帳，`dimensions` 對應母規格矩陣層次且每層至少一個可執行案例。
- 分片 `shard`（預設只含可執行，依群組／類型過濾，輪流分配且併集恰好一次）、`checkpoint`／`validateCheckpoint`（綁 manifest 摘要、輸入綁定、分片條件與案例 ID 清單）、`emptyProgress`／`recordResult`／`validateProgress`／`summary`（只收合成結果，拒絕原生標示、重複、未知、不適用、改標；摘要逐群組回報且 `nativeComplete`、四群組 `opened` 皆 false）。binding 綁 15 指紋、品質／等級規則摘要、核心雜湊、資料腳本、兩個 oracle 與本腳本、基準與 runtime 雜湊。
- 新增 `tests/set-equipment-quality-scenarios.test.cjs`（11 項）。未新增 requirements／suite／migration 註冊（A10）；未改 src／catalog／index.html／sw.js／verification，沒有原生執行。
