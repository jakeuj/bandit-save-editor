# 山寨帳房

《塔防山賊模擬器》的繁體中文存檔修改器。用瀏覽器讀取 `.dat`、修改並匯出副本，存檔全程在本機處理，不會上傳。

**[開啟修改器](https://bandit.jakeuj.com/)** · [操作教學](https://github.com/jakeuj/bandit-save-editor/wiki/操作教學) · [常見問題](https://github.com/jakeuj/bandit-save-editor/wiki/常見問題) · [Wiki 首頁](https://github.com/jakeuj/bandit-save-editor/wiki)

## 快速開始

1. 開啟修改器，選取要修改的遊戲進度檔，例如 `ea3save.dat`。
2. 修改資源、角色或裝備；需要預覽的操作先確認結果，再套用，最後從「檢視變更」核對。
3. 下載原檔備份，再匯出修改副本，例如 `ea3save.modified.dat`。
4. 結束遊戲，另行備份原始存檔，將修改副本改回原檔名，放回取出時的相同位置。
5. 重新開啟遊戲，載入對應存檔確認。

本機存檔、自動備份與雲存檔快取可能位於不同位置，請確認取出與放回的是同一份進度。Mac 路徑見[啟動器說明](launcher/README.md)。

## 功能

| 類別 | 可以做什麼 |
| --- | --- |
| 資源與名稱 | 修改銅錢、共用經驗、魂魄、科技點、操練點、材料數量及山寨／角色名稱 |
| 角色養成 | 增加角色、已習得職業與九項技藝經驗，依遊戲公式聯動結算；調整符合資格的一般隨機角色基礎資質、技藝上限與天賦等級 |
| 物品與裝備 | 調整既有普通裝備等級、品質與詞條係數，精準洗練合法詞條；升降既有套裝等級，保留套裝積分；調整丹藥資質累積增量 |
| 山寨與科技 | 設定職業操練上限與進階科技 31–44 |
| 批次操作 | 多角色經驗、單角色全部已習得職業／技藝經驗、同庫普通裝備升滿、進階科技同值；先預覽，全部合格才套用 |
| 圖鑑與查詢 | 查看角色、裝備及欄位資料；職業圖鑑可查 47 個繁中職業與轉職路線，不載入存檔也能使用 |
| 比對與復原 | 比對兩份存檔並匯出 CSV，檢視變更、還原累計修改或復原上一步；支援自訂欄位設定匯入與匯出 |

匯出只替換指定值，保留其他原始 JSON 文字。關聯欄位會整組還原；「復原一步」回到上一筆操作。完整功能限制與各版驗收見[各版紀錄](docs/releases.md)。

### 相容性與修改限制

- v2.10 的知識基準為遊戲 **V1.0.11.2**。請以編輯器顯示的遊戲版本核對；存檔沒有可靠的完整 build 指紋，能開啟不代表新版已相容。
- 一般模式遵守原版上限，進階模式只開放已實測範圍。尚未核實或關聯複雜的欄位保持唯讀，自訂座標不能繞過限制。
- 經驗操作會聯動等級與餘額，不扣共用經驗池，也不增加遣散／重生退款基數。職業須已習得，且角色未設定自動轉職。
- 基礎資質、技藝上限及天賦調整限符合資格的一般隨機角色，須通過原版組合與關聯檢查；天賦 ID 不能更換或清空。

欄位座標、公式及來源證據見[存檔知識調查](docs/research/save-knowledge.md)，個別功能規則由[維護索引](docs/maintenance.md)進入。

## 安裝 App 與離線使用

可選擇兩種方式：

- **安裝 App**：首次連線開啟網站，等顯示「可離線使用」，再使用「安裝山寨帳房」或瀏覽器安裝選單。iPhone／iPad Safari 使用「加入主畫面」，支援的 Mac Safari 使用「加入 Dock」。之後可離線選檔、修改、比對與匯出，存檔不會加入網站快取。
- **下載單檔 HTML**：從網站下載後，用 Edge 或 Chrome 直接開啟即可離線編輯，不需 Node.js、後端或外部遊戲資料表。

**關閉前請先匯出，未匯出的修改不會保留。** App 新版會在背景準備，等所有帳房分頁與視窗關閉後更新，不會在編輯途中強制重新載入。清除快取後需重新連線準備；外部指南、準備工具及下載單檔 HTML 仍需網路。

## 討論與問題回報

- [Issues 問題回報](https://github.com/jakeuj/bandit-save-editor/issues)：回報錯誤或提出功能需求。
- [Discussions 討論區](https://github.com/jakeuj/bandit-save-editor/discussions)：使用交流；初次認識可看[山寨帳房介紹與使用入口公告](https://github.com/jakeuj/bandit-save-editor/discussions/3)。

## 專案進度

公開進度與候選見[下一版規劃](docs/research/next-version-plan.md)，詳細任務及驗收依據見 [SDD](sdd/)。候選項目不代表已排定版本或正式開放。

[山寨帳房 Project](https://github.com/users/jakeuj/projects/3) 以「待辦」、「進行中」、「已完成」追蹤開發與驗收；目前為私人專案，需具存取權限才能查看。

- v2.10 套裝等級：支援背包／裝備庫及穿戴中裝備，限 Q1–Q6、T1–T9 與品質上限；保留積分、品質、詞條及合成來源。兩庫首次獨立原生證明已通過，範圍與驗收見[本版說明](docs/releases.md#v210-套裝等級)。
- v2.8.1 鞏固版（遊戲 V1.0.11.2）：當時將 z9 套裝等級改為唯讀，待獨立證明；該版不新增修改功能。舊存檔已升級套裝不追溯、不算載入失敗，該件等級保持唯讀且無法由本版還原。

## 本機開發

直接開啟 `index.html` 即可使用編輯器。修改程式與執行測試需 Node.js 22 以上：

```sh
npm ci --ignore-scripts
node scripts/build-editor.cjs
node scripts/build-editor.cjs --check
```

程式來源位於 `src/`，知識資料位於 `knowledge/`；建置會同步 HTML 內嵌程式與 `sw.js` 快取版本。不要直接修改產生的內嵌程式。

依變更選跑[測試指引](docs/testing.md)中的相關測試；需要 headless 瀏覽器測試時，再執行 `npx playwright install --only-shell chromium`。完整驗收入口為 `npm run verify:release`，按需執行。

PWA 需以 localhost HTTP 或 HTTPS 提供完整目錄；`file://` 只使用單檔編輯功能，不註冊 Service Worker。GitHub Pages 由 `.github/workflows/pages.yml` 發布，提交、部署及驗證流程見[發布指引](docs/maintenance/release.md)。

### 開發與研究文件

| 需求 | 入口 |
| --- | --- |
| 核心 API、功能維護、知識更新 | [維護索引](docs/maintenance.md) |
| 開發測試與驗收範圍 | [測試指引](docs/testing.md) |
| 欄位座標、成長公式與來源證據 | [存檔知識調查](docs/research/save-knowledge.md) |
| 遊戲改版、來源核對與按影響驗證 | [版本遷移](docs/maintenance/migration.md) |
| 歷史版本核對與實測 | [V1.0.11.2 調查](docs/research/v1.0.11.2-audit.md)／[V1.0.10.2 調查](docs/research/v1.0.10.2-audit.md) |
| 架構與跨檔關係 | [Repo 知識圖譜](docs/research/repository-graph.md) |
| 已發布功能、限制與驗收紀錄 | [各版紀錄](docs/releases.md) |
| Agent 工作入口 | [AGENTS.md](AGENTS.md) |

本 repo 不包含玩家存檔、完整遊戲程式或原始分析資料；測試使用合成資料，真實遊戲與存檔驗證在 repo 外的隔離副本進行。

## 實驗性 macOS 啟動器

另提供 [Mac 原生執行指南](https://bandit.jakeuj.com/mac.html)與準備工具，用於 macOS ARM64 原生執行研究。歷史測試曾確認啟動、Steam 雲存檔清單與 DLC 辨識，以及隔離副本的本機存讀與重啟；這些結果不代表新版遊戲已完成相同驗證，長時間遊玩、真實雲端上傳與成就仍待驗證。

準備方式與存檔位置見[啟動器說明](launcher/README.md)，版本及實測範圍見 [Mac 執行研究](docs/research/macos-runtime-investigation.md)。
