# 任務分派與子 session

[維護索引](../maintenance.md) · [承接流程](planning.md) · [下一步與目前進度](../research/next-version-plan.md)

> 2026-10-24 起預設在同一個 session 做完（見[輕量開發流程](lightweight.md)）。本頁只在工作真的能並行或很長，或使用者要求時適用。

使用者只對一個**主 session** 溝通。主 session 讀分派表，依各段建議的模型與思考程度自動開**子 session** 執行，收到子 session 回報後核對結果、再開下一批已解鎖段落，直到遇到停點才回到使用者。本頁規定主 session 怎麼拆段、開子 session、核對與交棒。

## 主 session 的角色

- **建議設定**：主 session 用 Opus 5.5、思考程度「高」。子 session 只能用同級或較便宜的模型、不高於主 session 的思考程度；主 session 設得較低時，需要「高」的段落改在主 session 自己執行，或先提醒使用者調高。
- **只做協調**：讀進度與分派表、開子 session、核對子 session 的提交與測試、更新進度入口、向使用者回報。實作段落一律交給子 session，避免主 session 的對話過長；主 session 只在子 session 失敗且修正很小時（例如紀錄行衝突）自己動手。
- **授權範圍**：使用者對主 session 說「繼續實作下一版功能」，就是授權主 session 依分派表連續開跑目前階段（例如 A 階段）中已解鎖的段落，不必每段再問。不延伸到：啟動原版遊戲或原生驗證、遊戲桌面 UI、開啟驗證旗標、首次證明合併、發布、下一階段（例如 B），以及 Wiki／Project／公告／Issue 同步；這些在停點問使用者，得到明確同意才開。

## 何時開子 session

- 「下一步做什麼」：回報進度並附分派計畫（下方格式），不開子 session。
- 「繼續實作下一版功能」：先核對工作樹、最近提交與分派表，然後把所有已解鎖段落各開一個子 session（`start_session`，initiation `user_asked`，context `fresh`，指定 `model`／`effort`）；可並行的段落同時開。開完回報一行開了哪些段，等子 session 回報。
- 使用者指名某一段（例如「做 A4」）：只開該段；使用者要求在主 session 直接做時照做。
- 新功能不建 SDD；需要分派時，主 session 先依本頁規則把簡短分派表寫進[目前進度](../research/next-version-plan.md)，再開子 session。舊 SDD 任務檔裡的分派表只是歷史紀錄。
- 執行環境沒有開 session 的工具時，退回舊做法：交出分派計畫與完整 prompt，由使用者另開 session。

## 選模型

暫定 Claude 5.5 系列；遇到新模型時只更新本節。

| 模型 | 適用 | 不交給它 |
| --- | --- | --- |
| **Opus 5.5** | 改 `src/core.js` 的資格、交易、回滾；碰到或需要避開共用樞紐的設計；證明閘門、首次證明合併；原生結果判讀與規格修正；跨模組設計與新研究 | 純機械性的勾選與文件同步（浪費） |
| **Sonnet 5.5** | 有既有範本可照做的程式：規則資料模組、獨立 oracle、manifest／分片、proof 接線、測試、沿用既有樣式的介面；照手冊跑原生分片與選跑並處理一般失敗 | 新的 core 交易設計、證明合併、原生反證判讀 |
| **Haiku 5.5** | 純文件同步、勾選與執行紀錄、連結修正；照固定指令跑檢查並整理結果；平行分支的整合推送（無衝突或只有紀錄行衝突） | 任何 `src/` 或 `scripts/` 的邏輯修改 |

範本判準：同類工作在已歸檔 SDD（例如 `sdd/archive/2026-10-23-treasure-level/`）有完成的對應任務，就算「有範本」。

## 思考程度

預設「中」，prompt 一律寫明。只有下列情況建議調整，並在 prompt 標頭註明原因：

- **高**：core 交易／回滾與精確 token、證明合併與閘門、原生結果與規格衝突的判讀、新研究結論。
- **低**：Haiku 的文件同步與勾選、只跑固定指令並回報。

## 依賴與並行

- **必須依序**：後一段讀前一段的產出（資料 → 資格 → 預覽 → 交易）；同一份程式檔（`src/core.js`、`knowledge/catalog.json`、`knowledge/verification.json`、`index.html`／`sw.js`）只能一段一段改。
- **原生遊戲一次一段**：並行副本尚未實作，同時只能有一個 session 啟動隔離遊戲。
- **可並行**：只新增或修改互不重疊的檔案（例如獨立 oracle、manifest 腳本與其測試），且不需要對方的產出。
- **子 session 的位置**：同一時間只有一個子 session 寫主 checkout（`use_worktree: false`），通常是改 `src/core.js` 或建置檔的那一段；其餘並行段落各開自己的 worktree（`use_worktree: true`），結束時 rebase 到 main 後直接推送 main。SDD 只改自己的任務行與執行紀錄；推送前 `git pull --rebase`，紀錄行衝突時兩邊都保留。
- **進度入口由主 session 更新**：子 session 不改 `docs/research/next-version-plan.md`；主 session 在核對完一批結果後統一改「下一步」並提交推送。
- **建置**：只有改到 `src/` 或 catalog 的段落才重建 `index.html`／`sw.js`；並行段落不改這兩個檔。

## 分派計畫格式

先一張表，再逐段給子 session 的 prompt（也就是 `start_session` 的 `prompt`）。

| 段 | 任務 | 模型 | 思考 | 前置 | 可同時跑 |
| --- | --- | --- | --- | --- | --- |
| 1 | A4 | Opus 5.5 | 中 | A3 已推送 | 2、3 |

每段 prompt 開頭四行固定：

```text
模型：Opus 5.5｜思考程度：中（預設）
位置：主 checkout（或：新 worktree 分支，結束 rebase 後推送 main）
前置：A3 已勾選並推送到 main；未滿足就停下回報
可同時跑：段 2、3（不同檔案）
```

接著寫：要做的任務與相關研究連結、只讀哪些文件、界線（不改哪些檔、旗標與證明）、驗證（測試、`node scripts/core-slice-report.cjs` 的預期結果）、收尾（照 `docs/maintenance/release.md` 最短流程；不改進度入口）、回報格式（下一節）。`background` 寫目前主線、已完成段落與其提交、這段在整體中的位置。

## 子 session 收尾回報

子 session 結束時回報給主 session（不需附下一步 prompt，由主 session 排）：

1. 做了什麼、提交 SHA、推送與否、測試及切片報告結果。
2. 未完成或未驗證的部分、遇到的衝突與處理。
3. 原生結果推翻規格、切片報告顯示意外重證、或需要使用者決定的事項；沒有就寫「無」。

## 主 session 核對與續派

收到子 session 回報後，主 session：

1. 核對回報不是自稱完成：`git fetch` 後看該提交確實在 main、任務已勾選、檔案範圍符合界線；有疑慮就讀差異或重跑該段測試。
2. 失敗或越界時：小問題自己修；需要重做的段落再開一個子 session（附失敗原因），不往下排。原生結果推翻規格或意外重證時，改開給 Opus 的修正段。
3. 一批都核對完，更新進度入口的「下一步」並提交推送，再開下一批已解鎖段落。
4. 遇到停點才回到使用者，回報：完成了哪些段與提交、現在在等什麼、需要使用者決定或授權的事（例如原生驗證、B 階段、發布）。回報前跑 `node scripts/reproof-cost.cjs`；印出「提示：」就把降低重證成本的候選一併提給使用者（[開發中的原生驗證](migration.md#開發中的原生驗證)第 6 點）。跑過既有群組原生重證的子 session 要在回報附上副本數與分鐘數，並確認已記入紀錄檔。停點包括：上述授權範圍外的事、子 session 等待使用者回答、連續失敗、整個階段完成。

最後一段完成時，主 session 產出下一階段的分派計畫，或功能收尾與候選選擇，並問使用者是否開跑。
