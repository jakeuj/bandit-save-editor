# 九項技藝上限維護

[維護索引](../maintenance.md)；只讀本次任務相關章節。版本與日期標示的實測紀錄只證明當時範圍，現行開放狀態以 catalog／verification 與相應 SDD 為準。

> 整份 core 摘要現採[語法樹格式](../research/core-ast-proof.md)：一般註解／排版不影響綁定，可執行語法改依 family 切片保護（[第二階段](../research/core-ast-proof.md#第二階段功能切片)），無法切片時退回整份 core。下列舊版整檔文字摘要與實測數字保留歷史脈絡；其他功能的區段摘要沒有在本階段改造。

## v2.8 A 交付紀錄：技藝上限核心，當時尚未開放

詳見[研究與A／B界線](../research/random-character-skill-caps.md)及[SDD任務](../../sdd/random-character-skill-caps/tasks.md)。`randomCharacterSkillCapsInfo(model,{characterId})`查資格；`previewCharacterSkillCaps(model,{characterId,caps})`接受九個安全整數，回九列C／L／E、共同生成見證及差異；`setCharacterSkillCaps(model,request,{preview})`要求同模型、同請求且未過期的核心預覽，重驗後一次提交。同值不新增歷史；降低到有餘額的目前等級時阻擋。預覽物件的changes不具執行權限。

第一次有效cap調整後，該角色全部技藝cap／L／E累計一起還原；之前及之後的單項／九項經驗都納入。`restoreAll(model)`清除差異及私有群組模式；勿再直接clear changes來實作還原全部。undo回上一筆交易，含群組模式。已知z2 y22–48在未啟用列也維持唯讀，舊set／自訂座標不能繞過。

A交付時，生成器新增`random-character-skill-caps-data.cjs`，獨立群組`randomCharacterSkillCaps`保持false；沒有randomCharacterTalents寫入群組。proof綁15來源、最小規則／天賦選取資料及整份未嵌入知識的core摘要。當時原生family帶pendingReason，oracle／lifecycle與初次merge入口明確拒絕；既有23組證明保持原檔，包含候選群組的全套遷移無法完成。這是歷史狀態；B的實作及首次驗收見下節與[B任務](../../sdd/random-character-skill-caps-b/tasks.md)。同指紋遷移仍只比較。

## v2.8 B：介面與首次獨立證明

此節接續上節A交付歷史，實際完成狀態見[B任務](../../sdd/random-character-skill-caps-b/tasks.md)及[研究紀錄](../research/random-character-skill-caps.md)。角色養成新增九上限輸入與完整九列C/L/E預覽，輸入／角色／模型變化使舊預覽失效；套用必須帶核心產生的原始preview，不能用自建changes執行。角色、批次及變更列表顯示27欄累計還原範圍，其他角色保留原分組。

首次開放入口：

```sh
node scripts/verify-skill-caps-suite.cjs --source PREPARED_GAME --runtime NWJS --save-file BASE.dat --artifacts OUTSIDE_REPO --package STEAM_GAME_DIR
```

Mac沿用已核對的準備副本，`--package`指向原始安裝目錄。未帶`--record`只產生repo外結果；完成完整驗收後才以同一入口的`--record`寫入，或由維護程式將本次實際`results.json`傳給匯出的`recordProof`，它會重新驗證完整結果與目前來源／資料／core摘要。正式CLI與匯出的合併介面都不能接受只有全true的checks。

首次矩陣108角色覆蓋六品質、九主位置、升降方向與不同次位置；另有兩角色生命週期副本、招募與有名回填對照。矩陣後九技藝批次與後續原生經驗、剛達cap／已封頂／提高後原生成長分開驗證。有效階段各自原版存檔、停止及新PID讀回，來源／原檔hash與階段PID／存檔SHA鏈必須相符。公開proof保留manifest／證據摘要，不提交原始report或玩家資料。

`random-character-skill-caps-proof.cjs`綁15來源、最小規則／天賦選取資料及整份未嵌入知識的core。修改共享核心後須重驗此群組；既有群組維持各自摘要及證明，不改hash冒充重驗。首次合併只加本群組及section，四產物寫入／建置／check任一步失敗會完整回滾。代表遷移維持Q1／Q6矩陣及兩角色生命週期，同指紋只比較（忽略fingerprint物件key排序）；沒有完整初次證明不能藉遷移第一次開放。天賦編輯仍另案。

新UI有Node事件與HTTP桌面／390px、file、PWA三種環境案例。閘門關閉時headless成功只代表預覽與停用；正式開放後須重新跑成功套用、交錯經驗、27欄還原／復原及實際下載重載。詳細流程及輸出在[測試指引](../testing.md)。

### 首次驗證與版本遷移歷史

2026-10-22 B首次完成108＋2完整隔離矩陣及13階段，正式合併為第24群組；該次來源為V1.0.10.2／build26094666。既有23群組紀錄完整保留，核心未更動；詳細實測與發布分層結果見[研究紀錄](../research/random-character-skill-caps.md)及[B任務](../../sdd/random-character-skill-caps-b/tasks.md)。其後更新至V1.0.11.2／build26126719，已完成15個Windows隔離副本、24群組代表遷移與必要UI補測，並保留首次完整矩陣證明；新版差異、測試工具收尾修正與發布範圍見[新版調查](../research/v1.0.11.2-audit.md)。Windows遇到通過副本清理的檔案鎖時，可沿用`--keep-copies`保留診斷，等自己的程序完全退出後再清理repo外副本。
