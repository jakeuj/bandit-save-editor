# 版本遷移重驗任務

- [ ] 1. `prepare-macos.py` 支援已核對指紋清單、中文安裝目錄預設及 `--verify-runtime`；以 V1.0.10.2 package 產生 repo 外副本，確認替換次數與重驗結果。
- [ ] 2. `verify-game.cjs` 在 darwin 接受「原始 15 指紋相符＋已核對補丁」的 runtime，state 記錄兩組雜湊；補拒絕情境的合成測試。
- [ ] 3. 抽出共用的群組必要 checks，新增 `verification-suite.cjs` 群組清單，並以測試確保 22 群組全數涵蓋、與 build-editor 一致。
- [ ] 4. 實作 `eventDigest` 正規化摘要，計算 V1.0.10.2 的 5 個 UI 群組摘要並補記到 verification；build-editor 接受並核對 `ui.source`。
- [ ] 5. 撰寫各家族的代表子集生成器（經驗與名稱、v2.1 進階、v2.2 係數／丹藥、v2.3 替換、v2.4 背包與選槽、v2.5 品質），並在 VM 核心開閘套用驗證。
- [ ] 6. 實作 `verify-migration.cjs` 的逐副本步驟執行、失敗停止、PID 清理與 repo 外結果輸出。
- [ ] 7. 實作自動寫回：指紋不同且全部原生 checks 通過才寫，UI 不符的群組寫成關閉；建置失敗即還原，相同指紋只出比較報告。
- [ ] 8. 在這台 Mac 對 V1.0.10.2 跑完整排練：Mac Steam 真實初始化、全部副本通過、UI 摘要沿用成立，比較報告與現有證明的群組及 checks 一致。
- [ ] 9. 更新 AGENTS.md、維護指引、UI 手冊、技能與路線圖的政策及操作；執行建置、`--check` 與全部測試。

## 驗收條件

- 情境：在 Mac 對 V1.0.10.2 執行流水線，約 10 個隔離副本都完成載入、原生存檔、新 PID 重啟與讀回，玩家原檔與 `~/bandit-mac-port` 的雜湊都沒有變。
- 情境：排練時指紋與現有證明相同，流水線只輸出比較報告，`knowledge/verification.json` 與 catalog 一個位元都不改。
- 情境：模擬新版指紋且全部原生 checks 通過時，自動寫入 verification 與 catalog 旗標，並重建 HTML；`build-editor.cjs --check` 與全部測試通過。
- 情境：任一步失敗，或寫回後建置失敗，就不留下任何部分寫入，報告會指出失敗的群組與步驟。
- 情境：UI 事件子樹的摘要改變時，首次選槽或品質群組以關閉狀態寫入，報告列出要補的最小 UI 測試；其他群組照常開放。
- 情境：未加入清單的新群組在 catalog 開啟時，合成測試失敗並指出缺少的群組。
- 情境：Mac 副本的 runtime 有任何非預期差異，或原始 package 指紋不符，setup 停止，不建立測試程序。
