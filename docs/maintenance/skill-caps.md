# 九項技藝上限維護

[維護索引](../maintenance.md)；只讀本次任務相關章節。版本與日期標示的實測紀錄只證明當時範圍，現行開放狀態以 catalog／verification 為準（輕量群組見 `knowledge/verification.json` 的 `lightweight`）。

> 下列 core 摘要、選跑重證與實測數字是 2026-10-24 輕量流程前的歷史紀錄；現行驗證與建置閘門見[輕量開發流程](lightweight.md)。

## 降低上限逐項提示（2026-11-04，v2.43）

一般／進階預覽的每列新增 `reasons`，沿用原本兩項降低限制：目標上限低於目前等級，或降低至目前等級但仍有經驗餘額。原因附目標值、目前等級與修正方向；有餘額時顯示實際餘額，提示至少保留下一級的上限。整體 `reasons` 仍包含各列原因，套用會重驗，不能藉改公開診斷資料繞過阻擋。

介面在對應輸入框下顯示原因，以 `aria-describedby` 連結、`aria-invalid` 標示，預覽將全部問題逐項列開。輸入／快捷填值、模式、角色或檔案變動時清除舊提示；成功預覽或套用後也不保留過期錯誤。共同生成見證與資格問題仍在整體預覽說明，不誤標成單一欄位錯誤。寫入判定與旗標未變；實測見[實作摘要](../research/random-character-skill-caps.md#降低上限逐項提示2026-11-04v243)。

## 介面改善（2026-11-04，v2.42）

同一角色切換一般／進階模式時，保留九項輸入草稿（含空白及尚未通過驗證的值），清除舊預覽並停用套用；切換角色或載入另一份存檔仍回到一般模式並讀取該角色目前值。進階模式新增「全部填入 100」，僅填入草稿並使預覽失效，須重新預覽、確認後才套用；角色不合格時按鈕停用。使用既有具名預覽與套用入口，寫入資格、旗標及 27 欄還原不變。實測見[實作摘要](../research/random-character-skill-caps.md#介面改善2026-11-04v242)。

## 初始角色與進階 1–100（2026-11-03，v2.41）

一般模式現在列舉「一般招募／初始角色」兩種來源；初始規則限 Q1，須有 `randomCharacterSkillCapsInitial` 旗標才可寫入。進階模式另用 `randomCharacterSkillCapsAdvancedInfo`／`previewCharacterSkillCapsAdvanced`／`setCharacterSkillCapsAdvanced`，須有 `randomCharacterSkillCapsAdvanced` 與原技藝上限旗標；已結丹者另依原結丹旗標與紀錄檢查。兩個新旗標在產生器預設關閉；2026-11-03 已通過 Windows 隔離原生冒煙，現行 catalog 已開放，以 v2.41 發布。

UI 預設一般模式，切換角色／存檔重設模式；切換模式會清除預覽，同一角色成功套用後保留模式。進階模式略過共同生成條件，但仍限定目前及目標九上限都在 1–100；保留其餘資格、L／E 與 27 欄還原。來源 SID、公式與實測範圍見[實作摘要](../research/random-character-skill-caps.md#實作摘要2026-11-03v241-初始角色與進階-1100)。冒煙工具為 `node scripts/verify-skill-caps-modes.cjs --state EXTERNAL_STATE --scenario EXTERNAL_SCENARIO`，會存檔並重啟自己的隔離程序；執行前依輕量流程取得當次啟動授權。

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

2026-10-22 B首次完成108＋2完整隔離矩陣及13階段，正式合併為第24群組；該次來源為V1.0.10.2／build26094666。既有23群組紀錄完整保留，核心未更動；詳細實測與發布分層結果見[研究紀錄](../research/random-character-skill-caps.md)及[B任務](../../sdd/random-character-skill-caps-b/tasks.md)。其後更新至V1.0.11.2／build26126719，已完成15個Windows隔離副本、24群組代表遷移與必要UI補測，並保留首次完整矩陣證明；新版差異、測試工具收尾修正與發布範圍見[新版調查](../research/archive/v1.0.11.2-audit.md)。Windows遇到通過副本清理的檔案鎖時，可沿用`--keep-copies`保留診斷，等自己的程序完全退出後再清理repo外副本。
