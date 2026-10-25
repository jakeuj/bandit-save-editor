# Project 維護

[維護索引](../maintenance.md) · [山寨帳房 Project #3](https://github.com/users/jakeuj/projects/3)

## 來源與狀態

維護目標為 owner `jakeuj` 的 Project `3`，直接使用 `gh project` 與必要的 `gh api graphql`。除非使用者明確要求瀏覽器操作，否則不開 Edge 或其他瀏覽器，不追加例行畫面驗收。維持既有可見性與權限。

先讀[目前規劃](../research/next-version-plan.md)及相關研究文件的實作摘要（舊功能另見 `sdd/` 歷史紀錄），再核對工作樹。卡片以來源文件與具體任務範圍配對，不只比標題。

- **待辦**：尚未開始的階段、驗收缺口或待評估候選；候選不等於排程或實作授權。
- **進行中**：已有實作但該卡範圍尚未交付；本機未提交成果須明標，不宣稱已發布。
- **已完成**：來源已記錄該卡範圍完成；尚未通過的驗收另列，不能因部分勾選或建置成功就將整案結案。

保留來源連結、驗收界線與未提交註記。歷史待辦若已被後續版本完成，不重新開案；Project 狀態不新增遊戲操作、實作或發布授權。

## 更新既有卡片

1. 用 `gh project view 3 --owner jakeuj --format json` 核對 Project 身分；用 `gh project field-list 3 --owner jakeuj --format json` 取得目前 Status 欄位與選項 ID，不硬編碼舊選項。
2. 用 `gh project item-list 3 --owner jakeuj --limit 100 --format json` 讀清單，確認沒有因筆數上限漏項；更多項目用 GraphQL 分頁。另核對本機 ID 清冊，依來源與範圍找既有卡片。
3. 直接更新既有卡片。草稿標題／內文使用 `gh project item-edit --id <DraftIssue-ID> --title ... --body ...`；狀態使用 `gh project item-edit --id <ProjectV2Item-ID> --project-id <Project-ID> --field-id <Status-field-ID> --single-select-option-id <Option-ID>`。兩種 ID 分開保存。若內容是 Issue／PR，沿用其原始項目，不轉成重複草稿。
4. 寫入後用 GraphQL `node(id: ...)` 讀回卡片的 Project、content、`isArchived` 與 `fieldValueByName(name:"Status")`，核對要求的內容與分類，再更新 ID 清冊。多行內容透過結構化輸入檔或程式參數傳給 `gh`，不拼接不安全的 shell 字串。

本機清冊存於已忽略的 `.local/project-items.json`，保存 Project ID、來源任務、ProjectV2Item ID、content ID、標題、狀態及核對日期。建立或更新成功就立即保存 ID，避免只留在暫存輸出。清冊可能過期，每次仍讀回遠端核對；私人卡片內文、完整 API 回應與機器路徑不提交到公開 repo。

只有明確屬於新增範圍、且完成既有卡片查重後才建立新卡。新增回應逾時、502 或結果不明時，先恢復查證結果，不直接重試建立。

## 清單異常與完成條件

清單為 0 或少項不代表卡片不存在。先核對帳號／Project、查詢筆數與分頁、檢視 filter，以及封存狀態；必要時查詢 `items(archivedStates:[ARCHIVED,NOT_ARCHIVED])`。再依清冊的既有 ID 逐卡讀回，核對歸屬、內文與狀態。缺少 ID 時先查既有建立回應與核對紀錄，無法確認則保留缺口；不得靠重複新增、刪除重建或另建 Project 處理清單問題。

2026-10-23 曾出現 Project 清單 GraphQL／REST 均回傳 0，但 35 張既有卡片可逐卡讀回的情況。當次核對為待辦 21、進行中 1、已完成 13，ID 不重複且內容／狀態相符；這是歷史快照，不是永久筆數要求。證據指向清單讀取／索引異常，但未經 GitHub 確認後端根因，不宣稱一定只是短暫延遲或已修復。

完成回報區分「寫入已確認」、「逐卡已核對」與「清單可正常列出」。清單仍異常時保存 ID 清冊與證據、說明未解決處，不反覆新增或無限輪詢。純 Project 維護不跑網站建置或等待 Pages；若另改 repo 文件，依[提交與發布](release.md#提交與發布)只檢查並提交授權範圍。
