# 普通裝備、詞條與丹藥維護

[維護索引](../maintenance.md)；只讀本次任務相關章節。版本與日期標示的實測紀錄只證明當時範圍，現行開放狀態以 catalog／verification 為準（輕量群組見 `knowledge/verification.json` 的 `lightweight`）。

## 第二批研究入口

裝備品質、詞條與丹藥資質增量的來源、候選範圍、限制及隔離遊戲驗證矩陣集中於[第二批研究](../research/advanced-editing-batch2.md)，工作狀態見[提案與任務](../../sdd/advanced-editing-batch2/tasks.md)。v2.2 已開放通過獨立隔離實測的既有詞條係數及丹藥增量；v2.2 的品質、詞條 ID 與超限維持唯讀；v2.3 的詞條替換另依獨立證明開放，不沿用 v2.1 裝備等級的證明或進階值域。所用新資料表須先納入來源覆蓋，品質／詞條的整件裝備交易與復原也須另驗證。

PWA 雜湊異常時，先比較實際 HTTP 回應與提交的 Git blob。本機 AdGuard 曾改寫首頁並注入 CSP／腳本，Worker 因內容不符而拒絕快取是預期行為；不要放寬 CSP 或略過指紋比對。BOM 保留則須在瀏覽器讀檔入口驗收，除了核心序列化測試，也要逐字核對真正下載的匯出檔。

## v2.2 核心與驗證入口

- `affixInfo(model,itemId,slot)`／`setEquipmentAffixCoefficient(model,{itemId,slot,coefficient})`：z9、已選洗練槽，1-based槽號，最多兩位小數。只改係數；與同件裝備等級共用還原群組，已修改係數時禁止再設超限等級。
- `pillInfo(model,characterId,aptitude,pillId)`／`setPillAptitudeBonus(model,{characterId,aptitude,pillId,bonus})`：aptitude1–3為力量／敏捷／智力，bonus為非負整數累積值，每1代表0.1點。pillId必須已持有且類型相符，作為上限依據，不扣材料。兩API的advanced只接受false。
- 範本0的隨機角色以存檔基礎及天賦為準；有名角色才要求js範本一致。完整穿戴及無結丹引用需重新檢查；既有小數增量先維持唯讀。細節與SID集中在第二批研究，不複製至技能。
- 生成器增加 `batch2Data`／`batch2Limits`／`batch2Fingerprints`。保留歷史13來源，第二批另涵蓋yx與tz；建置核對補充指紋、限制及資料SHA-256。擴充來源不能只更新catalog而沿用舊證明。
- `scripts/verify-game.cjs --scenario` 現在接受兩個新增具名操作；仍只在隔離VM啟用候選旗標，啟動前與assert核對13+2來源。`node scripts/verify-batch2.cjs --state /outside/state.json` 記錄原版三項資質及115項裝備效果，重啟後加 `--compare`。原生卸穿、洗練、服藥與重生另記後續證據；裝備格取wp資料，不可假設1。

重生呼叫僅驗證清除生命週期，不代替遊戲UI資格驗收；原生服藥可能產生小數增量，其後編輯停用是本版限制。來源檔、真實存檔與原始呼叫結果保持repo外。詳細已通過範圍及UI待辦見[第二批實作紀錄](../research/advanced-editing-batch2.md#v22-實作與隔離驗證)。

## v2.3 精準洗練維護

- `equipmentAffixReplacementInfo(model,{itemId,slot})` 回傳範本合法池、目前值、限制、逐候選可用狀態及停用原因。
- `previewEquipmentAffixReplacement(model,{itemId,slot,attributeId,coefficient})` 唯讀驗證並預覽單件效果，含主屬性與其他槽對同一 ID 的貢獻；不推算角色面板。
- `setEquipmentAffix(model,{itemId,slot,attributeId,coefficient,advanced=false})` 重跑完整檢查，原子修改 ID 與係數。與等級及既有係數共用整件還原群組；拒絕超限、新重複、非唯一選槽及不一致穿戴。自訂座標仍不可改這些欄位。
- `affixReplacement` 儲存公式來源 SID、參數及單位；`affixReplacementLimits` 儲存範圍。`equipmentAffixReplacement` 是獨立驗證群組，建置核對 13+2 來源、限制及 `SHA256(JSON.stringify({rules:catalog.affixReplacement,items:catalog.batch2Data.items}))`。不得沿用係數群組的證明。
- z9 y0 是初始背包列號，原生搬移保留它，可與目前列號不同、也可能重複。有效性檢查使用正值且在陣列界內，加上範本、品質、選槽與穿戴雙向指標；不要回復錯誤的 y0 等於當前列限制，也不可自動重編 y0。
- `scripts/verify-game.cjs --scenario` 接受 `setEquipmentAffix`。`node scripts/verify-affixes.cjs --state /outside/state.json --scenario /outside/scenario.json` 比對原生單件效果及隔離角色裝備效果；重啟後使用 `--compare`。`node scripts/verify-affix-lifecycle.cjs --state /outside/state.json --scenario /outside/scenario.json` 驗證卸穿與同槽洗練，更新隔離 state 的後續預期，再完成原版存檔／停止／新程序讀回。只對 repo 外副本操作。

副詞條在原生公式內強制 L=0，主屬性保留等級；各槽分別取整再加總。主屬性重疊時 y8 須為原版區間安全整數。詳細公式、SID、380 組原生比對與後續 76 次洗練以[研究記錄](../research/precise-affix-editing.md)為準。不得以原生函式回傳值宣稱角色 UI 即時快取也已驗收。

v2.3 已以功能提交 `a912466` 通過 [Pages 正式發布驗證](../research/precise-affix-editing.md#v23-正式發布驗證)：50 項測試、Git index bytes 建置檢查、正式資產比對及 PWA 關閉重開／斷網兩入口匯出／讀回。直接 file:// 新功能保持待人工驗收；後續版本仍須核對自己的完整 SHA。

## v2.4 裝備操作

裝備具名操作的options增加`plane=9`；`editingInfo(model,kind,id,plane=9)`及`affixInfo(model,itemId,slot,plane=9)`於最後傳庫別。只接受7／9；省略保持z9相容。背包沒有進階模式，新增的普通範圍與新取得標記規則有獨立證明。

候選資訊增加`selectedSlot`、`selectableSlots`與`requiresInitialSelection`；預覽／套用增加`selectUnwashedSlot=false`，預覽回傳`selectionChange`。未選槽須明確true，已選槽再傳true拒絕。群組`editing:equipment:庫別:列號`避免同列號不同庫互相還原。旗標、詞條、係數為同一交易；首次純鎖槽不是無變更。

`knowledge/verification.json`的equipmentWorkflow核對完整15來源、規則與資料雜湊及逐群組checks；初次選槽另要求selectionUi=true。生成器來源或規則變動會撤銷新群組旗標。不要因原生矩陣通過手動打開欠缺UI證據的首次選槽。

`node scripts/verify-affixes.cjs --state /outside/state.json --scenario /outside/scenario.json`現在依options.plane讀取目標，z9才做穿戴公式比對。`node scripts/verify-equipment-workflow.cjs --state /outside/state.json --scenario /outside/scenario.json`驗證原生洗練、穿脫及排序並更新後續expected；再完成原版save／assert／stop／restart／load／assert後用`--compare`核對。原始狀態留repo外。

本版實際已通過範圍及發布狀態以[研究紀錄](../research/equipment-workflow.md)及SDD任務為準。2026-10-22補齊遊戲選槽UI、桌面／390px、精確下載及PWA離線／版本交接證據；首次選槽的負向建置測試須明確將`selectionUi`設為false，不能依賴證明當時尚未通過的預設值。PWA受內容過濾器改寫時保留完整性檢查；使用者同意的測試網址例外須記錄範圍與測後還原或保留決定，不將例外當成網站安裝必要條件。更新交接先保留舊版未匯出變更，確認新版waiting不重載，再匯出、關閉全部同源視窗並重開核對版本；離線模擬完成後還原網路。

## v2.5 品質升降維護

`equipmentQualityInfo(model,{itemId,plane=9})`回傳完整普通裝備檢查、目前結構、六個目標的阻擋原因與驗證狀態。`previewEquipmentQualityChange(model,{itemId,plane=9,quality,addedAffixes=[]})`唯讀回傳欄位、增刪槽及54項單件效果。新增槽為`{slot,attributeId,coefficient}`；目標升品須完整連續尾槽。`setEquipmentQuality`接受相同參數及`confirmRemovedAffixes=false,advanced=false`，重跑所有檢查，降品須明確確認，與其他裝備操作共用`editing:equipment:庫別:列號`原子還原群組。自訂座標維持唯讀。

`scripts/equipment-quality-data.cjs`由原版資料建立243範本、主屬性設定、單位、公式與規則，與舊batch2資料分開。四個庫別／方向群組各需自己的load、save、restart、originalHashes、nativeEffects、lifecycle、qualityUi。建置核對完整15來源及`SHA256(JSON.stringify({quality:catalog.equipmentQuality,items:catalog.batch2Data.items,workflow:catalog.equipmentWorkflowLimits}))`，另核對核心`qualityAttributeEffect`函式原文（CRLF轉LF）的公式SHA-256。來源／規則／公式變動使證明失效，不複製v2.4旗標。

以下產生repo外合成候選，不接觸玩家原檔：

```sh
node scripts/prepare-quality-cases.cjs --output /existing/external/directory
node scripts/verify-game.cjs --setup --source /unpacked/game --runtime /installed/game.exe --save-file /original.dat --artifacts /external/directory --scenario /external/quality-7-Upgrade.json
node scripts/verify-game.cjs --state /external/state.json --load --mode 云存档
node scripts/verify-quality.cjs --state /external/state.json --scenario /external/quality-7-Upgrade.json
node scripts/verify-quality.cjs --state /external/state.json --scenario /external/quality-7-Upgrade.json --formulas
```

各庫／方向分開建立隔離副本，先完成原版save／assert／stop／restart／load（mode存档）／assert，再用`verify-quality --compare`比對。`verify-quality-lifecycle.cjs --state ... --scenario ...`執行原生洗練、精確成本、穿脫搬移／排序並建立經獨立核對的後續expected；再次完成原版IO與新PID，最後加`--compare`讀回。大型觀察陣列可使用`verify-game --quiet`保留PASS與錯誤而不輸出全陣列。原生`装备库取出`第三參數從0開始，否則漏搬y0。

公式測試涵蓋243範本及38候選，不把「可計算」當作「已原生比對」。完整6,592組、800件品質寫入、後續行為及代表UI證據見[品質研究](../research/equipment-quality.md)，工具原始產物留repo外。UI操作後先核對只有允許的洗練變更與y24提示副作用，才採納後續IO基準。桌面、390px、兩入口下載及PWA離線／等待交接另驗收，直接file://維持獨立狀態。

正式v2.5已經PR #2合併及相符SHA Pages部署、Git blob資產比對與Edge版本／離線驗證。IAB遇到關閉後仍waiting時，先核對所有已知同源分頁與快取雜湊，保留實際差異；本次改用既有v2.4的Edge正常關閉重開完成交接，沒有清快取或強制啟用。不同瀏覽器的結果分別記錄，避免把一個環境成功寫成全部成功。Edge選檔若欠缺擴充檔案權限，保留限制，不為例行驗收變更權限；可用相符建置的已授權測試環境完成檔案流程，正式畫面仍獨立核對。
