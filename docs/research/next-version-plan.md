# 目前進度與後續候選

更新基準：2026-10-23 的已記錄交付。實際開放狀態仍須核對目前 catalog／verification；工作樹中的開發檔案不代表已通過驗證或發布。

| 項目 | 已記錄狀態／下一步 | 來源 |
| --- | --- | --- |
| 按影響遷移 | 已有選跑流程；改版依相依摘要沿用或驗相關群組 | [遷移維護](../maintenance/migration.md)、[任務](../../sdd/selective-migration/tasks.md) |
| v2.8.1 鞏固版 | z9 未證明套裝路徑已關閉；舊存檔不追溯，該件保持唯讀且無法由本版還原 | [任務](../../sdd/v2.8.1-consolidation/tasks.md) |
| v2.9 天賦等級 | 已發布，首次原生證明及瀏覽器驗收見任務；尚未驗證範圍仍保留 | [研究](random-character-talents.md)、[任務](../../sdd/random-character-talents/tasks.md) |
| 套裝等級 | 研究 go 支持進入實作與首次驗證；本次文件整理不新增授權或開閘。開始前核對最新提案、任務與當前對話授權 | [研究](set-equipment-level.md)、[提案](../../sdd/set-equipment-level/proposal.md)、[任務](../../sdd/set-equipment-level/tasks.md) |
| 其他候選 | 寶物、丹藥擴充、套裝品質、靈物、內丹、城市、超限、建築等，依原路線圖重新核對未完成範圍 | [路線圖](feature-roadmap.md) |

## 接續工作

1. 讀目標研究及 SDD 的最新狀態，核對工作樹；已完成的盤點與首次證明直接引用，不重做。
2. 新功能依[首次開放流程](../maintenance/core.md#重建知識與開放寫入)擴充需求、suite、情境與相依；沒有首次證明的群組維持關閉。
3. 改 core 時核對[技藝上限證明](../maintenance/skill-caps.md)與[重開流程](../maintenance/talents.md#v29-的技藝上限重開)，不把舊版發布授權延伸為新任務授權。
4. 範本 0 隨機角色的資質、技藝上限與天賦不同於有名角色回填；涉及 runtime 補丁時另讀[補丁提案](../../sdd/runtime-patch/proposal.md)。

## 歷史盤點

[2026-10-23、v2.8 基準的完整盤點](archive/2026-10-23-next-version-plan.md)保留多代理評估、證據、當時缺口、備案與接續 prompt。其中「尚無天賦實作」、「套裝知識層空白」、待核准決策及未提交狀態屬當時快照，不是現況。舊 prompt 僅供追溯，不直接拿來重開已完成工作。
