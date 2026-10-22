# Issues 維護

[維護索引](../maintenance.md) · [專案 Issues](https://github.com/jakeuj/bandit-save-editor/issues)

## 操作與來源

直接使用 `gh issue`，必要時用 `gh api`，明確指定 `--repo jakeuj/bandit-save-editor`，不開 Edge 或其他瀏覽器，不使用 `--web` 或追加例行畫面驗收。只執行使用者已授權的建立、更新、留言、分類或狀態管理；本規則不代表每次開發都自動建立 Issue。

內容依目前規劃、相關 SDD 與實際證據整理。問題描述區分重現步驟、預期與實際結果；功能需求標明範圍、完成條件與來源。保留已發布／本機未提交／研究候選的區別，不公開真實存檔、遊戲 payload、原始 log、私人資料或機器路徑。

## 查重、建立與更新

1. 有指定編號或 URL 時，先用 `gh issue view <number> --repo jakeuj/bandit-save-editor --json number,title,body,state,url,labels,assignees,milestone` 讀原內容。未指定時用 `gh issue list --repo jakeuj/bandit-save-editor --state all --limit 100 --json number,title,body,state,url`，按來源任務、問題語意與範圍比對，不能只比完全相同標題。清單可能超過上限時提高 limit 或用 API 分頁；搜尋只是輔助，不將搜尋未命中視為不存在。
2. 同一問題優先更新既有 Issue，使用 `gh issue edit <number> --repo jakeuj/bandit-save-editor`，只修改本次授權欄位，保留其他內容。已關閉 Issue 若屬相同問題再發，依證據與授權決定重開或補充；不同問題才另建並引用相關舊案。
3. 確認是新增範圍且完成查重後，使用 `gh issue create --repo jakeuj/bandit-save-editor --title <title> --body-file <body.md>`。更新內文也用 `--body-file`；UTF-8 Markdown 保留真正換行，不把內文拼成 shell 指令。建立成功立即保存編號與 URL，後續沿用原 Issue。
4. 標籤、負責人及里程碑先查既有值，按需求用 `gh issue edit` 更新；不順便建立分類或指派無關人員。留言用 `gh issue comment --body-file`，關閉／重開用 `gh issue close`／`gh issue reopen`，均需在當次授權範圍內。未提交成果不自動等於已發布或可結案。
5. 操作後用 `gh issue view --json ...` 讀回相應欄位；留言另讀 comments 確認。核對內容、狀態與分類後回報 Issue 連結，不只依命令成功就宣稱結果一致。

建立或留言遇到逾時、502 或結果不明，先查既有回應、同主題 Issue／留言與遠端單筆內容，不直接重送。清單或搜尋異常時，已知編號優先單筆讀取；無法確認則保存證據並說明缺口，不重複新增、不刪除重建。

## Project 關聯與完成界線

需要加入或同步 Project 時，先依 [Project 維護](projects.md)核對原卡片與本機 ID 清冊。已有同範圍草稿時，先辨識其與 Issue 的關係及本次授權，不再新增一張重複草稿或重複關聯。Project 清單為 0 不代表 Issue 或卡片不存在；Issue 開關狀態與 Project Status 分別讀回，不假定兩者一定自動同步。

純 Issue 維護不跑網站建置、不提交 repo、不等待 Pages。若同時修改技能或 repo 文件，依[提交與發布](release.md#提交與發布)檢查待提交快照，僅提交授權文件，保留其他開發變更。
