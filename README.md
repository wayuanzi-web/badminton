# 羽球訓練手冊

羽球的 12 週訓練計畫、日常菜單、規則與知識，加上間歇計時、步法喊點和計分板，做成可安裝的網頁 App（PWA）。不需要帳號，手機點開就能用：

**https://wayuanzi-web.github.io/badminton/**

傳給 LINE 上的球友時，網址後面加 `?openExternalBrowser=1`，連結會用手機的瀏覽器開啟（LINE 內建瀏覽器不能安裝到主畫面）。

## 裝到手機

- **iPhone、iPad**：用 Safari 開網址，按分享鈕，選「加入主畫面」。先加到主畫面再開始設定和記錄，主畫面版本和 Safari 的資料是分開存的。
- **Android**：用 Chrome 開網址，點 App 右上角的設定，最下面有「安裝到這台裝置」。沒出現的話，用 Chrome 選單的「加到主畫面」。

裝好之後從主畫面的圖示開啟，是全螢幕，沒有網路也能用。

## 內容

- **今日**：依計畫排出當天課表，逐項打勾，完成後寫入紀錄。工具有間歇計時、步法點位（語音喊點）、計分板（21 分制與 15 分制）。
- **計畫**：12 週，基礎期、強化期、實戰期各 4 週。程度分入門、中階、進階，每週哪幾天練可以自己排。
- **菜單**：15 套日常菜單、80 個動作說明、飲食建議。
- **知識**：14 篇，規則、握拍、步法、單雙打戰術、裝備、傷害預防、找球友。
- **紀錄**：每週訓練時間、8 項檢測的進步對照、備份與還原。

## 資料存在哪裡

設定、打勾、訓練紀錄只存在那台裝置的瀏覽器（或主畫面 App）裡，不會上傳。換裝置用「紀錄」分頁的備份與還原。

這個網址和同帳號的其他 GitHub Pages 網站（`wayuanzi-web.github.io/…`）共用同一個網域的瀏覽器儲存空間。其他網站如果清除整個網域的資料，這裡的紀錄也會被清掉，所以偶爾備份一次。

## 檔案

| 路徑 | 內容 |
| --- | --- |
| `index.html` `sw.js` `manifest.webmanifest` | 上線的網頁 App，由建置腳本產生，不要直接改 |
| `icon-*.png` `apple-touch-icon.png` | App 圖示 |
| `src/data-plan.js` | 課表、12 週計畫、日常菜單、檢測項目 |
| `src/data-ex.js` | 動作庫：80 個動作的說明、要點、常見錯誤、影片搜尋字 |
| `src/data-learn.js` | 知識文章與飲食文章 |
| `src/logic.js` | 純邏輯：日期、排課、份量、計時序列、計分、統計、資料清洗 |
| `src/app-*.js` `src/styles.css` `src/body.html` | 畫面、工具、操作處理、樣式 |
| `build.mjs` | 建置腳本 |
| `build/` | 內嵌的數字字型（Barlow Condensed 子集，授權見 `build/fonts/OFL.txt`）、圖示產生腳本 |
| `test/` | 測試 |

## 修改與上線

```
node build.mjs --site .     # 重新產生 index.html、sw.js、manifest.webmanifest
git add -A && git commit -m "..." && git push
```

GitHub Pages 從 `main` 分支根目錄發布，推上去約一分鐘後生效。手機上第一次開還是舊版，同時在背景更新；關掉再開一次就是新版。紀錄不受影響。

改內容時：

- 份量寫法在 `src/data-plan.js` 開頭：`M(分鐘)`、`S(組, 次)`、`H(組, 秒)`、`I(動, 休, 回, 組)`、`C(間隔, 點數, 組)`、`T(文字)`。陣列是 `[入門, 中階, 進階]`。
- 段落加 `fix: 1` 表示不隨每週負荷增減（暖身、收操、比賽、跳躍）。
- 項目加 `lv: 1` 表示中階以上才出現，`mx: 0` 表示只有入門出現。
- 建置時會檢查每個課表引用的動作是否存在，有錯會直接失敗。
- 圖示要重畫才執行 `node build/icons.cjs`（需要 `sharp`），再把 `out/site/` 裡的四張 PNG 複製到根目錄。

建置同時會產生：

- `out/site/`：同一份網頁 App，另外帶一個 `_headers`（安全標頭，Cloudflare 會讀）。要放到別的靜態空間時用這個資料夾。
- `out/artifact/badminton-handbook.html`：發布成 Claude Artifact 用的片段。

## 離線與更新的做法

- `sw.js` 安裝時把頁面、manifest、四張圖示存進快取。之後一律先回快取，同時在背景向主機要新的存起來，所以球館訊號很差時也是立刻開啟。
- 快取名稱帶內容雜湊。內容一變，`sw.js` 跟著變，瀏覽器會裝新的、刪掉舊快取。
- 只處理自己的檔案、只清自己的快取（名稱以 `badminton-handbook-` 開頭），不影響同網域的其他網站。
- 資料存在 `localStorage` 的 `badminton-handbook-v1`。讀進來的資料（含貼上的備份）一律經過 `normalize()` 逐欄清洗；畫面輸出一律跳脫。

## 測試

```
node test/logic.test.mjs                      # 排課、份量、計分引擎、資料清洗
node test/contrast.mjs                        # 文字與控制項對比
NODE_PATH=<含 playwright 的 node_modules> node test/flows.cjs       # 主要操作流程
NODE_PATH=... node test/hardening.cjs         # 惡意備份、錯誤資料、鍵盤、窄螢幕
NODE_PATH=... node test/site.cjs              # 獨立版：離線、manifest、下載備份（先在 out/site 開 http.server 8765）
NODE_PATH=... node test/pwa.cjs [網址]        # 可安裝性、離線、訊號差、更新、子資料夾、安裝入口
                                              # 自帶測試主機；加上網址會另外檢查那個真正的主機
```

測試時可用 `window.__BMT_NOW__ = 'YYYY-MM-DD'` 指定今天的日期。

## 會過期的內容

- 計分制度：世界羽聯自 2027-01-04 起以 15 分制為標準計分制（`src/data-learn.js` 的規則文章；計分板用哪一種在設定裡切換）。規則查核日期 2026-10-04。
- 訓練、飲食、傷害處理的內容是一般性建議，不能取代教練、醫師或營養師的評估。
