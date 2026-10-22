# v2.8.1 鞏固版任務

狀態：**草案，未核准。** 每條 30–60 分鐘；細節與證據見[後續版本實作計畫](../../docs/research/next-version-plan.md)第 4 節。

- [ ] 1. `git status` 確認乾淨（selective-migration 未提交變更存在時停下回報）；在 `src/core.js` `editingInfo` 的 plane 9 分支加入 `kind==='普通'` 且 `setLink===0` 檢查，錯誤訊息含「套裝」；不碰 `ordinaryEquipment`、`qualityAttributeEffect` 與 v2.7 證明綁定切片。
- [ ] 2. `tests/advanced-editing.test.cjs` 新增 z9／z7 套裝拒絕、普通不變、寶物／內丹仍拒絕案例；`tests/equipment-ui.test.cjs` 新增選到 z9 套裝顯示唯讀原因；跑 `node --test tests/*.test.cjs`，並直接比對 `randomCharacterGrowth.formulaHash` 與 `equipmentQuality.formulaHash` 不變（`--check` 預期只因技藝上限失敗）。凍結 `src/core.js`。
- [ ] 3. 依使用者決定的路徑重開 `randomCharacterSkillCaps`：Windows 隔離副本、相符 15 指紋來源、基準存檔；通過後合併證明，核對其他 23 群組紀錄逐 byte 不變、`node scripts/build-editor.cjs --check` 通過。做不到則改走退回方案並在此記錄。
- [ ] 4. 文件對齊 V1.0.11.2：`docs/research/feature-roadmap.md`（基準段、第 3 項敘述、文末影響段）、`docs/research/random-character-skill-caps.md` 首段、`docs/game-ui-testing.md`、`launcher/README.md`、`mac.html`、`.agents/skills/bandit-save-editor/references/macos.md`；`docs/research/advanced-editing.md` equipmentLevel 證明段旁註不涵蓋套裝。
- [ ] 5. `docs/research/v1.0.11.2-audit.md` 補 `c05c4ae` 發布核對（Pages run 39809846573、線上 `index.html`／`sw.js` blob 相符、版本標籤）；`docs/maintenance.md` 補 Windows 遷移操作段（`--keep-copies`、CDP `Connection: close`、`BANDIT_BROWSER_PORT`）。
- [ ] 6. 側欄與更新紀錄改 v2.8.1／遊戲 V1.0.11.2，內容含「z9 套裝等級改為唯讀，待獨立證明」「不追溯」「不新增修改功能」；README、SKILL.md 同步；`tests/changelog.test.cjs` 通過。
- [ ] 7. `npm run verify:release` 全過；授權後提交推送；Pages 成功後比對線上 blob 並寫回紀錄。

## 驗收條件

- z9 與 z7 的套裝、寶物、內丹在 `editingInfo`／`setEquipmentLevel` 都被拒絕；普通裝備 z7／z9 行為與 v2.8 相同。
- 24 群組全部開放且證明記錄對應 V1.0.11.2；其他 23 群組紀錄不變。
- 文件中的 V1.0.10.2 只剩明確標示為歷史的句子。
- 旗標關閉狀態不得推送 main；退回方案採用時更新紀錄如實說明。
