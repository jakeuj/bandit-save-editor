# v2.4 背包裝備與首次選槽

驗證跨2026-10-21至2026-10-22，遊戲正式 V1.0.10.2、Steam build 26094666。安裝包與解包來源的完整13+2 SHA-256均與catalog相符；未切換V1.0.11.0測試分支。

## 狀態與開放範圍

背包三項操作、新取得標記與首次選槽均已有獨立隔離證明；2026-10-22補齊代表遊戲選槽UI及新PID讀回，`equipmentAffixInitialSelection`已開啟。桌面／390px、兩入口精確匯出讀回與本機PWA離線／版本交接均通過。正式部署證據另記於本文末尾。

## 新核對的來源與狀態

- `获得物品`普通分支 SID `166680919655131`：z7的y0為初始背包列號、y2=1、y7=0、y24=1。沿用y0正整數界內檢查，不與目前列號或全域唯一性綁定。
- `创建物品图标` SID `644557287879738`／expression2762讀y24，值1時建立物件「装备新获得标识」；`物品tips` SID `666416688115651`清零y24。這是新取得標記，不能繼續將1籠統視為飛升或未知特殊狀態。新功能接受0／1並保留，不幫使用者清除提示。
- `词条洗练` SID `564254928232839`同時改ID、係數及目標旗標。首次選槽的UI資格仍來自SID `196601779910507`、`775039415186059`；直接呼叫成功不等於選單資格通過。
- `装备库存入`／`装备库取出`搬移50欄保留y0；歸屬與角色指標由穿脫流程維護。z7同列號不受z9角色指標影響。`装备排序` SID `784672243649997`建立顯示排序索引，本版未直接重排save；不能把顯示排序寫成物理列號重編。

## 核心、交易及證明

裝備API增加`plane=9`，只接受7／9；位置參數查詢於最後傳庫別。背包限普通、數量1、歸屬0、等階1–9、品質1–6及原版等級；詞條限品質2–6並沿用v2.3合法池與取整公式。未知y25–27或錯誤結構阻擋，身份與還原群組採庫別＋目前列號。

首次預覽／套用增加`selectUnwashedSlot=false`。全未選槽時需明確true；已選槽再傳true拒絕。首次ID／係數不變仍需寫單一旗標，屬一筆交易；後續相同值無交易。還原整件裝備、逐步復原、失敗回滾及自訂座標限制均有測試。

`equipmentWorkflowLimits`由生成器維護，含來源SID、狀態、庫別及交易限制。獨立群組為`backpackEquipmentLevel`、`backpackEquipmentAffixCoefficient`、`backpackEquipmentAffixReplacement`、`equipmentNewItemMarker`及`equipmentAffixInitialSelection`。最後一組要求`selectionUi=true`才可開放，其他原生通過旗標不能代替它。建置比對完整15來源、限制及`SHA256(JSON.stringify({rules:equipmentWorkflowLimits,items:batch2Data.items,formulas:affixReplacement}))`；來源／資料／規則變動會撤銷對應候選閘門。

## 隔離遊戲驗證

沿用repo外遊戲／profile／存檔與原生Steam初始化，隔離啟動及重啟皆靜音；原始玩家檔案及來源目錄雜湊未變。所有測試副本程序已停止。原始scenario、state、log與玩家資料留repo外，公開只存去識別範圍。

| 案例 | 覆蓋與結果 |
| --- | --- |
| 背包係數＋替換 | 38候選×品質2–6×係數上下端，共380件；每件38項原生屬性與預覽比對通過 |
| 首次只鎖槽 | z7／z9、品質2–6全部合法槽、新取得標記0／1，共60件；保持ID／係數，僅選槽旗標寫入通過 |
| 首次三欄交易 | 另10件涵蓋z7／z9及品質2–6，ID、係數及旗標同筆修改，原生效果與存檔／新PID讀回通過 |
| 背包升降級 | 品質1–6、等階1／9、原版上限升級與降至1，共12件通過 |
| 五組持久化 | 84／86／90／94／98件，各自載入→原版存檔→停止→新PID載入、原文與效果核對通過 |
| 後續洗練 | 品質6共96次原生同槽洗練，各扣100魂魄，其他有效負載及旗標不變 |
| 原生穿脫與排序 | 實際背包穿戴→核對38項裝備效果→卸下返回新列；y0及有效負載保留。顯示排序不改記錄，再次存檔／新PID重啟通過 |

另驗證原生搬移返回的新背包列號可再次透過本版公開候選閘門修改等級、係數50.02及詞條50.03，再完成原版存檔／停止／新PID讀回。

另以相同列號250、相同初始y0=400的z7／z9兩件裝備分別修改不同詞條，原生效果及存檔／新PID讀回通過；oracle結果也以庫別＋列號配對，避免驗證工具本身串用記錄。總計464件矩陣案例，加一件搬移後再編輯。

單件原生oracle讀取目標庫別；z9另與隔離角色裝備公式核對，z7不假裝已穿戴。背包實際穿戴效果由生命週期工具另外驗證。等級案例核對持久化與有限原生結果，不擴大為完整角色面板證明。

## 測試與待驗收

目前64項合成／UI事件／PWA測試與Git index原始bytes建置同步通過。合成測試涵蓋非法庫別、z7／z9同列號、重複y0、數量與歸屬、特殊狀態、首次純鎖槽／三欄交易、多旗標、重複詞條、精度、超限、跨操作還原及原文保留。介面測試直接執行實際事件處理，核對首次確認、套用後清除、位置篩選與獨立閘門；它是DOM adapter測試，並非真實瀏覽器、手機或遊戲畫面。

先前兩個畫面工具曾因kernel assets路徑錯誤無法初始化；2026-10-22重試已恢復。下列為恢復後取得的新證據。

## 2026-10-22 遊戲與編輯器 UI 驗收

Windows原生隔離遊戲以2560×1440畫面、靜音及原生Steam初始化驗證。載入與存檔使用原生函式／IO；洗練操作使用實際滑鼠UI。入口為「世界 → 萬魂塔 → 地區 → 紫色洗練圖示 → 詞條洗練」，頁面有背包與角色穿戴兩個入口。不要在鍛造或物品鎖定按鈕尋找洗練。

- 品質3背包普通裝備未選槽時，兩個既有槽皆顯示100魂魄；首次洗練槽1後，槽2顯示「不可洗練」，僅槽1的ID、係數及旗標改變。
- 另一件由編輯器預先選定槽2的裝備，在原版UI中槽1停用、槽2可洗練。點擊停用槽不改任何裝備值、不扣魂魄；再次洗練槽2成功，槽1及選槽旗標保持原樣。
- 兩次有效UI洗練各扣100魂魄；畫面分別顯示技能傷害3.76%及小怪增傷2.75%，與實際隨機係數核對。UI用來證明資格與顯示，完整品質／槽位範圍仍由上表70件首次選槽矩陣證明。
- 後續原版存檔、停止PID42132、新PID30412讀回，240個裝備欄位與原版寫檔一致；15來源與原始存檔雜湊未變。測試程序均已停止。這不是另一次UI點擊存檔或UI讀檔的證明。
- 選物品時額外點過背包鎖定標記，僅改該件y22；生命週期核對將它單獨記錄，不將這項UI動作混稱編輯器寫入。

編輯器以IAB桌面及390px驗證背包／裝備庫篩選、名稱搜尋、效果預覽、未勾選確認時停用、切換目標清除確認、首次純鎖槽及ID／係數／旗標三欄交易。逐步復原可回到未選槽；任一欄位還原會復原整件裝備；讀回後只提供已選槽且隱藏首次確認。390px無頁面橫向溢出。

實際下載的五份檔案涵蓋桌面主入口、桌面預覽入口、背包首次三欄交易、390px預覽入口與390px主入口。全檔與核心序列化結果逐字相符，BOM、CRLF、大型整數literal均保留；已匯出後換檔沒有誤提示。再次修改則產生真正未匯出確認；取消後原檔名及修改值保留。

IAB的確認框曾阻塞dialog API及後續命令；改以原生Windows工具辨識Codex的同一確認框，按「取消」後恢復。未移除保護、未接受其他對話框。桌面與手機截圖、下載檔、遊戲state及原始雜湊均留repo外。

## 2026-10-22 本機 PWA 驗收

本機HTTP在IAB與Edge均被AdGuard改寫CSP並注入`local.adguard.org`腳本。候選原檔與瀏覽器收到的HTML雜湊不同，Worker拒絕安裝並顯示「離線準備失敗」符合完整性保護；更換壓縮及loopback位址仍相同。經使用者授權，由使用者加入僅限驗收網址的文件例外後恢復正常，沒有放寬CSP或跳過雜湊。測完已請求移除，使用者明確決定保留該本機規則；它不屬於專案必要設定。瀏覽器離線模擬已還原。

以同一來源提供Git bytes的v2.3（`d6c2e39`），確認Worker控制頁面後，載入合成檔並將z9裝備等級3改為4，保持未匯出。伺服器切換v2.4（`7e661f3`的相同資產）並執行瀏覽器標準registration.update()：新Worker停在installed／waiting，舊頁仍為v2.3，保留1筆變更並顯示新版備妥；匯出後關閉全部同源頁籤，再開即為v2.4及「可離線使用」。沒有強制skipWaiting或修改快取。

將瀏覽器設為離線後重載，確認navigator.onLine=false且Worker控制頁面，v2.4正常可用。讀取本機合成檔、預覽並確認背包第1件槽2的首次三欄交易（普攻傷害、50.03），實際下載並重新選檔：只提供槽2、值及效果2.75%正確、相同值顯示無變更。下載檔與先前線上同操作逐字一致，SHA-256為`d317e81b0f4b9b0759dd71cbd7dfe3a34a6d6b47c7fb97921429712f7b271ab5`，BOM／CRLF／大型整數原文保留。交接及離線截圖留repo外。

直接file://仍依工具政策維持待人工，不能以PWA結果替代。

## v2.4 正式發布驗證

2026-10-22（台灣時間）[PR #1](https://github.com/jakeuj/bandit-save-editor/pull/1)已合併，發布提交為`aec00a8bf800ef34583bd969d3c852c040ce4c43`，[Pages run 39642878678](https://github.com/jakeuj/bandit-save-editor/actions/runs/39642878678)的build／deploy均成功。CI重新執行64項測試與建置同步通過。

- [正式站](https://bandit.jakeuj.com/)首頁、index.html、Worker、Manifest、5個PWA圖示、Mac指南、sitemap、robots、分享圖及準備工具，共14個網址皆HTTP 200且bytes與上述提交Git blob相同；Pages CNAME、HTTPS與repo網站連結一致。
- 原正式v2.3分頁確實觀察到「可離線使用 · 新版已備妥，關閉所有帳房視窗後更新」，active仍activated、新版waiting為installed。關閉該站所有測試分頁後重新開啟，側欄顯示v2.4 · 2026.10.22，PWA為「可離線使用」。未清快取、未強制啟用Worker。
- 正式站斷網重載仍受Worker控制；合成檔完成背包槽2首次三欄交易、預覽視窗匯出及重新讀取。讀回只允許槽2、普攻傷害係數50.03／效果2.75%，下載SHA-256同上列`d317e81b…`，與本機及線上預期逐字相符。驗收後網路已還原。
- 正式欄位圖鑑標籤及摘要均顯示V1.0.10.2；瀏覽器未記錄error／warn。正式版本、更新等待、桌面／390px與遊戲UI截圖均保留repo外，沒有提交真實存檔或遊戲payload。

本次PWA證據為IAB瀏覽器Worker離線與關閉重開交接，不宣稱另完成Windows獨立安裝視窗或其他瀏覽器全套驗收。直接file://新功能仍待人工。

## 實作摘要（2026-10-24，v2.14 背包普通裝備等級超限）

依[輕量開發流程](../maintenance/lightweight.md)實作，不建 SDD。

**欄位與入口**：只寫背包 `[i,6,7]`，沿用 `editingInfo`／`setEquipmentLevel({plane:7,advanced:true})`。`editingInfo` 原本把 z7 的 `advancedVerified` 寫死為 false，改成與 z9 同樣讀 `群組+'Advanced'`，即新旗標 `backpackEquipmentLevelAdvanced`（登記在 `equipmentWorkflow` family）。上限沿用 `editingLimits.equipment.max=1000`，升級公式有限性檢查與 z9 相同；z7 等階 1–9、品質 1–6 在 1000 時兩條成本公式都有限。

**拒絕條件**：背包結構檢查（數量 1、歸屬 0、普通／非套裝、slot≤4、等階與範本一致、y24–27、詞條槽範圍）照舊；改過詞條係數或 ID 的裝備不能升到一般上限以上；超限背包裝備的詞條、品質與批次升滿維持停用（`ordinaryEquipment` 預設仍擋超限，批次顯示「不會自動降級」）。旗標開啟時，`setEditingValue` 對 z7 呼叫 `ordinaryEquipment(..., overLimitLevel=true)`，讓已超限的背包列（例如原生從裝備庫取出的）也能調低或再調高；旗標關閉時行為與 v2.4 相同（UI 顯示「背包僅一般模式」，超限列唯讀）。

**原生行為（靜態）**：`升级最大装备` SID `290240793057956` 是「等級 < `装备等级上限` 才 +1」的迴圈，超限件不會被拉回上限；`升级装备` 同樣只在上限內升級。

**合成測試**：`tests/backpack-equipment-level-advanced.test.cjs`（旗標獨立於 z9、上限+1／1000／1001 與非整數、只改 y6 與 undo／restore、已超限列調低再調高、結構拒絕、詞條已改不能超限、T9Q6 在 1000、批次不降級、自訂座標不可繞過）；`equipment-workflow`／`equipment-ui` 舊測試改為在旗標關閉時驗證原行為。

**隔離遊戲冒煙（2026-10-24，V1.0.11.2 完整快取，通過）**：基準存檔同 v2.13（SHA-256 `ebb0a4a2…`）。`verify-game.cjs` 以目前 core 把背包 #3 鐮刀（T1 Q1）1→1000、#6 礦鍬（T1 Q1）1→11；雲存檔載入、原版存檔、停止、新 PID 讀回一致。接著 `verify-native-lifecycle.cjs` 的 `backpackOverLimit`：#3 原生存入裝備庫，上限下對照（9→10）會升級扣費，1000 時 `升级装备`／`升级最大装备` 不改等級、不扣貨幣魂魄，取出回背包 50 欄不變；#6 由背包直接穿上角色 1，主屬性有限且等於 `装备主属性`，卸下回背包除 y7 外不變。再存檔、新 PID 讀回一致；最終原版存檔以修改器讀回，搬移後的新列號可降回 10、再升 1000、拒絕 1001。結果檔留在 repo 外，雜湊記於 `verification.json` 的 `lightweight`。

**工具教訓**：`穿戴装备` 後要等一拍（500 ms）再讀角色指標，同一次 evaluate 內讀到的是空列（y0=0）；`装备库存入`／`装备库取出` 則可在同一次呼叫後立即以 50 欄內容定位新列。

## 實作摘要（2026-10-27，v2.35 武庫裝備編輯）

依[輕量開發流程](../maintenance/lightweight.md)實作，不建 SDD。

**欄位與入口**：V1.0.13.0 的 `仓库存入`／`仓库取出` 在 z7 與 z22 間整列複製 y0–49，換裝模式（`[37,1,0]=1`）的穿卸也只改 y7，所以武庫列直接套背包的資格檢查與群組。core 加 `equipmentPlane`（7、9、22，且存檔要有 z22）、`backpackLike`（7 或 22）、`planeName`、`planeVerified`（群組開啟，且 z22 另需 `armoryEquipment`），原本各處 `plane===7` 的判斷改用它們；沒有新增具名入口，既有入口 `setEquipmentLevel`、`setEquipmentAffixCoefficient`(`Advanced`)、`setEquipmentAffix`、`setEquipmentQuality`、`setEquipmentSixthAffix`、`setInnerPillLevel`、套裝品質候選與批次 `equipmentMax` 都接受 `plane:22`。這和 v2.14 一樣改在樞紐內，另寫入口會複製整套背包檢查。UI 的位置選單與批次庫別加「武庫」，標籤用 `planeName`。

**拒絕條件**：與背包相同（數量 1、歸屬 0、普通／非套裝、y24–27、詞條槽範圍、超限詞條與第六槽的互斥）；22 層存檔傳 22 時拒絕；`armoryEquipment` 關閉時所有資訊入口照常回報但 `verified=false`，寫入一律拒絕。欄位圖鑑、舊 `set` 與自訂座標仍唯讀。套裝等級的跨池接受判斷對 z22 讀 `setEquipmentLevelCrossPool`（z9），因為那幾行被 `scripts/set-equipment-quality-equivalence.cjs` 逐字固定；兩個跨池群組目前都開著，所以結果相同。

**旗標**：`armoryEquipment`（`extract-game.cjs` 預設 false，`equipmentWorkflow` 欄位限制或裝備資料變更時與背包群組一起關閉），登記在 `verification-requirements.cjs`／`verification-suite.cjs` 的 `equipmentWorkflow`。

**合成測試**：`tests/armory-equipment.test.cjs`（旗標登記；關閉時十種寫入全部拒絕而背包照常；開啟時每種寫入只改目標 token、標籤為武庫、undo／restore 回原 bytes；套裝品質候選走背包群組；歸屬與特殊狀態拒絕與 z7 一致；清單與批次只在 23 層時含武庫）。瀏覽器 `tests/browser/armory-equipment.spec.cjs`（1280／390px 選武庫、套用、下載逐字比對、重讀再調；旗標關閉時按鈕停用）。

**隔離遊戲冒煙（2026-10-27，Mac Apple M4 Max、CrossOver 正式分支 V1.0.14.0，通過）**：基準沿用 v2.34 遊戲寫出的 23 層存檔（SHA-256 `fbdb5677…`）。`verify-game.cjs` 以候選 catalog（只開 `armoryEquipment`）把武庫 #1 鐮刀（T1 Q1 Lv1000）降到 10、#2 礦鍬（T1 Q1 Lv11）降到 5 再升品質 2（主係數 100→130、槽 1 暴擊幾率 25.5）；雲存檔載入、原版存檔、新 PID 讀回一致。`verify-native-lifecycle.cjs armoryEdited`：兩列 `仓库取出` 到背包再 `仓库存入` 回武庫，50 欄不變；換裝模式下角色 2 以 `穿戴装备(…,22)` 從武庫穿上 #2，除 y7 外 50 欄不變，`装备属性计算` 穿刺攻擊 14／採礦力 11／敏捷 0.46 等於 `装备主属性` 與修改器的品質預覽；`卸下装备(…,22)` 回武庫整列不變，原穿戴的柴斧依換裝模式進武庫。第二輪原版存檔、新 PID 讀回一致（3 個 PID、4 次 assert）。修改器重讀遊戲寫出檔逐字元往返，兩列仍可編輯、Lv16 超出一般上限被拒。腳本與結果在 repo 外 `armory-equipment-20261027/`。

## 實作摘要（2026-11-02，v2.39 備用套裝裝備編輯）

依[輕量開發流程](../maintenance/lightweight.md)實作，不建 SDD。使用者決定：裝備類全開、內丹除外；資質相關操作維持拒絕；旗標 `backupSetEquipment`，family `equipmentWorkflow`。

**欄位與入口**：V1.0.17.0 的 `角色换装` 只交換 z2 y16–21 與 z23 y1–6 的 z9 列號（z23 y0 記目前套裝），收起的列內容不變、owner 仍指向角色，交換後呼叫 `刷新单角色全属性`；屬性計算不讀 z23。所以收起的列和穿戴中的列一樣編輯，沒有新具名入口。core 加 `backupSetReferences(m,itemId,owner,slot)`：一般裝備（`editingInfo`，等級、詞條係數與超限、精準洗練、品質、第六槽都經過它）、`setEquipmentLevelInfo`、`setEquipmentQualityCandidateInfo`、`treasureLevelInfo` 在 z9 找不到穿戴參照時呼叫它，旗標開啟就算一筆參照，之後的雙向指標檢查照舊。UI 的裝備選單把這種列標成「備用套裝・角色名」（`knowledge-ui.js` 的 `storedInBackupSet`）。

**拒絕條件**：旗標關閉時照 v2.37 拒絕（「請先在遊戲換回這套」）；owner 不是有效角色、同一列在 z23 出現多次、存放部位與裝備部位不符時拒絕（「備用套裝指標與裝備部位不一致」）；內丹等級（`innerPillLevelInfo`）不論旗標都拒絕，換回時內丹入體的行為沒有核對；`aptitudeNeutralEquipment`、`characterAptitudeSource` 遇到備用套裝裝備仍拒絕資質相關操作。z23 欄位、舊 `set` 與自訂座標仍唯讀。

**旗標**：`backupSetEquipment`（`extract-game.cjs` 預設 false，與武庫一樣在 `equipmentWorkflow` 欄位限制或裝備資料變更時關閉），登記在 `verification-requirements.cjs`／`verification-suite.cjs` 的 `equipmentWorkflow`。

**合成測試**：`tests/backup-set.test.cjs`（旗標登記；關閉時照舊拒絕；開啟時一般裝備等級只寫 `[1,6,9]`、群組 `editing:equipment:9:1`，寶物等級可改，undo／restoreAll 回原 bytes，z23 仍唯讀；開啟時內丹、資質操作與部位不符仍拒絕；模擬 `角色换装` 換回後讀到修改後等級）。

**隔離遊戲冒煙（2026-11-02，Mac Apple M4 Max、CrossOver 正式分支 V1.0.17.0，通過）**：基準為 v2.38 冒煙遊戲寫出的 24 層存檔（SHA-256 `a03d3a3b…`，角色 2 在套裝 1，原套裝 0 的 7,12,14,13,41,0 收在 z23）。`verify-game.cjs` 以候選 catalog（只開 `backupSetEquipment`）把收起的 #7 柴斧（T1 Q1）等級 10→5，雲存檔載入、原版存檔、新 PID 讀回一致。`verify-native-lifecycle.cjs outfitSwap`（`item: {id: 7, level: 5, from: 10}`）原生 `角色换装(2,0,…)`：z23 y0 1→0、z2 y16–21 變回 7,12,14,13,41,0；#7 穿戴後 y6=5、y7=2，`装备属性计算` 伐木力 9 等於 Lv5 的 `装备主属性`（Lv10 為 14），物理攻擊 43、力量 2.91 不小於柴斧本身的主屬性。第二輪原版存檔、新 PID 讀回一致（3 個 PID、4 次 assert），結束後沒有殘留程序；修改器重讀遊戲寫出檔（`17e7b0c9…`）逐字元往返，#7 已穿戴、Lv16 超出一般上限被拒。腳本與結果在 repo 外 `backup-set-edit-20261102/`。

## 實作摘要（2026-11-02，v2.40 備用套裝內丹與資質）

依[輕量開發流程](../maintenance/lightweight.md)實作，不建 SDD。使用者決定：內丹等級開放；資質相關操作兩套都檢查；旗標 `backupSetInnerPillLevel`、`backupSetAptitude`，family `equipmentWorkflow`。

**靜態核對（V1.0.17.0）**：會讀 z23 的只有 `角色换装`、`卸下装备备用套`、`角色重生`／`角色解雇`（先卸下）與顯示用的 `刷新底部菜单`／tips。`角色换装` 只交換指標後呼叫 `刷新底部菜单`、`刷新单角色全属性`；`内丹入体存入` 只在 `渡劫结束` 成功分支讀 z2 y20，`渡劫结束` 與 `属性计算` 都不讀 z23。資質 A＝`属性计算(104–106)`＝基礎＋天賦＋入體內丹＋穿戴裝備，收起的那套不算；本版內丹、裝備、詞條池與套裝效果都沒有 104–106，所以換裝不改 A。

**欄位與入口**：沒有新具名入口。`backupSetReferences` 多一個旗標參數；`innerPillLevelInfo` 在 z9 找不到穿戴參照時以 `backupSetInnerPillLevel` 呼叫它（部位須為 5），回傳 `stored:true`、`worn:false`，寫入仍是 `setInnerPillLevel` 的 `[id,6,9]` 與群組 `inner-pill:9:id`。資質端加 `backupSetAptitudeRows(m,c)`：旗標開啟時回傳 z23 y1–6 的 `[部位,列號]`，`aptitudeNeutralEquipment`（結丹路徑）與 `characterAptitudeSource` 的一般路徑把它們接在穿戴欄後面做同一套檢查。UI 內丹資訊標「備用套裝」（`knowledge-ui.js`）。

**拒絕條件**：旗標關閉時照 v2.39 拒絕；內丹存放部位不是 5、owner 不是有效角色或同列重複時拒絕（「備用套裝指標與裝備部位不一致」）；備用套裝列號越界、同一件同時在穿戴與備用套裝時拒絕；收起的那套有 104–106 時結丹路徑拒絕，有寶物／內丹／套裝時一般路徑拒絕（與穿戴相同）。一般路徑的收起列經 `ordinaryEquipment`→`editingInfo` 驗證，所以 `backupSetEquipment` 關閉時會回「請先在遊戲換回這套」；兩旗標在 `equipmentWorkflow` 欄位限制或裝備資料變更時一起關閉。z23 欄位、舊 `set` 與自訂座標仍唯讀。

**合成測試**：`tests/backup-set.test.cjs` 加三案（內丹旗標：只寫 y6、undo 回原 bytes、不需裝備旗標、部位不符拒絕；資質旗標：收起與穿戴兩種存檔的 `pillInfo` 上限相同、一般路徑錯誤訊息相同；收起列帶 104 與穿戴／收起重複時拒絕）；`tests/version-migration.test.cjs` 的 `outfitSwap` 模擬加 item 清單、`内丹破镜值` 與 aptitudes 的通過及拒絕。

**隔離遊戲冒煙（2026-11-02，Mac Apple M4 Max、CrossOver 正式分支 V1.0.17.0，通過）**：基準同 v2.39（`a03d3a3b…`，角色 2 範本 0、Q1、未結丹，原套裝 0 的 7,12,14,13,41,0 收在 z23）。`verify-game.cjs` 以候選 catalog（只開兩個新旗標）把收起的 #41 蠻力內丹（T2 Q2）等級 8→3、角色 2 力量丹藥增量（#59）0→12，修改器預測三項資質 4.4／3／3.3；雲存檔載入、原版存檔、新 PID 讀回一致。`verify-native-lifecycle.cjs outfitSwap`（`item: [{id: 41, level: 3, from: 8}]`、`aptitudes` 三項）原生 `角色换装(2,0,…)`：#41 回到 y20，y6=3、y7=2，`装备属性计算` 力量 2.76 不小於 Lv3 的 `装备主属性` 1.14（Lv8 為 1.34），`内丹破镜值` 7.74 符合公式；換裝前後 `角色资质计算` 都是 4.4／3／3.3。第二輪原版存檔、新 PID 讀回一致（3 個 PID、4 次 assert），結束後沒有殘留程序；修改器重讀遊戲寫出檔（`3bd3b2a8…`）逐字元往返，#41 為穿戴中 Lv3、Lv16 超出上限被拒，三項資質仍為 4.4／3／3.3。腳本與結果在 repo 外 `backup-set-pill-aptitude-20261102/`。
