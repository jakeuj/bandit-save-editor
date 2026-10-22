# Acorn 建置用解析器

`acorn.cjs` 為 npm `acorn@8.15.0` 的 `dist/acorn.js` 原檔，授權見 `acorn-LICENSE`（MIT）。來源：https://github.com/acornjs/acorn/tree/8.15.0/acorn 。

固定版本隨 repo 保存，讓建置、離線維護與隔離測試副本不必安裝瀏覽器或 npm 相依即可核對證明；不內嵌進網站，也不加入 Pages 發布白名單。更新解析器須另增摘要演算法版本及相容性測試，不直接更換舊版演算法所使用的解析器。
