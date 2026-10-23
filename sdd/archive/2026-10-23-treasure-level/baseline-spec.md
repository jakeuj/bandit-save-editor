# 寶物等級：原生基準準備規格（任務 2）

狀態：2026-10-23 規格與候選 manifest 完成；**沒有原生執行、沒有首次證明、兩庫旗標關閉**。研究：[treasure-level.md](../../../docs/research/treasure-level.md)；任務：[tasks.md](tasks.md)。

## 基準與來源

- 來源：本機 `.local/game-sources.json` 的 preferredSourceId（V1.0.11.2，build 26126719）完整快取；15 指紋與目前 catalog 相符，`wp.json` SHA-256 與 catalog 相同。未重新解包。
- 170 個寶物範本（wp：kind=宝物、category=装备、部位 6）：T1–T6 為 21／25／29／31／31／33。

## 候選 manifest

實作：[treasure-level-scenarios.cjs](../../../scripts/treasure-level-scenarios.cjs)；測試：[treasure-level-matrix.test.cjs](../../../tests/treasure-level-matrix.test.cjs)。共 12,420 案，綁定 15 指紋、wp 範本摘要、腳本摘要與本機基準／runtime／來源 manifest 雜湊（repo 外）。

| 類型 | 數量 | 群組 | 分類 |
| --- | ---: | --- | --- |
| level | 12,240 | 背包 4,080；穿戴／未穿戴 z9 8,160 | unknown-native-generation |
| cost | 72 | treasureLevel | oracle-only |
| decompose | 72 | backpackTreasureLevel | oracle-only |
| reject | 36 | 依庫別 | policy-rejection |

- level：170 範本 × Q1–Q6 × 三狀態（backpack／stored／equipped 第 6 槽）× 邊界 1→2、2→1、cap−1→cap、cap→cap−1。
- cost：T1–T6 × Q1/Q6 × 魂魄不足／恰足／充足／封頂前最大／已封頂／最大升級。
- decompose：T1–T6 × Q1/Q6 × 等級 1／cap × 單件／批次未鎖定／批次鎖定；固定返還 20／200／1,000／10,000／50,000／500,000。
- reject：Q0、Q7、等級 0、超限、小數、字串、未知範本、數量≠1、錯誤等階、錯誤 owner、重複 owner、錯誤庫別。

## 合法、拒絕、未知

- **合法候選**：上列 level／cost／decompose。必須由原生取得（E1 特定裝備取得）建立合法 metadata；原生無法產生的範本×品質組合列為缺口，不人工假造也不縮小分母。
- **拒絕**：由編輯器政策拒絕，不需原生；拒絕後存檔位元組與歷史不變。
- **未知**：未知 metadata（y22、y23、y24 等）、原生降級行為、y50–59 搬移後狀態、分解越界列；觀察後回寫規格，未觀察前維持缺口並使對應群組關閉。

## 原生基準前置清單

1. 取得：呼叫特定裝備取得，記錄完整 60 欄、型別、品質重抽次數；Q 與詞條不由人工填寫。
2. 搬移：z7↔z9 以 y0–49 複製；另監看 y50–59；以實際目的列定位，y0 不要求等於列號。
3. 穿卸：第 6 槽（save[角色,21,2]）與 z9 y7 唯一互指；替換既有第 6 槽時追蹤被替換列。
4. 升級成本：逐級 C(L,T)=round(10×1.05^((T−1)×30+4L) − 1)，−1 在 round 內、指數外（任務 3 已對來源運算式核對）；oracle 預期不取自被測 core（任務 5）。
5. 分解：背包列清空、僅增魂魄、其他列不變；批次依品質與 y22 篩選。
6. 每階段原版存檔、停止、新 PID 讀回（任務 6、9）。

## 分片與續跑

`shard(manifest,{index,total,kinds})` 以案例序號取模分片；`emptyProgress／recordResult／validateProgress／summary` 記錄結果，拒絕重複、未知案例、摘要不符、合成冒充原生與失敗改標通過。progress 綁 manifestHash；來源或範本變動使 manifest 失效須重建。`summary.nativeComplete` 與兩群組在原生執行（任務 5、6、9）前恆為 false。
