# 套裝品質 B 任務

狀態：全部未執行，尚未授權實作。[子提案](proposal.md)／[母規格與全案驗收](../set-equipment-quality/tasks.md)。目前主線為套裝品質；A 階段已完成（2026-10-23），B 待使用者授權（見[進度入口](../../docs/research/next-version-plan.md)）。

每項工程操作目標 30–60 分鐘；超時先再拆子 SDD。自動矩陣執行另記分片／checkpoint，完成全部分母才可勾選。

- [x] B1. 核對並補取得原生基準：只補缺 Q／池／材料與洗練見證，保存生成／合成履歷；至少有套裝池專有 ID，未抽到維持缺案，原檔／快取雜湊不變。
- [x] B2. 固定生命週期副本與執行接線：建立三狀態×升降至少六類起點及覆蓋表，沿用 runner 接兩輪 IO／新 PID；不足則加副本，不編造 metadata。
- [x] B3. 完成候選介面與停用驗收：預覽庫別／方向、雙池、增刪槽、效果及確認重設，驗拒絕與未證明方向停用；隔離候選測試不計為正式可用驗收。
- [x] B4. 執行首次矩陣與生命週期分片：交易／效果、成本、洗練舊效果移除、穿卸／搬移／排序、兩輪 IO／新 PID 全部對帳；完整 manifest 結束才勾選，未命中與失敗不縮分母。
- [ ] B5. 完成必要原版 UI 證據：依當次明確授權驗品質顯示、槽數與已選槽停用／洗練；未授權或失敗保留缺口，不開相關群組。
- [x] B6. 補既有套裝等級兩庫跨池證明：各自獨立原生證明與原池回歸，驗合法等級、cap、效果、IO 及品質交錯 undo／還原；此時正式入口仍不擴權。
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

#### 原生長跑結果（2026-10-23，隔離遊戲同時一份、隱藏靜音，Steam 真實初始化；未用 computer use、未開原版桌面 UI）

- 提交：工程 `e02f26b`、拒絕案修正 `e6f1be8`、生命週期報告檔名 `eb1281f`、報告 manifest 摘要改用 A10 全零輸入版本 `a9aacf7`（最終長跑使用的程式）。試跑（全矩陣一次、`--no-stop-on-failure`）與探針、突變驗證都在 repo 外另存，不計入下列結果；試跑時發現並修正拒絕案的驗證缺陷後，矩陣與生命週期全部重跑。
- 進度（已完成／總數；通過／失敗／未命中／未知），分母＝A9 manifest 的可執行案，不適用案不計：z7 升 15,053／15,053（15,053／0／0／0）、z7 降 15,039／15,039（15,039／0／0／0）、z9 升 18,846／18,846（18,846／0／0／0）、z9 降 18,817／18,817（18,817／0／0／0），合計 67,755／67,755（67,755／0／0／0）。其中矩陣 67,717（base 19,440、effect 864、coefficient 450、level-cap 225、pool 46,656、reject 82）40 個分片，生命週期 38 份副本（6 基礎起點＋32 軸）。不適用 12,339 案（含 432 筆自然五／六件）逐案列在 manifest，不計通過；未命中 0（P套洗練 38 份生命週期副本與 7,776 個已選槽起點皆命中，無需換備選範本）、失敗 0、未知 0。
- 原生比對內容：67,709 個矩陣案例做過原生讀回；合法案例另做編輯前後單件效果（`装备主属性`）與穿戴者全角色效果／套裝摘要對 A7／A8 oracle、搬移（背包 23,214、裝備庫 23,214、穿戴卸下 6,690 次）；base 16,200 次原生同槽洗練（魂魄成本固定 100 魂魄／次，10,125 次取得 P套專有 ID，其餘 6,075 次所屬範本沒有 P套專有 ID，只洗 1 次），核對舊槽貢獻移除與洗練後核心資格 API／預覽；level-cap 225 案做原生 `升级装备` 的 cap 探測。生命週期 38 份各做兩輪 IO／新 PID 讀回、洗練、穿卸／搬移、`装备排序`，合成路徑兩軸另做原生 `套装合成`。13,735 個結果是 oracle 預測的拒絕（核心拒絕且無變更，原生只讀回起點），照規格分類，沒有改標。
- 標示過的注入：主係數端點由原生取得時直接帶端點（無需注入）；副係數端點與百分之一邊界（180 案）、已選槽的 P原專有／交集 ID（19,440 起點）、重複 ID 與池外尾槽等拒絕前提由 `injected` 標示後寫入原生放置，仍由原生讀回與重算效果；P套專有已選槽 7,776 個全來自原生洗練。
- 反證：沒有。原生單件效果、全角色效果／套裝摘要、搬移（y0–49、owner、指標、來源清除）、洗練（只動指定槽、結果在 P套、係數在區間、旗標 1、成本 100）、cap 探測與 A7／A8 oracle 全部一致。突變驗證（oracle 公式竄改、送進遊戲的列被改）都被偵測為反證。
- 界線與需主 session 判讀：①`stale-proof`／`incomplete-proof` 兩種拒絕案（每群組 2 案、共 8 案）是 A10 契約檢查（過期／不完整紀錄被拒），與遊戲無關，記為通過但 `nativeCompared:false`，不列入 A10 逐案列；A10 `validateResults` 要求每案 `nativeCompared:true`，B8 合併前需決定是否對這兩類豁免。②拒絕案的原生比對只有「起點讀回且拒絕後不變」。③`level-regression` 16 案（兩個既有等級群組的跨池補證）屬 B6，不在本段。因此 A10 逐案列（`a10-results.json`）67,747 筆全為 `{id,caseHash,passed,nativeCompared:true}`，各群組仍少 B6 的 8 案與契約 2 案。**B4 不勾選**：契約案尚待上述決定。
- 結果檔（repo 外 `set-equipment-quality-B4`，SHA-256）：`a10-results.json` `b776af09978a649d06790a3f4ddfa03261d32b1ac2959ca18097adf091e7a333`、`binding.json` `7609bcab428b1e9e2e2b14773bd3b85c625bbb05ac917f7e42c024c10888bd8f`（A9 manifest 真實輸入版 `74cad984…`、A10 全零輸入版 `629075b8…`、外部四輸入沿用 B1、工具摘要）、矩陣 40 個 `results.jsonl` 依檔名串接 `0ce4366c60c43f65f355b6ecf26051c2c43e6185e6028f42d116ea1e759dd5a1`、`lifecycle/lifecycle-results.json` `6eb0a3ea0dd5476dfe2a4a3b21543f80d810c7d3e3c4933514d03933adac6bb0`、`lifecycle/b4-lifecycle-report.json` `e8987601030dd7625c6449f19b7e7c16706f419bb4679cf6ae5e165583ed8582`。每個分片目錄有 `checkpoint.json`（綁 manifest、選取、ID 清單與工具摘要）與 `progress.json`。
- 原檔／快取：固定基準存檔 `ebb0a4a2…84c5`、玩家原檔 `9497ca27…6e1`、等級基準 `090290ff…48327` 與兩份快取 manifest 檔案集合在矩陣與生命週期前後雜湊相同。
- 驗證：`npm test` 373／373；`node scripts/core-slice-report.cjs`：core 切片未變。未改 `src/`、`index.html`、`sw.js`、`knowledge/`、旗標、`reproof-ledger.json` 與進度入口；四品質群組仍為 false，未合併任何證明。
- B6 可開跑條件：遊戲已釋放（長跑程序全部停止）；B6 與 B4 的原生資源互斥，這點已滿足。B6 不依賴上述 8 個契約案，但 B8 需要它們的處理方式。

#### 契約拒絕案補原生起點讀回（使用者決定，2026-10-23）

- 使用者決定 `stale-proof`／`incomplete-proof` 8 案比照其他拒絕案補原生起點讀回並標 `nativeCompared:true`。提交 `5271ce4`：這兩類現在取得合法原生起點（z7 Q3／Q4 範本 28）、做 A10 契約檢查（過期／不完整紀錄被拒）、核心操作前後起點不變，並由隔離遊戲原生讀回起點；沒有只改標記，也未改 A10 `validateResults`／proof 契約。
- 只重跑 82 個 `reject` 案（新分片 `shard-0-of-1-*`，綁新工具摘要；67,635 筆其他矩陣結果與 38 份生命週期沿用，其工具摘要未變的部分不重算）：82／82 通過，失敗、未命中、未知 0；`emit` 讓較新的重跑取代舊行，舊分片檔不改。遊戲程序已停止、鎖檔已清，固定存檔、玩家原檔、等級基準與快取雜湊前後相同。
- 更新後逐案列 `a10-results.json` `1cc22b2ed0bfcf97cd25e217e8702f0ec2de1baf28870c77ea10439642c253e2`：67,755 筆全為 `{id,caseHash,passed,nativeCompared:true}`，各群組可執行數＝通過數（z7 升 15,053、z7 降 15,039、z9 升 18,846、z9 降 18,817），不通過 0、契約僅 0。新 `binding.json` `07457ab263f7dfa969a6e7643238737b821667347039ea264b3947e48f49c3e6`（舊矩陣長跑版另存 `binding-matrix-run.json` `7609bcab…`）；新重跑分片 `results.jsonl` `816989185e6e489f05cb52a5f91f95e6767381f907b96c9a421f317920867a57`；其餘 40 個舊分片串接雜湊仍為 `0ce4366c…`。生命週期結果檔雜湊不變。
- 各群組仍少 `level-regression` 各 8 案（屬 B6，照舊註明）；A10 的 `validateResults` 對本段可驗項目已無缺口。B4 勾選。驗證：`npm test` 374／374；`node scripts/core-slice-report.cjs`：core 切片未變。

### B6（2026-10-23）

- 新 runner `scripts/verify-set-equipment-level-cross-pool.cjs`（未給 `--output` 拒絕且不產生結果）：範圍＝A9 manifest 的 `level-regression` 16 案（z7 `backpackSetEquipmentLevel`、z9 `setEquipmentLevel` 各 8 案：`refined-set-only-id`、`level-up`、`level-down`、`at-cap`、`wear-effect`、`io-two-rounds`、`quality-level-quality-undo`、`accumulated-restore`）。分母 16，不縮減。
- 候選等級政策只存在 VM 副本：在 `setEquipmentLevelInfo` 的槽檢查唯一一處，讓「旗標 1 的唯一已選槽」也可用 P套 ID（與品質候選共同資格相同），其他檢查不動；字串必須剛好命中一處，否則拒絕執行。出貨 `src/core.js` 未改，正式入口（`setEquipmentLevelInfo`／`editingInfo`／`setEquipmentLevel`／`set`／`setField`）對每個跨池起點與每份存檔 bytes 都驗證會拒絕且不留變更。品質旗標只在隔離知識副本開啟。
- 起點：等級 B 原生基準（Q3、積分 3，z7 範本 41（T1，原裝備 10）、z9 範本 473（T9，原裝備 274），P套 專有 ID 比例最高者），由隔離遊戲在各自庫別對槽 1 原生 `词条洗练`，各 1 次命中 P套 專有 ID（z7 61、z9 51；魂魄 100），全部案例共用此列。注入：無（`injected` 皆空；z9 穿戴只放 owner／指標）。
- 原生比對：洗練見證（只動該槽三欄、P套、係數在區間、旗標 1）與 A7 資格；誤放未選槽或拿掉旗標的 P套 ID 在候選等級也被拒絕。升 1→12、降 18→6（高點由原生 `升级装备` 產生）：只改 y6、原生讀回、單件效果對等級 oracle，原生升級在兩端點之間結果一致，費用＝`money` 合計、魂魄 0（z7 先 `装备库存入`）。cap：L20 接受，21／0／小數拒絕且無變更；原生 L19→20、L20 不再升也不扣費。穿戴效果：z9 穿戴列編輯前後的全角色屬性與套裝摘要，z7 編輯後由原生 `穿戴装备`／`卸下装备`（y0–49、owner、指標、來源清除）。兩輪 IO：B2 `playCopy`／`validateCopy`（讀回→存檔→新 PID→讀回；洗練→搬移含尾十欄標記→`装备排序`→存檔→新 PID），z9 為穿戴起點。品質→等級→品質：Q3→Q4→L22→（Q4→Q3 因超 cap 被兩支 oracle 與候選一起拒絕）→L18→Q3，undo 逐筆回到前一狀態；交錯後與兩次 undo 後 bytes 各自原生讀回＋新 PID 讀回，之後原生再洗練，品質與等級候選 API 仍接受並可再改等級。累計還原：L5→Q4→L12→Q5，用等級或品質 token `restore` 整件還原、`restoreAll` 也一樣，還原後 bytes 等於起點；累計與還原 bytes 各自原生讀回＋新 PID 讀回。所有中間狀態另外由原生讀回與單件效果比對。
- 結果：16／16 通過；失敗、未命中、未知皆 0；沒有反證。逐案 `a10-results.json` 16 筆全是 `{id,caseHash,passed,nativeCompared:true}`（caseHash 為 A10 全零輸入 manifest `629075b8…`，案例摘要與真實輸入版相同）。原生遊戲同一時間只開一份隱藏、靜音的隔離副本（Steam 真實初始化），共 15 次啟動（stage 1 一次、byte 案例各自啟動），未用 computer use。
- 第一次執行（repo 外 `set-equipment-quality-B6`，作廢）：前 10 案通過後，z7 `io-two-rounds` 被判失敗。原因是 runner 自己多加的檢查把卸下後已清空的 z9 監看列也當成要比對等級的列；B2 驗證本身是通過的，這不是原生反證。修正為只看實際持有該物品的列後，全部 16 案在新目錄重跑，舊結果不沿用。
- 結果檔（repo 外 `set-equipment-quality-B6-run2`，SHA-256）：`a10-results.json` `4c7a3d4e91d843253c0d20dda57b68e982311d54d5792ef9b1616dfecef83016`、`b6-results.json` `eed7503f03e21de82d7cc8080a5fa1eebb8a15816c3f57a18237477bd0a5f383`（binding：核心 `69b462a0…`、runner `5cb007b0…`、driver `5019bfa5…`、候選槽檢查 `60246936…`、manifest `629075b8…`）。固定存檔 `ebb0a4a2…84c5`、玩家原檔 `9497ca27…6e1a`、等級基準 `090290ff…48327` 與兩份快取 manifest 在前後都相同。
- 缺口與界線：每庫只用一個範本、一個選槽位置（槽 1），也只驗 Q3 起點；Q4／Q5 則經由品質交易覆蓋。正式等級入口仍不擴權，要到 B8 合併才接入跨池資格，屆時 B7／B8 必須核對最終 core 是否等同這裡的候選政策。沒有合併任何證明，沒有改旗標、`reproof-ledger.json` 或進度入口。
- 驗證：新增 `tests/set-equipment-level-cross-pool.test.cjs`（9 項，合成資料）；`npm test` 383／383；`node scripts/core-slice-report.cjs`：core 切片未變。
