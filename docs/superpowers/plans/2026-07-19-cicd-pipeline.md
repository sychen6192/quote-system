# CI-Gated Homelab Deploy Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 單一 GitHub Actions workflow:CI(lint/test/build)通過才建 image(latest + sha 標籤)並部署到 homelab runner,含部署後健康檢查。

**Architecture:** 三個 job 以 `needs` 串接於 `.github/workflows/pipeline.yml`;PR 只跑 `ci`;`build-and-push` 以 `github.event_name == 'push' && repository_owner == 'sychen6192'` 防護;`deploy` 依 GitHub 的 skipped-needs 語意自動跟著跳過。刪除既有 `ci.yml` 與 `deploy.yml`。

**Tech Stack:** GitHub Actions、docker/build-push-action@v5(+ setup-buildx、type=gha cache)、self-hosted runner(labels: self-hosted, homelab)。

**Spec:** `docs/superpowers/specs/2026-07-19-cicd-pipeline-design.md`

## Global Constraints

- Image 標籤:`ghcr.io/${{ github.repository }}:latest` 與 `:sha-${{ github.sha }}`(完整 SHA);deploy 一律用 sha 標籤。
- 容器參數與現行部署一致:`--name my-next-app -p 3000:3000 --env-file $HOME/quote-system/.env -v $HOME/quote-system/branding:/app/branding`,另加 `--restart unless-stopped`。
- 健康檢查:`curl -fsS http://localhost:3000/api/branding-icon`,3 秒間隔、最多 15 次,失敗印 `docker logs` 後 exit 1。
- Commit 訊息結尾:`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

---

### Task 1: `pipeline.yml` 取代兩個舊 workflow

**Files:**
- Create: `.github/workflows/pipeline.yml`
- Delete: `.github/workflows/ci.yml`、`.github/workflows/deploy.yml`

**Interfaces:**
- Produces: workflow jobs `ci` → `build-and-push` → `deploy`(Task 2 的 README 文字引用此流程與 sha 標籤回滾)。

- [ ] **Step 1: 寫入 `.github/workflows/pipeline.yml`**(完整內容如下)

```yaml
name: Pipeline

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build

  build-and-push:
    needs: ci
    if: github.event_name == 'push' && github.repository_owner == 'sychen6192'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:sha-${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    # needs 的 job 被 skip 時本 job 會自動 skip(PR 與 fork 都不會部署)
    needs: build-and-push
    runs-on: [self-hosted, homelab]
    concurrency:
      group: homelab-deploy
      cancel-in-progress: false
    steps:
      - name: Pull exact CI-verified image
        run: docker pull ghcr.io/${{ github.repository }}:sha-${{ github.sha }}

      - name: Replace container
        run: |
          docker stop my-next-app || true
          docker rm my-next-app || true
          docker run -d --name my-next-app -p 3000:3000 \
            --restart unless-stopped \
            --env-file $HOME/quote-system/.env \
            -v $HOME/quote-system/branding:/app/branding \
            ghcr.io/${{ github.repository }}:sha-${{ github.sha }}

      - name: Health check
        run: |
          for i in $(seq 1 15); do
            if curl -fsS http://localhost:3000/api/branding-icon > /dev/null; then
              echo "healthy after ${i} attempt(s)"
              exit 0
            fi
            sleep 3
          done
          echo "health check failed; container logs:"
          docker logs my-next-app || true
          exit 1
```

- [ ] **Step 2: 刪除舊 workflow**

```bash
git rm .github/workflows/ci.yml .github/workflows/deploy.yml
```

- [ ] **Step 3: 驗證 YAML 可解析**(macOS 內建 ruby)

Run: `ruby -ryaml -e 'YAML.load_file(".github/workflows/pipeline.yml"); puts "yaml ok"'`
Expected: `yaml ok`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "ci: single pipeline — deploy only after CI passes, sha-tagged images, health check

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: README 部署節更新(EN + zh-TW)

**Files:**
- Modify: `README.md`(Deployment 節的 blockquote)
- Modify: `README.zh-TW.md`(部署節的 blockquote)

**Interfaces:**
- Consumes: Task 1 的 pipeline 流程與 `sha-<commit>` 標籤慣例。

- [ ] **Step 1: `README.md` — 把原 blockquote 換成 pipeline 說明與回滾指令**

原文(要被取代):

```markdown
> `.github/workflows/deploy.yml` is the author's personal homelab pipeline and is guarded by a `repository_owner` condition — it will not run on forks.
```

新文:

```markdown
> `.github/workflows/pipeline.yml` runs lint/test/build on every push and PR. On the author's repo it additionally builds a Docker image (tagged `latest` and `sha-<commit>`) **only after CI passes**, then deploys it to a homelab self-hosted runner with a post-deploy health check — both steps are guarded by a `repository_owner` condition and will not run on forks.
>
> **Rollback:** every deploy is pinned to its commit — rerun the container with a previous tag: `docker run ... ghcr.io/<owner>/quote-system:sha-<previous-commit>` (tags are listed under GitHub Packages).
```

- [ ] **Step 2: `README.zh-TW.md` — 同樣替換**

原文(要被取代):

```markdown
> `.github/workflows/deploy.yml` 是原作者個人 homelab 的部署流程,已用 `repository_owner` 條件保護 — fork 不會觸發。
```

新文:

```markdown
> `.github/workflows/pipeline.yml` 對每個 push 與 PR 執行 lint/test/build;在原作者的 repo 上,**CI 通過後**才會建置 Docker image(`latest` 與 `sha-<commit>` 雙標籤)並部署到 homelab self-hosted runner,部署後有健康檢查 — 這兩步都有 `repository_owner` 條件保護,fork 不會觸發。
>
> **回滾**:每次部署都綁定 commit — 用前一個標籤重跑容器即可:`docker run ... ghcr.io/<owner>/quote-system:sha-<前一個 commit>`(標籤清單在 GitHub Packages 頁)。
```

- [ ] **Step 3: 驗證與 Commit**

Run: `grep -c "pipeline.yml" README.md README.zh-TW.md`(各應 ≥1)、`grep -c "deploy.yml" README.md README.zh-TW.md`(各應為 0)

```bash
git add README.md README.zh-TW.md
git commit -m "docs: deployment section reflects CI-gated pipeline and rollback

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review 紀錄

- Spec 覆蓋:pipeline 結構/標籤/健康檢查/concurrency(T1)、舊檔刪除(T1 Step 2)、README 回滾文件(T2)— 全數對應。驗收第 4 條(runner 啟動後首推全綠)屬 push 後的實機驗證,列入完成報告的使用者步驟。
- Placeholder:無 TBD;所有程式碼與指令完整。
- 一致性:sha 標籤在 build/deploy/README 三處寫法一致(`sha-${{ github.sha }}` / `sha-<commit>` 文件慣例)。
```
