# macOS ARM64 實驗啟動器

使用自己 Steam 安裝的《塔防山賊模擬器》資料，以及官方 NW.js SDK 0.82.0 ARM64。已在 Apple M4 Max 上驗證原生主選單、Steam 雲存檔清單及支援者 DLC 辨識；另以隔離測試確認載入修改副本、本機存檔及重啟讀回。長時間遊玩、真實雲端上傳與成就仍待驗證。

需要 macOS Apple Silicon 與 Python 3.9 或更新版本。此目錄只包含準備工具，不提供遊戲內容或玩家存檔。

```sh
python3 launcher/prepare-macos.py
```

預設從 `NGO-Steam-0` bottle 的 `塔防山贼模拟器` 安裝目錄複製（找不到時改用舊的 `bandit`），輸出到 `~/bandit-mac-port`；可用 `--source`、`--output` 指定其他位置。首次下載官方 runtime 約 141 MiB，並核對固定 SHA-256。工具只接受已核對路徑修正位置的遊戲腳本（目前為歷史 V1.0.9.1、V1.0.10.2、V1.0.11.2 及 V1.0.12.2）；未知來源更新時會停止，需重新調查。V1.0.11.2 與 V1.0.12.2 只完成路徑修正的靜態核對，尚未重驗 Mac 啟動、Steam 清單、實際存讀及重啟續玩；歷史實測不能擴張到新版。

遊戲改版時不必先登錄；在 Mac 準備時工具停下再處理即可。新版登錄只做靜態核對，Windows 也能做：對照前一版 `c3runtime.js` 每個修正位置的前後文與命中次數，確認沒變才把原始指紋加進 `SCRIPT_SHA256`，再用下方 `--verify-runtime` 核對套用後的副本。

`--verify-runtime GAME_DIR` 只做檢查、不寫入：確認準備好的副本的 `scripts/c3runtime.js` 恰好等於 `--source` 原始腳本套用已核對路徑修正的結果，並輸出原始與修正後的 SHA-256。隔離驗證工具用它確認 Mac 副本與 catalog 指紋的對應關係。

準備完成後，雙擊 `~/bandit-mac-port/啟動山賊.command`。遊戲必須由此啟動器開啟，因為修正後的資料根目錄使用啟動時的 working directory。

- Steam 安裝目錄與原始存檔不會被改動。
- 首次準備複製 `savedir` 與 `record.dat`；之後準備不會覆蓋 Mac 進度。
- Mac「雲存檔」快取位於 `~/bandit-mac-port/game/savedir`，自動備份位於 `game/backup`，與 Windows 存檔分開。
- V1.0.9.1 的手動「讀檔」使用 `save\\eaNsave.dat`。目前準備工具未正規化這組路徑，在 Mac 的 `game/` 下會產生檔名含反斜線的 `save\ea1save.dat` 等檔案。隔離測試已確認可寫入並重啟讀回；搬移或修改時保留實際檔名與位置，不能當成 `save/` 子目錄。
- Chromium profile 位於 `~/bandit-mac-port/profile`，啟動 log 位於 `logs/game.log`。
- 原版 Greenworks 與 Steam 驗證保留。若要使用 Steam 功能，需另外開啟並登入 **Mac 版 Steam**；CrossOver 裡的 Windows Steam 無法供 macOS dylib 使用。

修正範圍是 Construct NW.js `AppFolder`、AJAX 外置檔案 fallback、`savedir`／`backup` 分隔符，以及 icon manifest 的路徑。不修改 Steam 身分、授權、成就或 DLC 判定。

調查證據與 Nevergrind 比較見 [macOS runtime 調查](../docs/research/macos-runtime-investigation.md)。
