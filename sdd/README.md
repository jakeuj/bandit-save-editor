# SDD 歷史紀錄索引

2026-10-24 起新功能改走[輕量開發流程](../docs/maintenance/lightweight.md)，**不再新增 SDD**。本資料夾只保留當時的提案、任務與驗收紀錄；目前規則、功能狀態與證據以最新維護與研究文件為準，下表的「狀態」是對照用摘要，各資料夾內文仍是當時紀錄。

資料夾不整批移入 `archive/`：約 110 處連結直接指向這些路徑，且歸檔需使用者明確要求。

| 資料夾 | 版本 | 狀態 |
| --- | --- | --- |
| [save-knowledge](save-knowledge/proposal.md) | v2.0 | 已發布：存檔知識、型別化核心與成長編輯 |
| [advanced-editing](advanced-editing/proposal.md) | v2.1 | 已發布：裝備等級、操練上限、進階科技 |
| [advanced-editing-batch2](advanced-editing-batch2/proposal.md) | v2.2 | 已發布：詞條係數與丹藥增量；品質、詞條替換由後續版本另案 |
| [precise-affix-editing](precise-affix-editing/proposal.md) | v2.3 | 已發布：精準洗練 |
| [equipment-workflow](equipment-workflow/proposal.md) | v2.4 | 已發布：背包裝備與首次洗練選槽 |
| [equipment-quality](equipment-quality/proposal.md) | v2.5 | 已發布：普通裝備品質升降 |
| [batch-editing](batch-editing/proposal.md) | v2.6 | 已發布：批次操作 |
| [random-character-growth](random-character-growth/proposal.md) | v2.7 | 已發布：範本 0 基礎資質 |
| [random-character-skill-caps](random-character-skill-caps/proposal.md) | v2.8 A | 已完成：規格與 A 階段 |
| [random-character-skill-caps-b](random-character-skill-caps-b/proposal.md) | v2.8 B | 已發布：九項技藝上限 |
| [v2.8.1-consolidation](v2.8.1-consolidation/proposal.md) | v2.8.1 | 已發布：z9 套裝唯讀鞏固 |
| [random-character-talents](random-character-talents/proposal.md) | v2.9 | 已發布：天賦等級（提案開頭「尚未實作」為提案當時狀態） |
| [archive/2026-10-23-set-equipment-level](archive/2026-10-23-set-equipment-level/proposal.md) | v2.10 | 已發布並歸檔：套裝等級 |
| [archive/2026-10-23-treasure-level](archive/2026-10-23-treasure-level/proposal.md) | v2.11 | 已發布並歸檔：寶物等級 |
| [set-equipment-quality](set-equipment-quality/proposal.md)、[-a](set-equipment-quality-a/proposal.md)、[-b](set-equipment-quality-b/proposal.md) | v2.12 | 已發布：套裝品質 |
| [archive/2026-10-22-version-migration](archive/2026-10-22-version-migration/proposal.md) | 維護工具 | 已實作並歸檔：版本遷移重驗流水線 |
| [programmatic-testing](programmatic-testing/proposal.md) | 測試基礎（2026-10-22） | 已實作：Node＋headless 測試分層 |
| [selective-migration](selective-migration/proposal.md) | 維護工具（2026-10-23） | 已實作；2026-10-24 由輕量開發流程取代，不再是預設流程 |
| [core-slice-reproof](core-slice-reproof/proposal.md) | 維護工具（2026-10-23） | 第 1、2、4 節已實作；第 3 節並行副本不再需要 |
| [runtime-patch](runtime-patch/proposal.md) | 研究提案 | 未實作；有名角色與自然職業上限仍屬另線 |

各版範圍與驗證見[更新紀錄](../docs/releases.md)；功能入口見[功能導覽](../.agents/skills/bandit-save-editor/references/feature-guide.md)。
