# 套裝品質 B 任務

狀態：全部未執行，尚未授權實作。[子提案](proposal.md)／[母規格與全案驗收](../set-equipment-quality/tasks.md)。目前主線為套裝品質；A 階段已完成（2026-10-23），B 待使用者授權（見[進度入口](../../docs/research/next-version-plan.md)）。

每項工程操作目標 30–60 分鐘；超時先再拆子 SDD。自動矩陣執行另記分片／checkpoint，完成全部分母才可勾選。

- [x] B1. 核對並補取得原生基準：只補缺 Q／池／材料與洗練見證，保存生成／合成履歷；至少有套裝池專有 ID，未抽到維持缺案，原檔／快取雜湊不變。
- [x] B2. 固定生命週期副本與執行接線：建立三狀態×升降至少六類起點及覆蓋表，沿用 runner 接兩輪 IO／新 PID；不足則加副本，不編造 metadata。
- [x] B3. 完成候選介面與停用驗收：預覽庫別／方向、雙池、增刪槽、效果及確認重設，驗拒絕與未證明方向停用；隔離候選測試不計為正式可用驗收。
- [ ] B4. 執行首次矩陣與生命週期分片：交易／效果、成本、洗練舊效果移除、穿卸／搬移／排序、兩輪 IO／新 PID 全部對帳；完整 manifest 結束才勾選，未命中與失敗不縮分母。
- [ ] B5. 完成必要原版 UI 證據：依當次明確授權驗品質顯示、槽數與已選槽停用／洗練；未授權或失敗保留缺口，不開相關群組。
- [ ] B6. 補既有套裝等級兩庫跨池證明：各自獨立原生證明與原池回歸，驗合法等級、cap、效果、IO 及品質交錯 undo／還原；此時正式入口仍不擴權。
- [ ] B7. 核對最終 core 相依並重驗：完成技藝上限及其他受影響既有群組重驗，保留未受影響證據；不得只換摘要或關閉既有功能。後續核心若再變須重新核對。
- [ ] B8. 在隔離待交付快照合併證明：從原始結果重算四群組覆蓋；B4–B7 證據齊備才接入相應品質方向及已補證等級資格，固定快照供 B9，尚不交付開閘產物。
- [ ] B9. 驗正式入口可用流程：在 B8 快照驗已證明方向套用、未證明方向拒絕、下載 bytes／重載、undo／還原、桌面／390px、file、PWA 離線／交接；失敗撤回候選開閘，不能沿用 B3 結果。
- [ ] B10. 完成整合交付檢查：B9 通過後同步建置與研究／驗收紀錄，執行相關 Node／proof／遷移檢查，確認無既有功能回歸；記錄每群組狀態及缺口，提交發布依當次授權。

## 分派

由主 session 依[任務分派與子 session](../../docs/maintenance/dispatch.md)開各段子 session。B 依賴 A 全部完成；原生遊戲同時只能有一段在跑。

| 段 | 任務 | 模型 | 思考 | 前置 | 可同時跑 | 備註 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | B1 補原生基準 | Opus 5.5 | 中 | A 全部 | 3 | 原生；缺見證時判斷是否改規格 |
| 2 | B2 生命週期副本與接線 | Sonnet 5.5 | 中 | B1 | 3 | 原生小分片校正 |
| 3 | B3 候選介面與停用驗收 | Sonnet 5.5 | 中 | A 全部 | 1、2 | 不跑原生；用候選站跑瀏覽器 |
| 4 | B4 首次矩陣與生命週期分片 | Sonnet 5.5 | 中 | B2 | 3 | 原生長跑、可續跑；遇到原生反證改交 Opus |
| 5 | B6 套裝等級跨池證明 | Opus 5.5 | 中 | B4 | 3 | 原生；與 B4 不可同時跑 |
| 6 | B5 原版 UI 證據 | Opus 5.5 | 中 | B4，且使用者當次授權 | — | 需 computer use；未授權就保留缺口 |
| 7 | B7 最終 core 相依重驗 | Sonnet 5.5 | 中 | 最終 core 確定 | — | 先跑切片報告，只重證切片改變的 family |
| 8 | B8 合併證明 | Opus 5.5 | **高**（證明閘門） | B4–B7 | — | |
| 9 | B9 正式入口驗收 | Sonnet 5.5 | 中 | B8 | — | 瀏覽器全套 |
| 10 | B10 整合交付 | Haiku 5.5 | 低 | B9 | — | 照最短流程推送；更新紀錄與進度入口 |

## 驗收條件

- 情境：B3 候選畫面通過但缺原生或原版 UI 證據，仍不能交付開放功能。
- 情境：各方向原生證明與既有等級補證通過，再合併快照並通過 B9 正式操作驗收；所有證據須與最終程式相符。
- 情境：母規格的完整驗收條件仍須逐項滿足；拆分不減少矩陣、拒絕案例或證據要求。

## 執行紀錄

### B1（2026-10-23）

- 來源：`.local/game-sources.json` 的 `v1.0.11.2-full`；來源 manifest 274／274、runtime manifest 18／18 逐檔 SHA-256 相符，15 指紋與索引及 catalog 相符；執行前後重驗不變。只開一份隱藏、靜音隔離副本（Steam 真實初始化），未用 computer use、未開原版桌面 UI。
- 既有輸入：套裝等級 B 的 1,944 份取得／合成基準逐件離線重驗（指紋綁定相符、合成只改 y1／23／24／26／27、所有有效槽在 y27 原池、旗標 0、品質外尾槽空、主／副係數在區間），0 問題、0 反證；Q1–Q6 每範本齊備、y23≠y5 共 1,512 件。這些只作基準輸入，不計品質通過。
- 補取得（新腳本 `scripts/set-equipment-quality-baseline.cjs`，取得沿用已審 `set-equipment-level-native.cjs` 的「特定装备」＋`套装合成`）：
  - 詞條池：補 1,242 份同階同部位原裝備列（Q6、積分 3），與既有合計涵蓋 reachability 普查全部 1,458 列；0 問題、0 反證。
  - 洗練：對 P套 有專有 ID 的 1,107 組（z7 972 組全部原池列；z9 未穿戴 135 組為等級基準原池列），以原生 `词条洗练` 對槽 1 連續洗練（首次選槽後同槽重洗），保存每次洗前後全 60 欄與魂魄成本。1,107／1,107 命中套裝池專有 ID，共 4,068 次、每組 1–45 次（中位 1），每次成本 100 魂魄；每次結果皆在 y1 的 P套、係數在目前 Q 區間、該槽旗標 1、其他 57 欄不變。未改寫或挑選原生結果，只在命中後停止。
  - IO：將 30 件 z7 與 30 件 z9 洗後專有 ID 紀錄及 10 件新合成紀錄放入隔離存檔，原生存檔→停止→新 PID 重啟（29972→58532）→讀取存档，70／70 列逐欄相符。
- 原檔／快取：固定基準存檔、玩家原檔、等級基準檔及兩份快取 manifest 檔案集合前後雜湊相同。
- 規格核對：合成保留槽、洗練依 y1 套裝池、只改指定槽，與母規格一致；無規格衝突。
- A9 外部輸入雜湊（SHA-256）：
  - 基準 `baselineHash`：`b522b7b9f81ed982839fd5fdc197978de9f07c7c572b7571e8b9ef94f3e4a865`（等級基準檔、固定存檔與 B1 取得／洗練／IO 三份結果雜湊的組合摘要）
  - runtime `runtimeHash`：`bb65d6b2d194c663381d6a32185372d05d18ea96bfad5273f26ee71c219a6aab`
  - 來源 manifest `sourceManifestHash`：`236b90055001b53b2075eb8ffa8b119b89ea3e35a264b673e5bc3da8260ab372`
  - runtime manifest `runtimeManifestHash`：`80c05d896a992ebd05994f36e8f67e366fa804eab4cd835b51596b9a40acd0b2`
  - 其他：等級基準檔 `090290ff…48327`、固定存檔 `ebb0a4a2…84c5`、取得 `1036bdff…8e4c`、洗練 `d22770b9…d4ea5`、IO `cf5aafaa…0194`、報告 `1c25704e…174d`；原始結果與 log 留 repo 外 B1 artifacts 目錄。
- 見證：W1 已取得（Q1–Q6 起點／目標生成履歷）；W2 已取得（取得／合成後全槽在 y27 原池、旗標 0；品質編輯新增尾槽的原生讀回屬 B4）；W3 已取得（z7／z9 套裝池專有 ID 洗練見證）；W4–W7 不適用於 B1（品質平移讀回、降品刪槽、品質與等級交錯、穿卸／搬移歸屬由 B2／B4／B6 取得）。
- 缺案／界線：只洗槽 1（已選槽在尾、多槽組合與既有重複的實例屬 B4 雙池分片）；z9 只有未穿戴，穿戴者洗練屬 B2／B4。主係數固定 95+30(Q−1)，端點屬 B4 係數維度。
- 驗證：新增 `tests/set-equipment-quality-baseline.test.cjs`（7 項，合成資料）；`npm test` 334／334；`node scripts/core-slice-report.cjs` 為「core 切片未變」。未改 src、index.html、sw.js、knowledge、verification；四品質群組維持 false，未合併任何證明。

### B3（2026-10-23）

- 新增獨立唯讀入口 `setEquipmentQualityCandidateEffects(m,{itemId,plane,quality,addedAffixes})`（`src/core.js`，只新增 `SaveCore` 匯出，已加入 `coreRoots.setEquipmentQuality`）：取候選資格與預覽，對前後紀錄各算單件各屬性效果（公式與 A8 oracle 分開撰寫，測試逐屬性與 `effectChange` 對拍），不寫存檔、不建交易。未改 `editingInfo`、`setEditingValue`、`resolveField`、`ordinaryEquipment`、`equipmentQuality*`、`setEquipmentLevel*`、`transaction`、`put`、`restore`、`undo`。
- 新增 UI 卡片 `setQualityEditor`（`src/knowledge-ui.js` `renderSetQuality`、`index.html`）：只列套裝裝備；顯示庫別／方向／群組與驗證狀態、P原／P套 詞條池與每槽來源、新增尾槽的 P原 選擇與係數、刪尾槽確認、主係數與 cap、效果前後；旗標為 false 的方向停用「套用」並顯示原因；拒絕（超 cap、刪已選槽、重複、池外、係數越界、未明選）顯示 core 訊息；「重設選項與確認」清除輸入與確認。普通裝備品質卡與套裝等級介面未改動。
- 測試：`tests/set-equipment-quality-ui.test.cjs`（9 項，真實 widget 搭 DOM adapter；旗標只在隔離知識副本開啟）與 `tests/browser/set-equipment-quality.spec.cjs`（桌面／390px，出貨旗標下可預覽、套用停用、無橫向溢位）。既有 preview／proof 測試的名稱清單同步加入新入口。`node scripts/core-slice-report.cjs`：切片未變。`npm test` 336／336、`npm run test:browser` 27／27。
- 範圍：四群組旗標維持 false，未改 verification／catalog 旗標與進度入口；未跑原生。隔離候選測試只算 B3 候選驗收，不算正式可用驗收（B9）。

### B2（2026-10-23）

- 新 runner `scripts/verify-set-equipment-quality-migration-lifecycle.cjs`（取代失敗占位；未給 `--output` 仍拒絕且不產生結果）。起點：固定基準存檔清空後只放一件，經候選 `applySetEquipmentQualityCandidate`（品質旗標只在隔離知識副本開啟，`knowledge/` 與 catalog 不動）寫成 bytes，並與 A7／A8 兩支 oracle 對拍；原生載入該 bytes。`planCopies` 依 B1 引用的等級基準（1,944 份）選範本，`--per-class 2` 可加第二份。
- 六類起點（各 1 件，不同範本，T1／T9 交替）：背包升 Q2→3、背包降 Q4→3、未穿戴升 Q2→3、未穿戴降 Q4→3、穿戴升 Q2→3、穿戴降 Q4→3，各對到 A9 `lifecycle:<state>-<direction>` 基礎案。覆蓋表（`coverage`，產物 `b2-report.json`）逐 A9 生命週期案列狀態：基礎 6 案由六類各自通過；另 `tier-1`／`tier-9` 軸依副本階數在對應群組計入。四群組可執行生命週期案 9／9／10／10，已通過 1／1／2／2，其餘 32 案維持待 B4（Q 轉換軸、池／選槽軸、合成路徑軸、跨群組額外軸），不適用 12 案不計。覆蓋表只計副本實際通過者。
- 流程（原生、隱藏靜音、同時一份隔離副本，Steam 真實初始化；未用 computer use、未開原版桌面 UI）：第一輪＝載入編輯 bytes→逐欄讀回等於編輯結果（含角色指標）→原版存檔→停止→新 PID→讀取存档→讀回相同；第二輪＝原生同槽洗練（`词条洗练`，魂魄成本 100／次）→穿卸／搬移（背包起點 equip→unequip，裝備庫起點 takeout→equip→unequip）→原生 `装备排序`→再存讀；兩輪 PID 皆不同。監看 y0–59 與角色指標六格；每次搬移前在來源列種下 y50–59 標記。
- 原生觀察（與規格一致，無反證）：搬移只複製 y0–49，來源 y0–49 清零、y50–59 保留，標記沒有進入目的列；目的列沿用自己原有的 y50–59（`unequip` 回到原背包列時看到的是前次種下的標記，屬該列殘留而非複製，故標記改為每步各自種下）。洗練只改該槽 ID／係數／旗標三欄，結果在 P套、係數在目前 Q 區間、旗標 1；`装备排序` 對資料列無位置或內容變動（背包另放一件佔位裝備），之後以身分找回唯一一件。穿戴者洗練後搬移與新 PID 讀回通過。背包起點 5／4 次洗出套裝池專有 ID，其餘四類該範本套裝池無專有 ID，洗 1 次、記為未命中而非失敗。
- 校正結果：六類各 1 件全部通過，逐案輸出 `{id,caseHash,passed,nativeCompared:true}` 六筆（caseHash 為目前 A9 manifest 的案例摘要：backpack-up `0beadb7d…`、backpack-down `5b78cc91…`、stored-up `6afc56b0…`、stored-down `9def2605…`、equipped-up `c7a727b3…`、equipped-down `a60c6826…`）。這只是 runner 校正，不是 B4 完整矩陣，不合併任何證明，四群組仍 false、缺 UI 證據。
- 綁定與雜湊（SHA-256）：manifest `240c8b5c…e09679cd`、runner `3be470c4…c82af6505`、核心 `69b462a0…40bf1d6d5`、結果檔 `4df28e3f…bcfa47f33e`、固定基準存檔 `ebb0a4a2…84c5`（外部輸入四雜湊沿用 B1）。原始結果、起點存檔與 log 在 repo 外 `set-equipment-quality-B2`；執行前後固定存檔、玩家原檔、等級基準與兩份快取 manifest 雜湊相同。第一次嘗試誤把「回到原列的目的列有標記」當成複製而失敗，改為每步各自種下標記後重跑，舊結果收入 `superseded`，最終以此 runner 重跑六類。
- B4 可直接開跑的條件：沿用同一 runner 的 `playCopy`／`lifecycleDriver`／`validateCopy`，`--per-class 2` 可加副本；其餘 32 個生命週期軸需 B4 擴充 `planCopies` 的起點；runner 尚無依 A9 完整案例清單的分片排程與續跑（B4 需補）。
- 驗證：新增 `tests/set-equipment-quality-lifecycle.test.cjs`（8 項，合成資料與記憶體引擎驅動真 driver：規劃、bytes 對拍、六類報告、尾十欄／清除／PID／洗練／排序拒絕、覆蓋表與逐案格式、不可合併證明）；A10 占位測試改為「未給 --output 拒絕」。`npm test` 351／351；`node scripts/core-slice-report.cjs`：core 切片未變。未改 src、index.html、sw.js、knowledge、旗標與進度入口。

### B4（2026-10-23）

#### 工程（原生長跑前）

- 新矩陣 runner `scripts/verify-set-equipment-quality.cjs`（取代失敗占位；未給 `--output` 仍拒絕）＋`scripts/set-equipment-quality-matrix.cjs`（情境、驗證器、原生 driver、checkpoint）。範圍＝A9 manifest 的 `base`／`effect`／`coefficient`／`level-cap`／`pool`／`reject`；`lifecycle` 走擴充後的 B2 runner；`level-regression` 16 案屬 B6 的跨池補證，不在本段、也不縮進任何分母。
- 每案流程：原生取得／合成的起點（沿用 1,944 份等級基準，其餘原池／階段由 `generate` 現取，快取於 repo 外 `supply.jsonl`）→ 候選 core 交易（品質旗標只在隔離知識副本）→ 與 A7／A8 oracle 逐欄對拍（不讀 core 當答案）→ 同一批列放進隔離遊戲：原生讀回、單件效果（`装备主属性`，編輯前後）、穿戴者全角色效果與套裝摘要（`装备属性计算`／`套装数量检測`）、原生同槽洗練（魂魄成本、其他槽不變、舊槽貢獻移除，再以核心資格 API 與預覽核對洗練後可再轉換）、依狀態的搬移（`装备库存入`／`装备库取出`／`卸下装备`，y0–49 與 owner／指標）、原生 `升级装备` 的 cap 探測。拒絕案：核心拒絕且不留變更，原生只讀回起點。
- 係數端點：主係數端點先請原生取得（`获得物品` 帶端點）；原生不給或副係數端點、百分之一邊界、已選槽的 P原專有／交集 ID 無法由原生產生者，以 `injected` 標示後寫入原生放置，仍由原生讀回與重算效果。P套專有的已選槽一律來自原生洗練（最多 400 次，未命中記為 miss，不改標通過）。
- 精確 checkpoint：每個分片目錄 `checkpoint.json` 綁 A9 manifest（含真實外部輸入）、選取條件（index／total／kinds／groups）、案例 ID 清單雜湊、以及 runner／matrix／driver／核心／兩支 oracle／等級 oracle／scenarios 雜湊；不符即拒絕續跑。結果逐行 `results.jsonl`（`{id,caseHash,status,passed,nativeCompared,observation}`，過期案例摘要、未知或重複案例拒絕），每批更新 `progress.json`。原生反證（原生與 oracle 不一致）即停；未命中、失敗、不存在（不適用）、未知（未跑）分開計。`--report` 對帳、`--emit` 輸出 A10 逐案列＋所有未通過清單（不合併任何證明）。
- B2 runner 擴充：`planAll` 對 38 個可執行生命週期案各開一份副本（6 基礎起點＋tier-1／tier-9、Q1↔Q6、Q5↔Q6、原池專有尾槽／保留槽、P套洗練命中、已選槽保留、z7 背包合成路徑與 z9 原位合成路徑 × 對應群組），新增原生 `synth` 觀察；P套洗練未命中先換備選範本，仍未命中記 miss。每份仍是兩輪 IO／新 PID＋洗練＋穿卸搬移＋`装备排序`。
- 合成測試：`tests/set-equipment-quality-matrix.test.cjs`（14 項：情境與 oracle／核心對拍、驗證器竄改偵測、拒絕與純契約案、對帳、checkpoint 綁定、分片唯一覆蓋、driver 對記憶體遊戲、emit）與 lifecycle 測試新增 2 項（planAll、合成路徑／miss）；`npm test` 371／371；`node scripts/core-slice-report.cjs`：core 切片未變。未改 `src/`、`index.html`、`sw.js`、`knowledge/`、旗標、進度入口。
