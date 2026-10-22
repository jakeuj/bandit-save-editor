# v2.8.1 鞏固版任務

狀態：**2026-10-23 實作與本機驗收完成；已提交、推送並完成 Pages 與線上 blob 核對。** 每條 30–60 分鐘；細節與證據見[後續版本實作計畫](../../docs/research/next-version-plan.md)第 4 節。

- [x] 1. `git status` 確認乾淨（selective-migration 未提交變更存在時停下回報）；在 `src/core.js` `editingInfo` 的 plane 9 分支加入 `kind==='普通'` 且 `setLink===0` 檢查，錯誤訊息含「套裝」；不碰 `ordinaryEquipment`、`qualityAttributeEffect` 與 v2.7 證明綁定切片。
- [x] 2. `tests/advanced-editing.test.cjs` 新增 z9／z7 套裝拒絕、普通不變、寶物／內丹仍拒絕案例；`tests/equipment-ui.test.cjs` 新增選到 z9 套裝顯示唯讀原因；跑 `node --test tests/*.test.cjs`，並直接比對 `randomCharacterGrowth.formulaHash` 與 `equipmentQuality.formulaHash` 不變（`--check` 預期只因技藝上限失敗）。凍結 `src/core.js`。
- [x] 3. 依使用者決定的路徑重開 `randomCharacterSkillCaps`：Windows 隔離副本、相符 15 指紋來源、基準存檔；通過後合併證明，核對其他 23 群組紀錄逐 byte 不變、`node scripts/build-editor.cjs --check` 通過。做不到則改走退回方案並在此記錄。
- [x] 4. 文件對齊 V1.0.11.2：`docs/research/feature-roadmap.md`（基準段、第 3 項敘述、文末影響段）、`docs/research/random-character-skill-caps.md` 首段、`docs/game-ui-testing.md`、`launcher/README.md`、`mac.html`、`.agents/skills/bandit-save-editor/references/macos.md`；`docs/research/advanced-editing.md` equipmentLevel 證明段旁註不涵蓋套裝。
- [x] 5. `docs/research/v1.0.11.2-audit.md` 補 `c05c4ae` 發布核對（Pages run 39809846573、線上 `index.html`／`sw.js` blob 相符、版本標籤）；`docs/maintenance.md` 補 Windows 遷移操作段（`--keep-copies`、CDP `Connection: close`、`BANDIT_BROWSER_PORT`）。
- [x] 6. 側欄與更新紀錄改 v2.8.1／遊戲 V1.0.11.2，內容含「z9 套裝等級改為唯讀，待獨立證明」「不追溯」「不新增修改功能」；README、SKILL.md 同步；`tests/changelog.test.cjs` 通過。
- [x] 7. `npm run verify:release` 全過，回報結果與缺口，等待使用者授權提交；本次不提交、不推送。

## 驗收條件

- z9 與 z7 的套裝、寶物、內丹在 `editingInfo`／`setEquipmentLevel` 都被拒絕；普通裝備 z7／z9 行為與 v2.8 相同。
- 24 群組全部開放且證明記錄對應 V1.0.11.2；其他 23 群組紀錄不變。
- 文件中的 V1.0.10.2 只剩明確標示為歷史的句子。
- 旗標關閉狀態不得推送 main；退回方案採用時更新紀錄如實說明。

## 執行紀錄（2026-10-23）

- 第 1 條：工作樹乾淨，selective-migration 已提交於 `379eb80`。使用者確認四項決定，另授權 z7 僅補「套裝」拒絕訊息。核心只新增 plane 9 閘門與上述訊息；未改 ordinaryEquipment、品質公式或 v2.7 切片。Windows 安裝 build 26126719，migration `--plan` 確認同來源、無未知相依；核心凍結後執行 auto。

- 第 2 條：新增 z7／z9 套裝（範本 28）、寶物／內丹拒絕、普通裝備及 setLink 回歸；UI 事件案例確認切換套裝後顯示原因並停用。154 項 Node 執行為 149 通過／5 失敗，五項均因技藝上限整檔證明失效阻擋建置（第 3 條重驗後重跑）；新增兩案通過。`--check` 同樣預期拒絕技藝上限。直接比對資質與品質 formulaHash 均與修改前及證明相符。核心已凍結，SHA-256 `b69e38ac8974d74a441276bf2141dbee51d34d0f90f23dec11f1af7809a15a79`（本機 CRLF bytes）。

- 第 3 條：Windows win32-x64、V1.0.11.2／build26126719，auto 選跑 15 副本／241 步驟，全部通過、零警告，品質公式未變省略四次矩陣；技藝上限代表 2＋2 含原生效果、批次後續及生命週期，15 來源與基準原檔雜湊皆通過。auto 原始 schema 2 輸出留 repo 外；為遵守其他 23 群組逐 byte 不變，以既有 `Caps.validateResults(...,{initial:false})` 重算檢查，再用 `Caps.record` 僅替換原 proof 的 randomCharacterSkillCaps 物件。其餘前後 bytes、catalog bytes、首次 108＋2 initialVerification 全部不變；重新建立相符 migration baseline。建置／`--check` 通過，154 Node 全過（先前 5 項已排除）；未採退回方案。凍結核心的規範化 LF formulaHash 為 `7fd6dcfed8d66a2b12b450450222a613b2a9e3c42f24ef5e41004aade6ed0b45`。

- 第 4 條：七個指定文件／頁面完成對齊，舊版來源及 Mac 畫面明標歷史；新版 Mac 僅靜態核對，不擴稱已實測。路線圖更正 z7／z9 套裝排除時序，equipmentLevel 證明旁註普通限定與不追溯。36 個本機文件連結存在性檢查通過，差異人工核對完成。

- 第 5 條：從既有盤點補記 c05c4ae／Pages run 39809846573 與線上 blob、版本核對，明標本次未重新 GET；新增 Windows 隔離操作說明，未改 verify-migration 或 proof 腳本。維護指引 37 個及調查 1 個本機連結檢查通過；參數與當前實作核對完成。

- 第 6 條：側欄 v2.8.1／2026.10.23，更新紀錄首筆遊戲 V1.0.11.2，明載 z9 套裝唯讀、待獨立證明、不追溯與不新增功能；README／技能同步。兩項 changelog 測試全過。工作期間其他工作寫入的本機快取指引保留，未覆蓋。

- 第 7 條：`BANDIT_BROWSER_PORT=8942 npm run verify:release` 全過：建置同步、155 Node、12 headless（0 失敗／略過）；含桌面／390px、直接 file、PWA 離線與更新交接。技能格式檢查通過，`git diff --check` 通過。核心凍結、24 群組開放、其餘 23 群組證明原文及首次 108＋2 紀錄不變。沒有提交、推送或部署。

## 本次缺口

- 套裝等級仍缺獨立遊戲證明，z7／z9 保持唯讀；不新增群組。
- 新版 Mac 啟動／Steam 清單／存讀／重啟未重驗，歷史 file 人工待辦未擴大驗收。
- 發布已完成；本輪正式驗收限部署與 index.html／sw.js blob 核對，未擴大重跑正式瀏覽器或 Mac 測試。
- 其他工作在執行期間新增本機來源快取指引（AGENTS、gitignore、技能及維護文件）；保留其變更，這些不屬本次 v2.8.1 實作。

## 發布授權（2026-10-23）

使用者已明確授權提交並推送 v2.8.1。沿用已通過的完整驗收，本次只檢查建置同步；只提交本案變更，保留其他研究文件。推送後核對對應 SHA 的 Pages 結果及原計畫要求的 index.html／sw.js blob，再補發布紀錄。

### 發布行尾修正

首個發布提交 `9167e3f` 的 Pages run 39825686263 在 SW 同步檢查失敗：Windows 工作目錄 HTML／核心為 CRLF，Git 發布 blob 為 LF，SW 原先雜湊了轉換前 HTML。從該提交 Git archive 的原始 bytes 重現失敗，依同一份來源重建 SW 後隔離 `--check` 通過；只修正 SW 產物。工作目錄行尾回復成已提交的 canonical LF，核心沒有 Git 差異、規範化 formulaHash 及所有證明不變，本機 `--check` 亦通過。未重跑已通過的整套測試或遊戲。

### v2.8.1 正式發布完成

2026-10-23：功能提交 `9167e3f`，發布行尾修正提交 `8a5ae32080f93080baac2e514efc5f2310133794`。[Pages run 39825947955](https://github.com/jakeuj/bandit-save-editor/actions/runs/39825947955) build／deploy 成功。以 no-cache GET 核對線上 index.html／sw.js，bytes 與該提交 Git blob 完全相符；首頁側欄為 v2.8.1／2026.10.23，知識 V1.0.11.2。AGENTS 與技能發布規則已核對，本案不需調整通用規則；其他研究檔案保留未提交。此發布紀錄為純文件補記，推送後不再追蹤其自動部署。
