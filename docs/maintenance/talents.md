# 天賦等級維護

[維護索引](../maintenance.md)；只讀本次任務相關章節。版本與日期標示的實測紀錄只證明當時範圍，現行開放狀態以 catalog／verification 與相應 SDD 為準。

> 整份 core 摘要現採[語法樹格式](../research/core-ast-proof.md)：一般註解／排版不影響綁定，可執行語法改依 family 切片保護（[第二階段](../research/core-ast-proof.md#第二階段功能切片)），無法切片時退回整份 core。下列舊版整檔文字摘要與實測數字保留歷史脈絡；其他功能的區段摘要沒有在本階段改造。

## v2.9 一般隨機角色天賦等級

研究、規則與實測見[天賦研究](../research/random-character-talents.md)，任務與決策見[SDD](../../sdd/random-character-talents/tasks.md)。首版只改三槽天賦**等級**：範本 0、非在監、無結丹／重生紀錄、品質 1–6，三槽為互異已知 ID 且等級在品質池（Q1 1–2、Q2 1–3、Q3 2–4、Q4 3–5、Q5 4–5、Q6 5）。ID、0/0、池外等級與 Q6 都唯讀；z12 y1–3／21–23 經舊 `set`／自訂座標也不能寫。

`randomCharacterTalentsInfo(model,{characterId})` 查資格與每槽效果；`previewCharacterTalents(model,{characterId,levels})` 只接受三個等級；`setCharacterTalents(model,request,{preview})` 要求同模型、同請求與未過期的私有預覽。改到力量／敏捷／智力強化（屬性 104–106）時以 v2.7 `characterAptitudeSource` 的同一累加順序算新上限 C，既有丹藥 B 超過即阻擋，不截斷。天賦寫入沿用 v2.7 的 `aptitude:角色ID` 群組鍵，因此天賦 6 欄、基礎資質 3 欄、丹藥 3 欄任何先後都是同一 12 欄累計還原；`skill-growth` 27 欄獨立。

生成器 `random-character-talents-data.cjs` 以 10 個來源 SID 的事件摘要（只接受 V1.0.11.2 審閱值）產生 `catalog.randomCharacterTalents`：品質等級池、屬性單位與 `天赋属性` 6 個公式分支；天賦屬性／係數沿用 `batch2Data.talents`。來源、規則或天賦資料變動會關閉 `randomCharacterTalents`。

`random-character-talents-proof.cjs` 綁 15 來源、規則＋天賦資料，以及 core 的天賦區塊（`// Talent level rules.` 至 `// Talent level rules end.`）加 v2.7 證明切片，**不綁整份 core**，其他 core 修改不會讓本群組失效；反之，`randomCharacterSkillCaps` 仍綁整份 core。

首次開放入口（Windows 用完整開發快取與獨立 runtime，見[本機開發快取](migration.md#本機開發快取)）：

```sh
node scripts/verify-talents-suite.cjs --source FULL_SOURCE --runtime NWJS --save-file BASE.dat --artifacts OUTSIDE_REPO --keep-copies
node scripts/verify-talents-suite.cjs --merge-results OUTSIDE_REPO/random-talents-XXXXXX --record
```

第一行跑 `random-talents-matrix`（33 角色＋535 個原生公式值）與 `random-talents-lifecycle`（數值更新、轉職、下獄／召回、重生、解雇）兩份副本，只寫 repo 外結果與 `talents-validation.json`。第二行從同一次執行的副本證據重新驗證後，只在原 bytes 插入本群組 section 與旗標，接著建置與 `--check`，任一步失敗四個產物完整回滾；也可在第一行直接加 `--record`。合併器重讀副本保留的 `talents-effects.json`／`talents-reload.json`／`talents-lifecycle.json` 與 state，獨立重算矩陣、535 值與資質 A／C，不接受只有全 true 的 checks。

首次證明保存 `initialVerification`（33＋2 角色、535 值、證據與 manifest 雜湊）。之後的版本遷移使用 `random-talents-representative`（3 角色）與 `random-talents-lifecycle`，只能沿用這份首次證明，不能以代表子集首次開放；schema 2 複合證明另存 `talentInitialVerification`。

### v2.9 的技藝上限重開

以下保留 v2.9 當次的重開方式：以凍結的 core 為準，只重開 `randomCharacterSkillCaps`；當次其他既有群組綁定的片段與資料未變，因此沿用證明。後續修改必須先核對每個群組的來源、資料及公式相依；只有確認其他群組皆未受影響時，才能沿用「只跑技藝上限兩份」的方式。有其他相依改變時，依[版本遷移](migration.md#相依與證據)補驗相應群組，不直接套用這次的排除結論。當次指令如下：

```sh
node scripts/verify-migration.cjs --package STEAM_GAME_DIR --artifacts OUTSIDE_REPO --plan
node scripts/verify-migration.cjs --package STEAM_GAME_DIR --source FULL_SOURCE --runtime NWJS --save-file BASE.dat --artifacts OUTSIDE_REPO --copies random-skill-caps-representative,random-skill-caps-lifecycle --keep-copies
```

v2.9 當次 `--plan` 因 core 雜湊改變選全部 15 份副本；副本數與選跑原因須以當前工具輸出為準。`--copies` 只跑技藝上限兩份且不寫回。隨後以 repo 外維護程式呼叫 `Caps.validateResults(...,{initial:false})` 重算，再用 `Caps.record` 只替換 `verification.json` 中的 `randomCharacterSkillCaps` 物件，保留首次 108＋2 `initialVerification` 與其他 section 原 bytes。全部證明寫回後再以 `--baseline` 重建 `knowledge/migration-baseline.json`。
