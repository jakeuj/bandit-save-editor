# SEO、來源同步與 GitHub Pages

推送、部署、修改正式網址或搜尋／分享資訊時使用，先讀 repo 的 `docs/maintenance/release.md` 與 `.github/workflows/pages.yml`。本機發布來源為 repo checkout，舊 `outputs/` 的離線快照不代替目前建置產物。

## 正式網址與遷移

- Repo：`jakeuj/bandit-save-editor`
- 正式入口：`https://bandit.jakeuj.com/`
- Mac 指南：`https://bandit.jakeuj.com/mac.html`

目前使用獨立網域根目錄。此專案曾使用 `https://blog.jakeuj.com/bandit-save-editor/`；遷移時 Pages 已改新網域，HTML 與 sitemap 卻仍指向舊站。每次發布先查實際設定與 repo 的網站連結，不由 repo 名稱推算 github.io，也不只靠舊文件判斷網域：

```sh
gh api repos/jakeuj/bandit-save-editor/pages --jq '{cname: .cname, html_url: .html_url, build_type: .build_type, https_enforced: .https_enforced}'
gh repo view jakeuj/bandit-save-editor --json homepageUrl
```

網址變更時同步以下位置：

- `index.html`、`mac.html` 的自我 canonical、`og:url`、`og:image` 與 `twitter:image`。搜尋與分享 metadata 放在初始 HTML 的有效 `<head>`，不依賴 JavaScript 補入。
- `sitemap.xml` 的正式頁面 URL、根目錄 `robots.txt` 的絕對 `Sitemap:` URL；目前允許爬取，robots 的用途是提供 sitemap 探索入口。
- README 的公開入口，以及 GitHub repo 的 `homepageUrl`。研究筆記中的歷史驗證 URL 保留原本證據語境。
- 分享圖片可編輯來源 `assets/social-card.svg` 內的顯示網域。站內資產維持相對路徑，分享圖使用絕對 HTTPS URL。

在對話已授權更新專案網站連結時執行，並讀回確認：

```sh
gh repo edit jakeuj/bandit-save-editor --homepage https://bandit.jakeuj.com/
gh repo view jakeuj/bandit-save-editor --json homepageUrl
```

## 分享圖與本機驗證

目前公開分享圖為 `assets/share-card-v3.png`，對應 `assets/social-card.svg`。圖片內容改變時使用新檔名，並同步兩個頁面的 OG／Twitter metadata，避免沿用舊圖 URL；既有貼文的快取是否更新另行驗證。

檢查 PNG 實際編碼、1200 × 630 尺寸、縮小後的中文字與邊界，再核對 metadata 的 MIME、寬高及 alt。標題與描述應符合各頁內容；一般網站發布可套用環境中可用的 `google-seo` 技能，單純重推已驗證版本以部署確認為主。

以桌面與手機實際 viewport 驗證兩頁的導覽、橫向溢出及 JavaScript 錯誤。首頁主要內容已有可爬取的 Mac 指南連結，手機不必依賴被隱藏的側欄底部。比較初始與渲染後的 canonical，確認 metadata 穩定且沒有意外 `noindex`；存檔內容留在本機處理，不為 SEO 改變 CSP 或加入上傳。

## 產物與來源同步

需要同步產物時，從 repo 根目錄執行建置與同步檢查（以下不是合成測試）：

```sh
node scripts/build-editor.cjs
node scripts/build-editor.cjs --check
```

建置將 `src/` 與 catalog 內嵌進 `index.html`，也會核對每個開啟旗標的驗證紀錄、遊戲版本與資料指紋（見 repo `docs/maintenance/lightweight.md`「建置閘門」）。提交程式來源／知識時一併提交同步後的 HTML；單純改 SEO 時保留內嵌程式。網站使用者仍只需要單一 HTML，沒有外部程式或知識相依。

遊戲知識版本標記、修改器版號與建置同步依 repo `docs/maintenance/release.md`「知識版本標示同步」。修改標記時一併核對來源與測試，不在技能維護另一份標記數量或版本常數。

提交前一律依[待提交快照檢查](../../../../docs/maintenance/release.md#待提交快照檢查)驗證暫存區 Git bytes，包含 Windows 換行轉換及失敗修復流程；開發工作目錄的建置成功不代表發布產物雜湊相符。

本機 HTTP 曾被 AdGuard 插入 CSP／腳本，造成回應與 Worker 預期 SHA-256 不同。先比對實際回應與 Git blob，定位代理／擴充套件改寫；保留 Worker 拒絕錯版快取的行為，不以放寬 CSP 或略過雜湊核對排除症狀。若需測試網址例外，先取得使用者授權，記錄範圍及測後還原或保留的決定；例外不屬於網站必要設定。瀏覽器離線模擬完成後還原網路。

現有 workflow 推送 `main` 時只檢查來源同步，不安裝測試相依或瀏覽器；完整驗收可手動執行 workflow 並勾選 `full_verify`（預設關閉）。之後按白名單打包 `index.html`、`mac.html`、`manifest.webmanifest`、`sw.js`、`sitemap.xml`、`robots.txt`、`.nojekyll`、`assets/` 與 `launcher/prepare-macos.py`。新增公開檔案需一併更新打包規則，避免漏掉 PWA 資產、robots 或下載工具；私人 state、遊戲檔與原始 log 留在 repo 外。

## 部署完成條件

任何推送（含影響網站產物的功能發布）成功即結束，只回報提交連結（功能發布另附下一步提示，見發布指引「功能收尾」第 5 步）；即使自動觸發 Pages，也不查詢 run、不等待部署。只有使用者明確要求，或排查使用者回報的線上異常時，才執行下方第 1 項，追蹤本次 SHA 的部署結果。明確要求確認線上版本時才 GET 首頁；第 2–6 項的多頁資產、SEO、headless 與 PWA 檢查僅於使用者要求完整驗收，或相關故障需要時執行。成功簡短回報，失敗再查詳細日誌。

延續對話中已有的提交／推送授權，不重複確認。技能更新本身不授權發布、修改 DNS 或提交 Search Console。

1. 推送後取得本次 SHA，從 `pages.yml` 的 runs 找到相同 `headSha`；只追蹤該次 run。可用下列 PowerShell 命令篩選：

   ```powershell
   $releaseSha = git rev-parse HEAD
   gh run list --repo jakeuj/bandit-save-editor --workflow pages.yml --commit $releaseSha --limit 5 --json databaseId,headSha,status,conclusion,url
   ```

   取得 run ID 後，用 `gh run view RUN_ID --repo jakeuj/bandit-save-editor --json headSha,status,conclusion,url` 確認；需要等待時可用 `gh run watch RUN_ID --repo jakeuj/bandit-save-editor --exit-status --interval 10`。`RUN_ID` 替換為此次數字 ID。build 與 deploy 都成功即完成部署追蹤；只有符合前述條件才再進行正式站驗證。
2. 實際 GET 正式首頁、`mac.html`、`sitemap.xml`、`robots.txt`、metadata 指向的分享圖及本次修改的公開資產。確認 HTTPS、HTTP 200、內容與 MIME；需要時檢查舊入口／HTTP 的轉址終點，不能只測可連線。
3. 核對正式兩頁的 canonical 與 `og:url`，sitemap 只列正式 URL，robots 指向正式 sitemap，分享圖可讀且尺寸正確，HTTP `X-Robots-Tag` 與 HTML 都沒有意外 `noindex`。首頁與 `index.html` 離線下載入口、Mac 準備工具也需能取得預期內容。
4. 靜態內容以該次提交的 Git blob 比對，可比較回應 bytes 或 SHA-256。用 `git show SHA:PATH` 取得預期 bytes；Python 使用 `subprocess.check_output`，避免 shell 文字轉碼。Windows 工作目錄可能有 CRLF，直接拿工作目錄檔案雜湊比對會誤判，這次 `launcher/prepare-macos.py` 就有此情況。
5. 優先用獨立headless context開啟正式欄位圖鑑，同時核對標籤與索引摘要的版本；V1.0.10.2 曾出現摘要已更新、寫死的標籤仍為舊版。例行PWA等待／交接優先跑repo `docs/testing.md`的暫存建置案例；只有使用者特定環境需要補證時才操作其瀏覽器。若該環境PWA提示新版已備妥，先讓使用者匯出未保存的修改，再關閉所有同站帳房分頁與 App 視窗後重開；測試自己建立的空白分頁可直接關閉。重新整理仍可能使用舊 Worker。保留版本畫面截圖於 repo 外，記錄更新前後結果。
6. 讀回 GitHub repo 的網站連結，確認與 Pages 正式入口一致；回報提交、對應 run、正式 URL 與實際完成的驗證範圍。HTTP 下載成功不代表直接開檔 UI 已驗收，部署成功也不代表 Google 已收錄或社群舊貼文已刷新。

`queued` 是待決，不是程式失敗。狀態與日誌不一致時交叉確認 job、deployment 與實際 HTTP；只針對明確錯誤修正或重試。若 CDN 尚未更新，間隔重查受影響檔案，不能用舊內容宣稱本次完成；沒有可處理原因就回報待決與 run 連結，保留現有部署設定。

這個專案的正常發布不需要修改帳號根網站或既有網域 DNS。追蹤提醒、Search Console 操作與其他外部變更依使用者實際要求執行。

## 歷史證據

各次 SHA、run 與驗收限制完整保留在 [Pages 歷史驗證紀錄](pages-history.md)。
