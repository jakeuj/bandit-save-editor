# 山寨帳房維護與驗收

適用於存檔修改器及其遊戲知識。遊戲公式、事件 SID 與實測證據以[存檔知識調查](research/save-knowledge.md)為準；原生 Mac 準備與存檔位置見 [launcher 說明](../launcher/README.md)。

## 編輯入口

| 內容 | 來源與維護方式 |
| --- | --- |
| 讀寫、欄位定義、經驗與交易 | `src/core.js` |
| 選檔、資源、比對、自訂欄位、預覽與匯出 | `src/ui.js` |
| 角色、山寨、裝備、欄位圖鑑 | `src/knowledge-ui.js` |
| 名稱、來源位置、版本及指紋 | `knowledge/catalog.json`；由 `scripts/extract-game.cjs` 產生 |
| 名稱繁體轉換對照 | `knowledge/traditional-names.json`；保留遊戲原始 ID |
| 可寫群組的實測證明 | `knowledge/verification.json` |
| HTML 結構、樣式、使用說明與 SEO | `index.html`；其中 `save-core`、`save-ui` 區塊由建置工具同步 |

在 repo 根目錄執行：

```sh
node scripts/build-editor.cjs
node scripts/build-editor.cjs --check
node --test tests/*.test.cjs
```

第一個命令只更新內嵌程式，保留 HTML 結構與樣式。修改來源後一併提交產生的 `index.html`；只修改內嵌區塊會在下次建置時被覆蓋。使用者下載的單一 HTML 已內嵌執行程式與知識，不需 Node.js 或遊戲資料表。

## 核心 API 與相容性

核心公開為 `SaveCore`。座標皆為零起算的 `{x, y, z}`，不是畫面上的角色／職業名稱。

| 介面 | 用途與限制 |
| --- | --- |
| `parse(text, name)`／`serialize(model)` | 保留原始文字；匯出僅替換修改的值 token，未修改的大型整數、空白、BOM 與指數寫法保持原樣 |
| `resolveField(model, coord)` | 回傳 `FieldDescriptor`：型別、用途、關聯、來源、驗證狀態及直接編輯權限 |
| `setField(model, coord, value)` | 寫入已確認且開放的欄位，檢查原型別、字串限制及數值範圍 |
| `set(model, coord, value)` | 保留既有介面；已知欄位轉入相同限制，未辨識的數值座標維持手動整數功能 |
| `addExperience(model, options)` | `kind` 為 `character`、`profession` 或 `skill`；另帶 `characterId`、`amount`，職業／技藝另帶 `id` |
| `transaction(model, fn, label)` | 同步批次交易；失敗還原全部變更，成功形成一筆復原紀錄 |
| `restore(model, coord)`／`undo(model)` | 前者還原指定變更，經驗則還原同一項的累計關聯修改；後者回到前一筆交易 |

等級與經驗餘額由 `addExperience` 一起結算，不能透過 `setField` 或自訂座標單獨寫入。直接增加經驗不扣取得成本，也不改共用池投入／退款基數。欄位設定仍沿用 `version: 1`、`game: 'szmnqea'` 與 `fields` 格式；設定格式相容不代表可以繞過已知欄位限制。

玩家名稱與其他存檔字串進入 HTML 時使用文字節點或 HTML 跳脫；序列化則使用 JSON 字串跳脫，兩者用途不同。預覽、比對及唯讀檢視也要保留這項處理。

## 重建知識與開放寫入

```sh
node scripts/extract-game.cjs --source /path/to/unpacked/game --audit /tmp/bandit-audit.json
```

解析器只建立 expression factory 索引，不執行遊戲。事件／runtime 指紋不在已核對清單時停止；資料表指紋不同時，重建目錄不保留原本的新增可寫旗標。相同完整指紋重跑才保留既有旗標。繁體轉換在 macOS 使用 Foundation，其他平台重用提交的對照表。

新增可寫功能需完成以下流程：

1. 追查初始化、讀寫、計算與刪除，記錄欄位型別、值域、關聯及來源 SID；複雜或未釐清項目維持唯讀。
2. 用合成資料測試非法型別、跨級、上限、交易回滾、完整復原及精確 token 替換。
3. 以 `scripts/verify-game.cjs --help` 查看隔離驗證入口。此工具需要 macOS、Node.js 22+、已準備的 Mac 遊戲副本及 Mac Steam；來源須與 catalog 的全部 13 個指紋相符。若從 Windows payload 產生知識，先與 Mac 測試來源重新核對，不能直接沿用不同 runtime 的驗證紀錄。
4. 確認遊戲載入、遊戲寫檔、停止測試程序後重啟讀回及來源存檔雜湊；測試只在獨立 app／遊戲／profile 中執行，保留授權初始化，Steam 寫入導向本機鏡像與紀錄。
5. 將去識別結果與相符指紋寫入 `verification.json`，再開啟對應群組。建置會核對全部來源指紋、檢查結果及群組覆蓋，未通過就停止。

完整解析輸出、遊戲內容、玩家存檔、測試 state 與原始 log 均留在 repo 外。`--setup` 產生的測試狀態包含本機路徑及玩家資料，不能作為公開驗證紀錄提交。

## 離線 HTML 人工驗收

目前已通過內嵌相依性與禁止連線檢查；內建瀏覽器政策阻擋 `file://`，直接開檔的 UI 流程仍待一般 Chrome／Edge 確認。完成前保留 [SDD 任務 6](../sdd/save-knowledge/tasks.md) 的未完成狀態。

1. 從網站下載單一 HTML，使用一般 Chrome／Edge 開啟本機檔案，確認無網路時可進入欄位圖鑑。
2. 選取合成 `.dat`，測試資源、名稱及三類經驗編輯，核對跨級後的等級與餘額。
3. 預覽連動欄位，連續增加同一項經驗後整組還原，再驗證「復原一步」。
4. 匯出修改副本，重新載入並比對；確認原檔保留、修改值正確、自訂設定可匯入／匯出。
5. 記錄瀏覽器／版本、測試日期與結果，再更新研究筆記及任務狀態。單檔 HTTP 下載成功或相依性檢查通過，不能代替這項實測。

## 提交與發布

推送 `main` 會執行 Pages workflow，先檢查來源同步及核心測試，再以白名單打包靜態檔案。確認對應提交的部署成功，核對正式首頁、離線下載內容及修改過的公開資產。網站異動另驗證桌面／手機流程、主控台錯誤、canonical、分享資訊與 sitemap；文件變更以連結、指令及描述與實作一致性為主。
