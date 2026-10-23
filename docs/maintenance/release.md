# 版本標示、提交與發布

[維護索引](../maintenance.md)；只讀本次任務相關章節。版本與日期標示的實測紀錄只證明當時範圍，現行開放狀態以 catalog／verification 與相應 SDD 為準。

## 知識版本標示同步

遊戲知識版本以 `knowledge/catalog.json` 的 `gameVersion` 為唯一來源。`index.html` 的側欄遊戲版本、職業圖鑑標籤、職業資料來源說明、欄位圖鑑標籤、使用說明與更新紀錄開頭，共六處使用 `<span data-knowledge-version>…</span>`。`scripts/build-editor.cjs` 在建置時將版本做 HTML 跳脫後填入這些標記，再產生內嵌程式與 PWA 資產指紋；初始 HTML 與離線下載因此保有相同版本文字。新增遊戲知識版本標示時沿用此標記，避免另寫版本常數。

欄位圖鑑摘要由 `src/knowledge-ui.js` 讀取同一份內嵌知識的 `K.gameVersion`。摘要正確不代表其他標籤已同步：本次 V1.0.10.2 首次發布時曾出現摘要為新版、標籤仍為舊版，後由提交 `7adcb01` 修正。`tests/knowledge.test.cjs` 目前核對六個標記均等於內嵌的 `gameVersion`；新增或移除標示時，連同預期數量一起調整。`--check` 會重算產物，拒絕版本文字或 PWA 內容未同步的提交。

更新順序為核對來源與實測紀錄、重建 catalog、執行建置及測試，再提交 catalog、驗證紀錄與產生的 HTML／`sw.js`。版本標示只是呈現知識基準，開放寫入仍受完整來源指紋及 `verification.json` 限制。側欄以醒目的「遊戲版本」顯示這個標記，讓玩家確認存檔對應的遊戲版本；其下的「修改器 vX.Y」是工具發布版本，用於對照更新說明、回報問題與確認 PWA 已更新，和 Mac runtime 相容版本一樣不隨此標記改寫。手機版隱藏側欄底部，遊戲版本仍可在職業與欄位圖鑑標籤看到。

## 提交與發布

發布新版修改器時，同步更新側欄的「修改器 vX.Y · 日期」與 `index.html` 的「更新紀錄」對話框：在最上方加一筆，寫發布日期、對應遊戲版本，以及玩家看得懂的新增功能與限制。側欄版本文字與「更新紀錄」按鈕都會開啟這個對話框；`tests/changelog.test.cjs` 會核對第一筆與側欄版本、日期一致。手機版隱藏側欄底部，v2.6在主內容上方提供使用說明／更新紀錄入口，未載入存檔也能開啟；頁尾保留復原一步。

日常推送只做下方「待提交快照檢查」、提交及推送，不重跑全套 Node／瀏覽器／遊戲測試。完整驗收 `npm run verify:release` 僅在使用者要求或具體故障需要時執行；新增功能已核准的首次證明與驗收要求不受日常快速流程免除。手動 Pages workflow 的 `full_verify` 預設關閉。若工作樹混有其他任務，僅提交本次授權範圍，並對待提交快照檢查同步，保留其餘工作。

推送 `main` 會自動觸發 Pages workflow，只檢查來源同步並以白名單打包發布；完整驗收按需另行執行。**任何推送（含功能發布）成功即結束**，只回報提交連結，不查詢或等待自動觸發的部署；修改器目前供使用者自用，線上問題由使用者回報後再處理。只有使用者明確要求，或排查使用者回報的線上異常時，才追蹤對應 SHA 的部署結果並回報部署連結；明確要求確認線上版本時，才額外 GET 首頁。多頁資產、桌面／手機流程、主控台錯誤、canonical、分享資訊與 sitemap 依變更及驗收要求選跑。

需要追蹤部署時，以本次提交的 SHA 找到相同 `headSha` 的 run，確認 build／deploy 都成功。以下 HTTP、DOM 及 PWA 正式驗收僅在使用者要求或相關故障需要時執行：HTTP 內容以 `git show SHA:PATH` 的原始 bytes 比對，避免 Windows checkout 行尾轉換造成誤判。需要正式DOM證據時，以獨立headless context開啟正式欄位圖鑑，同時確認版本標籤與索引摘要；例行PWA交接由暫存建置測試，使用者特定快取問題才採以下人工流程。若 PWA 顯示「新版已備妥」，先匯出尚未保存的修改，再關閉所有同站帳房分頁與 App 視窗後重開；重新整理可能仍由舊 Worker 提供內容。保留可看見版本的截圖於 repo 外，HTTP 成功與瀏覽器結果分別記錄。

### 功能收尾（預設最短流程）

新功能（如 SDD 最後一項）首次證明合併後，只做：

1. 合併首次證明、開旗標、重建 HTML／`sw.js`。
2. 一次 `npm test`，再一次 `npm run test:browser`（官方入口已含建置同步檢查）。瀏覽器只用官方入口跑一次；不要先直接呼叫 Playwright 再用官方入口重跑。只有失敗後修正時，重跑受影響的檔案或規格。
3. 更新 `index.html` 更新紀錄、進度入口與 SDD 勾選，不另寫長篇交付或驗收報告。
4. 待提交快照檢查 → 提交 → 推送，推送成功即結束。

預設不追蹤 Pages 部署，不同步 Wiki、Project、Discussions 公告或 Issues；使用者要求時再另外處理。原生遊戲驗證只在首次證明（SDD 的原生任務）或 core／來源變更觸發的重證時執行，收尾不重跑原生。

## 待提交快照檢查

提交前先將本次授權檔案加入暫存區，再依下方流程驗證暫存區的 Git bytes。工作目錄的 `--check` 可用於開發，但不能代替此發布檢查。

PowerShell 在 repo 根目錄執行（先完成範圍核對及 `git add`）：

```powershell
@'
import io, subprocess, tempfile, zipfile
snapshot = subprocess.check_output(['git', 'write-tree'], text=True).strip()
with tempfile.TemporaryDirectory(prefix='bandit-index-check-') as folder:
    archive = subprocess.check_output(['git', 'archive', '--format=zip', snapshot])
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        bundle.extractall(folder)
    subprocess.run(['node', 'scripts/build-editor.cjs', '--check'], cwd=folder, check=True)
assert snapshot == subprocess.check_output(['git', 'write-tree'], text=True).strip(), 'Index changed; check again'
print('Verified tree: ' + snapshot)
'@ | python
```

成功且暫存區 tree 未改變才提交；提交後確認 `git rev-parse 'HEAD^{tree}'` 等於已驗證 tree，再推送。若重新 stage，須重做快照檢查。

未交付快照（兩段式首次證明）：首次證明的原生部分已合併、但編輯器 UI 驗收要等下一段時，只能在不推送的快照分支用 `node scripts/build-editor.cjs --pending-ui-snapshot` 建置。這個模式只接受 UI 標為待補（`{"pending":"B9"}`）的紀錄，其他檢查不放寬；在 `main` 上會拒絕執行。產出的 `index.html` 帶 `<meta name="bandit-delivery">`、`sw.js` 首行帶同一標記。一般建置和 `--check`（上方快照檢查與 Pages）都拒絕這類紀錄與標記，所以不能提交或推送。快照內的檢查改用 `--check --pending-ui-snapshot`，瀏覽器測試用 `npm run test:browser -- --pending-ui-snapshot`。補上 UI 證據（`finalizeUi`）後，以一般建置重建，再走正常流程。

換行差異的處理：

- 編輯文字時保留 `.gitattributes` 指定的 LF；Python 寫入可用 `newline='\n'`。屬性只約束 Git 轉換，不能防止編輯工具先將工作檔寫成 CRLF。
- builder 依實際 bytes 計算 PWA 指紋。工作目錄若含 CRLF，建置與本機 `--check` 可能都通過，但 `git add` 轉為 LF 後雜湊就失效。`git diff --check` 也不驗證產物雜湊。
- 快照檢查失敗時先停止提交／推送。在隔離快照執行 builder，檢視產物差異，只取回本次所需的 `index.html`／`sw.js`；保留工作目錄中其他未暫存修改，勿整份覆蓋。重新 stage 後再次檢查；不手填雜湊、不略過 CI 或 Service Worker 完整性檢查。
- 這是 agent 發布流程；目前 workflow 只在推送後執行 `--check`，尚無本機自動 hook。更新技能不能視為已新增自動攔截。

2026-10-23 品質下拉修正曾在 `36f2cb3` 因換行轉換導致 Pages 的 `sw.js` 同步檢查失敗；`d1d1c11` 依 Git blob 重建後部署成功。此案例說明檢查應在提交前固定快照，而非等 CI 失敗才查行尾。

## Wiki 維護

本專案 Wiki 已於 2026-10-23 初始化。內容維護使用獨立 Git 儲存庫 `https://github.com/jakeuj/bandit-save-editor.wiki.git`；`gh` 可按需查詢權限與設定，頁面內容透過 Git 維護。

1. 在主 repo 外沿用 Wiki checkout，先核對 remote 與工作樹，再以 `git pull --ff-only` 同步；沒有 checkout 時用 `git clone` 複製上述網址。保留既有未提交修改，遇到分歧先釐清再整合，不強制推送。
2. 依已發布的 repo 文件更新 `Home.md`、`操作教學.md`、`常見問題.md` 與 `_Sidebar.md`；保留功能限制及來源連結，不把未提交的開發功能或研究計畫寫成已開放能力。
3. 檢查 Markdown、Wiki 內部連結目標與 `git diff --check`，只提交本次授權內容，推送到 Wiki 的預設分支。Wiki 純文字變更不執行主網站建置或遊戲測試。
4. Git 推送成功即完成，回報 Wiki 頁面與提交／歷史連結；不查詢或等待 GitHub Pages 部署。除非使用者明確要求瀏覽器操作，否則不開 Edge 或其他瀏覽器，也不為例行維護追加畫面、截圖或重新初始化第一頁。

Wiki 與主 repo 分開提交；若同時修改主 repo 的技能、指引或文件，主 repo 仍依「提交與發布」檢查待提交快照的建置同步。

## 歷史發布與驗收限制

2026-10-21 的 V1.0.10.2 正式發布已驗證至提交 `7adcb01f9f0ddef749c1474850877df79ad78dd9`；對應部署、資產比對、畫面結果及驗收範圍集中於 [V1.0.10.2 正式發布紀錄](../research/v1.0.10.2-audit.md#正式發布驗證)。後續版本以自己的提交重做核對。


v2.1 的桌面／390px、精確匯出及隔離遊戲結果見 [進階修改實測](../research/advanced-editing.md#2026-10-21-windows-隔離實測)。本輪 `file://` 被工具政策阻擋，直接開檔驗收保持待辦；不可引用舊版資源測試當作三項新功能已實測。

2026-10-21 v2.1 已於提交 `d98db49` 發布，正式 v2.1／V1.0.10.2、資產 Git blob 比對、PWA waiting→關閉重開與斷網編輯／精確匯出皆通過，詳細見 [正式發布紀錄](../research/advanced-editing.md#v21-正式發布驗證)。JavaScript 與 Manifest 以 `.gitattributes` 固定 LF；提交前可用 Git blob 隔離副本檢查，避免 Windows 行尾改變已釘選的 PWA 雜湊。
