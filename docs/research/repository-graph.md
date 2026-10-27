# Repo 知識圖譜

graphify 將程式結構、研究文件與視覺素材整理為本機可查詢的圖譜。適合尋找跨檔入口，例如從維護指引追到核心交易、隔離遊戲驗證與單檔建置。找到入口後，依節點與關係的 `source_file`、`source_location` 回到目前來源確認；功能狀態以 catalog／verification 及各研究筆記的實作摘要為準（舊功能另見 `sdd/` 歷史紀錄）。

遊戲資料規則與可寫驗證的維護入口仍是 [存檔知識調查](save-knowledge.md)及[維護指引](../maintenance.md)。圖譜中的 `EXTRACTED` 表示來源明示關係，`INFERRED` 是推論，`AMBIGUOUS` 是待確認；三者都不等同隔離遊戲實測通過。

## 產物與版本控制

從 repo 根目錄建圖，輸出固定放在 `graphify-out/`：

| 產物 | 用途 |
| --- | --- |
| `graph.html` | 互動圖、搜尋、社群篩選與節點資訊 |
| `graph.json` | 查詢及後續更新的節點、關係與來源位置 |
| `GRAPH_REPORT.md` | 社群、凝聚度、核心節點、跨領域連結及限制 |
| `manifest.json`、`cache/` | 來源變更判斷及萃取快取 |
| `.graphify_python`、`.graphify_root` | 本機直譯器與掃描根目錄；換機後重新解析 |

本次另保留 `extraction-audit.json`（建圖前的原始節點與關係）、`graph-health.json`（完整性診斷）、`graph-preview.png`、`benchmark.json` 與 `cost.json`。這些補充檔案由當次流程產生，其他建圖方式不保證都會輸出；引用前先確認存在及對應版本。

整個目錄已列入 `.gitignore`，保留在本機供後續查詢與增量更新。repo 提交操作原則與去識別結果，圖譜可重新建立；Pages workflow 的靜態檔案白名單也不包含此目錄。真實存檔、遊戲 payload、runtime 與原始測試 log 沿用 repo 外保存規則。

## 建立、更新與查詢

在已載入 graphify 技能的 Codex 對話中使用：

```text
/graphify .
/graphify . --update
```

第一個指令建立全 repo 圖譜，第二個依快取與 manifest 處理新檔及變更。這是技能工作流程，Codex 與 Claude Code 皆可使用；文件、圖片的語意萃取由技能安排，沒有 Gemini 金鑰時可使用目前代理。單純架構提問且已有 `graph.json` 時直接查詢，無需先重建。沒有圖譜時仍可從程式與文件開始查找，等需要圖譜時再建置。

Windows PowerShell 可沿用建圖保存的 Python，先確認路徑及本機版本，再查詢：

```powershell
$graphifyPython = (Get-Content -LiteralPath 'graphify-out/.graphify_python' -Raw).Trim()
if (-not (Test-Path -LiteralPath $graphifyPython -PathType Leaf)) {
    throw '請依 graphify 技能重新解析 Python 直譯器。'
}
$env:PYTHONUTF8 = '1'
& $graphifyPython -c "import importlib.metadata; print(importlib.metadata.version('graphifyy'))"
& $graphifyPython -m graphify query '維護與驗收指引' --budget 1500
& $graphifyPython -m graphify explain 'inspectGame()'
```

`.graphify_python` 不存在時先依當次 graphify 技能解析環境。查詢字詞從圖內實際標籤選取；CLI 的字面比對不會自動處理跨語言同義詞。若使用中文完整問題無法命中，可改用圖內的具體標籤，例如「來源指紋與寫入閘門」或 `inspectGame()`，並保留使用了哪些展開詞。輸出標示 `TRUNCATED` 時，先縮小問題或調高 `--budget`；被截斷的關係不能當成不存在。引用特定行為時附來源位置；沒有相關關係時記錄缺口。

來源異動後，圖譜可能仍描述先前內容。比對 `built_at_commit`、manifest 與目前工作目錄，未提交修改也需納入；同一提交 SHA 不保證檔案未變。新增文件或更新驗收狀態後，下一次更新需包含語意萃取；本輪只修改文件時，以 `graphify-out/.needs_update` 註記待更新。graphify 的 post-commit hook 主要處理程式 AST，文件與圖片仍須另行更新；本次未安裝 hook 或持續監看程序。

最近一次更新：2026-10-27 在 macOS 依提交 `4360a9c`（v2.34 後）以 graphify 0.9.93 `--update` 重抽 323 檔（223 程式、100 文件），並剪除移入 `archive/` 的 `docs/research/v1.0.10.2-audit.md` 原路徑。這台機器的圖譜不含 2026-10-25 那次更新，仍是 2026-10-22 版本，因此由 574 節點／778 關係變為 3208／6121、227 社群（新增 2806／移除 172 節點）。移除的 172 個語意節點逐一核對都屬本輪重抽或刪除的來源後，才以 `force=True` 寫入，舊圖備份於 `graphify-out/backups/`。已設定 `GEMINI_API_KEY`，語意萃取改由 Gemini 執行；首輪 11 份文件沒有產生節點，單獨重跑後全數補齊。合併去重後仍有 7 份文件沒有歸屬節點：`docs/maintenance/` 的 discussions、dispatch、issues、planning、projects，以及 `docs/research/` 的 random-character-growth、relic-attributes。這 7 份在 manifest 未標記完成，下次 `--update` 會重抽。完整性檢查有 21 條自連結，無未建立或缺少端點的關係。Gemini 回報輸入約 82.5 萬、輸出約 7.4 萬 tokens。

前一次更新：2026-10-25 依提交 `291f725`（文件整理五階段後）重抽 92 檔（28 程式、64 文件），圖譜由 4060 節點／7592 關係、237 社群變為 3894／7294、239 社群；`index.html` 內嵌的 `KNOWLEDGE` 為單行約 61 萬字元，只萃取頂層結構，個別紀錄仍以 `knowledge/*.json` 為準。語意萃取由 5 個 Claude Code 子代理執行，只回報合計約 111 萬 tokens。

## Windows 萃取與稽核

- Python 從 PowerShell 管線或標準輸入執行時，Windows 多程序可能將 `<stdin>` 當成主模組路徑而失敗。本次 AST 自動退回循序執行後完成；自訂 API 流程可使用 `extract(..., parallel=False)`，或將程式存成有 `if __name__ == '__main__':` 保護的檔案。
- JSON sidecar 由 Python 以 `encoding='utf-8'` 寫入；主控台用 `PYTHONUTF8=1` 或 `sys.stdout.reconfigure(encoding='utf-8')`，避免 cp950 影響繁中與特殊符號。
- 多行 Python 步驟（含反斜線路徑或中文標籤）寫成暫存 `.py` 檔再執行，不塞進 `python -c` 字串；Git Bash heredoc 內的 `\` 跳脫曾造成語法錯誤。
- 開始更新前檢查 `graphify-out/` 是否殘留上次未清理的 `.graphify_*.json` 中間檔或 `.needs_update`；殘留代表上次沒跑完收尾，先刪中間檔再偵測，避免合併到舊萃取。
- 核對當次套件版本與技能版本，以及實際函式介面。本次初建時 CLI 回報套件 0.9.52、技能 0.9.66；這是歷史環境紀錄，不是版本需求。
- 文件按目錄分批，圖片各自成批並實際檢視；代理數依當次並行額度安排。SVG 可先光柵化後檢視，來源仍指向原 SVG；本次以暫存 `resvg-py` 渲染 favicon 與 social-card，再核對畫面，未修改原素材。
- 合併前驗證每批 JSON、節點 ID、來源路徑與邊端點；失敗批次須記錄，只有實際產生輸出的語意來源才寫入完成清單。圖譜為空或縮減保護拒絕寫入時，保留既有產物並查原因。`--update` 重抽已有語意節點的文件時，舊節點會被同檔的新 ID 取代，`to_json` 的語意保留檢查仍會列為缺失；先逐一確認缺失節點的 `source_file` 都在本輪重抽清單內（不是漏批或刪檔），才以 `force=True` 寫入，並保留舊 `graph.json` 備份到比對完成。

建圖後檢查缺少端點欄位、端點未建立、自連結及同端點關係合併。這些數值需要連同原始萃取解讀：外部模組可能沒有被建立為節點；預設無向簡單圖也可能將 `contains` 與 `calls` 等不同關係合併到同一對端點。保留原始關係供追查，完整性警告寫入報告，凝聚度保留實際數值。

增量更新後社群編號會重排。沿用舊名時，以新社群節點在舊 `graph.json` 的 `community` 計算重疊，過半者沿用 `.graphify_labels.json` 的舊名，其餘重新命名；2026-10-25 第二次更新為 193 個沿用、46 個重新命名。2026-10-27 更新時本機舊圖仍是 2026-10-22 的小圖，沒有依重疊沿用舊名：跨檔與核心社群手動命名，其餘以主要來源檔名命名。

若代理工具沒有回傳實際 token usage，成本標成「無法取得」；本次 `cost.json` 使用 `null` 與 `measurement_status: unavailable`。Claude Code 子代理只回報合計 tokens 時，另記 `subagent_total_tokens`，輸入／輸出仍為 `null`。既有累計欄位為 `null` 時，技能附的成本腳本直接相加會拋 `TypeError`，改為只追加本次紀錄、不改累計欄位。萃取 JSON 的零值占位不作為零成本證明。benchmark 的字數／脈絡大小估算與實際用量分別記錄。

## 2026-10-22 初次建圖紀錄

以下數字只描述當次快照，重新萃取後應使用新結果，不作為固定測試預期：

| 項目 | 結果 |
| --- | --- |
| 偵測語料 | 66 檔，約 124,517 詞；31 程式、27 文件、8 圖片 |
| 程式 AST | 286 節點、523 關係 |
| 語意萃取 | 35 檔，10 批；所有批次均有輸出 |
| 合併前 | 408 節點、747 關係 |
| 預設無向圖 | 408 節點、647 連線、30 社群 |
| 完整性 | 84 條關係的端點未建立；0 條缺少端點欄位；0 條自連結；16 條同端點關係合併 |
| 估算 benchmark | 兩個匹配的通用問題平均脈絡約 1,459 tokens，相對完整語料約縮減 113.8 倍；不代表答案完整度或實際 token 消耗 |
| 實際 token usage | 工具未提供，記為無法取得 |

84 條未建立端點的關係主要涉及 `node:fs`、`node:assert/strict`、`node:path` 等外部匯入，不能直接解讀為專案呼叫錯誤。四份 `knowledge/*.json` 沒有產生 AST 節點，相關入口由文件引用補足；此圖沒有完整索引 JSON 資料表內容。`.gitattributes`、`.gitignore`、`.nojekyll`、`manifest.webmanifest` 與 `sitemap.xml` 當時未被分類為支援語料。

Edge 本機 HTTP 預覽已顯示圖譜、30 個社群篩選與節點資訊面板，截圖保存在本機產物中。工具 URL 政策拒絕 `file://`，本次沒有直接開檔 UI 實測；HTTP 預覽結果不能替代離線開檔驗收，也不增加編輯器或遊戲的實測範圍。
