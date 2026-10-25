# 存檔知識、成長與寫入驗證

處理存檔讀寫、資源、名稱、成長或知識擴充時使用。從 repo 讀 `README.md`、`src/core.js`、`docs/research/save-knowledge.md`；API 讀 `docs/maintenance/core.md`，新增寫入與改版的驗證讀 `docs/maintenance/lightweight.md`；測試選擇讀 `docs/testing.md`。公式、座標表、事件 SID 及詳細實測只在這些 repo 文件維護。

## 識別與權限

存檔是 `c2array` 三維 JSON，座標從零起算。先由現有 parser 驗證結構；識別字串與陣列尺寸並不能證明遊戲 build 相容。以 catalog 顯示知識版本與來源，未知欄位明確標示未辨識。

公開知識與隔離實測的版本以 catalog／verification 為準；新版靜態分析另見 repo 的研究筆記，不能直接升格為已完成遊戲讀寫驗證。材料目錄或名稱的存在不代表已開放、已習得或可寫，動態索引 `*` 也不代表零或任意可寫座標。

使用 `SaveCore.resolveField` 取得型別、用途、關聯、來源與驗證狀態；具名編輯走 `setField`，成長走 `addExperience`。裝備、操練與進階科技使用 `setEquipmentLevel`、`setProfessionTrainingCap`、`setAdvancedTechnologyLevel`；一般與 `advanced` 各有群組及已驗證值域，由 `editingInfo` 查詢，不能直接改座標繞過。研究／操練進程、穿戴互指及容量限制依 repo 的 `docs/research/advanced-editing.md`，公式不另存於技能。

舊 `set` 及 version 1 自訂欄位設定保留相容性，同時套用已知欄位權限。

角色、職業與技藝的等級／餘額是關聯狀態；直接增加經驗與花費共用池升級是不同操作。依研究筆記核對上限、取整、小數、未習得與自動轉職等限制，保留共用池及投入／退款基數。不要在技能另存公式或自行寫入遊戲會重算的衍生屬性。

瀏覽器讀取存檔與比對檔須保留 UTF-8 BOM；沿用 `arrayBuffer()` 配合 `TextDecoder` 的 `ignoreBOM:true`，避免 `File.text()` 在核心 parser 前消去字元。驗收應逐字比較瀏覽器匯出與預期 token 替換結果，不能只比 JSON 值；詳細案例見 repo 的 v2.1 研究。

v2.2 的既有詞條係數走 `affixInfo`／`setEquipmentAffixCoefficient`，丹藥增量走 `pillInfo`／`setPillAptitudeBonus`。只開已驗證一般範圍，完整限制見 `docs/research/advanced-editing-batch2.md`；品質與詞條 ID 已分別由 v2.5／v2.3 的獨立操作處理，超限另案。係數含小數，丹藥儲存單位不等於顯示點數；原生截限也可能產生小數增量：`pillAptitudeBonusDecimal` 關閉時保留唯讀，開啟後以 0.1 格線編輯並保留未改值的原始 token。範本0隨機角色不可誤當缺失範本，有名角色才有載入回填檢查。

第二批使用原有13指紋加上獨立的 `batch2Fingerprints`，建置還比對規則資料雜湊與值域。新增表不能自動沿用舊驗證。原生後續操作用實際物品裝備格與完整參數，確認真實狀態變更；不要將驗證腳本假設錯誤當作遊戲結論。`scripts/verify-batch2.cjs` 的結果與完整生命週期證據仍留repo外。

## 重建知識

來源為使用者合法持有、解包的遊戲副本。`package.nw` 可作 ZIP 分析；原始解析輸出與完整遊戲資料留在 repo 外。

遊戲改版依 repo `docs/maintenance/game-update.md`：`verify-migration.cjs --plan` 只用來列出變動來源，真改動逐條比對事件後只對受影響功能跑冒煙。未知規則再使用 `node scripts/extract-game.cjs --source /outside/repo/unpacked-game --audit-only --audit /outside/repo/audit.json` 取得原始事件／讀寫索引；此模式不修改 catalog、繁中對照或驗證旗標。以 SID 追查規則，expression 編號可能移動。

```sh
node scripts/extract-game.cjs --source /path/to/unpacked/game --audit /outside/repo/bandit-audit.json
node scripts/build-editor.cjs
```

解析器只在限時、空白 VM 建立 expression factory 索引，不啟動遊戲或執行 factory。使用既有解析器與來源追蹤，不以臨時執行完整 runtime 取代分析。

事件／runtime 指紋未知時停止，先重查規則。其他資料表指紋改變時，重建不保留原本新增可寫旗標；只有完整來源指紋相同才保留。名稱轉繁體在 macOS 使用 Foundation，其他平台沿用提交的 `knowledge/traditional-names.json`，保留遊戲 ID。

## 開放新增寫入

依 repo `docs/maintenance/lightweight.md`「新功能怎麼做」：追查初始化、讀取、計算、寫入及刪除，記錄型別、值域、關聯與 SID；合成資料驗證非法值、跨級、上限、交易回滾、累計群組還原及精確 token 輸出；再做一次隔離遊戲冒煙（代表案例原版存檔、新程序讀回）才開旗標。隔離工具 `scripts/verify-game.cjs` 的參數與 Windows 本機快取見 `--help` 及 `docs/maintenance/migration.md`「本機開發快取」；狀態檔含玩家資料與本機路徑，存放於 repo 外。Windows 與 Mac 的 runtime 可能不同，不能直接搬用不匹配的冒煙紀錄。

## 驗收界線

存檔修改器以原生函式及原版存讀／重啟為遊戲證據；既有功能在遊戲改版時只對受影響者重跑冒煙。例行 UI 未重驗不阻擋既有功能，疑慮待實際故障複查，使用者明確要求才操作遊戲桌面。完整來源、規則與原始證據仍核對，報告區分本版原生、沿用及 UI 未重驗；原生函式操作不稱為 UI 操作。

研究筆記已記錄名稱、三類經驗與 v2.1 三項進階修改在隔離遊戲的載入、本機存檔及重啟讀回；這不等於完整選單重播、真實 Cloud 上傳、成就、DLC 獎勵或長時間穩定性。報告引用這些範圍，新增改動另做對應驗證。

桌面／手機、完整尺寸、離線相依性與直接開檔（2026-10-25 headless `file:` 驗收）的紀錄見 `docs/maintenance/pwa.md`；一般 Chrome／Edge 與原生選檔改為按需。

實際存檔先保存固定快照，避免玩家後續遊玩改檔污染預期。Windows 存檔位於 Steam 遊戲庫的 `steamapps/common/塔防山贼模拟器/save/ea2save.dat` 與 `ea3save.dat`；位置與新舊順序每次確認，Mac 另讀 [macos.md](macos.md)。

## 裝備洗練與操作（v2.3／v2.4）

精準洗練、首次選槽、z9 y0 列號、plane 參數與還原分組見 repo `docs/maintenance/equipment.md`，證據見 `docs/research/precise-affix-editing.md`、`docs/research/equipment-workflow.md`。UI 與 computer use 驗證先讀 `docs/game-ui-testing.md`；未提供原生控制時只報原生函式／IO 證據，不冒稱遊戲 UI 通過。
