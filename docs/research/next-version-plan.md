# 下一步與目前進度

更新基準：2026-10-25 的已記錄交付。實際開放狀態仍須核對目前 catalog／verification；工作樹中的開發檔案不代表已通過驗證或發布。

## 現在接哪一案

**目前沒有功能主線。** v2.28 已把知識基準換成遊戲 V1.0.12.2（2026-10-25）；2026-10-24 起改採[輕量開發流程](../maintenance/lightweight.md)。

| 要知道什麼 | 目前答案 |
| --- | --- |
| 剛完成 | v2.32 UI／UX 優化（2026-10-25）：手機首屏與全部功能選單、角色頁內導覽及收合、匯出底列、詳細規則與空狀態；保留既有寫入規則。53 項相關 Node、92 項完整瀏覽器驗收通過；最後提示修正另有 21 項回歸通過，四種寬度的十項功能頁無整頁水平溢出。見[各版紀錄](../releases.md#v232-uiux-優化) |
| 更早 | v2.31 第六槽、v2.30 詞條係數超限、v2.29 招募科技超限、v2.28 遊戲 V1.0.12.2 與更早的功能見[各版紀錄](../releases.md)；靈物套裝合成與精煉的原生驗證（只驗證、無新旗標）見[集中研究](candidate-sweep-2026-10-23.md#原生驗證摘要2026-10-25修改後靈物用於套裝合成與內丹精煉) |
| 目前主線 | 無功能主線 |
| 下一步 | roadmap 的功能候選（含超限群組）已全部處理完；剩下另線與補驗：Mac 啟動器的 V1.0.12.2 本機存讀／重啟補驗（2026-10-25 已在 Windows 完成靜態登錄，補驗要用 Apple Silicon Mac）、有名角色 runtime 補丁提案。舊功能的直接 file 流程已於 2026-10-25 以 headless 驗收（見下方「尚待驗收」）。要做哪一項待使用者指定 |
| 文件維護 | 2026-10-25 已把舊流程入口對齊輕量流程、精簡技能並去除重複；新增 [`sdd/README.md`](../../sdd/README.md) 歷史索引；`lightweight.md` 只留常駐規則，改版步驟與各版教訓移到[遊戲改版](../maintenance/game-update.md)、[原生教訓](../maintenance/native-lessons.md)。尚未做：candidate-sweep 依主題拆檔、roadmap 縮成總表、舊 audit 移 `archive/`；需使用者指定才做 |
| 授權 | v2.32 已完成；提交／推送依當次對話授權，下一項待使用者指定 |
| 分派 | 預設在同一個 session 做完；查詢用子 agent，符合[分派判斷](../maintenance/dispatch.md#先判斷要不要分派)才開子 session |
| 開放狀態 | 以目前 catalog／verification 為準；輕量開啟的群組與冒煙紀錄記在 `knowledge/verification.json` 的 `lightweight` |

其他候選（roadmap 功能候選已全部處理完）排序與理由見[路線圖](feature-roadmap.md)；候選不等於排程或實作授權。原生重證成本的「並行副本」候選隨[輕量開發流程](../maintenance/lightweight.md#改-core-與遊戲改版)停用（[舊提案](../../sdd/core-slice-reproof/proposal.md)第 3 節不再需要）。

套裝品質 A／B 已作為 v2.12 發布。2026-10-23 的[後續候選集中研究](candidate-sweep-2026-10-23.md)之後各項（小數丹藥、靈物、結丹、內丹、城市／城牆、科技／建築）已陸續發布為 v2.13–v2.26，實作摘要也寫在該文件。

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
3. 改 core 依[輕量開發流程](../maintenance/lightweight.md#改-core-與遊戲改版)跑受影響功能的 Node 測試，牽涉存檔讀寫才補冒煙；不把舊版發布授權延伸為新任務授權。
4. 範本 0 隨機角色的資質、技藝上限與天賦不同於有名角色回填；涉及 runtime 補丁時另讀[補丁提案](../../sdd/runtime-patch/proposal.md)。

## 歷史盤點

[2026-10-23、v2.8 基準的完整盤點](archive/2026-10-23-next-version-plan.md)保留多代理評估、證據、當時缺口、備案與接續 prompt。其中「尚無天賦實作」、「套裝知識層空白」、待核准決策及未提交狀態屬當時快照，不是現況。舊 prompt 僅供追溯，不直接拿來重開已完成工作。
