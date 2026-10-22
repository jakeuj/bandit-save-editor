# 技能載入與連結修復

僅在專案技能未出現在技能清單，或 Claude 技能連結異常時讀取。正常維護直接使用 `.agents/skills/bandit-save-editor/SKILL.md` 正本，不另存副本。

1. 技能清單缺少 `bandit-save-editor` 時，先直接讀正本並遵循其中規則，再檢查 `.claude/skills/bandit-save-editor`。Codex 直接掃描 `.agents/skills`；Claude 入口應為指向正本的相對 symlink，修復它不等於 Codex 已重新載入。
2. 若 Claude 入口是內容僅為相對路徑的一般檔案（Windows `core.symlinks=false` 常見），先核對該路徑沒有使用者變更，再執行 `git config core.symlinks true`，僅移除該一般檔案並執行 `git checkout -- .claude/skills/bandit-save-editor` 重建連結。其他異常先查明，不直接覆寫目錄或使用者檔案。
3. 若 symlink 權限不足，可在本機建立 directory junction 指向 `.agents/skills/bandit-save-editor`；先核對來源與目標均在預期 repo 範圍，不提交 junction，也不複製另一份技能。
4. 確認可經連結讀到 `SKILL.md`，並告知使用者須開新工作階段才會重新載入技能。當前工作階段沿用已直接讀取的正本，不把連結修復當作技能發現已生效的證據。
