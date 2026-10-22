# Pages 歷史驗證紀錄

以下是各次提交的實測基準，不表示目前版本已重新驗證；現行流程見 [Pages 參考](pages.md)。

## 已驗證基準

2026-10-21 v2.1 功能提交 `d98db495110beff15e1b5a5599f6b8804d11d674`，[Pages run 39607900455](https://github.com/jakeuj/bandit-save-editor/actions/runs/39607900455) 成功。正式 v2.1／V1.0.10.2、資產 Git blob 比對、PWA waiting→關閉重開與斷網編輯／精確匯出通過；詳細以 repo `docs/research/advanced-editing.md` 的「v2.1 正式發布驗證」為準。`file://` 的新功能流程仍待人工驗收，不能與 PWA 離線混為一談。


2026-10-21 的 V1.0.10.2 最終發布提交為 `7adcb01f9f0ddef749c1474850877df79ad78dd9`，[Pages run 39598503967](https://github.com/jakeuj/bandit-save-editor/actions/runs/39598503967) 成功；正式圖鑑標籤及摘要均確認新版，PWA 關閉後重開套用成功。詳細資產比對、截圖位置及範圍以 repo `docs/research/v1.0.10.2-audit.md` 的「正式發布驗證」為準，後續發布用自己的 SHA 驗證。

2026-10-21 的 SEO 修正提交為 `3c7f51be141d5b20f7f3fb42bbe317d6fe8d2fbe`，[Pages run 39454904155](https://github.com/jakeuj/bandit-save-editor/actions/runs/39454904155) 已成功。正式兩頁、sitemap、robots、v3 PNG、SVG 與 Mac 準備工具的回應內容均與該提交 Git blob 一致，repo 網站連結已改為新網域。此紀錄供回查，後續版本仍以自己的 SHA 重新驗證。




2026-10-21 v2.2 功能提交 `d7f0cedecae6ec1c6fb7f6f8b71015b0a48d6dae`，[Pages run 39615676545](https://github.com/jakeuj/bandit-save-editor/actions/runs/39615676545) 成功。正式 v2.2／V1.0.10.2、Git blob資產比對、舊Worker等待與關閉重開交接、斷網主介面匯出及新分頁讀回通過。詳細範圍與瀏覽器測試限制以repo `docs/research/advanced-editing-batch2.md`「v2.2 正式發布驗證」為準；直接file://新功能仍待人工驗收。

2026-10-21 v2.3 功能提交 `a912466c0607a89f62b5dd1298b8ca3eeee6f977`，[Pages run 39622670935](https://github.com/jakeuj/bandit-save-editor/actions/runs/39622670935) 成功。正式 v2.3／V1.0.10.2、12 個網址 Git blob 比對、舊版關閉重開交接，以及 PWA 斷網精準洗練／兩入口精確匯出／新頁讀回通過。詳細證據與工具逾時後恢復方法以 repo `docs/research/precise-affix-editing.md` 為準；本次未取得 waiting 提示文字，直接 file:// 仍待人工。不能把實際版本交接、提示觀察及離線開檔混寫為同一項。

2026-10-22 v2.4合併提交 `aec00a8bf800ef34583bd969d3c852c040ce4c43`，[Pages run 39642878678](https://github.com/jakeuj/bandit-save-editor/actions/runs/39642878678)成功。正式v2.4／V1.0.10.2、14個網址Git blob比對、實際waiting提示／關閉重開，以及PWA斷網首次選槽／預覽入口精確匯出／讀回通過。遊戲選槽UI、隔離新PID讀回與桌面／390px證據見repo `docs/research/equipment-workflow.md`；直接file://新流程仍待人工，不宣稱Windows獨立App安裝已驗收。
