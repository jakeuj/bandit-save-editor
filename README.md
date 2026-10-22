# 山寨帳房

《塔防山賊模擬器》的繁體中文存檔修改器。使用瀏覽器讀取 `.dat`，修改後匯出副本；存檔全程在本機處理。

**[開啟修改器](https://bandit.jakeuj.com/)**

[Wiki 首頁](https://github.com/jakeuj/bandit-save-editor/wiki) · [操作教學](https://github.com/jakeuj/bandit-save-editor/wiki/操作教學) · [常見問題](https://github.com/jakeuj/bandit-save-editor/wiki/常見問題)

## 功能

- v2.9 一般隨機角色天賦等級（遊戲 V1.0.11.2）：在品質的原版等級池內調整三槽天賦等級，預覽每槽效果；天賦 ID 不可更換或清空，品質 6 無可調整值。資質天賦連動丹藥上限，超過即整筆阻擋；同角色天賦、基礎資質與丹藥共 12 欄一起還原。詳見[本版說明](docs/releases.md#v29-一般隨機角色天賦等級)。

- v2.8.1 鞏固版（遊戲 V1.0.11.2）：z9 套裝等級改為唯讀，待獨立證明；本版不新增修改功能。舊存檔已升級套裝不追溯、不算載入失敗，該件等級保持唯讀且無法由本版還原。

- v2.8 一般隨機角色九項技藝上限：資格與共同生成條件檢查、九項上限／等級／餘額完整預覽，明確確認後一起套用。首次有效變更納入同角色 27 欄累計還原，保留單項及全部技藝經驗操作；限制與驗收進度見[本版說明](docs/releases.md#v28-一般隨機角色九項技藝上限)。

- v2.7 一般隨機角色三項基礎資質：限已招募、範本0、非在監、無結丹／重生階段紀錄，三項須符合相同品質的原版招募組合。先預覽資質來源、丹藥及新上限；衝突整筆阻擋。同角色基礎三項與丹藥三項一起累計還原，復原一步只撤回上一筆操作；天賦另由 v2.9 開放，超限未開放。

- v2.6 批次操作：多角色經驗、單角色全部已習得職業／九項技藝經驗、同庫普通裝備升滿、進階科技31–44同值。先預覽，任一目標不合格就整批不改；限一般模式，穿戴裝備另勾選。復原一步撤回整批，個別還原沿用既有累計群組。大量明細以50筆分頁，處理時可取消；手機可開使用說明與更新紀錄，也能復原一步。

- 修改銅錢、共用經驗、魂魄、科技點與操練點。
- 編輯山寨／角色名稱，依遊戲公式增加角色、已習得職業及九項技藝經驗，逐級結算並保留上限與關聯。
- v2.1 可升降既有一般裝備等級、設定職業操練上限與進階科技 31–44；一般模式遵守原版上限，進階模式開放已實測範圍。
- v2.2 新增既有詞條係數與丹藥資質累積增量；兩群組已完成 Windows 隔離遊戲載入、原版存檔及重啟驗證。
- 精準洗練可替換普通裝備合法詞條並預覽單件效果；品質2–6、原版係數範圍，不扣魂魄。v2.4支援背包及首次確認選槽，已有選槽只能修改同槽。
- 檢視角色成長、科技與操練狀態、背包／裝備庫及 22 層欄位圖鑑；尚未核實或關聯複雜的欄位維持唯讀。
- 職業圖鑑提供 47 個繁中職業、六階 16 條完整轉職路線，可搜尋、篩選系別及對照角色的前置等級與解鎖狀態；未載入存檔也可查閱。
- 內嵌 1,762 筆必要名稱、725 個事件函式與 850 處存檔寫入索引，支援來源 SID 查詢。
- 搜尋、篩選與批次修改遊戲材料資料表中的 220 筆材料。
- 比對兩份原始存檔，顯示不同欄位、座標與差額，並匯出 CSV。
- 使用自訂座標加入常用欄位，支援欄位設定匯入與匯出。
- 檢視變更、還原、復原一步，或還原全部修改。同一角色、同一類經驗的累計變更一起還原，保留等級／餘額關聯；「復原一步」則回到前一次操作。
- 下載原檔備份與修改副本；只替換指定值的 token，保留其他原始 JSON 文字。
- 安裝為獨立視窗 App，完成首次快取後可離線開啟編輯器。

## 使用方式

1. 開啟網站，選取遊戲的進度 `.dat`，例如 `ea3save.dat`；請依要修改的本機存檔、自動備份或雲存檔快取選擇位置。
2. 修改資源、材料或名稱；「角色養成」增加經驗、預覽並一起調整一般隨機角色三項基礎資質，「物品與裝備」調整裝備等級、詞條係數及精準洗練，「山寨與科技」設定操練上限與進階科技。也可在「批次操作」先選目標、預覽後一次套用。從「檢視變更」確認所有修改。
3. 先下載原檔備份，再匯出修改存檔，例如 `ea3save.modified.dat`。
4. 結束遊戲，把原始存檔另行備份，將修改副本改回原檔名並放回取出時的相同位置。
5. 重新開啟遊戲，載入對應存檔確認。

也可從網站下載單一 HTML，之後使用 Edge 或 Chrome 離線開啟。離線檔的圖示可以省略，修改功能不依賴外部檔案。

## 安裝 App 與離線使用

1. 首次連線開啟網站，等畫面顯示「可離線使用」。
2. Chrome／Edge 在瀏覽器允許安裝時會顯示「安裝山寨帳房」，也可使用瀏覽器的安裝選單。iPhone／iPad Safari 使用分享選單「加入主畫面」；支援的 Mac Safari 使用「檔案 → 加入 Dock」。
3. 之後可由桌面、Dock 或主畫面啟動，離線選檔、修改、比對及匯出。存檔不會上傳，也不會加入網站快取。

新版會先在背景準備，等所有帳房視窗（包含瀏覽器分頁）關閉後更新，編輯途中不會強制重新載入。**關閉不會保留未匯出的修改，請先匯出。** 瀏覽器或使用者清除快取後，需要重新連線準備。Mac 指南、準備工具、GitHub 等外部連結，以及下載單檔 HTML 仍需網路。

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

新增具名操作的座標為裝備 `[i,6,9]`、操練 `[job,5,0]`、科技 `[tech,4,0]`；自訂座標維持唯讀，請使用專屬介面完成關聯檢查。

材料名稱取自遊戲資料表；部分資料為重複名稱或占位名稱，不代表遊戲內都已開放。共用經驗與角色、職業、技藝經驗各自儲存。

上表是辨識座標；等級與經驗餘額須透過「角色養成」一起結算，不能單獨修改。v2.8 的九項上限透過專屬輸入、整組預覽及確認套用；自訂座標維持唯讀。

目前 v2.9 對應 2026-10-22 核對的遊戲 V1.0.11.2 正式版。程式證據、成長公式及歷史遊戲驗證記錄見 [存檔知識調查](docs/research/save-knowledge.md)。遊戲更新後需要重新核對；存檔本身沒有可靠的完整 build 指紋，介面會顯示知識對應版本，不能只靠陣列尺寸保證新版相容。

### 歷史驗證基準

下列為各次已記錄的驗證範圍，未驗項目保留；v2.9 的新增證據另見[各版紀錄](docs/releases.md#v29-一般隨機角色天賦等級)。

當次指定安裝為 V1.0.11.2／Steam build 26126719。已完成新版解包與 15 來源核對、15 個 Windows 隔離副本的原版存讀／新 PID 重啟及 24 群組重驗，另補洗練選槽與兩庫品質 UI 證明；詳見 [V1.0.11.2 調查](docs/research/v1.0.11.2-audit.md)。本次新版 Mac 只有路徑修正的靜態核對，尚未取得新版啟動及存讀證據；正式網站發布狀態也與本機驗證分開記錄。

後續高頻改版已改為[按影響驗證](docs/maintenance/migration.md#版本遷移重驗)：先看公告及靜態差異，未變沿用，只補相關功能的隱藏原生測試；例行不使用 computer use。流程成本與兩版重播結果見[精簡紀錄](docs/research/selective-migration.md)。

2026-10-21 已完成 V1.0.10.2（Steam build 26094666）的靜態核對及 Windows 隔離遊戲載入／原版存檔／程序重啟讀回。名稱與三類經驗通過實測，原始存檔雜湊未變；知識目錄與驗證紀錄已更新，屬性 #72 改為「最終增產」。詳細差異與實測範圍見 [V1.0.10.2 調查](docs/research/v1.0.10.2-audit.md)；此結果不涵蓋新版 Mac 啟動器。

角色／技藝經驗增加量為正整數，職業可有一位小數；職業必須已習得，且角色未設定自動轉職。增加經驗不扣共用池，也不增加遣散／重生退款基數。建築配置、任務及衍生屬性維持唯讀；裝備品質與詞條 ID 須透過各自具名操作修改。

v2.1 新功能採正安全整數，進階驗證上限為 1000，招募科技 #33 為 299；科技輸入為存檔值，遊戲提示的 Lv 為此值加一。操練上限不能低於任何角色已取得的該職業等級，改到 30 以上仍不會解除原版自然成長的 30 級限制。研究／操練中先回遊戲停止；背包與置物台科技下調不能小於現有數量。裝備只修改有效一般裝備的等級，排除套裝、寶物與內丹，穿戴互指不一致時停止。新增功能已完成五組 Windows 隔離讀寫／重啟、原版屬性計算與後續操作；範圍及 UI 限制見 [進階修改研究](docs/research/advanced-editing.md)。

## 本機開發與驗證

網站執行不需套件或後端，直接開啟 `index.html` 即可使用。開發測試使用 Node.js 22 以上及鎖定的 Playwright 開發依賴：

```sh
npm ci --ignore-scripts
npx playwright install --only-shell chromium
node scripts/build-editor.cjs
npm run verify:release
```

`src/core.js`、`src/ui.js`、`src/knowledge-ui.js`、`src/profession-ui.js`、`src/pwa.js`、`knowledge/catalog.json` 與 `knowledge/profession-guide.json` 會內嵌至 HTML。建置也依 HTML、必要資產及 Worker 來源的 SHA-256 產生 `sw.js`；修改圖示、Manifest 或首頁後同樣需重建。測試使用合成資料，包含實際的 2501 × 60 × 22 尺寸、字串轉義、小數、跨級、上限、原文保留與整組復原，以及 PWA 快取範圍、失敗回復和版本同步。

日常優先使用`npm run test:ui`及`npm run test:browser`，獨立無視窗測試會自行準備暫存檔、下載與本機HTTP伺服器。測試分工、file／PWA證據及必要時才使用computer use的規則見[程式化測試指引](docs/testing.md)。

PWA 開發需以 HTTP localhost 或 HTTPS 提供完整目錄，例如在 repo 執行 `python3 -m http.server 8000`，開啟 `http://localhost:8000/`。`file://` 只使用單檔編輯功能，不註冊 Service Worker。

若要重新分析自己安裝的遊戲：

```sh
node scripts/extract-game.cjs --source /path/to/unpacked/game --audit /tmp/bandit-audit.json
node scripts/build-editor.cjs
```

事件／runtime 指紋未知時停止；其他資料表指紋改變時，重建不保留原本的新增可寫旗標。先核對新版事件與公式，再更新規則及完整驗證紀錄。原始分析、遊戲與個人存檔始終留在 repo 外。隔離遊戲驗證工具 `scripts/verify-game.cjs` 使用 Node.js 22 以上，保留真實授權初始化，將 Cloud、成就與統計寫入導向測試目錄。

未知版本可先以 `--audit-only --audit /outside/repo/audit.json` 執行純分析；此模式只輸出指紋及原始索引，不修改 catalog、名稱對照表或驗證旗標。

## 文件入口

| 需求 | 文件 |
| --- | --- |
| 後續可寫功能的新增順序與依據 | [功能路線圖](docs/research/feature-roadmap.md) |
| 下一版範圍、已驗證事實與接續 prompt | [後續版本實作計畫](docs/research/next-version-plan.md) |
| v2.9 天賦等級規則、公式與獨立驗證 | [研究](docs/research/random-character-talents.md)／[任務](sdd/random-character-talents/tasks.md) |
| v2.8 技藝上限介面、規則與獨立驗證進度 | [研究](docs/research/random-character-skill-caps.md)／[B 階段任務](sdd/random-character-skill-caps-b/tasks.md) |
| 一般隨機角色基礎資質、招募值域與獨立驗證 | [v2.7研究](docs/research/random-character-growth.md) |
| 第二批詞條係數、丹藥增量與後續候選 | [可行範圍與驗證計畫](docs/research/advanced-editing-batch2.md) |
| v2.1 候選、公式、來源 SID 與實測 | [進階修改研究](docs/research/advanced-editing.md) |
| Windows 本機補丁的獨立研究範圍 | [補丁提案](sdd/runtime-patch/proposal.md) |
| 核心 API、來源維護、知識更新、驗證與發布 | [維護指引](docs/maintenance.md) |
| 程式與研究文件的關係、圖譜查詢與更新 | [Repo 知識圖譜](docs/research/repository-graph.md) |
| 欄位座標、成長公式、事件來源及實測範圍 | [存檔知識調查](docs/research/save-knowledge.md) |
| Mac 準備、三類存檔位置與啟動方式 | [啟動器說明](launcher/README.md) |
| CrossOver 問題、原生 runtime 與 Steam 調查 | [Mac 執行研究](docs/research/macos-runtime-investigation.md) |
| 尚待驗收項目 | [SDD 任務](sdd/save-knowledge/tasks.md) |

2026-10-21 以隔離 Chrome 155 驗證 PWA 安裝、獨立視窗、離線啟動、桌面／390px 編輯與精確匯出、直接開啟下載 HTML，以及多視窗更新等待。完整實測範圍與其他瀏覽器待驗項目見維護指引；直接開檔的名稱／三類經驗及設定完整流程仍待確認。真實 Cloud 上傳、成就、DLC 獎勵及長時間遊玩亦維持待驗證。

## GitHub Pages

GitHub Pages 使用 `.github/workflows/pages.yml` 發布。推送 `main` 後，流程預設只檢查建置同步，再將 `index.html`、`mac.html`、`manifest.webmanifest`、`sw.js`、`sitemap.xml`、`robots.txt`、`.nojekyll`、`assets/` 與 `launcher/prepare-macos.py` 打包部署；也可從 Actions 手動執行並按需勾選 `full_verify`，才執行完整 Node 與 headless 驗收。網站不需要 Jekyll 或其他建置工具。

網站入口為 `index.html`。搜尋與分享資訊設定在 HTML `<head>`，可編輯的分享圖片來源為 `assets/social-card.svg`，對外提供 `assets/share-card-v3.png`。

本 repository 不含玩家存檔、比對報告或完整遊戲程式。

## macOS 原生執行研究

已以 NW.js 0.82.0 ARM64 原生開啟遊戲，並確認 Steam 雲存檔清單與 DLC 辨識；本輪另以隔離副本確認新增修改的載入、本機存檔及重啟讀回。長時間遊玩、真實雲端上傳與成就仍待驗證。副本準備與三類存檔位置見 [launcher/README.md](launcher/README.md)，CrossOver GPU 錯誤、實測範圍及 Nevergrind 比較見 [調查筆記](docs/research/macos-runtime-investigation.md)。

網站提供 [Mac 原生執行指南](https://bandit.jakeuj.com/mac.html) 與準備工具下載。


## 各版功能與驗收紀錄

逐版詳細限制、交易語意與實測範圍見[功能與驗收紀錄](docs/releases.md)；目前維護入口見[維護索引](docs/maintenance.md)。
