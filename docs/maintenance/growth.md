# 一般隨機角色基礎資質維護

[維護索引](../maintenance.md)；只讀本次任務相關章節。版本與日期標示的實測紀錄只證明當時範圍，現行開放狀態以 catalog／verification 與相應 SDD 為準。

## v2.7 一般隨機角色基礎資質

來源與數值規則見[研究](../research/random-character-growth.md)，驗收狀態見[SDD](../../sdd/random-character-growth/tasks.md)。範本0、已招募、非在監、y50與z16階段紀錄全零，且完整資質來源可核對才開放；小數丹藥增量停用。有名角色載入依範本回填，不能用此功能或runtime補丁混處理。

`randomCharacterGrowthInfo(model,{characterId})`回資格／原因及三項來源；`previewCharacterBaseAptitudes(model,{characterId,baseRaw})`接受三項原始安全整數，回canApply、差異、前後A／B／總值／C及原因；`setCharacterBaseAptitudes`重跑相同檢查、原子寫三欄。一般模式要求同品質任一原生傾向可生成，三欄不能獨立套範圍。預覽及套用不接受任意方法／座標或超限；自訂座標維持唯讀。

v2.7 首次交付時，資質與丹藥共用 `aptitude:角色ID` 六欄累計還原群組。v2.9 加入天賦後，一般隨機角色的天賦、基礎資質與丹藥改為同一 12 欄累計群組，現行互動依[天賦維護](talents.md#v29-一般隨機角色天賦等級)；有名角色仍只允許既有丹藥操作的三欄還原，寫入值域維持原限制。復原一步仍按交易，失敗不留下變更。下調資質使現有B超出新C就阻擋，不默改B或依目前持有丹藥猜測歷史來源。

生成器`random-character-growth-data.cjs`核對招募SID與公式後建立`catalog.randomCharacterGrowth`；來源／規則／資質資料變動關閉新旗標。`randomCharacterBaseAptitudes`有獨立section、family、代表情境與逐項checks，建置核對15來源、規則及天賦／裝備必要資料SHA、核心資質／穿戴檢查計算區段SHA。新增欄位仍由三份驗證需求／清單／遷移情境及版本遷移測試共同覆蓋，v2.7共23個已開放群組；v2.8 A另增1個候選群組，B取得完整獨立證明後合併為第24個。

初次驗證用`verify-random-character-suite.cjs`，參數沿用`--source`、`--runtime`、`--save-file`、`--artifacts`與Mac的`--package`；未帶`--record`只驗證，全部成功後帶此參數才合併新section與旗標，保留原有22群組完整證明。`verify-random-character-growth.cjs`比對原生A／B／C；`verify-random-character-lifecycle.cjs`每階段原生存檔、停止、新PID讀回，另有`--compare`重查最後結果。新群組首次完整矩陣24角色及2角色生命週期；未來版本遷移採Q1／Q6代表子集，同指紋仍只比較。

### 首次驗證與發布歷史

2026-10-22本機Mac實測已完成24角色六品質／升降／天賦加成、原版IO及新PID讀回；生命週期另涵蓋數值更新、三項服藥、單次自然經驗達轉職門檻、下獄／召回、重生及解雇，各階段皆再次存讀。15來源與原始存檔雜湊未變，自己的程序已停止，副本背景隱藏／靜音／非全螢幕。沒有新增遊戲UI或真實Cloud／成就驗證。

桌面、390px、PWA斷網及一般Edge直接file開啟獨立HTML均已用2501×60×22合成檔完成新功能編輯、預覽及實際下載，逐字符合獨立token預期；桌面、390px與Edge file流程另完成群組還原及復原。直接file結果只涵蓋本版新功能，不代替`sdd/save-knowledge`其他歷史待辦；網路模擬與viewport測後恢復。2026-10-22依使用者授權，與v2.6一併以`5d5c55b`推送並完成[Pages正式發布驗證](../research/random-character-growth.md#v27-正式發布驗證)；兩案SDD均保留原位置。
