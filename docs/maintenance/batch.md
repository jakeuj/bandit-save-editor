# 批次操作維護

[維護索引](../maintenance.md)；只讀本次任務相關章節。版本與日期標示的實測紀錄只證明當時範圍，現行開放狀態以 catalog／verification 為準（輕量群組見 `knowledge/verification.json` 的 `lightweight`）。

## v2.6 批次操作維護

`src/batch-ui.js`由`src/ui.js`的批次標記內嵌，新增來源時同步`build-editor.cjs`，勿直接改產物內嵌程式。`previewBatch(model, request, options)`／`applyBatch(model, request, options)`皆回傳Promise；request僅接受下列固定種類：

| kind | 參數 |
| --- | --- |
| characterExperience | characterIds（不重複ID陣列）、amount（正整數） |
| professionExperience | characterId、amount（正數，最多一位小數）；自動展開全部已習得職業 |
| skillExperience | characterId、amount（正整數）；固定展開九項技藝 |
| equipmentMax | plane（7或9）、includeEquipped（預設false）；只納入普通裝備 |
| technologyLevel | level（一般模式存檔值）；固定展開31–44 |

options可帶`signal`取消與`onProgress({done,total})`；套用可帶`preview`，核心會核對該預覽的模型及request快照，過期即拒絕。回傳`summary`含targets、changed、unchanged、excluded、blocked、changedCells，`rows`包含名稱、狀態、前後值／座標與原因，`canApply`表示有變更且全數合格。預覽不是可繞過驗證的寫入清單，套用仍重新呼叫具名API。

私有模型共用原始文字與陣列，只複製變更集合，約12ms讓出畫面；正式模型不跨await開啟同步交易。失敗／取消不動正式變更或歷史，成功只提交一筆；全批無變更不新增歷史。還原保留既有經驗／整件裝備累計群組，復原一步撤回整批。不可增加通用方法名稱、任意座標或略過失敗的路徑。

批次及全域預覽每頁最多50筆；單角色選單最多50個候選，超過以名稱／#ID搜尋，角色勾選跨頁保留。完整尺寸測試分別記錄Node VM耗時、事件迴圈回應、取消及精確匯出；瀏覽器另外核對DOM數量、桌面／390px操作與實際下載，不把同步核心速度當成手機效能承諾。

不新增驗證群組，當時22個既有群組繼續由三份驗證需求／清單／遷移情境共同覆蓋；批次測試另外確認各既有閘門不能繞過。未來若擴充寫入語意或值域，須重新判斷獨立群組，並依[輕量開發流程](lightweight.md)冒煙後開旗標。

隔離冒煙沿用`verify-game.cjs --setup`，加`--batch-requests /outside/repo/requests.json`（1–20筆固定request的JSON陣列），先套用既有scenario，再逐批預覽／套用，將各批次結果與所有聯動座標併入state觀察。其餘載入、原生存檔、assert、停止、新PID重啟、讀回及assert照舊；不寫回catalog或verification。Mac必須先開啟並登入原生Steam，使用相符15指紋及已核對路徑補丁、副本背景隱藏／非全螢幕／靜音。原始request、scenario、state及log留repo外。

### 首次驗證歷史

2026-10-22：V1.0.10.2隔離副本五種批次均通過，批次聯動55個欄位，併入既有scenario共觀察120個欄位；原生存檔與新PID讀回兩輪assert通過，15來源及原檔雜湊未變，測試程序已停止。完整尺寸與瀏覽器證據見[SDD驗收紀錄](../../sdd/batch-editing/tasks.md)。本輪沒有新增遊戲UI、直接file開檔或正式部署驗收。
