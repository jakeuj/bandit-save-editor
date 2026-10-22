# 功能任務導覽

只讀目標功能的條目，再依指向的研究、維護文件及 SDD 核對現況。版本實測數字是歷史證據，不是永久預期；本導覽不新增實作或發布授權。

## 依任務讀取

- 完整轉職表、職業條件與社群工作圖：讀 repo 的 `src/profession-ui.js`、`knowledge/profession-guide.json`；前置資料由 `extract-game.cjs` 重建，規則與來源界線見研究筆記「職業轉職圖鑑」。
- 裝備等級、職業操練上限、進階科技或超限模式：讀 repo 的 `docs/research/advanced-editing.md` 與 `sdd/advanced-editing/tasks.md`；基礎資質、技藝上限、天賦回填或自然職業30級限制另讀 `sdd/runtime-patch/proposal.md`。v2.8.1 已在 `editingInfo` 的 z9 分支補普通／setLink 檢查，當時套裝等級唯讀；目前獨立套裝功能另見下項；v2.8 及以前的可寫路徑是未證明缺口，舊存檔不追溯，該件等級不能由本版還原。

### 套裝與規劃

- 套裝等級、套裝積分或合成後搬移：讀 repo 的 `docs/research/set-equipment-level.md`、`sdd/archive/2026-10-23-set-equipment-level/proposal.md` 與 `tasks.md`。研究結論為 go 進入實作與首次驗證；實作階段與授權須核對最新 SDD 及當前對話；研究結論不代表開閘。首版只改 y6，z7／z9 各用 `backpackSetEquipmentLevel`／`setEquipmentLevel` 獨立群組與首次證明，不沿用普通裝備證明。原生升級只處理 z9，背包 oracle 須經原生搬移取得實際目的列；y23 積分與 y26／y27 合成來源保留，y0 不必等於列號。v2.10 已發布、驗收並歸檔，兩庫首次原生證明與介面驗收見歸檔 SDD，發布範圍見 `docs/releases.md`；矩陣、合法基準及來源 SID／expression 依研究、SDD 及 `docs/maintenance/core.md`，不在技能複製；任何新來源仍依證明開閘，套裝品質、詞條及超限另案。
- 規劃下一版或評估候選順序：先讀 repo 的 `docs/research/next-version-plan.md`（目前進度、候選及歷史盤點入口），需要單項排序理由再讀 `docs/research/feature-roadmap.md`；路線圖的 v2.8 排序及 V1.0.11.0 影響段屬歷史研究脈絡。不重做已記錄的盤點；開閘門仍依維護指引。範本0一般隨機角色的資質、技藝上限與天賦不受載入回填，與補丁提案範圍不同。
- v2.8.1 鞏固版（z9 套裝唯讀、文件對齊 V1.0.11.2、發布核對紀錄）：讀 `sdd/v2.8.1-consolidation/proposal.md` 與 `tasks.md`，歷史上 2026-10-23 使用者已核准四項決定及該版提交／推送；實作、驗收與發布見任務紀錄，不延伸為新任務授權。本版不新增修改功能。v2.8.1 當時採整檔文字摘要；現行整份 core 語法樹摘要會因可執行語法變動失效（格式與舊證明對照見 `docs/research/core-ast-proof.md`），改完後依維護指引重開，既有已開放群組失效時不以關閉旗標的狀態推送；新增候選群組則在首次證明前維持關閉。

### 普通裝備與丹藥

- 第二批詞條與丹藥資質增量：讀 repo 的 `docs/research/advanced-editing-batch2.md` 與 `sdd/advanced-editing-batch2/`。v2.2 已開放獨立驗證的既有詞條係數與丹藥增量；替換ID見v2.3，品質見v2.5，超限另行驗證。
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
