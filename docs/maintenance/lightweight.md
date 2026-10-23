# 輕量開發流程

[維護索引](../maintenance.md) · [下一步與目前進度](../research/next-version-plan.md)

2026-10-24 起，使用者決定改用本頁流程：這是使用者自己玩遊戲用的輔助工具，修改器只另存副本、不覆蓋原檔，改壞了換回備份即可。本頁取代舊流程中下列較重的要求：SDD（proposal／tasks，含 A／B 拆分）與另開的設計文件、分派表與多 session 協調、全量原生矩陣、證明紀錄綁定各種雜湊、改 core 就重證全部代表副本、遊戲 UI 證據。舊規則留在各維護文件作為歷史紀錄，與本頁衝突時以本頁為準。

## 保留的保護

- 匯出只替換指定值的 token，保留原文（BOM、大型整數、指數寫法、空白）。
- 核心交易的合成測試：資格、預覽、交易、失敗回滾、undo／還原。邊寫邊補即可，不強制先寫測試。
- 每個新寫入功能有自己的 `verification` 旗標，預設關閉，下方「隔離遊戲冒煙」通過才開。自訂座標、舊 `set` 與批次不能繞過旗標。
- 真實存檔、遊戲 payload、runtime 與原始 log 留在 repo 外，只操作隔離副本；玩家原檔與快取的雜湊不能變。

## 新功能怎麼做

1. **不寫 SDD**：不建 `sdd/<功能>/`，開工前也不另寫設計文件。要改哪些欄位、公式、拒絕條件直接列在當次對話的任務清單；需要使用者決定的取捨（例如輸入精度、範圍限制）在對話裡問。
2. **實作**：新功能仍走[獨立具名入口](core.md#新功能的-core-開發規範)，避免牽動既有功能；這是為了好維護，不是為了少跑重證。
3. **測試**：相關 Node 測試，加一次 `npm run test:browser`。瀏覽器測試涵蓋桌面與 390px 的套用、下載與重新讀取。
4. **隔離遊戲冒煙**：每個庫別／方向挑 1–2 個代表案例，用修改器編輯後，在隔離副本以原版存檔，再換新程序讀回，確認數值與原版行為一致。不跑全量矩陣，不做全分母 oracle 對拍。
5. **寫實作摘要**：做完後在該功能的研究文件加一小節「實作摘要」（沒有研究文件就寫在 [`docs/releases.md`](../releases.md) 該版紀錄），只記以後維護會用到的事：改了哪些欄位、公式、拒絕條件、具名入口，以及冒煙用了哪些代表案例與結果。這是事後紀錄，不是開工前的規格。
6. **開旗標、發布**：依[功能收尾最短流程](release.md#功能收尾預設最短流程)。不另寫長篇驗收報告；推送後在回覆最後附下一步提示與可貼上的開工 prompt（同一節第 5 步）。

既有 `sdd/` 目錄保留為已交付功能的歷史規格與證據，維護舊功能時照樣可讀，不需要補寫或遷移。

遊戲 UI 證據預設不做，見[遊戲 UI 手冊](../game-ui-testing.md#新功能首次證明)。

## 改 core 與遊戲改版

- 改 core 不再重證全部代表副本。改到既有功能的程式時，跑該功能的 Node 測試；改動牽涉存檔讀寫行為時，再補該功能的隔離遊戲冒煙。
- 遊戲改版時，對受影響的功能跑冒煙。
- `node scripts/core-slice-report.cjs` 只當參考，不再決定要不要重證。重證成本紀錄（`reproof-ledger.json`）與「並行副本」候選隨之停用。

## Session 與授權

- 預設在同一個 session 做完，不開子 session。查詢或核對用子 agent；只有同時符合「長、機械化、規格已定」，或兩個互不相干的功能要並行時，才依[任務分派](dispatch.md#先判斷要不要分派)開子 session。
- 啟動隔離遊戲、computer use、發布、Wiki／Project／公告同步，仍需使用者當次同意。
- 每完成一個功能，主動把可重用的教訓（工具陷阱、踩過的坑）寫回技能或對應的維護文件。

## 建置閘門

`scripts/build-editor.cjs` 對每個開啟的旗標（`knowledge/catalog.json` 的 `verification`）只核對三件事，任何一項不符就拒絕建置：

1. `knowledge/verification.json` 的 `groups` 有該群組，且為 `true`。
2. `verification.json` 的 `gameVersion` 等於知識的 `gameVersion`。
3. `verification.json` 的 `fingerprints` 等於知識的遊戲資料指紋。

不再核對 core 摘要、證明內容、manifest 或工具雜湊，所以改 `src/core.js` 不會讓建置失敗。新功能冒煙通過後，在 `groups` 加上該群組、在 `verification.json` 的 `lightweight` 加一筆冒煙紀錄（日期、遊戲版本、代表案例、基準存檔與 repo 外結果檔的 SHA-256），並打開旗標。

`lightweight` 裡的群組不進舊的複合遷移證明（`scripts/migration-proof.cjs` 的 `composite`）：選跑、`problem` 與 `compose` 都略過它們，所以版本遷移寫回後這些旗標會關閉，要在新版重跑冒煙再開。沒有這筆紀錄的已開群組仍照舊要求複合證據。冒煙可沿用 `verify-game.cjs --scenario`（`setPillAptitudeBonus`、`setEquipmentLevel` 等具名操作）加 `verify-native-lifecycle.cjs`（`ascend`、`followup`、`pills`、`backpackOverLimit`、`relics`、`relicTakeOff` 六種動作；`pills` 可用 `pillCharacter` 指定角色；擺放類動作要在存檔重啟後另跑一次取下，才算驗過兩輪 IO；`穿戴装备` 後要等一拍再讀角色指標，同一次 evaluate 內讀到的是空列）；固定基準存檔先複製到 repo 外的新資料夾，步驟依 `.local/game-sources.json` 的 `nativeSmoke` 紀錄（雲存檔載入 → 存檔 → assert → stop → restart → 存檔載入 → assert）。遊戲改版時，對受影響的功能跑冒煙，再更新 `gameVersion` 與 `fingerprints`。測試見 `tests/build-gate.test.cjs`。

`scripts/*-proof.cjs` 與 `verification.json` 裡較早的首次證明紀錄仍保留作為歷史證據與遷移工具，但不再是建置條件。

### 測試也不綁目前 core

2026-10-24 第一次在輕量流程下改 core（小數丹藥）時，有 21 項舊測試失敗：它們斷言「已開放群組的首次證明、B7 等價或 core 切片基準必須對上目前的 `src/core.js`」。依使用者決定已刪除這些斷言（`tests/helpers/set-quality-shipped.cjs` 的 `assertShipped` 只核對旗標與群組紀錄存在）；切片選取機制測試改以目前 core 當基準。之後新增測試不要再把歷史證明綁到目前 core 文字或切片。

新增旗標時，除了 `extract-game.cjs` 的預設值與 `catalog.json`，也要登記到 `scripts/verification-requirements.cjs` 與 `scripts/verification-suite.cjs` 對應 family 的 `groups`，否則 `version-migration` 測試會報「no family」；旗標開啟前，`version-migration.test.cjs` 的 write-back 比對清單也要列入它（開啟後自動排除）。

`verify-game.cjs` 的操作白名單新增具名方法時，也要把它（與對應的 info／preview 入口）列進 `scripts/migration-analysis.cjs` 該 family 的 `coreRoots`，否則 `tests/core-slice-roots.test.cjs` 報「不屬於任何 family」。新的 UI 模組（例如 v2.15 的 `src/relic-ui.js`）要在 `build-editor.cjs` 加佔位替換、在 `tests/skill-caps-ui.test.cjs`／`tests/talent-levels-ui.test.cjs` 兩個完整 UI 測試台注入，並在 `knowledge-ui.js` 呼叫處加 `typeof` 防護（單獨載入 knowledge-ui 的測試沒有該函式）。重抽 `catalog.json` 時鍵順序可能和既有檔不同，以語意比對確認沒有其他差異即可。

改到 `editingInfo`、`setEditingValue` 這類共用樞紐（v2.14 背包超限）時，所有 family 的切片都會變，`migration-proof` 的 `problem()` 對歷史證明一律回「複合證明與來源或程式不相符」。比照上段：直接斷言「開放群組的證明對上目前 core」的測試改成只核對群組紀錄；要測證明結構檢查（缺首次紀錄、交換、資料雜湊）的測試，用 `tests/helpers/current-core-proof.cjs` 把複本的 core 身分換成目前來源再測。換身分後原生證據摘要仍綁舊切片，所以不能再斷言整體 `problem()` 為 null。

### 基準存檔缺狀態時先原生備料（v2.16 教訓）

固定基準存檔沒有要測的狀態（例如結丹角色）時，不要手寫存檔欄位。先用一次隔離副本做原生備料：雲存檔載入，接著用 `verify-native-lifecycle.cjs` 呼叫原生函式做出狀態（`ascend` 是範例：`获得物品`→`穿戴装备`→設定變數後呼叫 `渡劫结束`），然後原生存檔、新 PID 讀回。最後把該副本的 `save/ea1save.dat`（連同 `saveinfo.dat`）複製到 repo 外，作為新的 `--save-file` 基準，再照常跑編輯冒煙。踩過的坑：

- 事件表的 static local（例如 `渡劫结丹品质`）不在 `GetAllGlobalVariables()`，要從 `GetAllLocalVariables()` 依名稱找，名稱須唯一。
- `verify-game.cjs` 的 `editSave` 每次都會改角色 1（等級、y50 歸零、名稱與經驗），所以要測的狀態放在別的角色。
- `--setup` 在讀 `--scenario` 前就建好副本目錄；情境檔路徑錯時，要清掉殘留目錄再重跑。Git Bash 的 `node -e` 寫檔要用 `H:/...`，不能用 `/h/...`。
- 半途失敗時，遊戲內狀態已經變了，不要在同一副本續跑，從 `--setup` 重來。
- 原生行為和預期不同時（例如重生只清第一筆入體內丹），先在現場讀值確認，再決定是修正拒絕條件還是工具斷言，並把它寫進實作摘要。
