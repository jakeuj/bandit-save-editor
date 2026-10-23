# 寶物等級任務

狀態：2026-10-23 **研究完成／待開始實作**。提案：[proposal.md](proposal.md)；證據：[研究](../../../docs/research/treasure-level.md)；目前入口：[下一步與目前進度](../../../docs/research/next-version-plan.md)。

2026-10-23 十項全部完成，已作為 v2.11 發布並歸檔；下一步見[進度入口](../../../docs/research/next-version-plan.md)。任務 2–3 只新增規格、manifest、規則資料與合成測試，沒有改核心、註冊旗標或執行原生測試。

以下每條為一個可檢查的開發切片，目標 30–60 分鐘；完整自動矩陣執行另分片記錄。若單條實作超過此粒度，先拆 A／B 子提案並回寫進度入口，不能把大項打勾當作全案完成。

- [x] 1. 完成可行性研究：15 指紋、初始化／欄位、升級與上限、經驗函式引用、穿卸搬移及分解返還。產出研究及本提案；結論為等級有條件 go、經驗 no-go。
- [x] 2. 固定原生基準準備規格與案例 manifest：170 範本／Q1–Q6、兩庫及第 6 槽狀態、等級邊界、來源／合法 metadata 與成本／分解案例；定義未知／非法／缺案及分片 checkpoint。先核對完整開發快取，不重解包已驗來源。
- [x] 3. 建立最小寶物規則資料與相依摘要：T1–T6、第 6 槽、cap、魂魄成本、固定分解表及來源 SID；資料形狀及來源不符拒絕測試通過，兩庫旗標保持關閉。
- [x] 4. 實作資格、預覽與 y6 原子交易：兩庫分派及 owner 互指、型別／上下界／非法類型、無變更、精確 token、undo／累計還原及回滾測試；既有路徑不擴權。
- [x] 5. 建立獨立原生計算 oracle 與矩陣執行器：合法取得、效果、單次／最大升級成本、低等級對照、固定分解返還；預期不來自被測 core，分片可續跑且能偵測漏案。
- [x] 6. 建立穿卸／搬移／分解 IO suite：實際返回列、替換第 6 槽、owner、y0–59、鎖定篩選、原版存檔與新 PID 讀回、來源原檔雜湊。範圍與缺口可對帳。
- [x] 7. 接上兩庫 proof 與遷移需求：獨立首次群組、suite／family／操作白名單、來源／規則／核心摘要、代表情境及合併拒絕條件；缺首次證明不能由代表遷移開閘。
- [x] 8. 完成候選介面與瀏覽器案例：預覽／套用／拒絕原因／還原，桌面與 390px、真實下載重載、直接 file、PWA 離線與更新交接；未證明入口維持停用。
- [x] 9. 分片執行並核對完整首次矩陣／生命週期：每庫案例全部可對帳，原生反證回寫規格；核對最終 core 的既有群組相依與技藝上限重驗，保存具體失敗／續跑位置。
- [x] 10. 合併有效證明並完成本功能驗收、建置與交付文件：相關 Node／瀏覽器／proof 檢查及首次完整驗收通過，更新目前進度；提交、推送、外部同步及發布依當次授權另記，未發布不寫已發布。

## 驗收條件

- 合法兩庫寶物升降等級只改 y6；品質／詞條／owner／其他 metadata 與資源不變。某庫缺證明時只保持該新群組停用。
- Q1–Q6 的上限為 10／15／20／25／30／35，T1–T6；非法型別、超限、錯誤範本、數量、互指與未知狀態拒絕且不留歷史。
- 來源沒有經驗呼叫時，不出現寶物經驗輸入、不把 y4／y8 當經驗、不套用角色經驗交易。
- 原生單次／最大升級依當前 L 逐級計魂魄成本；編輯器不扣款的政策與原生 oracle 資源差異分開斷言。
- 空槽／替換穿戴、卸下與兩庫往返後等級及 metadata 保存，角色第 6 槽和 owner 唯一互指；跟蹤實際目的列，不要求 y0 等於 x。
- 升／降級後，T1–T6 分解仍為 20／200／1,000／10,000／50,000／500,000 魂魄；原生清除背包列且其他列不變。批次鎖定篩選獨立驗證。
- 必要階段完成原版寫檔、停止及新 PID 讀回；靜態／合成結果不冒充原生實測。
- 匯出精確保留未修改文字，復原與回滾完整；手機、file 與 PWA 各有本功能證據。

## 本輪紀錄

任務 1 完成：核對相符 15 來源、170 範本、實際魂魄升級、經驗函式只有定義、兩庫 50 欄搬移、第 6 槽互指及固定等階分解表。沒有執行遊戲或新增可寫群組。完整來源摘錄與核對報告留 repo 外，公開結論見研究。

任務 2 完成（2026-10-23，本機未提交）：[baseline-spec.md](baseline-spec.md) 固定規格；`scripts/treasure-level-scenarios.cjs` 產生 12,420 案（level 12,240／cost 72／decompose 72／reject 36），綁 15 指紋與 wp 範本摘要，附分片及續跑檢查；`tests/treasure-level-matrix.test.cjs` 3 項通過，並以真實 wp.json 核對 170 範本與 wp 指紋相符。未執行原生，兩庫仍關閉。

任務 3 完成（2026-10-23，本機未提交）：`scripts/treasure-level-data.cjs` 由來源 wp 與 20 個事件 SID 的摘要產生 `catalog.treasureLevel`（170 範本、cap 規則、成本公式、固定分解表、欄位與搬移界線、經驗 no-go）；SID 摘要未知、範本／等階規模不符即拒絕，歷史版本回傳 null。已接入 `extract-game.cjs`，catalog 以插入方式新增資料（避免重排既有鍵）、HTML／sw.js 已同步。依套裝案前例，兩庫旗標尚未註冊到 verification（正式遷移註冊留任務 7），既有證明未改。`tests/treasure-level-data.test.cjs` 3 項通過，全部 211 項通過。未執行原生。

任務 4 完成（2026-10-23，僅本機工作樹、未提交）：`src/core.js` 新增 `treasureLevelInfo`，`editingInfo` 對寶物分派到獨立兩庫群組（backpackTreasureLevel／treasureLevel，旗標未註冊＝停用）；既有 `setEquipmentLevel` 入口只改 y6，沿用 setEditingValue 的 token、undo、還原與回滾，普通裝備與套裝路徑未擴權。資格：範本、數量 1、等階一致、y4=0、y22∈{0,1}、全欄位為有限數值、品質 1–6、等級 1–cap、背包 owner=0、穿戴第 6 槽與 owner 唯一互指。`tests/treasure-level.test.cjs` 4 項通過（含 T1–T6×Q1–Q6 邊界、拒絕原子性、閘門與唯讀繞過），`advanced-editing` 舊斷言改為寶物改走自身閘門。

**阻擋／不可推送：** core 可執行語法已變，使整份 core 綁定的既有證明失效，12 項既有測試（套裝首次證明、技藝上限 AST、建置閘門等）失敗，`build-editor` 因套裝等級證明不符拒絕建置。依維護規則不得以此狀態推送；須在任務 9 以最終 core 依[重開流程](../../../docs/maintenance/talents.md#v29-的技藝上限重開)重驗套裝／技藝上限／天賦等既有群組（需原生）後才能恢復綠燈。在此之前 core 變更只留本機，任務 5–8 在同一工作樹累積。

任務 5 完成（2026-10-23，僅本機）：`scripts/treasure-level-oracle.cjs`（魂魄逐級成本、封頂／最大升級、固定分解與批次鎖定、搬移 y0–49、僅 y6 斷言、百分比主屬性效果）預期不取自被測 core；`scripts/treasure-level-synthetic.cjs` 對 manifest 案例跑候選 core 並恆標 nativeCompared=false；`scripts/treasure-level-native.cjs` 為免執行的原生 driver（generate／level／costs／decompose／effects／observe，引數依函式標頭，首次執行在任務 6／9）。`tests/treasure-level-oracle.test.cjs` 5 項通過；全套 208 通過，仍是任務 4 造成的同 12 項證明綁定失敗。

**已知缺口：** 效果 oracle 僅涵蓋已核對的百分比主屬性公式；170 範本中 72 個的主屬性可由靜態算出，其餘 98 個涉及 32 種屬性（含 10、15、28–30、77–103 等）沒有靜態公式，列為 native-observation-only，任務 9 須由原生觀察補證，不得以被測 core 當預期。獲得物品的 y8 係數起始值（95+30(Q−1)）沿用套裝前例，待任務 6 以原生合法基準校正。

任務 6 進行中（2026-10-23，僅本機）：新增 `scripts/verify-treasure-level-native.cjs`（calibrate 小分片）並擴充 driver 的 `single` 操作；於隱藏靜音隔離副本（兩次，皆乾淨停止、無殘留 game.exe）完成校正，**不計入首次證明**。原生觀察：
- 取得：`获得物品` 引數順序正確，物品等級參數可直接產生指定等級（Q6 達 35、Q3 為 5／7），單次即得目標品質；新取得列 y0=1、y2=1、y4=0、y7=0、y22=0，y8 等於傳入的特定主屬性（95+30(Q−1)），另有 y23=品質、y24=1（目前 core 資格尚未檢查這兩欄，首版維持保留不寫）。
- 升級：背包／未穿戴／穿戴三態 3→5 魂魄成本皆為 38，與 oracle 逐級加總相符；背包路徑經原生存入後 y0–49 無差異；穿戴態僅 y7 因本 driver 手動寫入互指而異（正式穿卸待 IO suite）；單次、最大升級與魂魄不足（升級停止、魂魄不變）皆與 oracle 相符，升級只改 y6。
- 分解：T1／T3／T6 返還 20／1,000／500,000，背包列清空，與固定表相符。
- 主屬性：`装备主属性` 對 attribute 17／12／13 × T1–T3 × 等級 1／5／10 × 係數 95／155 共 54 點與 oracle 百分比公式完全一致，確認該公式適用寶物；其餘 32 種屬性仍無靜態公式。
尚未做：原生穿戴／卸下／替換第 6 槽、搬移 y50–59 監看、原版存檔寫出與新 PID 讀回、批次分解、全矩陣與可行品質／範本覆蓋。

任務 6 IO 小分片（2026-10-23，僅本機；`scripts/verify-treasure-level-lifecycle.cjs`，隱藏靜音隔離副本，皆乾淨停止；不計入首次證明）：3 個案例（backpack-1-up、stored-6-down、equipped-1-up）完成編輯器編輯後的原版存檔寫出、停止、新 PID 重啟讀回（各 3 個 PID、4 項斷言全過）、原生穿戴／卸下往返與最終再存讀。觀察：
- 背包案：原生存入／穿戴實際落在 z9 列 2，不同於保留的 y0=1，驗證「不以 y0 當列號」；穿戴後 y7=1、第 6 槽指標指向目的列，卸下後指標清零、y7=0；y0–59 除 y7 外全等。
- 未穿戴 z9 案：先原生取出至 z7，再穿戴、卸下，欄位保存。
- **替換第 6 槽（新發現）：** 穿戴第二件寶物時，新件落在原 z9 列，y7=1、指標更新；被替換者回到 z7 但**保留舊 owner y7=1**（替換路徑不清除）。目前 core 要求背包寶物 owner=0，因此這種原生合法列會被拒絕（fail-closed）。是否放寬須在任務 9 前決定並補原生證明；在此之前此狀態維持唯讀，並須列入拒絕／缺口清單與規格。
- y0–49 搬移複製與 y50–59 監看、批次分解、卸下後 owner 與替換後再升級仍未覆蓋；完整 12 案生命週期未跑。

舊 owner 原生試驗（2026-10-23，`scripts/verify-treasure-level-owner-probe.cjs`，隱藏靜音隔離副本、乾淨停止；觀察用，不計入首次證明）：以兩件寶物原生穿戴、替換後，被換下者在 z7 保留 y7=1。後續原生操作：存入 z9（得到未穿戴但 y7=1 的 z9 列，指標不指向它）、取出（y7 仍為 1）、再穿戴覆蓋另一件（成功、新舊件 owner 皆維持 1、第 6 槽指向穿戴者）、對舊 owner 列分解（返還等階固定價 200、該列清空）；舊 owner 狀態寫出原版存檔並以新 PID 重啟後仍在。結論：遊戲不會重寫它、也不因它出錯，卸下才清為 0。
**決定：放寬資格（僅 y6 寫入不變）。** `src/core.js` 的寶物資格改為：owner 必須為 0 或有效角色；z9 允許「owner>0 但無任何角色指標指向」的舊 owner 未穿戴列，穿戴列仍須指標與 owner 唯一互指，z7 第 6 槽以外的指標、重複引用與無效角色仍拒絕。已加入合成測試（z7／z9 舊 owner 可改 y6 且 y7 保留、無效角色拒絕）。任務 9 須補舊 owner 的 z7／z9 原生生命週期案例（含升降後再存讀）後才能開閘；未補前不得視為已證明。

任務 6 完成（2026-10-23，僅本機；結果在 repo 外 `treasure-level-B`，皆隱藏靜音隔離副本、乾淨停止、玩家存檔未動）：
- **完整 16 案生命週期**（`verify-treasure-level-lifecycle.cjs --only all`）：12 案（背包／未穿戴 z9／穿戴 × Q1／Q6 × 升／降）＋ 4 個舊 owner 案（stale-backpack Q1 升、Q6 降；stale-stored Q1 降、Q6 升）全數通過；每案經 3 個 PID、4 項斷言（編輯後存檔載入、原版存檔寫出、停止、重啟讀回、原生穿卸往返、最終再存再讀），4 個穿戴案另做替換第 6 槽（被換下者回 z7 並保留舊 owner）。
- **y50–59 監看**（每列預先寫入 100–109 標記）：搬移只複製並清除 y0–49；y50–59 既不複製到目的列、也不從來源清除，目的列保留原本內容。與研究「搬移迴圈僅 y0–49」一致，已以原生觀察固定；編輯器只改 y6，不受影響。
- **原生取出**保留儲存 owner（含舊 owner）；只有卸下清為 0；穿戴後第 6 槽指標與 owner 唯一互指；背包案目的列與保留 y0 不同（不以 y0 為列號）。
- **批次分解**（`verify-treasure-level-batch.cjs`，8 件混合等階／品質／鎖定／舊 owner）：品質參數為「小於等於」上限，y22=1 的鎖定列保留，舊 owner 列照常分解；Q≤2 一次移除 4 件共 1,240、Q≤4 再移除 1 件 20，皆等於固定等階表加總，與 oracle `batchDecompose` 一致。
- 限制：這些結果以任務 4–5 當下的 core 產生編輯；最終 core 確定後須在任務 9 重跑（綁最終 core 雜湊的首次證明），目前不計入首次證明。未涵蓋：170 範本 × Q1–Q6 全矩陣的原生取得覆蓋、效果 oracle 的另外 32 種屬性、穿戴後效果對照。

任務 7 完成（2026-10-23，本機分支 wip/treasure-level-tasks-4-6）：
- 登記：`backpackTreasureLevel`／`treasureLevel` 以 false 加入 catalog 與 `extract-game.cjs` 的 verification（原位插入，不重排）；`verification-requirements.cjs` 新增 `treasureLevel` 區段（每群組獨立，六項原生檢查）；`verification-suite.cjs` 新增 `treasureLevel` family（`initialProofRequired`、oracle `verify-treasure-level.cjs`、lifecycle `verify-treasure-level-migration-lifecycle.cjs`）；`migration-analysis.cjs` 登記相依函式（含魂魄升級、分解、批量分解、獲得魂魄）與讀寫範圍（z7／z9 y0–59、角色第 16–21 欄）；`migration-proof.cjs` 加入規則摘要、`treasureInitialVerification` 的匯入／輸出／合併／檢查。操作白名單沿用 `setEquipmentLevel`，未新增入口。
- `scripts/treasure-level-proof.cjs`：binding（來源指紋、規則、AST 核心、oracle 摘要）、`initialProblem`（每群組固定分母：背包 4,080 級別案例／6 生命週期／72 分解／12 拒絕，穿戴庫 8,160／10／72 成本／24 拒絕，170 範本效果）、`validateMigrationCopy`、`problem`（建置閘門；`build-editor.cjs` 已呼叫）、`mergeProof`（舊式與複合證明皆只合併該群組、拒絕不完整紀錄／過期規則／未完成檢查／核心綁定不同）。**首次矩陣的完整驗證與記錄產生器屬任務 9**；代表遷移只重驗已有首次證明的群組，缺證明時 `verify-migration.cjs` 的 `needsInitial` 維持關閉。
- 代表情境：`treasure-level-migration-scenarios.cjs` 產生 7／9 兩庫各 2 件（T1 Q1 1→2、T6 Q6 35→34）；`verify-treasure-level.cjs` 唯讀原生主屬性觀察並與 oracle 比對（百分比屬性比公式，其餘只檢查有限值並記為 native-only）；`verify-treasure-level-migration-lifecycle.cjs` 原生穿卸往返、寫檔與新 PID 讀回比對。`verify-migration.cjs` 接上證據讀取、`provenChecks` 與 `buildProof`，`migration-scenarios.cjs` 登記兩個副本名。
- 驗證：於隱藏靜音隔離副本以實際 `runMigration` 流程跑兩個代表副本，各 6 項檢查（load／save／restart／originalHashes／nativeEffects／lifecycle）全過、無殘留 game.exe；**這是代表遷移驗證，不是首次證明，兩個旗標仍為 false**。過程發現新 lifecycle 腳本未登記為可新 PID 後比對，已補進 `comparable`，並加測試。
- 測試：新增 `tests/treasure-level-proof.test.cjs`（8 項）；`advanced-editing` 測試設定讓寶物兩庫維持關閉；`version-migration` 預期清單納入兩個代表副本與兩個關閉群組。全套 228 項，216 通過，失敗的仍是任務 4 造成的同 12 項既有證明綁定測試。
- 限制：`index.html`／`sw.js` 內嵌 catalog 尚未同步新增的兩個 false 旗標——`build-editor` 因套裝等級證明與 core 不符而拒絕建置，須待任務 9 重驗後一併重建。

任務 8 完成（2026-10-23，本機分支 wip/treasure-level-tasks-4-6）：
- 介面（`src/knowledge-ui.js`）：寶物沿用「裝備等級」編輯器，只開一般模式（進階核取方塊停用、不顯示進階上限）；顯示目前等級、一般上限、等階 T、品質 Q 與歸屬（無／#角色）；單獨的預覽行（`data-treasure-level-preview`）顯示「寶物等級 a → b，品質、詞條、歸屬與魂魄保持，不扣魂魄」，非法數字（空白、0、小數、負數、超過上限）停用套用並顯示 1–上限；無首次證明時顯示「寶物等級尚待首次獨立證明，目前停用」；不合格寶物顯示 core 的拒絕原因（超限、數量／等階／特殊狀態、歸屬與指標不一致）且不能套用。還原沿用既有逐格還原與復原。未新增經驗、魂魄扣款或進階入口。
- 單元測試 `tests/treasure-level-ui.test.cjs`（5 項）：以實際 knowledge-ui 處理器對 DOM 轉接器驗證停用／開放兩態、三種庫別（背包、未穿戴、穿戴）顯示、預覽與套用只改 y6、owner 與指標不變、復原、拒絕原因。
- 瀏覽器：`tests/browser/treasure-level.spec.cjs` 5 項全過（約 12 秒）——未證明停用且不寫入；1280／390px 的兩庫分離、預覽、超限停用、復原、無橫向溢位、精準位元組匯出與真實下載重載；直接 file 下載與逐格還原；PWA 離線匯出與新版待命交接。這些在 **拋棄式候選站**（`site.cjs` 的 `createSite({candidate})`：複製目前來源、只開指定旗標並移除證明閘門後建置）上跑，只證明瀏覽器行為，**不是首次證明**，也不改 repo 內任何旗標或 `index.html`。
- 限制：正式 `index.html`／`sw.js` 尚未含新介面（`build-editor` 因核心與套裝等級證明不符拒絕建置，待任務 9）。既有瀏覽器案例 22 項通過、3 項失敗，失敗的是用正式建置器的 `site.upgrade()` 的三個 PWA 升級案例（同一個證明阻擋），與本次介面無關。全套 node 測試 233 項，221 通過、同一批 12 項既有證明綁定失敗。

任務 9 完成（2026-10-23，本機分支 wip/treasure-level-tasks-4-6；原生證據在 repo 外 `H:/bandit-audit/selective-migration-20261023/treasure-level-B`）：
- 工具：`scripts/verify-treasure-level-matrix.cjs`（階段 baselines／levels／costs／decompose／rejects，可續跑、綁 15 指紋、規則、driver、manifest 與最終 core 的 AST 雜湊）、`scripts/treasure-level-evidence.cjs`（從原始觀察重新推導預期，不信任成功旗標）；`verify-treasure-level-lifecycle.cjs` 結果改綁核心／規則／runner／driver 雜湊。
- 執行（隱藏靜音隔離副本，結束後無殘留 game.exe）：原生取得 170 範本 × Q1–Q6 = 1,020 組，**零缺口**，全部 y3＝範本等階、y5＝品質、y2＝1、y4＝0、y7＝0、y22＝0、y23＝品質、y24＝1；等級矩陣 12,240 案（背包 4,080／穿戴庫 8,160）全過——每案由最終 core 編輯、與基準及 oracle 重算比對，升級案另與原生 `升级装备` 逐欄（y0–59；背包經搬移故 y0–49）及魂魄成本比對；成本 72、分解 72（單件／批次未鎖定／批次鎖定）原生全過；拒絕 36 由最終 core 全數拒絕；生命週期 16 案（含 4 個舊 owner）用最終 core 全過（各 3 PID、4 項斷言、原版存檔寫出與新 PID 讀回、穿戴替換第 6 槽）。
- 驗證器 `validate` 通過並產生 `initial-record.json`：背包 4,080／6／170 範本／72 分解／12 拒絕，穿戴庫 8,160／10／170／72 成本／24 拒絕，符合 `initialProblem` 固定分母；證據摘要 ec7f5d9d…3747c。
- 屬性覆蓋：70 種屬性成分中 38 種有靜態公式並與 oracle 逐值相符，**32 種（10、15、28–30、77–103）只做原生觀察（有限值）**，不宣稱有公式。
- 原生反證回寫：①副詞條函式沒有等級項（只有基底＋等階），主屬性才有；`装备属性计算` 的總值含副詞條與加總規則，不拿來和公式逐值比，改比函式層級成分。②任務 6 放寬舊 owner 後我沒有重跑全部 12 案，最終 core 全量重跑才發現穿戴態的「卸下」會清 owner，驗證器已區分（`worn`）並補測試。
- 既有群組重驗：遷移規劃（同來源、core 可執行語法改變）保守選出 19 個代表副本，於原生全過（`results.json`：completed、27 個群組全部檢查通過）。**寫回結果會把證明檔升為複合格式（schema 2），使 14 項依賴舊格式證明內容的既有測試改變前提（紅燈 12→26），這屬任務 10 的證明合併／驗收，因此已備份寫回產物並還原 repo 內五個檔案**，分支維持 12 項已知證明綁定紅燈。重新寫回可用 `--resume` 指向該次執行目錄。
- 尚未做：把寶物首次紀錄與既有遷移寫回合併進證明、重建 HTML／sw.js（目前 `build-editor` 仍因核心與套裝等級證明不符拒絕建置）、整體驗收與交付文件。新增 `tests/treasure-level-evidence.test.cjs`（5 項）；全套 238 項，226 通過、同一批 12 項既有證明綁定失敗。

任務 10 完成（2026-10-23，本機分支 wip/treasure-level-tasks-4-6，任務 10 的變更未提交）：
- 證明合併：先用 `verify-migration.cjs --resume` 從已完成的 19 個代表副本重做寫回（不重跑原生），證明檔升為複合格式（schema 2），既有 27 個群組沿用；再以新工具 `scripts/verify-treasure-level-suite.cjs --config EXTERNAL_CONFIG` 重新驗證全部原始原生結果（1,020 取得、12,240 等級、72 成本、72 分解、36 拒絕、16 生命週期）、逐群組合併 `treasureInitialVerification`、只開 `backpackTreasureLevel`／`treasureLevel` 兩旗標（原位修改 catalog）並建置；任何一步失敗逐位元組還原五個檔案。兩庫各自擁有首次紀錄，互不替代；缺紀錄、規則摘要過期、核心改動皆被建置閘門拒絕（見 `tests/treasure-level-proof.test.cjs`）。
- 既有測試：證明檔改為複合格式後，原先讀 repo 舊格式證明的測試改用凍結的舊版證明＋對應 core（`tests/fixtures/legacy-release/`、`tests/helpers/legacy-release.cjs`，覆蓋層關閉寶物兩庫）；真實複合證明另有針對性測試。寶物資料測試改為「兩庫已註冊且各有首次證明」。
- 驗收：`build-editor --check` 同步；Node 全套 238 項全過；瀏覽器 25 項全過（含 5 項寶物候選案例與三個正式建置器的 PWA 升級案例）；寶物介面單元 5 項。UI 與瀏覽器案例在候選站與正式站皆通過；候選站只用於驗證未證明狀態的停用。
- 範圍與缺口（如實）：只改 y6，不扣魂魄，不開放經驗；32 種屬性（10、15、28–30、77–103）只有原生觀察，無公式；寶物等級升降後的實際戰鬥效果只比對 `装备主属性` 函式層級成分，未做完整戰鬥模擬；沒有真實雲端、成就或長時間遊玩驗證。
- 發布（使用者於 2026-10-23 授權）：版本 v2.11、更新紀錄、推送、GitHub Pages 發布與 Wiki／公告同步，結果見提交與各頁面。
