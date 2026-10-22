# 山寨帳房 v2.8.1「V1.0.11.2 鞏固版」

需求類型：修正＋文件，不新增修改功能。研究日期：2026-10-23（Asia/Taipei）。狀態：**草案，待使用者核准下方四項決定後才進入實作**。

完整盤點、證據與版本順序見 [後續版本實作計畫](../../docs/research/next-version-plan.md)；本提案只摘要範圍與決策，不重複證據。

## 為什麼做

- `src/core.js` 的 `editingInfo` 裝備庫（z9）分支只排除寶物與內丹，套裝檢查只在背包（z7）分支與 `ordinaryEquipment`，而後者在 z9 等級路徑不會被呼叫。`setEquipmentLevel` 因此可改 z9 套裝等級，但 `equipmentLevel` 證明只涵蓋普通裝備。這是自 v2.1 起每個發布版都含的未證明寫入路徑。
- `c05c4ae` 已把知識對齊 V1.0.11.2 並上線，但路線圖、v2.8 研究、UI 測試指引、Mac 啟動器文件仍寫 V1.0.10.2 基準，且正式發布核對沒有紀錄。

## 範圍

1. `editingInfo` plane 9 分支補 `kind==='普通'` 且 `setLink===0` 檢查，套裝改唯讀；只改這一處，之後凍結 `src/core.js`。
2. 核心與 UI 測試：z7／z9 套裝拒絕、普通不變、寶物／內丹仍拒絕；UI 選到 z9 套裝顯示原因。
3. 重開 `randomCharacterSkillCaps`（任何 core 改動都會讓其整檔 formulaHash 失效）：走 `verify-skill-caps-suite.cjs --record`（108＋2）或 selective-migration 落地後的 `migration-cli auto`，依使用者決定。
4. 文件對齊 V1.0.11.2、補 `c05c4ae` 發布核對、維護指引補 Windows 遷移操作段。
5. 版號 v2.8.1、更新紀錄、`verify:release`、授權後提交推送與線上 blob 核對。

不在本版：天賦、套裝等級功能化、`verify-migration.cjs` 與 proof 腳本改動（與 selective-migration 同檔）、CI 拆分、PWA 版號、Mac 新版排練。

## 退回方案

Windows 隔離環境不可用或重驗跑不完：不改 `src/core.js`，只在 `src/knowledge-ui.js` 的 `equipmentChoices` 過濾 z9 套裝並顯示「套裝等級尚未隔離驗證」；更新紀錄如實寫這是 UI 遮蔽，不是核心 fail-closed。

## 需要使用者決定

1. selective-migration 與本案的先後與分支策略。
2. 授權把 z9 套裝等級改唯讀（對已出貨能力的收回；舊存檔中已升級的套裝不追溯）。
3. 版號 v2.8.1（保留 v2.9 給天賦）。
4. 重開技藝上限群組的路徑（108＋2 `--record` 或 selective-migration `auto`）。
