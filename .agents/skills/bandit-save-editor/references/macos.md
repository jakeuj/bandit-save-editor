# macOS ARM64 啟動與存檔

處理 repo 的 Mac 準備工具、CrossOver 啟動問題、Steam 或 Mac 存檔位置時，先讀 `launcher/README.md` 與 `docs/research/macos-runtime-investigation.md`；寫入實測另讀 `docs/research/save-knowledge.md`。

## 維持目前的實驗路線

專案以自己的 Steam 遊戲資料搭配 NW.js SDK 0.82.0 osx-arm64，沿用遊戲原附的 universal Greenworks 與 Steam dylib。這是與既有 ABI／指紋核對的 runtime，不能當成追求最新版的版本提示，也不直接套用其他遊戲的 Steam adapter。

準備工具是 `launcher/prepare-macos.py`，需要 Apple Silicon macOS 與 Python 3.9+；從 `--help` 及 README 確認來源、輸出與預設位置。工具下載官方 runtime、驗固定 SHA-256 與遊戲腳本指紋，只修改副本。來源更新而停止時先調查相容性，不移除檢查硬跑。

透過產生的 `啟動山賊.command` 啟動；修正後資料根目錄依賴啟動 working directory。隔離 Chromium profile 不等於隔離遊戲以 `AppFolder` 讀寫的資料，須同時隔離 app、遊戲根目錄與存檔。

## 三類存檔位置

以目前工具的輸出根目錄及實際檔名確認：

| 用途 | 位置／注意事項 |
| --- | --- |
| 雲存檔下載快取 | `game/savedir/`，不等於已上傳 Steam Cloud |
| 自動備份 | `game/backup/` |
| 手動存檔／讀檔 | V1.0.9.1 仍使用含反斜線的 `save\eaNsave.dat` 檔名，位於 `game/` 下，不能當成 `save/` 子目錄 |

修改副本放回取出時的相同位置，並選對應載入分頁。準備工具首次複製 `savedir` 與 `record.dat`，再次準備保留 Mac 進度；不要用 Windows 路徑假設覆蓋它。路徑正規化若有改動，驗證既有資料遷移、實際寫檔與重啟續玩，再更新 repo 文件。

## Steam 與驗收範圍

Mac Steam 需另行啟動並登入；CrossOver 裡的 Windows Steam 不能提供 macOS dylib 所需連線。保留原生身分、授權、Cloud、成就與 DLC 判定，不以假造初始化成功代替相容性驗證。

repo 證據已涵蓋原生主選單、ARM64／繪圖、Steam 清單與 DLC 辨識，以及隔離副本修改後的載入、本機寫檔和重啟讀回。它們不證明真實 Cloud 上傳、成就／統計寫入、DLC 獎勵或長時間穩定性。

重跑驗證沿用 `scripts/verify-game.cjs`，依維護指引逐步執行，每一步確認完成後才進下一步；僅操作測試 PID，保留來源存檔雜湊與隔離的 Steam 寫入鏡像。原始 runtime、遊戲 payload、state、profile、log 與 crash dump 全部留在 repo 外；公開文件只寫去識別證據。

## CrossOver 診斷

已重現 GPU 子程序以 `0xc0000005`（`-1073741819`）退出，伴隨 `Failed to send GpuControl.CreateCommandBuffer`；這是症狀證據，尚未定位 Wine 內部根因。

- 包含 `--in-process-gpu` 的既有測試被殘留 singleton 影響，結果無效；重新驗證前將它標為待測。
- 有必要重現時，用目前 CrossOver wrapper 的 `--help` 確認 `--bottle`、`--workdir`、`--cx-log`，只擷取對應遊戲的 Chromium／例外訊號。原始 log 與 dump 留在 repo 外，輸出僅保留診斷相關片段。
- 終止啟動 wrapper 或 Python process group 未必會結束 Wine 內的子程序。重試前按完整遊戲路徑辨識殘留 PID；清理僅限該次測試建立的程序，保留同 bottle 的 Steam 與其他遊戲。
- 在使用者正操作遊戲時，以觀察和離線副本工作為主；重啟前先確認目前畫面，保留進度。
