# 套裝品質 A 任務

狀態：目前主線；A1–A3 已授權並完成（2026-10-23），A4 起逐段明確授權。[子提案](proposal.md)／[母規格與全案驗收](../set-equipment-quality/tasks.md)／[進度入口](../../docs/research/next-version-plan.md)。

每項工程操作目標 30–60 分鐘；超時先再拆子 SDD。自動矩陣執行另記分片／checkpoint，完成全部分母才可勾選。

- [x] A1. 核對來源與重用工具：記錄完整來源／runtime manifest、15 指紋、既有生成／測試工具及基準缺口；未知來源或缺表拒絕。
- [x] A2. 擴充最小資料：產出 P原／P套、品質規則與 Q1–Q10 相依摘要；缺來源、錯同階／部位及雙池差異有合成案例，原始表不入 repo。
- [x] A3. 隔離候選共同資格：未選槽限 P原，唯一已選槽可用聯集；測試正式等級及其他入口仍拒絕未補證的新範圍，普通裝備權限不變。
- [ ] A4. 實作候選資訊與預覽：驗主副 roll 平移、槽數、雙池、cap 及四方向分派；不寫存檔，正式群組保持關閉。
- [ ] A5. 實作候選升品交易：明選新增 P原 尾槽且旗標 0、禁止新增重複，保留原有重複及非交易欄；精確 token 與失敗回滾有合成案例。
- [ ] A6. 實作候選降品與整件還原：刪尾槽確認、刪已選槽／目標超 cap 拒絕；品質→等級→品質、undo、累計還原與無變更合成案例通過。
- [ ] A7. 建立獨立交易與生成可達性預期：不讀被測 core 預覽，明列來源生成規則與原生見證待辦；不杜撰原生升品函式或偽造生成結果。
- [ ] A8. 建立獨立效果及生命週期預期：涵蓋攻擊 L×Q、取整、主副重疊、舊效果移除、S／N，列兩輪 IO、搬移 50 欄及尾十欄斷言。
- [ ] A9. 固定 manifest 與分片契約：列 19,440 基礎案、至少 864 組效果及母規格全部額外維度，拆四群組分母、合法／拒絕／未知／不適用，checkpoint 綁精確輸入。
- [ ] A10. 接線拒絕未證明的 proof 流程：requirements／suite／migration／摘要綁定測試拒絕漏案、重複、錯方向、過期、缺 IO／UI 及僅代表遷移；四群組關閉，交付 B 準備清單。

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
