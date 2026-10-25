# 功能任務導覽

一功能一列，只讀目標功能那列指向的文件。欄位、公式、具名入口、拒絕條件、還原群組與冒煙結果都在研究文件的「實作摘要」（v2.12 以前看研究正文與 `sdd/` 歷史紀錄），本頁不複製；現行開放狀態以 `knowledge/catalog.json` 的 `verification` 為準。本導覽不新增實作或發布授權。

研究路徑以 repo 的 `docs/research/` 為準，下表簡寫：`sweep` 是 `candidate-sweep-2026-10-23.md`、`batch2` 是 `advanced-editing-batch2.md`。

## 依功能讀取

| 功能 | 版本 | 旗標 | 先讀 | 舊 SDD |
| --- | --- | --- | --- | --- |
| 職業轉職圖鑑 | — | — | `src/profession-ui.js`、`knowledge/profession-guide.json`、[研究筆記](../../../../docs/research/save-knowledge.md#職業轉職圖鑑) | — |
| 裝備等級、職業操練上限、進階科技、超限模式 | v2.1 | `equipmentLevel*`、`professionTrainingCap*`、`advancedTechnologyLevel*` | [進階修改](../../../../docs/research/advanced-editing.md) | `sdd/advanced-editing/` |
| 既有詞條係數、丹藥資質增量 | v2.2 | `*AffixCoefficient`、`pillAptitudeBonus` | [batch2](../../../../docs/research/advanced-editing-batch2.md)、[裝備維護](../../../../docs/maintenance/equipment.md) | `sdd/advanced-editing-batch2/` |
| 精準洗練、單件效果預覽 | v2.3 | `*AffixReplacement` | [精準洗練](../../../../docs/research/precise-affix-editing.md)、[裝備維護](../../../../docs/maintenance/equipment.md) | `sdd/precise-affix-editing/` |
| 背包裝備、首次選槽、新取得標記 | v2.4 | `backpackEquipmentLevel`、`equipmentAffixInitialSelection`、`equipmentNewItemMarker` | [裝備操作](../../../../docs/research/equipment-workflow.md) | `sdd/equipment-workflow/` |
| 普通裝備品質升降、y23 語意 | v2.5 | `*EquipmentQuality{Upgrade,Downgrade}` | [品質研究](../../../../docs/research/equipment-quality.md)、[裝備維護](../../../../docs/maintenance/equipment.md) | `sdd/equipment-quality/` |
| 批次經驗、升滿、科技同值 | v2.6 | 沿用既有閘門 | [批次維護](../../../../docs/maintenance/batch.md) | `sdd/batch-editing/` |
| 範本 0 基礎資質 | v2.7 | `randomCharacterBaseAptitudes` | [隨機角色成長](../../../../docs/research/random-character-growth.md)、[growth](../../../../docs/maintenance/growth.md) | `sdd/random-character-growth/` |
| 範本 0 九項技藝上限 | v2.8 | `randomCharacterSkillCaps` | [技藝上限](../../../../docs/research/random-character-skill-caps.md)、[skill-caps](../../../../docs/maintenance/skill-caps.md) | `sdd/random-character-skill-caps{,-b}/` |
| z9 套裝唯讀鞏固 | v2.8.1 | — | — | `sdd/v2.8.1-consolidation/` |
| 範本 0 天賦等級 | v2.9 | `randomCharacterTalents` | [天賦](../../../../docs/research/random-character-talents.md)、[talents](../../../../docs/maintenance/talents.md) | `sdd/random-character-talents/` |
| 套裝等級、積分、合成後搬移 | v2.10 | `backpackSetEquipmentLevel`、`setEquipmentLevel`、`*CrossPool` | [套裝等級](../../../../docs/research/set-equipment-level.md) | `sdd/archive/2026-10-23-set-equipment-level/` |
| 寶物等級（魂魄升級，無經驗欄） | v2.11 | `backpackTreasureLevel`、`treasureLevel` | [寶物等級](../../../../docs/research/treasure-level.md) | `sdd/archive/2026-10-23-treasure-level/` |
| 套裝品質 | v2.12 | `*SetEquipmentQuality{Upgrade,Downgrade}` | [套裝品質](../../../../docs/research/set-equipment-quality.md) | `sdd/set-equipment-quality{,-a,-b}/` |
| 小數丹藥增量 | v2.13 | `pillAptitudeBonusDecimal` | [sweep 實作摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#實作摘要2026-10-24v213) | — |
| 背包普通裝備等級超限 | v2.14 | `backpackEquipmentLevelAdvanced` | [裝備操作實作摘要](../../../../docs/research/equipment-workflow.md#實作摘要2026-10-24v214-背包普通裝備等級超限) | — |
| 背包靈物五行 | v2.15 | `relicAttributes` | [sweep 實作摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#實作摘要2026-10-24v215-背包靈物五行) | — |
| 結丹角色丹藥 | v2.16 | `pillAptitudeBonusAscended` | [sweep 實作摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#實作摘要2026-10-24v216-結丹角色丹藥) | — |
| 結丹角色基礎資質與天賦 | v2.17 | `randomCharacterBaseAptitudesAscended`、`randomCharacterTalentsAscended` | [sweep 實作摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#實作摘要2026-10-24v217-結丹角色基礎資質與天賦) | — |
| 結丹角色技藝上限 | v2.18 | `randomCharacterSkillCapsAscended` | [sweep 實作摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#實作摘要2026-10-24v218-結丹角色技藝上限) | — |
| 城牆強化等級 | v2.19 | `wallEnhancementLevel` | [sweep 實作摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#實作摘要2026-10-24v219-城牆強化等級) | — |
| 城市層數與聲望 | v2.20 | `cityLayerLevel` | [sweep 實作摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#實作摘要2026-10-24v220-城市層數與聲望) | — |
| 結丹品質 | v2.21 | `ascensionQuality` | [sweep 實作摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#實作摘要2026-10-24v221-結丹品質) | — |
| 未入體內丹等級 | v2.22 | `backpackInnerPillLevel`、`innerPillLevel` | [sweep 實作摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#實作摘要2026-10-24v222-未入體內丹等級) | — |
| 入體內丹等級 | v2.23 | `ascendedInnerPillLevel` | [sweep 實作摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#實作摘要2026-10-24v223-入體內丹等級) | — |
| 基礎科技解鎖 | v2.24 | `basicTechnologyLevel` | [sweep 實作摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#實作摘要2026-10-24v224-基礎科技解鎖) | — |
| 建築等級 | v2.25 | `buildingLevel` | [sweep 實作摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#實作摘要2026-10-24v225-建築等級) | — |
| 已擺放靈物五行 | v2.26 | `placedRelicAttributes` | [sweep 實作摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#實作摘要2026-10-24v226-已擺放靈物五行) | — |
| 丹藥超限 | v2.27 | `pillAptitudeBonusAdvanced` | [batch2 實作摘要](../../../../docs/research/advanced-editing-batch2.md#實作摘要2026-10-25v227-丹藥超限) | — |
| 招募科技超限 | v2.29 | `recruitTechnologyAdvanced` | [進階修改實作摘要](../../../../docs/research/advanced-editing.md#實作摘要2026-10-25v229-招募科技超限) | — |
| 詞條係數超限 | v2.30 | `equipmentAffixCoefficientAdvanced` | [batch2 實作摘要](../../../../docs/research/advanced-editing-batch2.md#實作摘要2026-10-25v230-詞條係數超限) | — |
| 第六槽（品質 7 不開放） | v2.31 | `equipmentSixthAffix` | [batch2 實作摘要](../../../../docs/research/advanced-editing-batch2.md#實作摘要2026-10-25v231-第六槽品質-7-判定不開放) | — |

靈物用於套裝合成與內丹精煉的原生驗證（只驗證、無新旗標）見 [sweep 原生驗證摘要](../../../../docs/research/candidate-sweep-2026-10-23.md#原生驗證摘要2026-10-25修改後靈物用於套裝合成與內丹精煉)。有名角色資質、技藝上限、天賦回填與自然職業 30 級限制屬 [runtime 補丁提案](../../../../sdd/runtime-patch/proposal.md)，與網站修改器分開。

## 跨功能易錯點

- 範本 0 一般隨機角色的資質、技藝上限與天賦不受載入回填；有名角色有回填檢查，範圍不同。
- 裝備 y0 是初始背包列號，原生搬移後可不等於目前列號、也可重複，不得據此拒絕；靈物以 y1 範本判定。
- v2.8 及以前 z9 套裝等級可寫是未證明缺口，v2.8.1 已補排除；舊存檔不追溯，該件等級不能由修改器還原。
- 新功能走[獨立具名入口](../../../../docs/maintenance/core.md#新功能的-core-開發規範)，驗證依[輕量開發流程](../../../../docs/maintenance/lightweight.md)。

非功能任務（PWA、來源遷移、發布及 Mac）回到[技能入口](../SKILL.md#依任務讀取)，不在此重複維護流程。
