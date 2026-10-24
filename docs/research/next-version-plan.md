# 下一步與目前進度

更新基準：2026-10-25 的已記錄交付。實際開放狀態仍須核對目前 catalog／verification；工作樹中的開發檔案不代表已通過驗證或發布。

## 現在接哪一案

**目前沒有功能主線。** 已擺放靈物五行已完成 v2.26（2026-10-24），靈物套裝合成與精煉的原生驗證已於 2026-10-25 完成；2026-10-24 起改採[輕量開發流程](../maintenance/lightweight.md)。

| 要知道什麼 | 目前答案 |
| --- | --- |
| 剛完成 | 靈物套裝合成與精煉的原生驗證（2026-10-25，只驗證、無新旗標）：`套装合成` 把靈物 y4 寫進裝備 y23、y10 寫進 y26（y26 沒有讀取者），`内丹精炼` 只用靈物 y4（品質＝floor((y4＋材料品質)/2)），完全不讀五行；材料、部位、靈物範本與配方解鎖只在選取介面檢查。冒煙（修改過的 #5 加穿戴中的竹槍合成土匪之槍、修改過的 #4 加練氣力量丹 Q6 精煉成 Q5 掠奪內丹、兩輪存讀、修改器重讀）通過。摘要見[集中研究](candidate-sweep-2026-10-23.md#原生驗證摘要2026-10-25修改後靈物用於套裝合成與內丹精煉) |
| 前一版 | v2.26 已擺放靈物五行（2026-10-24）：擺放中的靈物在 z19，`刷新地块灵气` 依 z19 y5–10 與置物台等級即時計算；只收置物台且互指正確的列，冒煙通過後開啟 `placedRelicAttributes`。實作摘要見[集中研究](candidate-sweep-2026-10-23.md#實作摘要2026-10-24v226-已擺放靈物五行) |
| 目前主線 | 無功能主線 |
| 下一步 | 下一個功能從 roadmap 挑（剩其他超限、丹藥擴充），依[輕量開發流程](../maintenance/lightweight.md)做 |
| 授權 | 靈物合成與精煉驗證已完成；提交／推送依當次對話授權，下一個功能待使用者指定 |
| 分派 | 預設在同一個 session 做完；查詢用子 agent，符合[分派判斷](../maintenance/dispatch.md#先判斷要不要分派)才開子 session |
| 開放狀態 | 以目前 catalog／verification 為準；輕量開啟的群組（`pillAptitudeBonusDecimal`、`backpackEquipmentLevelAdvanced`、`relicAttributes`、`pillAptitudeBonusAscended`、`randomCharacterBaseAptitudesAscended`、`randomCharacterTalentsAscended`、`randomCharacterSkillCapsAscended`、`wallEnhancementLevel`、`cityLayerLevel`、`ascensionQuality`、`backpackInnerPillLevel`、`innerPillLevel`、`ascendedInnerPillLevel`、`basicTechnologyLevel`、`buildingLevel`、`placedRelicAttributes`）記在 `verification.json` 的 `lightweight` |

### 其他候選

| 候選 | 目前完成到哪 | 下一步 | 要改 `src/core.js`？要跑原生驗證？ |
| --- | --- | --- | --- |
| 降低原生重證成本 | 第 1、2、4 節已實作並推送：core 依 family 切片綁定、獨立入口開發規範、開發中不選跑；以 v2.11 已證明 core 建立切片基準，未重跑原生 | 剩第 3 節：並行副本（先做 PID／profile 核對與 2 份 Steam 探針）；何時值得做由[重證成本紀錄](reproof-ledger.json)判斷，切片報告達門檻會印「提示：」 | 只改 `scripts/` 與文件；並行需要實際跑原生副本驗證 |

其他候選（其餘超限與丹藥擴充）排序與理由見[路線圖](feature-roadmap.md)；候選不等於排程或實作授權。

套裝品質已於 2026-10-23 選為主線，A1–A10 已授權並完成。2026-10-23 的[後續候選集中研究](candidate-sweep-2026-10-23.md)補查了小數丹藥的跨 API 限制、靈物共同生成／平均值、結丹相依、內丹空經驗函式及城市／城牆，交付限研究文件，沒有功能發布或新增原生證明。

## 已交付與候選概況

| 項目 | 已記錄狀態／下一步 | 來源 |
| --- | --- | --- |
| 按影響遷移 | 已有選跑流程；改版依相依摘要沿用或驗相關群組 | [遷移維護](../maintenance/migration.md)、[任務](../../sdd/selective-migration/tasks.md) |
| v2.8.1 鞏固版 | z9 未證明套裝路徑已關閉；舊存檔不追溯，該件保持唯讀且無法由本版還原 | [任務](../../sdd/v2.8.1-consolidation/tasks.md) |
| v2.9 天賦等級 | 已發布，首次原生證明及瀏覽器驗收見任務；尚未驗證範圍仍保留 | [研究](random-character-talents.md)、[任務](../../sdd/random-character-talents/tasks.md) |
| v2.10 套裝等級 | 已發布並驗收歸檔；兩庫各自首次證明及 Node／瀏覽器驗收通過，對應 SHA 的 Pages build／deploy 成功 | [研究](set-equipment-level.md)、[提案](../../sdd/archive/2026-10-23-set-equipment-level/proposal.md)、[任務](../../sdd/archive/2026-10-23-set-equipment-level/tasks.md) |
| v2.11 寶物等級 | 已發布並歸檔；兩庫首次證明已合併並開啟，經驗候選經查證排除 | [研究](treasure-level.md)、[提案](../../sdd/archive/2026-10-23-treasure-level/proposal.md)、[任務](../../sdd/archive/2026-10-23-treasure-level/tasks.md) |
| 原生重證成本 | 切片綁定與開發規範已實作；並行副本待做 | [提案](../../sdd/core-slice-reproof/proposal.md) |
| 其他候選 | 內丹與渡劫、建築與基礎科技等依目前優先順序評估 | [路線圖](feature-roadmap.md) |

## 尚待驗收

- 名稱、三類經驗與設定，以及 v2.1–v2.5 各功能的直接下載 HTML／file 流程仍依各 SDD 保留缺口；新版功能的 file 或 PWA 通過不代替舊功能驗收。
- V1.0.11.2 的 Mac 啟動、本機存讀與新程序重啟仍待補驗，不能沿用舊版結果。
- 有名角色與自然職業上限的 [runtime 補丁](../../sdd/runtime-patch/proposal.md)另列研究候選，與網站修改器分開。

## 公開入口與追蹤

本頁集中目前進度與候選；[功能路線圖](feature-roadmap.md)保留研究排序與技術理由，[各版紀錄](../releases.md)記錄已發布能力與驗收界線。[Wiki 開發進度與後續候選](https://github.com/jakeuj/bandit-save-editor/wiki/開發進度與後續候選)提供玩家導覽。

[Project](https://github.com/users/jakeuj/projects/3)追蹤具體任務，為私人專案，需存取權限；候選不代表排定版本、日期或實作授權。

## 接續工作

1. 讀目標研究的最新狀態（舊功能另有 `sdd/` 歷史紀錄），核對工作樹；已完成的盤點與證明直接引用，不重做。
2. 新功能依[輕量開發流程](../maintenance/lightweight.md)直接實作，不建 SDD；冒煙通過前旗標維持關閉，做完在研究文件補實作摘要。
3. 改 core 時核對[技藝上限證明](../maintenance/skill-caps.md)與[重開流程](../maintenance/talents.md#v29-的技藝上限重開)，不把舊版發布授權延伸為新任務授權。
4. 範本 0 隨機角色的資質、技藝上限與天賦不同於有名角色回填；涉及 runtime 補丁時另讀[補丁提案](../../sdd/runtime-patch/proposal.md)。

## 歷史盤點

[2026-10-23、v2.8 基準的完整盤點](archive/2026-10-23-next-version-plan.md)保留多代理評估、證據、當時缺口、備案與接續 prompt。其中「尚無天賦實作」、「套裝知識層空白」、待核准決策及未提交狀態屬當時快照，不是現況。舊 prompt 僅供追溯，不直接拿來重開已完成工作。
