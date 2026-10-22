# 程式測試優先，降低瀏覽器操作與干擾

需求類型：重構。2026-10-22使用者已確認Node＋獨立無視窗瀏覽器方案並授權實作。

## 為什麼做

核心已有完整測試，但Node UI下載測試只確認檔名，檔案解碼、Blob、實際下載與版面仍仰賴逐步computer use。將可重複流程寫成測試，讓日常驗證以程式摘要為主，降低token、時間及對使用者電腦的干擾。

## 要改什麼

- 共用合成存檔與獨立token預期產生器，保留BOM、空白、指數及大型整數literal。
- Node執行真正UI事件，攔截Blob並比對檔名、MIME、bytes及匯出保護狀態。
- 鎖定Playwright開發依賴，使用獨立headless Chromium、隔離context、單worker及暫存檔，測試建置後HTML的桌面／390px與2501×60×22流程。
- HTTP、直接file、PWA離線／waiting更新分別驗證。PWA兩份暫存建置沿用正式完整性規則。
- 提供test:ui、test:browser、verify:release；失敗保留trace／截圖，平時只印摘要。CI通過全部檢查才部署。
- 遊戲與編輯器都先程式測試；原生視窗、安裝、使用者特定環境或程式無法回答的視覺問題，才說明缺口並補最小computer use。

## 影響範圍

測試helpers、Node UI測試、新增瀏覽器測試與執行工具、npm設定及Pages CI；README、維護指引、AGENTS及專案技能同步測試優先順序。產品維持單檔HTML與現有SaveCore API，不增測試後門或改寫遊戲驗證證明。真實存檔及原始遊戲資料仍留repo外，測試只使用合成檔。既有SDD保留原位；推送依當次使用者授權。
