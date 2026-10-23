---
name: bandit-save-editor
description: 維護 jakeuj/bandit-save-editor（山寨帳房／塔防山賊模擬器存檔修改器）的資源與成長編輯、存檔知識、離線版、SEO／分享預覽、GitHub Pages、專案 Wiki／Project／Discussions／Issues，以及 repo 內的實驗性 macOS ARM64 啟動器。用於此專案的進度查詢（現在做到哪、下一步做什麼）、續做下一版、開發、驗證、發布、Wiki／Project／公告／Issue 維護與 Mac／CrossOver 啟動調查；其他專案的一般 GitHub 操作或其他遊戲不適用。
---

# 山寨帳房 Repo 維護

維護 [jakeuj/bandit-save-editor](https://github.com/jakeuj/bandit-save-editor)，使用台灣繁體中文。專案包含瀏覽器本機存檔修改器與實驗性 Mac 啟動器。

## 定位專案

此技能隨 repo 提供，位於 `.agents/skills/bandit-save-editor/`；`.claude/skills/bandit-save-editor` 是指向同一份的 symlink。以目前 checkout 的 repo 根目錄為工作位置，核對 Git remote 與工作目錄變更。

技能未載入或連結異常時，讀[技能載入與連結修復](references/skill-loading.md)；正常任務不執行修復。

先讀 repo 的 `AGENTS.md`、`README.md` 與任務相關文件。技能提供入口與維護約束；公式、SID、指紋、實測證據及未完成項目以 repo 文件為準。舊對話 `outputs/` 的離線 HTML 不是開發來源。

## 進度查詢與承接

使用者問「現在做到哪」、「下一步做什麼」或「繼續實作下一版功能」時，先讀 repo 的 [下一步與目前進度](../../../docs/research/next-version-plan.md)，核對工作樹，依[輕量開發流程](../../../docs/maintenance/lightweight.md)在同一個 session 實作；只有工作真的能並行或很長時，才依[任務分派](../../../docs/maintenance/dispatch.md)開子 session。不重問已明確的目標。每次停點更新同一進度入口；roadmap 只用於候選排序，歷史完成工作不重開。每完成一個功能，主動把可重用的教訓寫回技能或對應的維護文件。

## 規則同步檢查

更新此技能或使用者要求調整工作流程時，將下列檢查納入同一次修改：

1. 重讀目前磁碟上的技能正本及適用的 `AGENTS.md`（含上層與目標目錄的指引），以使用者最新要求核對同一行為的規則。搜尋相關技能參考文件與維護／測試指引，找出仍要求舊流程的段落。
2. 在已授權範圍內一併修正衝突或補足 AGENTS 的入口，保留無關修改。通用規則集中於適當入口，細節以連結指向主文件；涉及自動執行時也核對實際腳本或 workflow，區分文件規則與工具行為。若受其他適用指令或權限限制而無法同步，明確指出未完成處與實際影響。
3. 完成前重新搜尋舊措辭，核對會影響下一次決策的入口與例外一致。交付時簡述 AGENTS 已調整，或核對後不需調整及原因；區分已寫入本機、已提交／推送及實際驗證範圍。當前工作階段重讀新規則；後續工作階段從 repo 最新指引載入，不以只修改技能檔作為行為已驗證的證據。

## 依任務讀取

所有 repo 路徑以 checkout 根目錄為準；只讀命中的入口。

| 任務 | 入口 |
| --- | --- |
| 架構與跨檔關係 | 若有 `graphify-out/graph.json` 先查圖譜並核對目前來源；建立、更新與完整性限制見 `docs/research/repository-graph.md` |
| 存檔讀寫、名稱、經驗、知識重建 | [存檔參考](references/save-format.md)、`src/core.js`、`docs/research/save-knowledge.md`、`docs/maintenance/core.md` |
| 裝備、丹藥、資質、技藝上限、天賦、批次或職業圖鑑 | [功能導覽](references/feature-guide.md) 的對應條目，接著讀該功能研究（舊功能另有 `sdd/` 歷史紀錄；新功能不建 SDD） |
| 遊戲改版、來源快取、原生驗證 | `docs/maintenance/migration.md`、[操作補充](references/operations.md) 的版本更新入口 |
| 開發測試與驗收 | `docs/testing.md`；新增功能依 `docs/maintenance/lightweight.md`，隱藏原生測試先讀 `docs/maintenance/migration.md`「本機開發快取」並核對 `.local/game-sources.json` 的 `preferredDevelopmentSourceId` |
| PWA、直接開檔、離線驗收 | `docs/maintenance/pwa.md`、`docs/testing.md` |
| 提交、發布、版本標示、SEO、分享預覽 | `docs/maintenance/release.md`、[Pages 參考](references/pages.md)；交付證據界線見[操作補充](references/operations.md) |
| Wiki 內容與側邊欄維護 | `docs/maintenance/release.md`「Wiki 維護」；已初始化，直接用 Git 提交推送，除非使用者明確要求，否則不開 Edge 或其他瀏覽器 |
| Project 卡片、狀態與清單異常 | `docs/maintenance/projects.md`；直接用 `gh` 更新既有 ID，清單異常不重複新增，除非使用者明確要求，否則不開瀏覽器 |
| Discussions 公告發布與更新 | `docs/maintenance/discussions.md`；直接用 `gh api graphql`，不開瀏覽器，更新沿用原討論 ID 並讀回確認 |
| Issues 建立、更新與查重 | `docs/maintenance/issues.md`；直接用 `gh`，不開瀏覽器，先查開啟／已關閉 Issue，更新沿用原編號，結果不明不重複新增 |
| 目前進度、下一步、繼續實作下一版 | `docs/research/next-version-plan.md`；依 `docs/maintenance/lightweight.md` 在同一 session 實作，必要時才依 `docs/maintenance/dispatch.md` 開子 session，候選排序再讀 roadmap |
| 使用者明確要求遊戲 UI | `docs/game-ui-testing.md` 快速開始與目標路徑，再讀當次 computer-use 技能 |
| Mac／CrossOver／Steam／存檔位置 | [Mac 參考](references/macos.md)、`launcher/README.md`、`docs/research/macos-runtime-investigation.md` |

日常推送先依[待提交快照檢查](../../../docs/maintenance/release.md#待提交快照檢查)驗證暫存區 Git bytes；工作目錄的 `--check` 不代替此檢查；推送成功即結束（含功能發布），不追蹤 Pages；Wiki／Project／公告預設不同步，使用者要求才處理。功能收尾依發布指引的[最短流程](../../../docs/maintenance/release.md#功能收尾預設最短流程)。完整驗收與部署追蹤條件依發布指引。新功能的驗證、改 core 與遊戲改版時要跑什麼，依[輕量開發流程](../../../docs/maintenance/lightweight.md)；新寫入功能在冒煙通過前維持關閉。建置閘門只核對每個開啟旗標在 `knowledge/verification.json` 的紀錄、遊戲版本與資料指紋，改 core 不會讓它失敗；輕量開啟的群組另記 `lightweight` 冒煙紀錄，不進複合遷移證明，改版後關閉待重冒煙，見該頁「建置閘門」；測試也不再把歷史證明綁到目前 core，新旗標記得登記 family，見該頁「測試也不綁目前 core」。

## 編輯來源

- 新功能依[core 開發規範](../../../docs/maintenance/core.md#新功能的-core-開發規範)走獨立入口、不改共用樞紐，方便維護。
- 讀寫、型別與成長交易改 `src/core.js`；一般操作改 `src/ui.js`；角色、裝備及欄位圖鑑改 `src/knowledge-ui.js`。
- `knowledge/catalog.json` 由 `scripts/extract-game.cjs` 產生；繁體名稱對照與寫入實測分別維護於 `knowledge/traditional-names.json`、`knowledge/verification.json`。
- HTML 結構、樣式與 SEO 改 `index.html`。其中的 `save-core`／`save-ui` 由 `node scripts/build-editor.cjs` 同步，修改程式來源後一併提交產生的 HTML；直接修改內嵌程式會被覆蓋。
- 維持單檔 HTML 內嵌程式與知識、本機處理及 CSP 禁止連線；使用者操作不需要 Node.js 或外部遊戲資料表。

## 寫入約束

- 匯出只替換指定值的 token，保留其他原始文字，包括大型整數 literal、BOM、空白及指數寫法。數值與字串皆須維持原型別；JSON 字串跳脫與 HTML 顯示跳脫各自處理。
- 欄位權限由 `resolveField`／`setField` 統一判斷；舊 `set` 與自訂座標不能繞過已知唯讀限制。
- 角色、已習得職業及九項技藝的經驗使用 `addExperience` 聯動結算；等級與餘額不單獨改寫。同一角色同一類經驗的累計變更整組還原，`undo` 則回到前一次交易；失敗交易全部回滾。
- 新增寫入功能：合成測試加一次隔離遊戲冒煙（代表案例原版存檔、新程序讀回）通過才開旗標，不做全量矩陣與遊戲 UI 證據，見[輕量開發流程](../../../docs/maintenance/lightweight.md)。
- 真實存檔、遊戲 payload、runtime、驗證 state 與原始 log 留在 repo 外。使用固定副本驗證，修改玩家原檔依任務指示執行並保留備份。

整份 core 摘要格式、舊證明對照與註解／排版的適用界線見 `docs/research/core-ast-proof.md`；續跑 checkpoint 仍核對精確檔案指紋。
