# CI 把關的自動部署 Pipeline 設計

**日期**: 2026-07-19
**專案**: quote-system
**目標**: push 到 `main` 後,CI(lint/test/build)通過才建置 Docker image 並自動部署到 homelab;CI 失敗則不部署。

## 背景

- 現況:`ci.yml` 與 `deploy.yml` 都在 push `main` 時**同時**觸發 — 測試失敗仍會照常部署。
- 已確認:homelab self-hosted runner(`homelab-nextjs-runner`,labels: `self-hosted, homelab`)已註冊但目前 **offline**;使用者選擇維持推送式部署,會自行啟動 runner。
- 已確認決策:採單一 workflow 以 `needs` 串接(否決 `workflow_run` 兩檔方案 — conclusion 檢查與 default-branch 版本等陷阱多)。

## 設計

### 檔案變更

| 動作 | 檔案 |
|---|---|
| 新增 | `.github/workflows/pipeline.yml` |
| 刪除 | `.github/workflows/ci.yml`、`.github/workflows/deploy.yml` |
| 修改 | `README.md` / `README.zh-TW.md` 部署節:提及 pipeline 流程與回滾指令 |

### `pipeline.yml` 結構

**觸發**:`pull_request`(任何分支)與 `push` 到 `main`。

**Job 1 `ci`**(ubuntu-latest,兩種事件都跑):
- checkout → setup-node(node 22, npm cache)→ `npm ci` → `npm run lint` → `npm test` → `npm run build`

**Job 2 `build-and-push`**(ubuntu-latest):
- `needs: ci`;`if: github.event_name == 'push' && github.repository_owner == 'sychen6192'`
- 登入 ghcr(`GITHUB_TOKEN`)→ `docker/build-push-action`
- **標籤兩個**:`ghcr.io/${{ github.repository }}:latest` 與 `ghcr.io/${{ github.repository }}:sha-${{ github.sha }}`(完整 SHA,避免截斷處理)
- `cache-from`/`cache-to`: `type=gha`(加速後續建置)

**Job 3 `deploy`**(`runs-on: [self-hosted, homelab]`):
- `needs: build-and-push`(隱含只在 push + owner 條件成立時執行)
- `concurrency: { group: homelab-deploy, cancel-in-progress: false }` — 連續 push 時部署排隊,不互相取消
- 步驟:
  1. `docker pull` **sha 標籤**(部署的 image 與剛通過 CI 的 commit 一一對應)
  2. `docker stop my-next-app || true && docker rm my-next-app || true`
  3. `docker run -d --name my-next-app -p 3000:3000 --restart unless-stopped --env-file $HOME/quote-system/.env -v $HOME/quote-system/branding:/app/branding ghcr.io/${{ github.repository }}:sha-${{ github.sha }}`
  4. **健康檢查**:`curl -fsS http://localhost:3000/api/branding-icon`,每 3 秒重試、最多 15 次;全失敗則印出 `docker logs my-next-app` 並讓 job 失敗

### 錯誤行為

| 情境 | 行為 |
|---|---|
| CI 失敗 | `build-and-push` 與 `deploy` 皆不執行,不產生 image |
| runner offline | `deploy` job 顯示 queued 等待 runner,不會靜默消失 |
| 健康檢查失敗 | job 標紅 + 輸出容器 log;舊容器已被替換,回滾靠 sha 標籤(見下) |
| fork 的人 push | owner 條件擋住 build 與 deploy,只跑 `ci` |

### 回滾(文件化,不做自動回滾 — YAGNI)

README 部署節加入:`docker run` 指定前一次成功的 `sha-XXXXXXX` 標籤即可回滾;歷史標籤在 GitHub Packages 頁可查。

### 驗收標準

1. YAML 可被解析(本機驗證);push 後 Actions 頁顯示 `ci → build-and-push → deploy` 依賴鏈。
2. PR 事件只觸發 `ci`。
3. 刻意讓測試失敗的 push(僅本機模擬推理,不實際 push 壞 commit)在結構上不可能觸發 build/deploy(`needs` 保證)。
4. runner 啟動後首次 push:三個 job 全綠,homelab 容器換新,健康檢查通過,網站正常。
5. `ci.yml`、`deploy.yml` 已刪除,無殘留重複觸發。

### 前置條件(使用者操作)

- homelab 主機:`~/quote-system/.env` 與 `~/quote-system/branding/` 就位(昨晚遷移產物的複本)。
- 啟動 runner 服務(`sudo ./svc.sh start` 或 systemd `actions.runner.*` 服務;檢查/重裝指令會附在完成報告)。

### 不做(YAGNI)

- 自動回滾、藍綠/金絲雀部署
- staging 環境
- Watchtower 拉取式備援
- Slack/Email 通知(GitHub 內建失敗通知信已足夠)

---

## 修訂:資料庫供應(2026-07-19,首次上線後)

**問題**:首次成功部署後 `invoice.sycomputer.org/zh-TW` 回 500。根因調查(多層邊界抓證據):

- Cloudflare 透傳 origin 的 `HTTP 500`(非 52x),代理正常;
- 同容器 `/api/branding-icon`(不碰 DB)回 200,`/zh-TW`(查 Postgres)回 500;
- 容器的 `DATABASE_URL` 是 Mac 開發殘留值 `postgres://…@localhost:5432/quote_db`,容器內 `localhost` 指向容器自己;
- host `192.168.11.3:5432` 關閉 —— homelab 上根本沒有 Postgres。

原設計的「前置條件:DATABASE_URL 正確」假設不成立:homelab 從未有資料庫,`.env` 又帶入了開發值。原健康檢查打不碰 DB 的 `/api/branding-icon`,因此誤報成功。

**修正**(`deploy` job 擴充):

1. `docker network create quote-net`(冪等)——app 與 db 共享網路。
2. 持久化 Postgres:`quote-db` 容器(`postgres:16-alpine`,named volume `quote-db-data`,`--restart unless-stopped`),三態守衛(running→略過 / stopped→start / 不存在→create),資料跨重部署保留;僅在 `quote-net` 內、不對 host 發佈埠。
3. Schema:`node:22-alpine` 容器跑 `drizzle-kit push --force`(無 TTY 可非互動、冪等 no-op;已本機實測),`$GITHUB_WORKSPACE` 於 runner 容器與 host 同路徑故可掛載。
4. App:加入 `quote-net`,以 `-e DATABASE_URL=…@quote-db:5432/…` **覆蓋** `.env` 的錯誤值(不需手動改 homelab 檔案)。
5. 健康檢查改打 `/zh-TW`(實際查 DB),重試上限提高到 20 次 —— 這類 DB 故障往後會讓部署失敗,不再誤報。

**新驗收**:部署後 `curl https://invoice.sycomputer.org/zh-TW` 回 200 且顯示應用(非 500);`/api/branding-icon` 仍 200。
