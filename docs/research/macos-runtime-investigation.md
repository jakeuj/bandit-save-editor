# 《塔防山賊模擬器》macOS runtime 調查

調查日期：2026-10-20（Asia/Taipei）。證據來自本機檔案檢查、第一方文件、CrossOver 重現、macOS ARM64 實際啟動，以及使用者提供的遊戲畫面。遊戲測試與路徑修正均使用隔離副本；未修改 Steam 原始遊戲與原始存檔。

## 結論

**已成功沿用 Nevergrind「保留遊戲資料、換 macOS NW.js runtime」的方向，使用 NW.js SDK 0.82.0 osx-arm64 在 Apple M4 Max 原生開啟遊戲。** 已確認主選單、WebGL 2、Steam 模組載入；使用者畫面也證實雲存檔清單及支援者 DLC 辨識。本輪隔離測試另確認修改副本進入主畫面、本機寫檔及重啟讀回；真實雲端上傳、成就與長時間穩定性仍待驗證。詳見 [存檔知識驗證紀錄](save-knowledge.md)。

這不是把 `game.exe` 轉成 macOS 執行檔，而是由 macOS／ARM64 NW.js 執行相同 HTML、JavaScript、WebAssembly 與資產。NW.js 官方支援此種 macOS `app.nw` 封裝。[NW.js 封裝文件](https://docs.nwjs.io/For%20Users/Package%20and%20Distribute/)

## 本機證據

來源目錄：

```text
/Users/jakeuj/Library/Application Support/CrossOver/Bottles/NGO-Steam-0/drive_c/Program Files (x86)/Steam/steamapps/common/bandit
```

| 項目 | 已確認結果 | 證據 |
| --- | --- | --- |
| 遊戲引擎 | Construct 3 | `package.nw/index.html` 包含 Scirra Construct generator，載入 `scripts/main.js`；程式包含 `C3.Plugins` |
| 桌面 runtime | NW.js 0.82.0 | `nw.dll` 的 UTF-16 Windows version resource 同時有 `FileVersion=0.82.0`、`ProductVersion=0.82.0` |
| Chromium | 119.0.6045.105 | 官方 NW.js 0.82.0 發行說明與本機版本吻合 |
| 遊戲 payload | ZIP 格式 `package.nw`，273 個項目 | Python `zipfile.ZipFile` 可直接列出、讀取 |
| JavaScript | 可讀的 `scripts/main.js`、`scripts/c3runtime.js` | 沒有查到 `evalNWBin`／`importNWBin`；ZIP 清單沒有類似 Nevergrind 的 `ngo.bin` |
| Steam plugin | Greengrinds，addon ID `open_Greengrinds` | `scripts/c3runtime.js` 中的 plugin class |
| macOS Greenworks | 已內附 x86_64 + arm64 universal | 對 `greenworks-osx.node` 副本執行 `file`、`otool -L` |
| Steam dylib | `libsteam_api.dylib`、`libsdkencryptedappticket.dylib` 均含 arm64 | 對副本執行 `file`、`otool -L` |
| dylib 位置 | Greenworks 從自身所在目錄載入 Steam dylib | `otool -L` 顯示 `@loader_path/libsteam_api.dylib` 及 `@loader_path/libsdkencryptedappticket.dylib` |
| Steam AppID | `4267800` | `package.nw/steam_appid.txt` |

官方 NW.js 0.82.0 發行說明明列 macOS ARM64 一般與 SDK 下載；SDK 有 DevTools，適合診斷。[0.82.0 發行說明](https://nwjs.io/blog/v0.82.0/)

Greengrinds 作者文件指定 NW.js 0.82.0，其他版本可能需替換原生 binary；也說明 Steam 用戶登入及 `steam_appid.txt` 的需求。官方 Greenworks 0.82.0 版本紀錄同時新增 macOS universal／Apple Silicon 支援，與本機 binary 的架構相符。本次已實際載入遊戲原附模組，沒有替換 Steam adapter。[Greengrinds 作者文件](https://www.construct.net/en/make-games/addons/244/greengrinds/documentation)、[Greenworks 官方版本紀錄](https://www.construct.net/en/make-games/addons/84/greenworks-for-nw-js/versions)

## 本次實測結果與啟動方式

環境：macOS 27.0.1（26A434）、Apple M4 Max、CrossOver 26.3、遊戲畫面版本 V1.0.9.1，Steam build ID 26036956。

| 檢查 | 結果與限制 |
| --- | --- |
| CrossOver 基準啟動 | GPU 子程序反覆當機，報 `GPU process exited unexpectedly: exit_code=-1073741819`（即 `0xc0000005`），接著 `Failed to send GpuControl.CreateCommandBuffer` |
| 歷史 Crashpad | 同遊戲 profile 下多份 dump 為 `0xc0000005`；只能確認 GPU 子程序失敗，尚未定位 Wine 內部的最終根因 |
| `--in-process-gpu` | 曾嘗試，但被前次殘留的遊戲 singleton 影響；此輪結果不成立，不列為已驗證解法 |
| 原生架構 | 程序內回傳 `platform=darwin`、`arch=arm64`、`nw=0.82.0`、`modules=115`；沒有使用 Rosetta |
| 原生繪圖 | Construct log：`Hosted in worker, rendering with WebGL 2 [ANGLE (Apple, Apple M4 Max, OpenGL 4.1)]`；使用者可操作主選單 |
| Steam | 首次未開 Mac Steam 時初始化失敗；Mac Steam 啟動後，載入 `Steam.AppBundle/Steam/Contents/MacOS/steamclient.dylib` 成功 |
| Steam Cloud 讀取 | 使用者提供畫面可見最新存檔及雲檔 1–3 的角色、地點、日期與遊玩時間；尚未驗證下載後進入遊戲或上傳 |
| DLC | 使用者提供畫面右下角「支持者包 DLC」為綠色勾選；尚未測試遊戲內獎勵領取 |
| 本機存檔 | 初期複製四份 `.dat` 至獨立 `savedir` 並核對 SHA-256；本輪以隔離遊戲真實讀寫事件確認新增修改、寫檔及重啟讀回；來源存檔未變 |

可重複準備工具：[`launcher/prepare-macos.py`](../../launcher/prepare-macos.py)，詳見 [launcher 說明](../../launcher/README.md)。本機已建立：

```text
/Users/jakeuj/bandit-mac-port/啟動山賊.command
/Users/jakeuj/bandit-mac-port/game/savedir
/Users/jakeuj/bandit-mac-port/logs/game.log
```

雙擊 `啟動山賊.command` 即可重新開啟。Mac 版 Steam 需另行啟動、登入，才能使用其 Steam 功能。正式啟動器不開 remote debugging port；調查時曾使用 localhost 19282／19283 讀取架構資訊。

官方 runtime ZIP 已比對官方 `SHASUMS256.txt`，準備工具固定校驗此值：

```text
d2f38741cd6065e255aab6f947a8a1d417e59b2d6419a03f7ac45ac863621803  nwjs-sdk-v0.82.0-osx-arm64.zip
```

原始 Wine／Chromium log 保留於本機暫存與 port 的 log 目錄，不納入 Git。研究筆記只記錄與診斷相關的訊息，避免提交使用者資料。

## 與 Nevergrind launcher 的差異

檢查的 GitHub 版本為 `97d56854ef2ad854c278d023fec199e0bdf0c54c`。GitHub 網頁抓取不可用時，以 `git clone --depth=1` 讀取同一個第一方 repository，暫存於 `/tmp/nevergrind-mac-research-20261020`。

| 項目 | Nevergrind 現有做法 | BANDIT 的影響 |
| --- | --- | --- |
| runtime | 已驗證 NW.js SDK 0.60.0 osx-x64，Apple Silicon 透過 Rosetta | BANDIT 原 runtime 是 0.82.0，本來就有官方 ARM64 runtime |
| JavaScript | `ngo.bin` 透過 `evalNWBin` 載入；0.77.0 ARM64 與 x64 都在 compiled cache 被拒絕 | BANDIT 是可讀 JS，沒有查到這個 cache 相容性障礙 |
| Steam | 原 Greenworks addon 曾崩潰，改用 `steamworks.js@0.4.0` + 自訂 API adapter | BANDIT 已附 universal Greenworks，先測原模組最合理 |
| 檔案 | build script 挑選 NGO 檔案複製至 `Contents/Resources/app.nw` | BANDIT 應展開自己的 `package.nw`，沿用自己的 manifest，而非套 NGO 模板 |
| Steam 功能 | NGO adapter 著重身分、驗證票券等遊戲所需 API | BANDIT 的 Greengrinds 還有 Cloud、DLC、stats 等 API，不能假設 NGO adapter 覆蓋完整 |

來源：[Nevergrind launcher 狀態](https://github.com/jakeuj/nevergrind-mac/blob/97d56854ef2ad854c278d023fec199e0bdf0c54c/launcher/docs/status.md)、[macOS build script](https://github.com/jakeuj/nevergrind-mac/blob/97d56854ef2ad854c278d023fec199e0bdf0c54c/launcher/scripts/build-macos-app.sh)、[Greenworks adapter](https://github.com/jakeuj/nevergrind-mac/blob/97d56854ef2ad854c278d023fec199e0bdf0c54c/launcher/adapters/greenworks-steamworks-js.js)。

NW.js 官方提醒，`nwjc` 編譯內容不保證跨平台及跨 NW.js 版本；原生 Node addon 也必須配合 NW.js 的 ABI。這解釋為什麼不能把 NGO 成功的 0.60.0 直接當成 BANDIT 最佳版本。[compiled JavaScript 限制](https://docs.nwjs.io/For%20Users/Advanced/Protect%20JavaScript%20Source%20Code/)、[native modules 文件](https://docs.nwjs.io/For%20Users/Advanced/Use%20Native%20Node%20Modules/)

Nevergrind 的預設本機 runtime 快取路徑（由 script／README 得知，非確認檔案仍存在）：

```text
/Users/jakeuj/nevergrind-mac-port/downloads/nwjs-sdk-v0.60.0-osx-x64.zip
/Users/jakeuj/nevergrind-mac-port/runtime/nwjs-sdk-v0.60.0-osx-x64
/Users/jakeuj/nevergrind-mac-port/Nevergrind Online.app
/Applications/Nevergrind Online.app
```

## 必須處理的跨平台路徑

以下是本機 `scripts/c3runtime.js` 的程式行為；尚未證明每一項都在啟動時觸發。

- NW.js plugin 的 `AppFolder` 是 `dirname(process.execPath) + separator`。在 `.app` 內通常會指到 `Contents/MacOS`，不是 `Contents/Resources/app.nw`；存檔、`record.dat`、`dlc/support/info.dat` 等外置資料須明確決定 macOS 位置。
- 遊戲事件表含 `savedir\\saveinfo.dat`、`savedir\\ea…save.dat`、`backup\\saveinfo.dat` 字串。macOS 不會把 `\\` 當成目錄分隔符，副本必須正規化讀寫路徑，否則可能讀不到舊檔，或產生含反斜線的錯誤檔名。
- AJAX fallback 另外使用 `dirname(execPath) + "\\"`，也有同樣問題。僅修存檔檔名，未必涵蓋所有外置 JSON 的 fallback 讀取。
- `package.json` 的 `c3-app-icons` 亦用反斜線；核心 `index.html` 的資產路徑則是正常 `/`。

因此，第一輪應使用獨立工作目錄、獨立 Chromium user data、遊戲與存檔的副本，並記錄 JavaScript console 及 fs 錯誤；`--user-data-dir` 只隔離 Chromium profile，**不會自動隔離以 `AppFolder` 讀寫的遊戲存檔**。

## 建議驗證順序

1. 下載官方 `nwjs-sdk-v0.82.0-osx-arm64.zip`，以副本建立 `.app/Contents/Resources/app.nw`。
2. 保留 BANDIT 原 `greenworks.js`、`greenworks-osx.node`、兩個 dylib 及 AppID；啟動命令的 cwd 設為 app payload，避免 `steam_appid.txt` 相對路徑誤差。
3. 先驗證 arm64 runtime、Greenworks 載入、標題畫面、畫面更新與音訊；若 Steam 未啟動，將其初始化失敗與遊戲畫面失敗分開記錄。
4. 修正 macOS 專用副本的檔案路徑，驗證外置 JSON、現有存檔副本、另存、重啟後載入。未完成這一步，僅看到主選單不能稱為移植成功。
5. 使用原 AppID 的合法 macOS Steam 登入狀態驗證成就、DLC 等功能；Cloud 在明確需要寫入之前先避免測試上傳。Greengrinds 作者也提醒 macOS overlay 可能有問題，overlay 失敗本身不代表核心遊戲無法執行。[Greengrinds 作者文件](https://www.construct.net/en/make-games/addons/244/greengrinds/documentation)
6. 只有原 Greenworks 確認因 ABI 或相容性失敗時，再考慮重編或建立 `steamworks.js` adapter；不預先移除 Steam 或假造驗證成功。

若發行端日後更新 Construct exporter，新的遊戲版本可能改用不同 runtime，須重新確認。Construct 現行文件已將 NW.js exporter 列為退役功能，但此事不會讓眼前已存在的 NW.js payload 自動失效。[Construct deprecated features](https://www.construct.net/en/make-games/manuals/construct-3/tips-and-guides/deprecated-features)

## V1.0.12.2 靜態核對（2026-10-25）

在 Windows 用指定安裝的 V1.0.12.2（Steam build 26174490）完成靜態核對，再把指紋登錄進準備工具；沒有在 Mac 上執行。

| 檢查 | 結果 |
| --- | --- |
| 來源 | 安裝的 `package.nw` 共 273 個項目；`scripts/c3runtime.js` 指紋與 `knowledge/catalog.json` 的 V1.0.12.2 相符 |
| 修正位置 | 跟 V1.0.11.2 比對 `execPath`、`\\"`、`"savedir\\`、`"backup\\`、`"save\\` 前後各 60 字元的片段，8 個片段完全相同；命中次數：`_appFolder` 1 次、`_nwjsAppFolder` 1 次、`savedir` 4 次、`backup` 4 次（與前版相同） |
| 其他改動 | `c3runtime.js` 只差遊戲 expression（角色排序、刷新倒數、第六槽計算等）及部分 shader／expression 區塊改成 CRLF 換行，沒碰檔案讀寫 |
| 未變檔案 | `package.json`（icon 仍用反斜線，準備工具照舊修正）、`scripts/main.js`、`greenworks-osx.node` 指紋與下方 V1.0.9.1 相同 |
| 工具核對 | 用準備工具的 `patch_runtime` 產生修正副本，`--verify-runtime` 回報 `game_version` V1.0.12.2 |

尚未做：Mac 原生啟動、Steam 清單、本機存檔／讀檔、新程序重啟讀回。2026-10-27 要在 Mac 補驗時，Steam 正式分支已更新到 V1.0.13.0，V1.0.12.2 無法再取得，所以這版的 Mac 實測不會補；改驗 V1.0.13.0，見下節。

## V1.0.13.0 Mac 補驗（2026-10-27）

環境：Apple M4 Max、macOS 27、CrossOver `NGO-Steam-0` bottle 的正式分支 V1.0.13.0（Steam build 26194770，當天更新）、Mac 版 Steam 已啟動。只用隔離副本，Steam 安裝與原始存檔沒有改動。

| 檢查 | 結果 |
| --- | --- |
| 靜態核對 | `package.nw` 共 273 個項目。`c3runtime.js` 的 4 種修正字串與 V1.0.9.1 已修正副本比對前後各 60 字元，10 處片段完全相同；命中次數 1／1／4／4，與前版相同。原始指紋登錄進 `SCRIPT_SHA256` |
| 準備工具 | `prepare-macos.py --output <repo 外>` 重新下載官方 NW.js 並通過固定 SHA-256；`--verify-runtime` 回報 `game_version` V1.0.13.0 |
| 原生啟動 | 兩個程序都是 `platform=darwin`、`arch=arm64`、NW.js 0.82.0，log 為 `rendering with WebGL 2 [ANGLE (Apple, Apple M4 Max, OpenGL 4.1)]`；遊戲帶來的 Greenworks 初始化成功 |
| 存讀與重啟 | `verify-game.cjs`：雲存檔載入 → 原生存檔 → `--assert` 通過 → 停止 → 新 PID 重啟 → 存檔載入 → `--assert` 通過；兩次遊戲寫出的 `save\ea1save.dat` 雜湊相同，原始存檔與測試來源指紋不變 |
| 隱藏執行 | 沿用 `LSBackgroundOnly` 測試 app、隱藏視窗與靜音設定；結束後沒有殘留程序 |

- 候選 catalog 只把目前 catalog 的 15 個來源指紋換成 V1.0.13.0，放在 repo 外。`verify-game.cjs` 的基準編輯（角色 1 名稱與三類經驗）用的是 V1.0.12.2 知識，這次結果只證明啟動器能存讀，不代表修改器支援 V1.0.13.0。修改器的 V1.0.13.0 改版另於同日以 v2.33 完成（[各版紀錄](../releases.md#v233-遊戲-v10130)）。與 V1.0.12.2 相比，`data.json`、`c3runtime.js`、`kj.json`、`jz.json` 有變。
- 原生「主动」存檔除了 `save\ea1save.dat`，也會在 `game/` 下寫出檔名含反斜線的 `savedir\ea1save.dat`、`savedir\saveinfo.dat`。來源是 `(AppFolder + 資料夾變數) + "\\ea"` 這組以變數組路徑的 expression，V1.0.9.1 就有，準備工具沒有正規化；不是 V1.0.13.0 的新問題。因此 Mac 上手動存檔不會更新 `savedir/` 資料夾裡的雲存檔快取。
- 沒做：遊戲 UI 中的 Steam 雲存檔清單（測試不開視窗）、真實雲端上傳、成就、長時間遊玩。

```text
V1.0.12.2 scripts/c3runtime.js  原始 e6a6d629bf7320344445ac7e6e47085211496e5b6a9498aec13ab1a121abd04b
                                修正 54f926b275e1fed2243b7c901bd1aab7d28682bebffd46eec8ad68182b4019c2
```

## V1.0.14.0 Mac 驗證（2026-10-27）

同一台 Apple M4 Max、CrossOver 正式分支 V1.0.14.0（Steam build 26234362，當天第二次更新）。`c3runtime.js` 4 種修正字串前後各 150 字元與 V1.0.13.0 相同、命中 1／1／4／4，原始指紋登錄進 `SCRIPT_SHA256`；`prepare-macos.py --output <repo 外> --runtime-archive <既有官方壓縮檔>` 準備、`--verify-runtime` 回報 V1.0.14.0。修改器 v2.34 的兩份冒煙（[各版紀錄](../releases.md#v234-遊戲-v10140)）同時涵蓋啟動、雲存檔載入、原生存檔與新 PID 讀回：程序為 `darwin`／`arm64`／NW.js 0.82.0，WebGL 2（ANGLE Apple M4 Max），Greenworks 初始化成功，隱藏執行、結束後沒有殘留程序。

```text
V1.0.14.0 scripts/c3runtime.js  原始 9ced70d01f1a1b82da6952b21130401a017f3a2953b579ece1a97aedbb9cb097
                                修正 5739491ad1aa4ea3a04adc4d42e8970554ecd641bc3a02060778afe5d43184b3
```

## V1.0.15.0 Mac 驗證（2026-10-30）

同一台 Apple M4 Max、CrossOver 正式分支 V1.0.15.0（Steam build 26287157）。`c3runtime.js` 4 種修正字串前後各 150 字元與 V1.0.14.0 相同、命中 1／1／4／4，原始指紋登錄進 `SCRIPT_SHA256`；`prepare-macos.py --output <repo 外> --runtime-archive <既有官方壓縮檔>` 準備、`--verify-runtime` 回報 V1.0.15.0。修改器 v2.36 的冒煙（[各版紀錄](../releases.md#v236-遊戲-v10150)）涵蓋啟動、雲存檔載入、原生存檔與新 PID 讀回，隱藏執行、結束後沒有殘留程序。

```text
V1.0.15.0 scripts/c3runtime.js  原始 efff92f5ad93a0e014f7afb841da59c422f31d3420872154555f8f21975232d2
                                修正 783debe8810a44505507a22edc7864a0a8ac51be843c09cd18ac47ce840726bf
```

## 本次檔案指紋

下列為 V1.0.9.1 `package.nw` 內檔案的 SHA-256，便於日後分辨遊戲更新；不包含遊戲程式或玩家資料本身。

```text
package.json             79173c1a8a3a36445e1fb0734a1d2df63848464058a475be961df70fe4c5ae99
scripts/main.js          a7660e495d5dcbed209f1fdc5092e82483474f6150c43bf38cfebb0029541da5
scripts/c3runtime.js     b5bf45f38e8165bbd5093702695486fe77797a27914bba8b1fdd5f46658396bc
greenworks-osx.node      4fdd1afe628ebf319b96b3a32d25161801b66cc34e6e692a5a2a1004ef7d4ca2
```
