# Discussions 維護

[維護索引](../maintenance.md) · [專案 Discussions](https://github.com/jakeuj/bandit-save-editor/discussions)

## 操作與來源

直接用 `gh api graphql` 發布或更新 `jakeuj/bandit-save-editor` 的公告，不開 Edge 或其他瀏覽器，也不追加例行畫面／截圖驗收。在使用者已授權的主題、內容與發布範圍內執行；維護規則本身不代表每次 repo 更新都要自動發公告。

內容依 [README](../../README.md)、[各版紀錄](../releases.md)及任務相關文件整理。區分已發布能力、本機未提交成果與研究候選，保留遊戲版本、功能限制及驗收界線；不公開真實存檔、原始 log、私人資料或機器路徑。

## 發布或更新流程

1. 查詢 repository ID、`hasDiscussionsEnabled` 與 `discussionCategories`，依名稱找到目前的 `Announcements` category ID。其他分類依使用者指定，不沿用未核對的舊 ID。
2. 更新指定討論時，以 `repository.discussion(number: ...)` 讀取其 ID、標題、內文、分類及 URL；未指定編號時先查既有討論並按主題確認目標，清單有下一頁就繼續分頁。既有介紹與使用入口公告為 [Discussion #3](https://github.com/jakeuj/bandit-save-editor/discussions/3)，更新此公告沿用原討論，不另發一篇。
3. 新公告使用 `createDiscussion(input: {repositoryId, categoryId, title, body})`；更新使用 `updateDiscussion(input: {discussionId, title, body})`，只傳本次要改的欄位，保留其餘內容與分類。只有確定屬於新增主題或使用者明確要求新公告時才建立。
4. 將 GraphQL query 與 variables 寫成 UTF-8 JSON 輸入檔，以 `gh api graphql --input <payload.json>` 執行。多行 Markdown 保留真正換行，不把內文拼成 shell 指令。成功回應立即保存討論 ID、編號與 URL，供續跑核對。
5. 用討論編號或 ID 讀回遠端，核對標題、內文與分類符合預期後，回報公告連結。mutation 成功但讀回不符時，保留差異並針對原 ID 處理，不宣稱完整成功。

新增若逾時、502 或結果不明，先查建立回應及遠端同主題討論；無法確認時保留不確定狀態，不直接重送 `createDiscussion`。清單空白不單獨作為不存在的證據，已知 ID 優先單筆查證。

純公告維護不跑網站建置、不提交 repo、不等待 Pages。若同時要求修改技能或 repo 文件，依[提交與發布](release.md#提交與發布)檢查待提交快照，僅提交授權文件，保留其他開發變更。
