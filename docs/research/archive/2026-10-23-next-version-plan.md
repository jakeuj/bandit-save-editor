# 歷史盤點：v2.8 後續版本規劃

本頁保留當時調查、未完成狀態與接續 prompt；不是現行操作指令或新的授權。後續進度見[目前入口](../next-version-plan.md)。

# 後續版本實作計畫（2026-10-23 盤點）

盤點日期：2026-10-23（Asia/Taipei）。基準 HEAD `c05c4ae`（knowledge 已對齊 **V1.0.11.2／Steam build 26126719**），編輯器 **v2.8**。本文件是一次多代理盤點（6 份子系統地圖、3 份提案、3 位評審、24 次反駁驗證、1 次完整性審查）的濃縮結果，目的是讓後續 session 不必重新研究就能開工。**本文件不授權開啟任何閘門**；每項仍依[維護指引](../../maintenance/core.md#重建知識與開放寫入)走來源追查、合成測試、隔離實測與指紋寫入。

讀本文件前不必再讀完整路線圖；需要單項細節時再依下方連結跳到[功能路線圖](../feature-roadmap.md)對應段落。路線圖第 0–10 項的排序與理由仍有效，但其「基準 V1.0.10.2」敘述已過時（見第 3 節）。

## 1. 現況快照（已核對）

| 項目 | 狀態 | 證據 |
| --- | --- | --- |
| 知識基準 | V1.0.11.2／build 26126719，24 群組全部開放（代表子集遷移＋最小 UI 補測，Windows 隔離） | `knowledge/verification.json`（`migration.completed=true`）、[V1.0.11.2 對齊紀錄](../v1.0.11.2-audit.md) |
| 正式站 | `c05c4ae` 已推送，Pages run 39809846573 build／deploy 成功；線上 `index.html` 與 `sw.js` 的 SHA-256 與該提交 Git blob 相符；側欄「修改器 v2.8 · 2026.10.22」、遊戲版本 V1.0.11.2 | 2026-10-23 以 no-cache 抓取比對 |
| 本機核對 | `node scripts/build-editor.cjs --check` 通過；`node --test tests/*.test.cjs` 138 項全過（56.8 秒） | 2026-10-23 執行 |
| 未重跑 | 12 項 headless（`npm run test:browser`）、本機安裝 15 指紋重算、新版 Mac 啟動／存讀 | — |
| 技藝上限證明 | 首次完整 108＋2 矩陣仍是 V1.0.10.2／darwin-arm64（`023b4f4` 的 verification.json）；V1.0.11.2 只有 Q1／Q6 代表子集（2 矩陣＋2 生命週期，win32） | `knowledge/verification.json` randomCharacterSkillCaps、[v2.8 研究](../random-character-skill-caps.md) |
| 進行中 | `sdd/selective-migration/`（遊戲改版按影響驗證）：5 條任務未勾，但 `scripts/migration-analysis.cjs`、`migration-cli.cjs`、`migration-proof.cjs`、`migration-source.cjs` 已寫出，並把 `scripts/build-editor.cjs` 與兩個 proof 檢查器改接 `proof.schemaVersion===2` 的共用閘門（現行 verification.json 無此欄位，分支潛伏未啟用）。2026-10-23 盤點時全部未提交 | `git status`、`sdd/selective-migration/tasks.md` |
| 未勾選 SDD 任務 | 只有 4 條，全是直接 `file://` 人工驗收：v2.1 任務 7b、第二批 9b、v2.3 任務 10、save-knowledge 任務 6 | 各 `sdd/*/tasks.md` |

## 2. 已驗證的關鍵事實

以下每條都經反駁驗證（三位獨立代理以原始碼、文件、版本順序三種角度查證），並由本次 session 再次人工核對列出的行號。

1. **z9 套裝等級是已出貨但沒有證明的寫入路徑。** `src/core.js` 的 `editingInfo` 裝備分支只排除 `宝物`／`内丹`（約第 70 行）；`item.kind!=='普通'` 與 `setLink!==0` 檢查只存在於 z7 背包分支（約第 75 行）與 `ordinaryEquipment`（約第 137 行），而後者只在 `plane===7` 時被 `setEditingValue` 呼叫（約第 100 行）。因此 `setEquipmentLevel(model,{itemId,level})`（預設 plane 9）可改裝備庫內套裝（例如 `土匪之槍`，id 28，kind `套装`，setLink≠0）的等級，但 `equipmentLevel` 群組證明只涵蓋普通裝備。headless 探針以合成存檔重現 z9 套裝被接受、z7 被拒絕；批次路徑不受影響（`src/core.js` 批次已排除非普通）。沒有任何遊戲內證據，不知道遊戲載入後會怎麼處理。路線圖第 3 項「v2.1 以 wp4=普通 排除套裝」的敘述與程式不符。
2. **任何 `src/core.js` 位元變動都會讓 `randomCharacterSkillCaps` 的整檔 `formulaHash` 失效**，建置 `--check` 拋錯；`randomCharacterGrowth` 與 `equipmentQuality` 只綁公式片段，不受影響（除非改到該片段）。但首次 108＋2 證明（`initialVerification`）不綁當前 core，可被代表遷移沿用——V1.0.10.2→V1.0.11.2 遷移就是這樣做的。
3. **同指紋下重開技藝上限群組的路徑**：HEAD（舊閘門）只有 `scripts/verify-skill-caps-suite.cjs --record` 重跑 108＋2；selective-migration 落地後（schemaVersion 2），core 改動會讓 `migration-cli auto` 把全部 8 家族 15 副本判為需原生重跑（技藝上限只跑 2＋2 代表）。兩條路都需要 Windows 隔離環境、相符的 15 指紋來源與基準存檔；108＋2 在 Windows 沒有先例、`verify-skill-caps-suite.cjs` 沒有 `--resume`、repo 沒有耗時紀錄。
4. **天賦（v2.9）就緒度不足以一個週期過閘**：`knowledge/catalog.json` 的 `randomCharacterSkillCaps.talents` 已有 75 個 tf 天賦與六品質等級池 `[1,2]/[1,3]/[2,4]/[3,5]/[4,5]/[5]`，核心只把 z12 y1–3／21–23 當唯讀見證。75 個天賦只有 3 個走 104–106 資質分支，其餘效果分支沒有公式與 oracle；0/0 空槽、三槽去重、傾向 OR 條件、轉職後 `excludedPrimary` 重檢都未定。沒有 SDD、交易 API、群組或證明工具。
5. **套裝等級（路線圖第 3 項）知識層空白**：catalog 只算 `tz.json` 指紋沒有列資料；套裝升級是否共用 `装备等级上限` SID `713681756866045`、套裝屬性是否隨 y6 重算、y23／y26／y27 語意都未證明；`migration-scenarios.cjs` 只建普通裝備列。V1.0.11.2 的套裝合成改為依選擇庫別寫入物品（`[*,7,9]` 讀取），正式化後 z9 歸屬須重查。
6. **文件殘留 V1.0.10.2 基準**：`docs/research/feature-roadmap.md`（研究日期段、基準段、文末 V1.0.11.0 影響段）、`docs/research/random-character-skill-caps.md` 首段、`docs/game-ui-testing.md` 的畫面基準與洗練入口、`launcher/README.md` 第 11 行行尾版本清單、`mac.html` 的預設來源目錄與「已實測」面板、`.agents/skills/bandit-save-editor/references/macos.md` 對 `prepare-macos.py` 預設目錄的描述。`c05c4ae` 的正式發布核對沒有寫進任何文件。
7. **遷移工具覆蓋**：`verification-requirements.cjs`、`verification-suite.cjs`、`migration-scenarios.cjs` 已含全部 24 群組，代表子集 15 個副本；`tests/version-migration.test.cjs` 強制新群組同時有 section、family、代表情境。新群組必須同步三表，否則建置與測試失敗。
8. **UI 層沒有擋套裝**：`src/knowledge-ui.js` 的 `equipmentChoices` 列出 z9 全部物品，核心 fail-closed 後使用者仍可在下拉選到套裝，只會在狀態列看到核心錯誤文字；`tests/equipment-ui.test.cjs` 與 `tests/browser/*.spec.cjs` 沒有裝備等級案例。

## 3. 版本順序建議

| 序 | 版本 | 性質 | 一句話 |
| --- | --- | --- | --- |
| 0 | selective-migration 落地 | 進行中（另一 session） | 它正佔著 `build-editor.cjs`、`verify-migration.cjs`、兩個 proof 腳本；其他版本與它同檔必衝突，先讓它提交 |
| 1 | **v2.8.1 鞏固版** | 修正＋文件，不加功能 | 關閉 z9 套裝等級未證明路徑、文件對齊 V1.0.11.2、記錄 c05c4ae 發布核對；SDD 草案見 [sdd/v2.8.1-consolidation](../../../sdd/v2.8.1-consolidation/proposal.md) |
| 2 | **v2.9 天賦** | 先前置研究，再 A／B 兩階段 | 保留 v2.9 命名給天賦（路線圖、v2.7／v2.8 研究與 SDD 都這樣寫）；前置研究清單見第 5 節 |
| 3 | 套裝等級 | 研究後 go／no-go | 第 6 節；可與第 2 項的研究並行，純文件不阻擋發布 |
| 4 | 寶物等級／經驗、丹藥擴充、套裝品質、靈物、內丹、城市、超限、建築 | 依路線圖第 4–10 項 | 都需要新群組與值域證明，知識層空白，維持延後 |

評審三人中兩人選「鞏固版」路線（總分 15／15），一人選「玩家價值優先」（13）但同樣給鞏固版 13 分。鞏固版勝出的理由：不開新群組、唯一一次核心改動、修的是已出貨的證據缺口；弱項是沒有新玩家功能。

### 退回方案

v2.8.1 若取不到 Windows 隔離環境或 108＋2／15 副本在週期內跑不完：**不改 `src/core.js`**，只在 `src/knowledge-ui.js` 的 `equipmentChoices` 過濾 z9 套裝並在編輯器顯示「套裝等級尚未隔離驗證」，文件標記缺口。這不是 fail-closed（核心仍接受），只是 UI 遮蔽，更新紀錄要如實寫。

### 需要使用者決定的事

1. selective-migration 與 v2.8.1 的先後與單一寫入者分支策略（兩者同時改閘門檔會衝突）。
2. 是否授權把 z9 套裝等級改為唯讀：這是對已出貨能力的收回；v2.8 以前已在 z9 把套裝升到上限的存檔，載入後該件顯示唯讀且無法還原，不追溯、不算載入失敗。更新紀錄必須明說。
3. 版號採 v2.8.1（保留 v2.9 給天賦）還是直接 v2.9。
4. 重開技藝上限群組走哪條路：等 selective-migration 後跑 `migration-cli auto`（15 副本，技藝上限只跑代表 2＋2），或直接 `verify-skill-caps-suite.cjs --record` 重跑 108＋2 把 `initialVerification` 升級到 V1.0.11.2。

## 4. v2.8.1 鞏固版範圍（可直接轉成 SDD 任務）

1. **核心閘門**：`editingInfo` 的 plane 9 分支加入與 `ordinaryEquipment` 同語意的 `item.kind==='普通'` 且 `KNOWLEDGE.batch2Data.items[item.id].setLink===0` 檢查；套裝／setLink≠0 在 z9 的裝備等級改為唯讀，錯誤訊息含「套裝」。只改 `editingInfo`，不碰 `ordinaryEquipment` 函式文字、`qualityAttributeEffect`，以及 v2.7 證明綁定的切片（`scripts/random-character-growth-proof.cjs` 列出的 core 區段）。完成後凍結 `src/core.js`。
2. **測試**：`tests/advanced-editing.test.cjs` 新增 z9 套裝（範本 28 土匪之槍，setLink≠0）與 z7 套裝皆被 `setEquipmentLevel`／`editingInfo` 拒絕且訊息含「套裝」；普通裝備 z7／z9 行為不變；寶物／內丹仍拒絕。`tests/equipment-ui.test.cjs` 補 UI 事件案例：選到 z9 套裝時顯示唯讀原因。改完立刻跑 `node --test tests/*.test.cjs` 與 `node scripts/build-editor.cjs --check`。注意 `--check` 遇第一個錯誤就 throw，技藝上限檢查排在 growth 與品質之前，所以「只看到 randomCharacterSkillCaps 錯誤」不能證明其他群組未受影響；要直接比對 `randomCharacterGrowth.formulaHash` 與 `equipmentQuality.formulaHash` 不變。
3. **重開技藝上限群組**：依第 3 節決定 4 的路徑，在 Windows 隔離副本以相符 15 指紋來源執行；通過後合併證明，核對其他 23 群組紀錄逐 byte 不變、`--check` 通過。旗標關閉狀態不得推送 main。
4. **文件對齊 V1.0.11.2**：第 2 節第 6 條列出的檔案；`docs/research/advanced-editing.md` 的 equipmentLevel 證明段旁註「不涵蓋套裝；v2.8 及以前 z9 套裝等級可寫為缺口」；`docs/research/feature-roadmap.md` 第 3 項更正為「v2.1 只在 z7 排除，z9 於 v2.8.1 補排除」。
5. **發布核對紀錄**：比照 `72398f4` 的做法，在 [V1.0.11.2 對齊紀錄](../v1.0.11.2-audit.md) 補 `c05c4ae` 的 Pages run 39809846573、線上 `index.html`／`sw.js` blob 相符、版本標籤 V1.0.11.2／v2.8（本文件第 1 節已有結果，搬過去即可）。
6. **維護指引補 Windows 遷移操作段**：`docs/maintenance.md`「版本遷移重驗」目前只有 macOS 指令；補 `--keep-copies` 避開 EPERM、CDP `Connection: close` 背景、`BANDIT_BROWSER_PORT=8942` 的本機過濾器例外（細節在 V1.0.11.2 對齊紀錄）。不改 `verify-migration.cjs`（與 selective-migration 同檔）。
7. **版本與更新紀錄**：側欄「修改器 v2.8.1 · 日期」，更新紀錄首筆標「遊戲 V1.0.11.2」，內容含「z9 套裝等級改為唯讀，待獨立證明」「不追溯」「不新增修改功能」；README、SKILL.md 同步；`tests/changelog.test.cjs` 接受 v2.8.1。
8. **發布**：`npm run verify:release` 全過後授權提交推送；Pages 成功後比對線上 blob，寫回紀錄。

並行、純文件、不阻擋發布：第 5 節天賦前置研究、第 6 節套裝等級研究、v2.1–v2.5 直接 `file://` 人工驗收（依 `docs/maintenance.md`「離線 HTML 人工驗收」五步，需使用者本人或 computer use 授權）。

延後到 v2.8.1 之後的獨立小提交：CI 拆 pull_request 驗證 job（目前 `.github/workflows/pages.yml` 只有 push main 與 workflow_dispatch）、Playwright 快取、`timeout-minutes`；PWA 狀態列顯示新版版號；Mac V1.0.11.2 啟動／存讀排練（需使用者的 Apple Silicon Mac 與 Mac Steam）。

## 5. v2.9 天賦前置研究清單

產出 `docs/research/random-character-talents.md` 與 `sdd/random-character-talents/proposal.md`，全部標示「靜態核對」，不開旗標、不改 core。來源入口：[v2.7 研究](../random-character-growth.md)第 25 行附近的 v2.9 限制、[v2.8 研究](../random-character-skill-caps.md)、`sdd/runtime-patch/proposal.md`（有名角色 `数值更新` 以 expressions 回填範本天賦到 z12 y1–3／21–23，說明為何只能做範本 0）。

1. tf 合法池：75 個 ID 是否全部可由原版招募產生；`招募测试角色`／`招募指定角色` 是否用池外或固定天賦；tf 欄 0–3、5 與 13–21 以外欄位語意；是否有品質限定 ID。
2. ID／等級型別：z12 y1–3、y21–23 在原版寫入下是否恆為整數；等級能否超出品質池（有名範本 js 54–56 回填值、重生／渡劫是否改等級）。
3. 0/0 空槽：原版招募去重失敗會不會留空槽；v2.7 允許、v2.8 不允許，v2.9 是否允許「清除天賦」寫 0/0，空槽角色能否再被 v2.8 接受。
4. 重複／適用性：三槽去重、戰鬥／生產傾向欄（tf 4／6）的完整 OR 條件表、`excludedPrimary` 所需主要技藝位置只能由九上限見證枚舉——嚴格語意要求資質＋九上限＋三天賦聯合見證，還是天賦只驗池內合法。
5. 效果分支：73 個非資質屬性（技點、暴擊、克制、技藝經驗、工作加成、經驗成長、額外倍率…）是否都是 level×coefficient/10；寫入 `属性临时` 哪一列；多屬性天賦（32 個）三欄是否獨立累加；`天赋属性计算` SID `778369382997146` 與 `天赋属性` SID `699833323210652` 的完整解讀；重算時機（載入、數值更新、招募、轉職）。
6. 三方相依與還原分組：改天賦改變 A→C（既有丹藥 B 超 C 要阻擋，比照 v2.7）、改變九上限見證（阻擋或聯合見證）；天賦 6 欄併入 v2.7 的 6 欄、v2.8 的 27 欄，還是新開第三個累計群組；undo 與 v2.6 批次暫存模型如何處理。
7. 招募天賦選取子樹（SID `873825376472526` 及三類傾向 SID）是否已在 `randomCharacterSkillCaps` 的 `sourceDigest` 子樹內；若否，v2.8 規則漂移保護與 v2.9 `sourceSids` 都要補。
8. 範圍政策三選一並估矩陣規模：只改等級／只改 ID／兩者；首版是否只開放純資質或單屬性天賦以縮小 oracle。
9. UI 證據：天賦名稱／tips／屬性文本屬顯示層；是否需要像首次選槽那樣加 `uiChecks` 與事件摘要，或明確只宣稱存檔與原生計算。
10. 必改檔案清單（天賦寫入落地時）：`scripts/verification-requirements.cjs` 新 section、`scripts/verification-suite.cjs` 新 family（`initialProofRequired`）、`scripts/migration-scenarios.cjs` 代表情境、新 scenarios／oracle／lifecycle／suite／proof 模組、`scripts/verify-game.cjs` 操作白名單、`src/core.js` 三具名 API、`src/ui.js` 三槽編輯器、`tests/version-migration.test.cjs`／`pwa.test.cjs`／`changelog.test.cjs` 同步。

## 6. 套裝等級前置研究清單

2026-10-23 進度：已完成[套裝等級研究](../set-equipment-level.md)，結論為 go 進入實作與首次獨立驗證；[SDD 提案](../../../sdd/set-equipment-level/proposal.md)與[任務](../../../sdd/set-equipment-level/tasks.md)仍待確認、尚未實作。下列清單保留為研究題目，後續沿用研究結果，不重做盤點或據此開閘。

產出 `docs/research/set-equipment-level.md`，結論為 go／no-go。以 SID 定位（V1.0.11.2 的 expression 已整段 +11）：

1. `装备等级上限` SID `713681756866045` 對套裝是否同為 `10+(Q−1)×5`。
2. `升级装备`／`升级最大装备`（V1.0.10.2 新增 SID `290240793057956`）的套裝分支、升級貨幣與魂魄的套裝難度。
3. `套装属性` SID `661914404104909`、`套装数量检测` SID `797846367485481`、`相同套装数` SID `240477057233049`：套裝加成是否隨 y6 重算、y23／y26／y27 在等級變更下是否需改寫。
4. `tz.json` 是否要進 catalog 列資料；`migration-scenarios.cjs` 需新增套裝列的基準存檔條件。
5. V1.0.11.2 套裝合成改依庫別寫入後的 z9 搬移與歸屬。
6. 若 go：z7／z9 各一個新群組、獨立 oracle、首次矩陣規模估計；v2.8.1 的「排除」改為「以套裝獨立證明取代排除」。

## 7. 本次盤點未驗證的事項

- 12 項 headless 未重跑；本機安裝的 15 指紋未重算（只核對 appmanifest buildid）。
- z9 套裝等級缺口只有合成存檔的 headless 核心探針，沒有遊戲載入／存檔／重啟證據。
- 「斷網下點擊下載離線版」是否命中 Service Worker 的 HOME 快取為靜態推論，未實測。
- selective-migration 的實作狀態以 2026-10-23 00:48 的工作樹為準，之後可能已改變；開工前重跑 `git status`。
- `graphify-out/graph.json` 停在 `db683ec`，缺遷移／證明模組與 v2.6–v2.8 API，行號已漂移；依 `graphify-out/.needs_update` 更新後才可用它規劃。

## 8. 給新 session 的接續 prompt

以下 prompt 設計給較便宜的模型，前提是先讀本文件；每個 prompt 只做一件事，做完回報再開下一個。使用者若已做出第 3 節的決定，直接把決定補在 prompt 末尾。

### Prompt A：v2.8.1 鞏固版（實作）

```text
請依 docs/research/next-version-plan.md 第 3–4 節實作 v2.8.1 鞏固版。先讀 AGENTS.md、docs/research/next-version-plan.md、sdd/v2.8.1-consolidation/proposal.md 與 tasks.md；只有需要細節時才讀 docs/maintenance.md 與 docs/research/v1.0.11.2-audit.md。
開工前：git status 確認工作樹乾淨；若有 sdd/selective-migration 的未提交變更，停下來回報，不要動那些檔案。
依 tasks.md 逐條完成並勾選；每條做完跑該條指定的測試。src/core.js 只改 editingInfo 的 plane 9 分支，改完就凍結。技藝上限群組重開需要 Windows 隔離環境與相符來源，若環境不可用，改走計畫第 3 節的退回方案並在 tasks.md 如實記錄。
不開新群組、不提交、不推送；全部完成並 npm run verify:release 通過後回報結果與缺口，等使用者授權提交。
使用者決定：（1）selective-migration 先後：＿＿；（2）z9 套裝等級改唯讀：＿＿；（3）版號：＿＿；（4）重開技藝上限路徑：＿＿。
```

### Prompt B：v2.9 天賦前置研究（只讀、純文件）

```text
請依 docs/research/next-version-plan.md 第 5 節完成 v2.9 一般隨機角色天賦的前置研究。先讀 AGENTS.md、docs/research/next-version-plan.md 第 2 與第 5 節、docs/research/random-character-growth.md、docs/research/random-character-skill-caps.md。
只讀 repo 與 repo 外的 V1.0.11.2 audit（路徑由使用者提供），不啟動遊戲、不改 src/、不改 catalog 或 verification、不開旗標。
產出 docs/research/random-character-talents.md（逐題回答第 5 節 1–9 題，每題標示「靜態核對」或「未知」，附 SID 與 expression）與 sdd/random-character-talents/proposal.md（三種範圍政策各自的矩陣規模、對 v2.7／v2.8 共同見證的影響、A／B 拆分與 ≤10 條任務建議）。不建立 tasks.md，等使用者核准。
完成後回報哪些問題仍無法由靜態來源回答，需要隔離實測。
```

### Prompt C：套裝等級前置研究（只讀、純文件）

```text
請依 docs/research/next-version-plan.md 第 6 節完成套裝等級的 go／no-go 研究，產出 docs/research/set-equipment-level.md。先讀 AGENTS.md、該計畫第 2 節第 1、5 條與第 6 節、docs/research/feature-roadmap.md 第 3 與第 5 項、docs/research/v1.0.11.2-audit.md 的套裝合成變更。
只讀 repo 與 repo 外 audit，不啟動遊戲、不改 src/、catalog、verification。每個結論附 SID 與 expression，區分靜態核對與未知。結尾給 go／no-go 與理由；若 go，列出新群組、oracle 與基準存檔條件。
```
