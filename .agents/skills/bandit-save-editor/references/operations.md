# 來源快取、驗證與交付入口

此頁只負責導覽，規則以以下 repo 主文件為準；路徑從 checkout 根目錄起算。

## 版本更新入口

| 情境 | 讀取位置 |
| --- | --- |
| 開發或原生測試：定位完整來源、獨立 runtime、manifest 與快取冒煙證據 | `docs/maintenance/migration.md`「本機開發快取」 |
| 遊戲改版：本機索引、公告、build／套件指紋、精簡分析與選跑 | `docs/maintenance/migration.md`「日常更新入口」；公告來源與 API 備援見 `docs/maintenance/core.md`「重建知識與開放寫入」 |
| 未知來源的純分析、SID 與 expression 追查 | [存檔參考](save-format.md#重建知識) |
| 版本沿用、原生實測、續跑及寫回條件 | `docs/maintenance/migration.md`「相依與證據」「擴大與續跑」 |

精簡來源只供分析；完整快取缺失／損壞或來源改變時，依主流程補建，不因例行查版本重新解包。V1.0.11.2 完整實測見 `docs/research/v1.0.11.2-audit.md`，後續選跑政策與重播見 `docs/research/selective-migration.md`；Windows 證據不代表 Mac 已實測。

## 驗證與交付

- 開發測試、完整驗收觸發條件、分頁／搜尋、精確下載與分層證據：`docs/testing.md`；新增功能另讀該功能已核准 SDD 的首次證明要求。
- 隔離遊戲靜音、手動重啟參數、遊戲桌面操作條件：`docs/game-ui-testing.md`「適用範圍與證據」「測試音量」。音訊測試須使用者明確要求，不調整玩家遊戲、Discord 或系統音量。
- 日常提交、推送、功能收尾：`docs/maintenance/release.md`「提交與發布」與「功能收尾」；推送成功即結束。部署追蹤與正式站驗收只在使用者要求時做，操作細節見 [Pages 參考](pages.md#部署完成條件)。只在對話授權範圍推送或發布。
- 直接 file 與 PWA 的證據界線：`docs/maintenance/pwa.md` 與 `docs/testing.md`。單檔相依性／HTTP 下載不代替直接開檔 UI；headless Chromium 不代替原生視窗或其他瀏覽器證據。

文件變更檢查連結、指令與實作一致性。交付分開記錄核心、瀏覽器／離線、部署、隔離遊戲 IO 及真實 Steam 功能；歷史結果只作引用，不自動繼承為本次通過，也不把歷史案例數或玩家數值當永久預期。
