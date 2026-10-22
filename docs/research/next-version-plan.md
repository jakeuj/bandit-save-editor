# 目前進度與後續候選

更新基準：2026-10-23 的已記錄交付。實際開放狀態仍須核對目前 catalog／verification；工作樹中的開發檔案不代表已通過驗證或發布。

| 項目 | 已記錄狀態／下一步 | 來源 |
| --- | --- | --- |
| 按影響遷移 | 已有選跑流程；改版依相依摘要沿用或驗相關群組 | [遷移維護](../maintenance/migration.md)、[任務](../../sdd/selective-migration/tasks.md) |
| v2.8.1 鞏固版 | z9 未證明套裝路徑已關閉；舊存檔不追溯，該件保持唯讀且無法由本版還原 | [任務](../../sdd/v2.8.1-consolidation/tasks.md) |
| v2.9 天賦等級 | 已發布，首次原生證明及瀏覽器驗收見任務；尚未驗證範圍仍保留 | [研究](random-character-talents.md)、[任務](../../sdd/random-character-talents/tasks.md) |
| v2.10 套裝等級 | 已發布並驗收歸檔；兩庫各自首次證明及 Node／瀏覽器驗收通過，對應 SHA 的 Pages build／deploy 成功 | [研究](set-equipment-level.md)、[提案](../../sdd/archive/2026-10-23-set-equipment-level/proposal.md)、[任務](../../sdd/archive/2026-10-23-set-equipment-level/tasks.md) |
| 其他候選 | 寶物、丹藥擴充、套裝品質、靈物、內丹、城市、超限、建築等，依原路線圖重新核對未完成範圍 | [路線圖](feature-roadmap.md) |

## 尚待驗收

- 名稱、三類經驗與設定，以及 v2.1–v2.5 各功能的直接下載 HTML／file 流程仍依各 SDD 保留缺口；新版功能的 file 或 PWA 通過不代替舊功能驗收。
- V1.0.11.2 的 Mac 啟動、本機存讀與新程序重啟仍待補驗，不能沿用舊版結果。
- 有名角色與自然職業上限的 [runtime 補丁](../../sdd/runtime-patch/proposal.md)另列研究候選，與網站修改器分開。

## 公開入口與追蹤

本頁集中目前進度與候選；[功能路線圖](feature-roadmap.md)保留研究排序與技術理由，[各版紀錄](../releases.md)記錄已發布能力與驗收界線。[Wiki 開發進度與後續候選](https://github.com/jakeuj/bandit-save-editor/wiki/開發進度與後續候選)提供玩家導覽。

[Project](https://github.com/users/jakeuj/projects/3)追蹤具體任務，為私人專案，需存取權限；候選不代表排定版本、日期或實作授權。

## 接續工作

1. 讀目標研究及 SDD 的最新狀態，核對工作樹；已完成的盤點與首次證明直接引用，不重做。
2. 新功能依[首次開放流程](../maintenance/core.md#重建知識與開放寫入)擴充需求、suite、情境與相依；沒有首次證明的群組維持關閉。
3. 改 core 時核對[技藝上限證明](../maintenance/skill-caps.md)與[重開流程](../maintenance/talents.md#v29-的技藝上限重開)，不把舊版發布授權延伸為新任務授權。
4. 範本 0 隨機角色的資質、技藝上限與天賦不同於有名角色回填；涉及 runtime 補丁時另讀[補丁提案](../../sdd/runtime-patch/proposal.md)。

## 歷史盤點

[2026-10-23、v2.8 基準的完整盤點](archive/2026-10-23-next-version-plan.md)保留多代理評估、證據、當時缺口、備案與接續 prompt。其中「尚無天賦實作」、「套裝知識層空白」、待核准決策及未提交狀態屬當時快照，不是現況。舊 prompt 僅供追溯，不直接拿來重開已完成工作。
