# v2.9 一般隨機角色天賦等級任務

狀態：**2026-10-23 任務 1–9 完成；`randomCharacterTalents` 已以首次完整證明開放，技藝上限已重開。任務 10（版本與發布）待使用者授權。** 範圍與決策見[提案](proposal.md#已核准決策2026-10-23)，規則與 SID 見[研究筆記](../../docs/research/random-character-talents.md)。每條 30–60 分鐘；單條超時或需要改動 v2.7 證明綁定的 core 區段時，先回報重估，不壓成一條大任務。

範圍：範本 0、非在監、無結丹／重生紀錄的已招募角色，只改三槽天賦**等級**，等級須在品質池內（Q1 1–2、Q2 1–3、Q3 2–4、Q4 3–5、Q5 4–5、Q6 5）。ID 不可改、不寫 0/0、Q6 唯讀、不提供天賦批次。天賦 6 欄與 v2.7 資質 6 欄合併為 12 欄還原群組。

**A：規則與核心（任務 1–5，`randomCharacterTalents` 保持關閉）**

- [x] 1. 開工核對：`git status` 乾淨、HEAD 含 v2.8.1（`9167e3f`）；以 repo 外 V1.0.11.2 來源重算 15 指紋。確認提案決策 3 的改寫（v2.9 只在 A 凍結 core 後重開一次技藝上限）；使用者另有意見就先更正提案。
- [x] 2. 新增天賦效果規則產生器：tf 第 4–12 欄、sx 第 4 欄型別、`天赋属性` 6 個公式分支、品質等級池；以研究第 7 題的 `sourceSids` 計算摘要，未知摘要拒絕產生。重建 catalog 候選，確認只新增天賦段落、其他段落與 `randomCharacterSkillCaps`／`randomCharacterGrowth` 逐 byte 不變；補規則漂移與分支公式的 Node 測試（535 個屬性槽×等級值與研究筆記範例相符）。
- [x] 3. 在 `src/core.js` 新增 `randomCharacterTalentsInfo`、`previewCharacterTalents`、`setCharacterTalents`：資格同 v2.7／v2.8；三槽 ID 不變、新等級在池內、ID 1–3 改等級後新 C 不得低於既有丹藥 B（阻擋，不截斷）；私有預覽關聯與 revision 重驗，只寫有差異的等級 token。只新增函式與群組註冊，不改 v2.7 證明綁定區段；新群組的計算摘要綁天賦相關切片，避免日後整檔連鎖失效。
- [x] 4. 實作 12 欄合併還原群組：首次有效天賦交易把該角色 `aptitude:角色ID` 群組擴為 12 欄（反向：之後的資質交易也落在同群組），模式隨交易／undo／`restoreAll` 保存；v2.6 私有批次暫存模型複製模式。Node 測試：失敗回滾、改回原值仍有資質差異不解除、個別還原後 B≤C 仍成立、undo 回上一筆、`skill-growth` 27 欄不受影響。
- [x] 5. 接入獨立 requirement、suite family（`initialProofRequired`、`pendingReason`）、代表情境、`migration-analysis.cjs` 相依宣告與驗證方法白名單；同步 `tests/version-migration.test.cjs`。完成 2501×60×22 合成檔 token 保留（BOM、空白、指數、大型整數 literal）與 v2.8 見證不變測試。跑 `node --test tests/*.test.cjs`；`--check` 預期只因技藝上限整檔摘要失效而拒絕，直接比對 growth／quality formulaHash 不變。**凍結 `src/core.js` 並記錄 SHA。**

**B：介面、原生證明與發布（任務 6–10，不得再改 `src/core.js`）**

- [x] 6. 角色養成頁加三槽等級編輯器（顯示 ID／名稱／品質池、資質上限連動與 12 欄還原說明），預覽後明確套用；Node UI 事件與 headless HTTP 1280／390px、直接 file、PWA 案例。（headless 與頁面容器因建置拒絕延到任務 9，見執行紀錄）
- [x] 7. 建立原生 oracle 與矩陣／生命週期 runner：535 個 `天赋属性计算` 值；Q1–Q5×3 槽×升／降 30 角色（覆蓋 6 個公式分支、單／雙屬性）＋ID 1／2／3 資質連動 3 角色；2 角色生命週期（數值更新不回填、轉職、下獄／召回、重生、解雇）。逐階段原版存檔、停止、新 PID 讀回；記錄 talent 欄位實際 token 型別。
- [x] 8. 在 Windows 隔離副本以相符 15 指紋執行任務 7，合併器重新核算 checks 才寫入 `randomCharacterTalents` 首次證明；其他群組紀錄逐項 deepEqual 保留。
- [x] 9. 依維護指引重開 `randomCharacterSkillCaps`（v2.9 唯一一次，以任務 5 凍結的 core 為準），其他 23 群組與首次 108＋2 紀錄不變。建置前先在 `index.html` 的 `skillCapsEditor` 後加 `<div class="form-card" id="talentLevelsEditor"></div>`，再同步建置；`--check` 通過，補任務 6 延後的 headless HTTP 1280／390px、直接 file、PWA 天賦案例，`npm run verify:release` 全過。
- [ ] 10. 版本 v2.9、更新紀錄（只改等級、ID 不可改、Q6 唯讀、12 欄還原）、README／技能／研究筆記同步；經使用者授權提交推送，核對對應 SHA 的 Pages 結果。

## 驗收條件

- 只有範本 0 合資格角色的三槽等級可改，且必在品質池內；ID、0/0、Q6 與池外等級全部拒絕。
- ID 1–3 等級變更後丹藥 B 不超過新 C；12 欄還原、undo 與 `restoreAll` 後存檔回到原 bytes。
- 原生 535 值與 Node 公式一致；矩陣與生命週期均有原版存檔及新 PID 讀回。
- `randomCharacterTalents` 只在任務 8 首次證明後開啟；技藝上限群組只重開一次，其他群組紀錄不變。
- 遊戲畫面名稱／tips 不在宣稱範圍；如有截圖，另記為可選觀察。

## 執行紀錄

- 第 1 條：工作樹只有本案研究／SDD 與其他工作的 `set-equipment-level` 檔案；`src/core.js` 的 M 只是 stat 標記，`git diff` 為空。HEAD `7d6d86c` 已含 v2.8.1（`9167e3f`）；repo 外 V1.0.11.2 精簡來源 15/15 指紋與 catalog 相符。使用者接受決策 3 的改寫，提案不變。改動前基準：155 項 Node 全過、`--check` 通過。
- 第 2 條：新增 `scripts/random-character-talents-data.cjs`，10 個來源 SID 的 `eventDigest` 只接受 V1.0.11.2 審閱值 `f6710c95…6e80`（V1.0.10.2 因 bound-reference 編號不同而摘要不同，未整段重審，故不列入）。規則只含品質等級池、76 個屬性的單位與 6 個公式分支；天賦屬性／係數沿用 `batch2Data.talents`。以 repo 外輸出重建 catalog，與現行逐鍵比對只多出 `randomCharacterTalents` 與 `verification.randomCharacterTalents:false`，繁中對照不變。`canPreserve` 綁指紋、規則與天賦資料。
- 第 3 條：`src/core.js` 只在 `// Skill cap rules end.` 後新增天賦區塊（`talentEffect`、`randomCharacterTalentsInfo`、`previewCharacterTalents`、`setCharacterTalents`），另把 z12 y1–3／21–23 在 `resolveField` 標成唯讀天賦欄並匯出 API；未動 v2.7 證明切片。資格：範本 0、非在監、無結丹／重生、品質 1–6、三槽為互異已知 ID 且等級在品質池；0/0、重複、池外一律唯讀，Q6 沒有可改值。只有改到資質天賦（屬性 104–106）時才呼叫 `characterAptitudeSource` 並以相同累加順序算新 C，丹藥 B 超過即阻擋。預覽綁私有關聯、`batchSnapshot` 與 z2／z12／z16 狀態。535 個屬性值與獨立 oracle 相符。
- 第 4 條：天賦交易使用 v2.7 既有的 `aptitude:角色ID` 群組鍵，因此天賦 6 欄、基礎資質 3 欄、丹藥 3 欄任何先後都在同一 12 欄群組；個別還原整組回原 bytes、undo 回上一交易、`restoreAll` 清空，`skill-growth` 與其他角色不受影響；批次暫存不需新模式，套用後舊天賦預覽失效。改等級不影響 v2.8 見證，但會讓已開的技藝上限預覽失效。
- 第 5 條：新增 requirement section 與 suite family（`initialProofRequired`、`pendingReason`），oracle／lifecycle 為 exit 1 的明確失敗入口；`random-talents-representative` 代表情境（Q2 含資質天賦、Q5）在 2501×60×22 基準存檔重播；`verify-game.cjs` 白名單、`migration-analysis.cjs` 相依與寫入區域、`migration-proof.cjs` dataHash 同步；新增 `random-character-talents-proof.cjs`（綁天賦區塊＋v2.7 切片，不綁整份 core）並在建置閘門開旗標時檢查。更新 3 個測試預期（新 lifecycle 副本、寫回關閉清單、v2.8 合併不開天賦）。
- 驗收：170 項 Node 中 165 通過；5 項失敗全因 `randomCharacterSkillCaps` 整檔摘要失效（建置拒絕），與 v2.8.1 開工時相同，任務 9 重開後重跑。`randomCharacterGrowth` 與 `equipmentQuality` formulaHash 與證明相符，v2.7 `problem` 為 null；`--check` 只回報技藝上限。`git diff --check` 通過。
- 凍結：`src/core.js` SHA-256（工作樹 bytes 即 LF）`fe01461977c8164b97c8c2101c5f9c4b4a43b816d37f53c06e244c7eb75d9756`；天賦 formulaHash 前綴 `66b8a442053a9cd2`。
- 未做：建置拒絕前無法同步 `index.html`／`sw.js`，兩檔仍是 v2.8.1；`knowledge/migration-baseline.json` 的 coreHash 待任務 9 重開後重建；沒有提交、推送或啟動遊戲。
- 第 6 條：`src/knowledge-ui.js` 新增 `renderTalentLevels`（比照技藝上限），角色養成頁顯示三槽 #ID／名稱、品質等級池下拉、目前效果，預覽表列等級與效果前後值；改到資質天賦時另列來源 A、丹藥 B、總資質與上限 C，並說明 12 欄一起還原與 ID 不能更換。只經 `previewCharacterTalents` 預覽、`setCharacterTalents` 明確套用；輸入、角色、模型 revision、undo、還原與換檔都使預覽失效。`src/ui.js` 變更檢視對 `aptitude:` 群組加註 12 欄還原。新增 `tests/talent-levels-ui.test.cjs` 5 案：關閉閘門可預覽不可寫、6 種唯讀原因與 Q6 單一等級、僅變更等級 token、丹藥超過新上限阻擋、失效情境、下載 bytes（BOM、大型整數、指數）與重載。核心未改，SHA 仍為 `fe014619…9756`。
- 第 6 條缺口：`index.html` 加容器會改變 PWA 快取釘選的頁面 bytes，而建置拒絕前無法同步 `sw.js`，曾因此多出 5 項 PWA 測試失敗，所以本輪還原 `index.html`、把容器列入任務 9；`renderTalentLevels` 在容器不存在時直接略過，舊頁不會壞。headless HTTP 1280／390px、直接 file、PWA 案例同樣延到任務 9 建置恢復後補跑。
- 第 6 條驗收：175 項 Node 中 170 通過，失敗仍只有技藝上限整檔摘要失效的同 5 項；`git diff --check` 通過。沒有提交、推送或啟動遊戲。
- 第 7 條：`random-character-talents-scenarios.cjs` 產生首次矩陣（Q1–Q5×3 槽×升／降 30 角色，10 組互異非資質三元組使每個位置各被改一次，涵蓋 6 個公式分支與單／雙屬性；另 3 個 Q3 角色改 ID 1／2／3）、代表遷移 3 角色與 2 角色生命週期。`verify-random-character-talents.cjs` 讀原生 z12 與 `天赋属性计算(角色,屬性,0,0)` 總和、資質角色的 `属性计算`／`角色资质上限`／`角色资质计算`，並以 `天赋属性(屬性,係數,等級)` 跑 535 值；重啟後比對並讀遊戲寫出存檔的原始 token。`verify-talents-lifecycle.cjs` 依序數值更新、轉職、下獄、召回、重生、解雇，每階段沿用 v2.7 checkpoint（原版存檔、停止、新 PID、載入、斷言）。`random-character-talents-proof.cjs` 的 `validateResults` 重讀副本 JSON 證據，以 catalog＋目前 core 獨立重算矩陣、535 值與 A／C，不採用傳入 checks；首次證明保存 `initialVerification`。移除 `pendingReason`；`verify-migration.cjs` 讓代表遷移只能沿用首次證明（schema 2 另存 `talentInitialVerification`），`runCopy` 附上天賦證據，新增 `random-talents-lifecycle` 副本。新增 `verify-talents-suite.cjs`（`--record`／`--merge-results`）與 `tests/talents-native.test.cjs`（偽造全 true、竄改公式／token／PID／事件、代表子集首次開放、core 變更皆失敗）。
- 第 8 條：V1.0.11.2／build 26126719，Windows win32-x64，完整開發快取＋獨立 runtime，隱藏靜音、真實 Steam 初始化，基準存檔為 repo 外副本（SHA-256 `ebb0a4a2…84c5`），computer use 0。`random-talents-matrix` 11 步、`random-talents-lifecycle` 19 步全部通過、無警告；535 值與核心逐一完全相等，33×6 個天賦 token 皆整數，生命週期 9 個不同 PID。13 項 checks 由合併器重算全成立。證據 `e7b433bd…24cf2`、manifest `686c4d45…387d`；原始輸出在 repo 外 `v2.9-talents-20261023/random-talents-QUlgMN`。首次證明以 `--merge-results --record` 只在原 bytes 插入本 section 與旗標（formulaHash 前綴 `66b8a442053a9cd2`、dataHash `286c9d4e…`），其他 section 不變；在任務 9 的技藝上限合併之後寫入，因此建置與 `--check` 當場通過。
- 第 9 條：`verify-migration.cjs --plan` 確認安裝 build 26126719、15 指紋相符、無未知相依；因 core 雜湊改變 auto 會選全部 15 份，但只有技藝上限綁整份 core，故以 `--copies` 只跑 `random-skill-caps-representative`（11 步）與 `random-skill-caps-lifecycle`（19 步），全部通過。repo 外 `merge-skill-caps.cjs` 以 `Caps.validateResults(...,{initial:false})` 重算後只替換 `randomCharacterSkillCaps` 物件：僅 formulaHash（改為凍結 core `fe014619…9756`）與證據雜湊兩行變動，首次 108＋2 `initialVerification` 與其他 section 原 bytes 不變。`--baseline` 重建 `knowledge/migration-baseline.json`。`index.html` 加 `talentLevelsEditor` 容器並同步建置；新增 `tests/browser/talent-levels.spec.cjs`。首次 `verify:release` 在 HTTP 390px 抓到天賦編輯器使頁面溢出（任務 6 的 UI 缺陷），改為讓既有 `.tablewrap` 溢出／`min-width:0`／toolbar 換行規則也套用 `#talentLevelsEditor`（只改 CSS）後重跑通過。
- 驗收：`BANDIT_BROWSER_PORT=8942 npm run verify:release` 全過：建置同步、180 Node、16 headless（含天賦 HTTP 1280／390px、直接 file、PWA 斷網），0 失敗／略過。25/25 群組開放；`src/core.js` 仍為凍結 SHA-256 `fe01461977c8164b97c8c2101c5f9c4b4a43b816d37f53c06e244c7eb75d9756`。
- 文件：研究筆記補隔離原生驗證與仍未驗證項目；維護指引新增 v2.9 段（API、12 欄群組、證明綁定、首次開放與代表遷移、技藝上限重開流程）；測試指引補天賦 UI／headless；專案技能更新 v2.9 與技藝上限條目。AGENTS.md 核對後不需調整（無天賦專屬規則，通用規則仍一致）。
- 未做：渡劫、遊戲畫面名稱／tips、戰鬥／生產實際效果與 macOS 未驗證；版本號、更新紀錄與 README 屬任務 10；沒有提交或推送。
