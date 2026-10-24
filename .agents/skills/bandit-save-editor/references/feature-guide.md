# 功能任務導覽

只讀目標功能的條目，再依指向的研究、維護文件及 SDD 核對現況。版本實測數字是歷史證據，不是永久預期；本導覽不新增實作或發布授權。

## 依任務讀取

- 完整轉職表、職業條件與社群工作圖：讀 repo 的 `src/profession-ui.js`、`knowledge/profession-guide.json`；前置資料由 `extract-game.cjs` 重建，規則與來源界線見研究筆記「職業轉職圖鑑」。
- 裝備等級、職業操練上限、進階科技或超限模式：讀 repo 的 `docs/research/advanced-editing.md` 與 `sdd/advanced-editing/tasks.md`；背包普通裝備等級超限（v2.14，旗標 `backpackEquipmentLevelAdvanced`，上限同 z9 的 1000）的實作摘要在 `docs/research/equipment-workflow.md`；基礎資質、技藝上限、天賦回填或自然職業30級限制另讀 `sdd/runtime-patch/proposal.md`。v2.8.1 已在 `editingInfo` 的 z9 分支補普通／setLink 檢查，當時套裝等級唯讀；目前獨立套裝功能另見下項；v2.8 及以前的可寫路徑是未證明缺口，舊存檔不追溯，該件等級不能由本版還原。

### 寶物、套裝與規劃

- 寶物等級／經驗、穿卸搬移或分解返還：讀 repo 的 `docs/research/treasure-level.md` 與 `sdd/archive/2026-10-23-treasure-level/proposal.md`、`tasks.md`（已歸檔）。V1.0.11.2 靜態研究確認實際為魂魄升級；經驗函式沒有找到呼叫，不新增虛構經驗欄位。寶物等級已依 SDD 十項實作並通過兩庫各自的首次原生證明（只改 y6、不扣魂魄、不開放經驗），本機驗收通過但**尚未發布**；發布前回進度入口核對，版本號、提交推送與發布須另行授權。

- 套裝等級、套裝積分或合成後搬移：讀 repo 的 `docs/research/set-equipment-level.md`、`sdd/archive/2026-10-23-set-equipment-level/proposal.md` 與 `tasks.md`。研究結論為 go 進入實作與首次驗證；實作階段與授權須核對最新 SDD 及當前對話；研究結論不代表開閘。首版只改 y6，z7／z9 各用 `backpackSetEquipmentLevel`／`setEquipmentLevel` 獨立群組與首次證明，不沿用普通裝備證明。原生升級只處理 z9，背包 oracle 須經原生搬移取得實際目的列；y23 積分與 y26／y27 合成來源保留，y0 不必等於列號。v2.10 已發布、驗收並歸檔，兩庫首次原生證明與介面驗收見歸檔 SDD，發布範圍見 `docs/releases.md`；矩陣、合法基準及來源 SID／expression 依研究、SDD 及 `docs/maintenance/core.md`，不在技能複製；任何新來源仍依證明開閘，套裝品質、詞條及超限另案。
- 問進度、下一步或繼續實作：依 `docs/maintenance/planning.md` 承接；規劃下一版或評估候選順序先讀 repo 的 `docs/research/next-version-plan.md`（目前進度、候選及歷史盤點入口），需要單項排序理由再讀 `docs/research/feature-roadmap.md`；路線圖的 v2.8 排序及 V1.0.11.0 影響段屬歷史研究脈絡。不重做已記錄的盤點；開閘門仍依維護指引。範本0一般隨機角色的資質、技藝上限與天賦不受載入回填，與補丁提案範圍不同。
- v2.8.1 鞏固版（z9 套裝唯讀、文件對齊 V1.0.11.2、發布核對紀錄）：讀 `sdd/v2.8.1-consolidation/proposal.md` 與 `tasks.md`，歷史上 2026-10-23 使用者已核准四項決定及該版提交／推送；實作、驗收與發布見任務紀錄，不延伸為新任務授權。本版不新增修改功能。v2.8.1 當時採整檔文字摘要；現行整份 core 語法樹摘要會因可執行語法變動失效（格式與舊證明對照見 `docs/research/core-ast-proof.md`），改完後依維護指引重開，既有已開放群組失效時不以關閉旗標的狀態推送；新增候選群組則在首次證明前維持關閉。

### 普通裝備與丹藥

- 第二批詞條與丹藥資質增量：讀 repo 的 `docs/research/advanced-editing-batch2.md` 與 `sdd/advanced-editing-batch2/`。v2.2 已開放獨立驗證的既有詞條係數與丹藥增量；替換ID見v2.3，品質見v2.5，超限另行驗證。小數丹藥增量（0.1 格線、未改值保留原 token、旗標 `pillAptitudeBonusDecimal`）的實作摘要在 `docs/research/candidate-sweep-2026-10-23.md`；它同時放寬基礎資質與天賦對 B 的讀取檢查。
- 結丹角色丹藥（v2.16，旗標 `pillAptitudeBonusAscended`）：讀 repo `docs/research/candidate-sweep-2026-10-23.md` 第 2 節與其實作摘要。只改 B；M＝1.5＋依 k 順序加總的 z17 y15（加總順序影響浮點）；本版沒有任何內丹／裝備帶 104–106，A 不受影響，出現就拒絕。原生重生只清第一筆入體內丹，殘留 z17 列不被引用，不得據此拒絕。基礎資質與天賦對結丹角色由 v2.17 開放（下一條）。
- 結丹角色基礎資質與天賦（v2.17，旗標 `randomCharacterBaseAptitudesAscended`、`randomCharacterTalentsAscended`）：讀同一節 v2.17 實作摘要。兩入口傳 `ascended=true` 給 `characterAptitudeSource`，cap 用 `aptitudeCap`；`渡劫结束` 不寫 z2 y10–12、y49、z12，招募與等級池判斷不變。有名角色仍拒絕結丹角色；技藝上限見下一條。
- 結丹角色技藝上限（v2.18，旗標 `randomCharacterSkillCapsAscended`）：讀同一節 v2.18 實作摘要。info 以 `ascensionRecord` 取代無結丹拒絕，其餘沿用 v2.8；`渡劫结束` 呼叫閉包不寫見證與技藝欄位，所以不讀穿戴件、不算倍率。
- 結丹品質（v2.21，旗標 `ascensionQuality`）：讀同一節 v2.21 實作摘要（含 z17／z16 呼叫閉包）。只改範本 0 結丹角色某一次的 z16 `[c,2k−1]`（1–9），並把該次入體內丹 z17 y15–17 改成 `結丹係數(q,k)`；只有 y15 被 `角色资质上限倍率` 讀取，但三格一起寫才過 `ascensionRecord`。降品質使任一項 A+B/10 超過新上限時阻擋；還原群組 `aptitude:角色ID`。z17 入體後原生不再修改；渡劫中狀態是全域變數、不存檔。剩餘內丹候選見 roadmap 第 5 項。
- 未入體內丹等級（v2.22，旗標 `backpackInnerPillLevel`、`innerPillLevel`）：讀同一節 v2.22 實作摘要。具名入口 `innerPillLevelInfo`／`previewInnerPillLevel`／`setInnerPillLevel` 只寫 z7／z9 y6（1 到 10＋(q−1)×5）；共用 `editingInfo` 仍拒絕內丹，裝備等級面板在 UI 依範本種類分派。z9 只收部位 5 穿戴中、互指一致的列；內丹詞條 y9–20 一直是 0。等級進 `装备属性计算` 與 `内丹破镜值`（渡劫速度），渡劫時隨 `内丹入体存入` 凍結到 z17；入體內丹 z17 y6 見下一條。
- 入體內丹等級（v2.23，旗標 `ascendedInnerPillLevel`）：讀同一節 v2.23 實作摘要。具名入口 `ascendedInnerPillLevelInfo`／`previewAscendedInnerPillLevel`／`setAscendedInnerPillLevel` 以角色＋結丹次序指定，只寫被 z16 引用的 z17 y6（1 到 10＋(y5−1)×5）；UI 在結丹品質面板，與結丹品質共用次序下拉，但有名與在監角色也可改（不經 `ascensionQualityInfo`）。唯一有效讀取者 `内丹属性计算`（9 個參數）只算主屬性，不進資質 A、倍率 M 或渡劫值；重生殘留列唯讀；每顆各自還原群組 `inner-pill:17:列號`。
- 基礎科技（v2.24，旗標 `basicTechnologyLevel`）：讀 `docs/research/candidate-sweep-2026-10-23.md` 的 v2.24 實作摘要。具名入口 `basicTechnologiesInfo`／`previewBasicTechnology`／`setBasicTechnology` 只把 kj 1–28 的 `[t,4,0]` 0→1，缺少的前置鏈（catalog 科技列的 `prerequisite`，kj 第 7 欄）同一筆解鎖，y12 研究點數歸零；研究中（y13 或書院設施進程）拒絕，沒有降級入口。讀取者只有介面閘門與研究流程；建築升級上限讀進階科技 31–44，`建筑最高等级` 沒有呼叫者。UI 在 `src/tech-ui.js`，還原群組 `technology:basic`。
- 建築等級（v2.25，旗標 `buildingLevel`）：讀同一份集中研究的 v2.25 實作摘要（含 z1 欄位表與讀取者）。具名入口 `buildingLevelsInfo`／`previewBuildingLevel`／`setBuildingLevel` 只把 z1 `[x,5,1]` 升高到 min(4, floor((catalog 建築列 `upgradeTechnology` 的進階科技＋1)/60))；施工中（y4＞0）、升階中（y10＝1）、渡劫台佔用（y7＞0）與建造局（沒有 `upgradeTechnology`）拒絕，沒有降級入口。第 0 列是城牆（y0 是存檔識別），還原群組 `wall:enhancement`；其他列 `building:x`，共用 `setEditingValue` 的 `raisedBuildingGroup` 會把只在新書院／校場上限內的進階科技或操練上限併入該群組。讀取者全是即時計算，置物台靈氣在進場時重算。UI 在 `src/building-ui.js`
- 背包靈物五行（v2.15，旗標 `relicAttributes`）：讀 repo `docs/research/candidate-sweep-2026-10-23.md` 第 3 節與其實作摘要。只改 z18 未擺放列的 y5–10，五行須能由 `获得灵物` 共同生成（見證搜尋），平均一律依原式重算；原生取下後 y0 會過期，以 y1 範本判定靈物，不得以 y0≠列號拒絕。置物台效果、套裝合成與精煉未原生驗證。
- 城牆強化等級（v2.19，旗標 `wallEnhancementLevel`）：讀 repo `docs/research/candidate-sweep-2026-10-23.md` 第 4 節實作摘要。只改 `[19,1,0]`（0–cap，cap＝(z1 #0 y5+1)×60）；降級時 z1 #0 y11 目前生命夾到不含加成的最大生命，因為原生回血與治療不會把超上限的生命往下壓、加成 25 無法離線算準。升級不動生命、不扣退貨幣；城市層數與聲望另案。
- 城市層數與聲望（v2.20，旗標 `cityLayerLevel`）：讀同一節 v2.20 實作摘要。只改進過的城市（zddt 類型「城市」x=1–27，y44=1）的 `[c,11,0]`，0–149；總聲望快取 `[8,1,0]` 讀檔不重算，所以同一交易依 round(Σ int(y11)+[y44=1]) 重寫；降低時 y21 掛機層數超過新值才夾；已佔領（y38=1）不低於 149。城市名稱在 catalog `cityLayers`（另記 `zddt.json` 雜湊，不併入 15 個來源指紋）。野外、魂塔層數不在範圍。
- 精準洗練、替換已選槽詞條、單件裝備效果預覽或搬移識別：讀 repo 的 `docs/research/precise-affix-editing.md` 與 `sdd/precise-affix-editing/tasks.md`。v2.3 使用獨立替換驗證群組，不沿用係數證明；原生搬移後 y0 可不同於目前列號，不得據此拒絕合法裝備。
- 背包裝備、首次洗練選槽或新取得標記：讀 repo `docs/research/equipment-workflow.md` 與 `sdd/equipment-workflow/tasks.md`。v2.4已正式發布並開放首次選槽；具備代表遊戲選槽UI、原版存檔／新PID讀回、桌面／390px精確下載及PWA離線／更新交接證據。詳細範圍與SHA以repo紀錄為準；直接file://新流程仍待人工。
- 普通裝備品質升降、完整單件效果或y23語意：讀repo `docs/research/equipment-quality.md`、`sdd/equipment-quality/tasks.md`與 `docs/maintenance/equipment.md`。背包／z9的升品／降品有四個獨立證明，綁定15來源、規則／資料及公式雜湊；新增尾槽須明選，刪槽須確認且保留已選槽。取得事件分支與y23不可再簡化為目前品質。詳細公式、6,592組原生比對、UI及發布狀態留repo。

### 基礎資質

- 一般隨機角色基礎資質、三項組合值域或與丹藥的還原相依：讀 `docs/research/random-character-growth.md`、`sdd/random-character-growth/tasks.md` 與 `docs/maintenance/growth.md`。v2.7 僅處理範本0基礎資質，技藝上限／天賦另案；開放狀態以獨立證明為準。

### 技藝上限

- 一般隨機角色九項技藝上限、27欄累計還原、原生封頂餘額或首次證明：讀 `docs/research/random-character-skill-caps.md`、`sdd/random-character-skill-caps-b/tasks.md` 與 `docs/maintenance/skill-caps.md`。A核心與B介面／完整矩陣分開驗收，首次開放走獨立suite，代表遷移不能取代；相符15來源、規則及整份core摘要才有效，天賦等級見下一項 v2.9。

### 天賦等級

- 一般隨機角色天賦等級（v2.9）、天賦效果公式、12欄資質／天賦合併還原或其首次證明：讀 `docs/research/random-character-talents.md`、`sdd/random-character-talents/tasks.md` 與 `docs/maintenance/talents.md`。首版只改等級，ID、0/0、池外等級與 Q6 唯讀；天賦寫入沿用 `aptitude:角色ID` 群組。天賦證明只綁 core 的天賦區塊＋v2.7 切片；技藝上限仍綁整份 core，改 core 後先依維護指引核對所有群組相依；其他群組未受影響時，才只跑技藝上限兩份代表副本並只替換其 section。首次開放走 `verify-talents-suite.cjs`（33＋2 角色、535 原生公式），合併器重讀副本證據重算 checks；代表遷移只能沿用首次證明。開放狀態以 verification 與 SDD 為準。

### 批次與其他維護

- 批次經驗、普通裝備升滿、科技同值或大量變更預覽：讀`docs/maintenance/batch.md`與`sdd/batch-editing/`。批次沿用既有具名API及閘門，暫存模型分段檢查，全部合格才一次提交；復原一步撤回整批，個別還原維持累計群組。完整尺寸、瀏覽器及隔離冒煙證據以任務紀錄為準，發布狀態另查repo。

非功能任務（PWA、來源遷移、發布及 Mac）回到[技能入口](../SKILL.md#依任務讀取)，不在此重複維護流程。
