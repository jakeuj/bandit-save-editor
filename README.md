# 山寨帳房

《塔防山賊模擬器》的繁體中文存檔修改器。使用瀏覽器讀取 `.dat`，修改後匯出副本；存檔全程在本機處理。

**[開啟修改器](https://bandit.jakeuj.com/)**

## 功能

- 修改銅錢、共用經驗、魂魄、科技點與操練點。
- 編輯山寨／角色名稱，依遊戲公式增加角色、已習得職業及九項技藝經驗，逐級結算並保留上限與關聯。
- 檢視角色成長、科技與操練狀態、背包／裝備庫及 22 層欄位圖鑑；尚未核實或關聯複雜的欄位維持唯讀。
- 內嵌 1,762 筆必要名稱、724 個事件函式與 843 處存檔寫入索引，支援來源 SID 查詢。
- 搜尋、篩選與批次修改遊戲材料資料表中的 220 筆材料。
- 比對兩份原始存檔，顯示不同欄位、座標與差額，並匯出 CSV。
- 使用自訂座標加入常用欄位，支援欄位設定匯入與匯出。
- 檢視變更、還原、復原一步，或還原全部修改。同一角色、同一類經驗的累計變更一起還原，保留等級／餘額關聯；「復原一步」則回到前一次操作。
- 下載原檔備份與修改副本；只替換指定值的 token，保留其他原始 JSON 文字。

## 使用方式

1. 開啟網站，選取遊戲的進度 `.dat`，例如 `ea3save.dat`；請依要修改的本機存檔、自動備份或雲存檔快取選擇位置。
2. 修改資源、材料或名稱；「角色養成」可選角色及經驗類型，輸入增加量後逐級結算。從「檢視變更」確認所有連動欄位。
3. 先下載原檔備份，再匯出修改存檔，例如 `ea3save.modified.dat`。
4. 結束遊戲，把原始存檔另行備份，將修改副本改回原檔名並放回取出時的相同位置。
5. 重新開啟遊戲，載入對應存檔確認。

也可從網站下載單一 HTML，之後使用 Edge 或 Chrome 離線開啟。離線檔的圖示可以省略，修改功能不依賴外部檔案。

## 已核對的資料欄位

座標從 0 起算。

| 項目 | JSON 位置 |
| --- | --- |
| 銅錢 | `data[1][2][0]` |
| 共用經驗 | `data[2][2][0]` |
| 魂魄 | `data[3][2][0]` |
| 科技點 | `data[4][2][0]` |
| 操練點 | `data[5][2][0]` |
| 材料數量 | `data[材料編號][6][0]` |
| 山寨／角色名稱 | `data[1][1][0]`／`data[角色編號][1][2]` |
| 角色等級／自然經驗餘額 | `data[角色編號][3][2]`／`data[角色編號][4][2]` |
| 職業等級／經驗餘額 | `data[角色編號][職業編號][4]`／`data[角色編號][職業編號][5]` |
| 技藝上限／等級／經驗餘額 | `data[角色編號][21+k][2]`／`data[角色編號][30+k][2]`／`data[角色編號][39+k][2]`，`k` 為 1–9 |

材料名稱取自遊戲資料表；部分資料為重複名稱或占位名稱，不代表遊戲內都已開放。共用經驗與角色、職業、技藝經驗各自儲存。

上表是辨識座標；等級與經驗餘額須透過「角色養成」一起結算，不能單獨修改。技藝上限目前唯讀。

v2 依據 2026-10-20、遊戲 V1.0.9.1 的事件與 JavaScript 製作。程式證據、成長公式及遊戲驗證記錄見 [存檔知識調查](docs/research/save-knowledge.md)。遊戲更新後需要重新核對；存檔本身沒有可靠的完整 build 指紋，介面會顯示知識對應版本，不能只靠陣列尺寸保證新版相容。

角色／技藝經驗增加量為正整數，職業可有一位小數；職業必須已習得，且角色未設定自動轉職。增加經驗不扣共用池，也不增加遣散／重生退款基數。科技解鎖、建築配置、裝備關聯、任務及衍生屬性目前提供唯讀資訊。

## 本機開發與驗證

網站沒有套件相依或後端，直接開啟 `index.html` 即可使用。維護來源時使用 Node.js 18 或更新版本：

```sh
node scripts/build-editor.cjs
node scripts/build-editor.cjs --check
node --test tests/*.test.cjs
```

`src/core.js`、`src/ui.js`、`src/knowledge-ui.js` 與 `knowledge/catalog.json` 會內嵌至 HTML。測試使用合成資料，包含實際的 2501 × 60 × 22 尺寸、字串轉義、小數、跨級、上限、原文保留與整組復原。

若要重新分析自己安裝的遊戲：

```sh
node scripts/extract-game.cjs --source /path/to/unpacked/game --audit /tmp/bandit-audit.json
node scripts/build-editor.cjs
```

事件／runtime 指紋未知時停止；其他資料表指紋改變時，重建不保留原本的新增可寫旗標。先核對新版事件與公式，再更新規則及完整驗證紀錄。原始分析、遊戲與個人存檔始終留在 repo 外。隔離遊戲驗證工具 `scripts/verify-game.cjs` 使用 Node.js 22 以上，保留真實授權初始化，將 Cloud、成就與統計寫入導向測試目錄。

## 文件入口

| 需求 | 文件 |
| --- | --- |
| 核心 API、來源維護、知識更新、驗證與發布 | [維護指引](docs/maintenance.md) |
| 欄位座標、成長公式、事件來源及實測範圍 | [存檔知識調查](docs/research/save-knowledge.md) |
| Mac 準備、三類存檔位置與啟動方式 | [啟動器說明](launcher/README.md) |
| CrossOver 問題、原生 runtime 與 Steam 調查 | [Mac 執行研究](docs/research/macos-runtime-investigation.md) |
| 尚待驗收項目 | [SDD 任務](sdd/save-knowledge/tasks.md) |

離線相依性檢查及線上 HTML 下載已通過；直接開啟本機 HTML 的完整 UI 流程仍待 Chrome／Edge 人工確認，步驟見維護指引。真實 Cloud 上傳、成就、DLC 獎勵及長時間遊玩亦維持待驗證。

## GitHub Pages

GitHub Pages 使用 `.github/workflows/pages.yml` 發布。推送 `main` 後，流程會先驗證核心讀寫功能，再將 `index.html`、`mac.html`、`sitemap.xml`、`robots.txt`、`.nojekyll`、`assets/` 與 `launcher/prepare-macos.py` 打包部署；也可從 Actions 手動執行。網站不需要 Jekyll 或其他建置工具。

網站入口為 `index.html`。搜尋與分享資訊設定在 HTML `<head>`，可編輯的分享圖片來源為 `assets/social-card.svg`，對外提供 `assets/share-card-v3.png`。

本 repository 不含玩家存檔、比對報告或完整遊戲程式。

## macOS 原生執行研究

已以 NW.js 0.82.0 ARM64 原生開啟遊戲，並確認 Steam 雲存檔清單與 DLC 辨識；本輪另以隔離副本確認新增修改的載入、本機存檔及重啟讀回。長時間遊玩、真實雲端上傳與成就仍待驗證。副本準備與三類存檔位置見 [launcher/README.md](launcher/README.md)，CrossOver GPU 錯誤、實測範圍及 Nevergrind 比較見 [調查筆記](docs/research/macos-runtime-investigation.md)。

網站提供 [Mac 原生執行指南](https://bandit.jakeuj.com/mac.html) 與準備工具下載。
