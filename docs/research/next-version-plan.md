# 下一步與目前進度

更新基準：2026-10-25 的已記錄交付。實際開放狀態仍須核對目前 catalog／verification；工作樹中的開發檔案不代表已通過驗證或發布。

## 現在接哪一案

**目前沒有功能主線。** v2.28 已把知識基準換成遊戲 V1.0.12.2（2026-10-25）；2026-10-24 起改採[輕量開發流程](../maintenance/lightweight.md)。

| 要知道什麼 | 目前答案 |
| --- | --- |
| 剛完成 | v2.32 UI／UX 優化（2026-10-25）：手機首屏與全部功能選單、角色頁內導覽及收合、匯出底列、詳細規則與空狀態；保留既有寫入規則。53 項相關 Node、92 項完整瀏覽器驗收通過；最後提示修正另有 21 項回歸通過，四種寬度的十項功能頁無整頁水平溢出。見[各版紀錄](../releases.md#v232-uiux-優化) |
| 前一項 | v2.31 第六槽（2026-10-25）：Q6 普通裝備的第六槽 `[i,14,z]`／`[i,20,z]` 可新增、替換、清除（合法池不重複、50–120、兩位小數、y33 保持 0），獨立入口 `sixthAffixInfo`／`previewEquipmentSixthAffix`／`setEquipmentSixthAffix`。原生生成碰不到第六槽（`装备词条数量` 夾到 5），但 `装备属性计算`、`物品tips` 都是 Repeat 6 照算照列，洗練頁只列 5 槽。使用者決定只開第六槽、品質 7 判定不開放（原生拿不到、不多一槽、品質字樣空白、背景顯示凡物），並放寬穿戴者檢查（`ordinaryEquipment` 第 6 參數）。冒煙（沿用 v2.30 備料存檔：穿戴中暴傷 120、背包暴擊 50.5，兩輪存讀、效果差值等於預測、卸下穿回、原生洗練已選槽不動第六槽、修改器重讀）通過後開啟 `equipmentSixthAffix`。摘要見[第二批研究](advanced-editing-batch2.md#實作摘要2026-10-25v231-第六槽品質-7-判定不開放) |
| 再前一項 | v2.30 詞條係數超限（2026-10-25）：普通裝備已選洗練槽的係數 z7／z9 可設原版下限到 1000，原生線性不夾限、重洗回原版區間；冒煙後開啟 `equipmentAffixCoefficientAdvanced`。摘要見[第二批研究](advanced-editing-batch2.md#實作摘要2026-10-25v230-詞條係數超限) |
| 更早 | v2.29 招募科技超限（2026-10-25）：進階科技 #33 進階模式放寬到 599；冒煙後開啟 `recruitTechnologyAdvanced`。摘要見[進階修改研究](advanced-editing.md#實作摘要2026-10-25v229-招募科技超限) |
| 再更早 | v2.28 遊戲 V1.0.12.2（2026-10-25）：公式編號 +4，裝備與靈物兩份代表冒煙通過，原有旗標維持開放。做法見[輕量流程](../maintenance/lightweight.md#遊戲改版v228-實例)、摘要見[各版紀錄](../releases.md#v228-遊戲-v10122) |
| 歷史 | v2.27 丹藥超限與更早的功能見[各版紀錄](../releases.md)；靈物套裝合成與精煉的原生驗證（只驗證、無新旗標）見[集中研究](candidate-sweep-2026-10-23.md#原生驗證摘要2026-10-25修改後靈物用於套裝合成與內丹精煉) |
| 目前主線 | 無功能主線 |
| 下一步 | roadmap 的功能候選（含超限群組）已全部處理完；剩下另線與補驗：Mac 啟動器的 V1.0.12.2 本機存讀／重啟補驗（2026-10-25 已在 Windows 完成靜態登錄，補驗要用 Apple Silicon Mac）、有名角色 runtime 補丁提案。舊功能的直接 file 流程已於 2026-10-25 以 headless 驗收（見下方「尚待驗收」）。要做哪一項待使用者指定 |
| 授權 | v2.32 已完成；提交／推送依當次對話授權，下一項待使用者指定 |
| 分派 | 預設在同一個 session 做完；查詢用子 agent，符合[分派判斷](../maintenance/dispatch.md#先判斷要不要分派)才開子 session |
| 開放狀態 | 以目前 catalog／verification 為準；輕量開啟的群組（`pillAptitudeBonusDecimal`、`backpackEquipmentLevelAdvanced`、`relicAttributes`、`pillAptitudeBonusAscended`、`randomCharacterBaseAptitudesAscended`、`randomCharacterTalentsAscended`、`randomCharacterSkillCapsAscended`、`wallEnhancementLevel`、`cityLayerLevel`、`ascensionQuality`、`backpackInnerPillLevel`、`innerPillLevel`、`ascendedInnerPillLevel`、`basicTechnologyLevel`、`buildingLevel`、`placedRelicAttributes`、`pillAptitudeBonusAdvanced`、`recruitTechnologyAdvanced`、`equipmentAffixCoefficientAdvanced`、`equipmentSixthAffix`）記在 `verification.json` 的 `lightweight` |

### 其他候選

| 候選 | 目前完成到哪 | 下一步 | 要改 `src/core.js`？要跑原生驗證？ |
| --- | --- | --- | --- |
| 降低原生重證成本 | 第 1、2、4 節已實作並推送：core 依 family 切片綁定、獨立入口開發規範、開發中不選跑；以 v2.11 已證明 core 建立切片基準，未重跑原生 | 剩第 3 節：並行副本（先做 PID／profile 核對與 2 份 Steam 探針）；何時值得做由[重證成本紀錄](reproof-ledger.json)判斷，切片報告達門檻會印「提示：」 | 只改 `scripts/` 與文件；並行需要實際跑原生副本驗證 |

其他候選（roadmap 功能候選已全部處理完）排序與理由見[路線圖](feature-roadmap.md)；候選不等於排程或實作授權。

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

- 舊功能直接開檔（2026-10-25）：資源、名稱、三類經驗、自訂欄位設定、比對／CSV 與 v2.1–v2.6 已由 `tests/browser/legacy-file.spec.cjs` 以 headless Chromium 的 `file:` URL 完成讀取、編輯、還原／復原、精確匯出與重讀（6 案全過），範圍與未涵蓋處見[紀錄](../maintenance/pwa.md#2026-10-25-舊功能直接開檔驗收紀錄)。一般 Chrome／Edge、原生選檔與正式站下載的 HTML 未做；使用者決定以此作為驗收，四個歷史 SDD 任務（v2.1 7b、v2.2 9b、v2.3 10、save-knowledge 6）已勾選；原生選檔與一般瀏覽器改為按需。
- V1.0.11.2 與 V1.0.12.2 的 Mac 啟動、本機存讀與新程序重啟仍待補驗，不能沿用舊版結果。V1.0.12.2 的 `c3runtime.js` 已於 2026-10-25 在 Windows 做靜態核對並登錄（修正位置與前版相同，見 [Mac 研究](macos-runtime-investigation.md#v10122-靜態核對2026-10-25)），補驗要在 Apple Silicon Mac 上做。
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
