# 來源、核心 API 與首次開放

[維護索引](../maintenance.md)；只讀本次任務相關章節。版本與日期標示的實測紀錄只證明當時範圍，現行開放狀態以 catalog／verification 與相應 SDD 為準。

## 編輯入口

| 內容 | 來源與維護方式 |
| --- | --- |
| 讀寫、欄位定義、經驗與交易 | `src/core.js` |
| 選檔、資源、比對、自訂欄位、預覽與匯出 | `src/ui.js` |
| 角色、山寨、裝備、欄位圖鑑 | `src/knowledge-ui.js` |
| 完整轉職表、職業清單與角色對照 | `src/profession-ui.js`；資料來源見研究筆記的「職業轉職圖鑑」 |
| 社群附圖的工作建議與已核對轉職門檻 | `knowledge/profession-guide.json`；由建置工具內嵌，不在重建遊戲目錄時覆寫 |
| 名稱、來源位置、版本及指紋 | `knowledge/catalog.json`；由 `scripts/extract-game.cjs` 產生 |
| 名稱繁體轉換對照 | `knowledge/traditional-names.json`；保留遊戲原始 ID |
| 可寫群組的實測證明 | `knowledge/verification.json` |
| HTML 結構、樣式、使用說明與 SEO | `index.html`；其中 `save-core`、`save-ui`、`save-pwa` 區塊由建置工具同步 |
| PWA 安裝、離線狀態及快取 | `src/pwa.js`、`src/service-worker.js`、`manifest.webmanifest`；建置產生 `sw.js` |

開發環境與測試分工見[程式化測試指引](../testing.md)。日常推送只做建置同步檢查，Pages CI 快速發布，不重跑完整驗收。需要同步產物時執行建置：

```sh
node scripts/build-editor.cjs
```

建置命令更新內嵌程式與 `sw.js`，保留 HTML 結構與樣式。修改來源後一併提交產生的 `index.html` 及 `sw.js`；只修改產生區塊會在下次建置時被覆蓋。使用者下載的單一 HTML 已內嵌執行程式與知識，不需 Node.js 或遊戲資料表。

## Repo 知識圖譜

查詢架構、程式與研究文件的跨檔關係時，先用本機既有的 `graphify-out/graph.json` 找到入口，再依來源位置核對目前程式及文件。來源異動後依需要增量更新；新增或修改文件、圖片也需語意萃取。建圖方式、Windows 注意事項與完整性診斷集中於 [Repo 知識圖譜](../research/repository-graph.md)。

`graphify-out/` 是可重建的本機導覽產物，已由 Git 忽略，也不在 Pages 發布白名單內。遊戲公式與寫入驗證仍以研究筆記、catalog 及 verification 為依據；圖譜的連線、社群或摘要不會開放可寫群組。

## 職業圖鑑維護

`scripts/extract-game.cjs` 從 `zy.json` 產生職業的 `tier`（第 3 欄）、`family`（第 4 欄）及 `prerequisites`（第 10–12 欄的非零 ID）。`src/profession-ui.js` 由前置關係組合六階路線，職業名稱不另建翻譯副本。工作方向由社群附圖整理，另存 `knowledge/profession-guide.json`；空陣列表示原圖虛線且未標工作，缺少項目表示第六階未涵蓋，兩者均不表示遊戲禁止工作。轉職等級與解鎖條件的事件證據見研究筆記。

路線表的工作搜尋以最深的原圖職業為準，避免流民涵蓋九種工作的共用標籤讓每條路線都命中。職業清單則搜尋個別職業名稱、ID、類別、系別及工作。名稱索引與角色養成可跳到職業詳情；載入存檔後可選角色對照，所有查閱均唯讀。

### 2026-10-21 職業圖鑑實測紀錄

2026-10-21：內建瀏覽器以 localhost 實測未載入存檔的 16 條路線／47 個職業、系別／名稱／工作搜尋、空結果與清除、第五／六階詳情、名稱索引及角色養成跳轉。合成存檔對照已習得職業 Lv 9、前置需求 Lv 10、操練上限 15／0，顯示等級不足、已解鎖及未解鎖；待匯出變更維持 0。390px 的頁面寬度維持 390px，750px 路線表僅在自身容器水平捲動，無頁面例外。修改搜尋後另關閉舊版測試分頁，確認新版搜尋「建造」為 1 條路線。直接開啟 `file://` 被內建瀏覽器 URL 政策拒絕，未繞過；本次職業圖鑑只完成離線相依性檢查，沒有新增直接開檔實測結論。

## 核心 API 與相容性

核心公開為 `SaveCore`。座標皆為零起算的 `{x, y, z}`，不是畫面上的角色／職業名稱。

| 介面 | 用途與限制 |
| --- | --- |
| `parse(text, name)`／`serialize(model)` | 保留原始文字；匯出僅替換修改的值 token，未修改的大型整數、空白、BOM 與指數寫法保持原樣 |
| `resolveField(model, coord)` | 回傳 `FieldDescriptor`：型別、用途、關聯、來源、驗證狀態及直接編輯權限 |
| `setField(model, coord, value)` | 寫入已確認且開放的欄位，檢查原型別、字串限制及數值範圍 |
| `set(model, coord, value)` | 保留既有介面；已知欄位轉入相同限制，未辨識的數值座標維持手動整數功能 |
| `addExperience(model, options)` | `kind` 為 `character`、`profession` 或 `skill`；另帶 `characterId`、`amount`，職業／技藝另帶 `id` |
| `editingInfo(model, kind, id)` | `kind` 為 `equipment`／`training`／`technology`；回傳目前值、一般／進階上限與各自驗證狀態，無效實體或忙碌進程會拒絕 |
| `setEquipmentLevel(model, {itemId, level, advanced})` | 只改有效一般裝備等級，檢查完整穿戴互指，排除寶物／內丹 |
| `setProfessionTrainingCap(model, {professionId, cap, advanced})` | 阻擋操練中；下限為所有角色已取得的該職業最高等級；不解除自然成長30級 |
| `setAdvancedTechnologyLevel(model, {technologyId, level, advanced})` | 限31–44；輸入存檔值（遊戲提示Lv加一）；阻擋研究中，檢查容量與計算範圍 |
| `transaction(model, fn, label)` | 同步批次交易；失敗還原全部變更，成功形成一筆復原紀錄 |
| `restore(model, coord)`／`undo(model)` | 前者還原指定變更，經驗則還原同一項的累計關聯修改；後者回到前一筆交易 |

等級與經驗餘額由 `addExperience` 一起結算，不能透過 `setField` 或自訂座標單獨寫入。直接增加經驗不扣取得成本，也不改共用池投入／退款基數。欄位設定仍沿用 `version: 1`、`game: 'szmnqea'` 與 `fields` 格式；設定格式相容不代表可以繞過已知欄位限制。

三項進階修改的 `advanced` 預設 false，一般／進階各有獨立驗證群組。公開值域由 catalog 的 `editingLimits` 與 verification 完全比對，目前上限1000、科技33另限299。這三類進階修改的已知欄位經自訂座標及舊 `set` 仍保持唯讀，只能使用具名操作；相同目標的累計修改整組還原。來源、公式及本輪實測見 [v2.1 研究](../research/advanced-editing.md)。瀏覽器讀取存檔使用 `TextDecoder` 的 `ignoreBOM:true` 保留 BOM，避免 `File.text()` 消去原字元。

玩家名稱與其他存檔字串進入 HTML 時使用文字節點或 HTML 跳脫；序列化則使用 JSON 字串跳脫，兩者用途不同。預覽、比對及唯讀檢視也要保留這項處理。

## 新功能的 core 開發規範

> 2026-10-24 起依[輕量開發流程](lightweight.md)：下列獨立入口原則保留（好維護），但改 core 不再重證全部代表副本，第 6 點的切片報告只當參考。

既有群組的原生證據依 family 的 core 切片綁定（見[切片綁定](../research/core-ast-proof.md#第二階段功能切片)）。只有修改落在少數 family 專屬函式時才省得到選跑；碰到共用樞紐就等同整份 core 變動，全部重證。新功能依下列規範設計：

1. 以**獨立具名入口**提供資格、預覽與交易（例如 `xxxInfo`／`previewXxx`／`setXxx`），UI 直接呼叫該入口；不在 `editingInfo`、`setEditingValue`、`resolveField` 等樞紐新增分支。寶物等級（v2.11）接入 `editingInfo`／`setEditingValue`，因此付了全部 19 份重證，是反例。
2. 新入口只新增 `globalThis.SaveCore` 匯出名稱；新增名稱不影響既有 family，改變既有名稱的指向則會影響。
3. 新功能的唯讀保護若必須進入 `resolveField`（例如自訂座標不可繞過），先排在一次本來就要全跑的時點（遊戲改版或發布前），把分類改成資料驅動；不在開發中修改樞紐。
4. 共用工具（座標、格存取、`put`、`transaction`、`parse`／`serialize`）只在發布前批次修改；新功能需要的輔助函式放在自己的區塊。
5. 新 family 必須在 `scripts/migration-analysis.cjs` 的 `coreRoots` 宣告其原生情境與驗證腳本使用的 `SaveCore` 方法；`tests/core-slice-roots.test.cjs` 會核對漏列。
6. 每次修改 core 後先跑 `node scripts/core-slice-report.cjs`（純靜態、秒級），看本次修改會讓哪些 family 的切片改變；在 SDD 停點記錄結果。

## 重建知識與開放寫入

遊戲更新資訊以 [Steam 最新消息](https://store.steampowered.com/news/app/4267800)為入口，核對公告日期、版本及正式／測試／相容分支，並在研究筆記保留當次公告的永久連結。頁面無法取得正文時可用 [Steam 官方新聞 API](https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=4267800&count=5&maxlength=0&feeds=steam_community_announcements)。本機安裝版本另核對 `appmanifest_4267800.acf` 的 `buildid` 及來源指紋，包內個別版本文字可能落後；公告與靜態分析不能作為新增群組的首次隔離遊戲證明；既有群組則可依[版本遷移規則](migration.md#相依與證據)合法沿用原始證據，並明示本版未重新實測。

```sh
node scripts/extract-game.cjs --source /path/to/unpacked/game --audit /tmp/bandit-audit.json
```

解析器只建立 expression factory 索引，不執行遊戲。事件／runtime 指紋不在已核對清單時停止；資料表指紋不同時，重建目錄不保留原本的新增可寫旗標。相同完整指紋重跑才保留既有旗標。繁體轉換在 macOS 使用 Foundation，其他平台重用提交的對照表。

新版指紋未知時，先用純分析模式取得 repo 外的 audit：

```sh
node scripts/extract-game.cjs --source /path/to/unpacked/game --audit-only --audit /outside/repo/audit.json
```

此模式輸出 13 個來源指紋、統計及事件／讀寫索引，略過 catalog 產生器，不修改 catalog、繁中對照或驗證旗標。一般重建的指紋限制維持不變；原始 audit 的 repo 外路徑會在寫入知識前檢查。比對時以 SID 定位，expression 編號可能因其他事件增刪而移動。2026-10-21 的新版分析與 Windows 讀寫／重啟結果見 [V1.0.10.2 調查](../research/v1.0.10.2-audit.md)。

新增可寫功能需完成以下流程：

1. 追查初始化、讀寫、計算與刪除，記錄欄位型別、值域、關聯及來源 SID；複雜或未釐清項目維持唯讀。
2. 用合成資料測試非法型別、跨級、上限、交易回滾、完整復原及精確 token 替換。
3. 以 `scripts/verify-game.cjs --help` 查看隔離驗證入口。此工具需要 Windows 或 macOS、Node.js 22+、解包的遊戲、同平台 NW.js runtime 及已登入的 Steam；來源須與 catalog 的完整15個指紋（13個基礎加yx／tz）相符。Windows 優先傳入本機索引記錄的快取 `game.exe`，也可用安裝目錄的版本；工具會複製 runtime 至隔離遊戲目錄。用 `--catalog` 指定候選目錄、`--save-file` 指定唯讀來源存檔、`--artifacts` 指定已存在的 repo 外目錄；不能沿用不同 runtime 的驗證紀錄。
4. 確認遊戲載入、遊戲寫檔、停止測試程序後重啟讀回及來源存檔雜湊；測試只在獨立 app／遊戲／profile 中執行，保留授權初始化，Steam 寫入導向本機鏡像與紀錄。
5. 將去識別結果與相符指紋寫入 `verification.json`，再開啟對應群組。建置會核對全部來源指紋、檢查結果及群組覆蓋，未通過就停止。
6. 在 `scripts/verification-requirements.cjs` 加群組與 checks，`scripts/verification-suite.cjs` 指定家族／步驟，`scripts/migration-scenarios.cjs` 補代表情境，並在 `scripts/migration-analysis.cjs` 宣告相依。漏加不能在遷移時判為可沿用；首次獨立證明合併後才成為下次遷移的既有群組。

v2.1 可使用 repo 外 `--scenario` JSON：`baseline` 為 `[x,y,z,value]` 陣列、`operations` 指定三項具名 API 的 `method`／`options`、`observe` 列出預期核對座標。`verify-game.cjs` 的候選旗標只存在隔離 VM，不修改公開 catalog；只有版本遷移流水線在下節條件下寫回。`--load` 等待主畫面，`--save`／`--assert` 確認布局就緒後執行；`scripts/verify-advanced.cjs --state /outside/state.json` 記錄原版屬性／加成，重啟後加 `--compare` 核對。原始 scenario、結果、SID 呼叫及玩家資料仍留在 repo 外。

完整解析輸出、遊戲內容、玩家存檔、測試 state 與原始 log 均留在 repo 外。`--setup` 產生的測試狀態包含本機路徑及玩家資料，不能作為公開驗證紀錄提交。


## 套裝等級首次證明與遷移

詳見[研究與原生結果](../research/set-equipment-level.md)、[SDD](../../sdd/archive/2026-10-23-set-equipment-level/tasks.md)。`setEquipmentLevelInfo(model,{itemId,plane})` 核對套裝 metadata、Q1–Q6／T1–T9、等級、owner 與雙向唯一指標；`editingInfo(model,'equipment',id,plane)` 依種類分派，`setEquipmentLevel` 僅改 y6。z7 使用 `backpackSetEquipmentLevel`，z9 使用 `setEquipmentLevel`；品質、詞條、套裝合成及進階模式不在範圍。已洗唯一選槽的 P套 ID（跨池範圍）另由 `backpackSetEquipmentLevelCrossPool`／`setEquipmentLevelCrossPool` 各自把關，預設關閉，關閉時只接受原池；首次證明見[套裝品質 B 任務](../../sdd/set-equipment-quality-b/tasks.md)。y0 是保留身分，可不同於目前列號；y23／26／27 保留。各群組的獨立首次證明通過後才開放。

首次工具：`verify-set-equipment-level-suite.cjs --config EXTERNAL_CONFIG`。設定提供來源、runtime、原始基準與 SHA-256、兩份快取 manifest／檔案數及 repo 外 out；先依本機來源索引定位，不將設定提交。工具核對全部快取與 15 指紋，再執行原生生成、矩陣與 12 生命週期副本。各階段結果保存在 out；續跑綁定精確 core、原生 driver、oracle、情境、來源與輸入摘要。`--merge-results OUT --config EXTERNAL_CONFIG --record` 重讀完整原始結果、逐案重算後，只插入新 proof section／群組旗標並建置；失敗回滾四個產物。重跑已合併證據時省略 `--record` 作檢查，不覆寫首次證明。

公開 section `setEquipmentLevel.initialVerification[group]` 各自保存原始來源、核心語法樹摘要、manifest／evidence 摘要及覆蓋數。建置核對目前 15 來源、資料、oracle、整份 core AST 與該庫首次證明；代表子集不能首次開閘。原始觀察不放 repo。資料仍是靜態抽取，不以 catalog 的階段描述代替 verification。

日後代表遷移使用 `set-level-7-representative`／`set-level-9-representative`，分別 2 件 Q1／Q6 升降，另經搬移穿卸、原版存檔／不同 PID 重載。需求表、suite、操作白名單、來源事件／表格／存檔區域及資料摘要均已接線；schema 2 保存 `setInitialVerification`，只能沿用已存在的首次證明。每庫由自身副本產生 checks，缺庫或只有成功旗標不算通過。修改可執行 core 後亦須依技藝上限維護指引重驗，不能只換摘要。
