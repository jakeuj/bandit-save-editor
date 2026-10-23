# 專案工作指引

使用台灣繁體中文。本 repo 維護山寨帳房存檔修改器與實驗性 macOS ARM64 啟動器。

## 任務入口

- 處理本專案的開發、研究、測試、發布或 GitHub 維護時，先載入 [bandit-save-editor 技能](.agents/skills/bandit-save-editor/SKILL.md)，再依任務表只讀相關文件；不要預設載入全部維護資料。一般對話不需載入。
- 技能未出現在清單時，直接讀上述正本照做；載入或連結異常依[技能載入與連結修復](.agents/skills/bandit-save-editor/references/skill-loading.md)處理。
- 問「現在做到哪／下一步做什麼／繼續實作下一版」時，從[下一步與目前進度](docs/research/next-version-plan.md)承接，操作規則見技能的進度承接入口。
- 目前規劃、功能狀態與證據以最新 repo 文件及當前對話為準；歷史盤點、舊 prompt 與執行紀錄不當作新授權。

## 共通界線

- 保留其他工作中的變更，只提交當次授權範圍。
- 真實存檔、遊戲 payload、runtime、原始 log 與 crash dump 留在 repo 外；公開文件與技能只放程式、合成資料及去識別知識。
- 開發依[輕量開發流程](docs/maintenance/lightweight.md)：新增寫入功能用預設關閉的旗標，通過合成測試與一次隔離遊戲冒煙才開；詳細寫入與復原規則由技能導向核心與各功能文件。

## 指引維護

AGENTS.md 只保留常駐規則與入口；任務操作放技能或其指向的維護文件，公式與實測證據放研究文件（新功能不建 SDD，既有 `sdd/` 為歷史紀錄）。更新規則或拆分文件時，依技能「規則同步檢查」核對入口、保留證據並修正連結；交付說明 AGENTS 已調整或核對後無需調整。
