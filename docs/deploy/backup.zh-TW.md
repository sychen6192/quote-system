# 備份、還原與搬移伺服器

[English](backup.md)

以下指令都在安裝目錄（預設為 `~/quote-system`）中執行。

## 需要備份什麼

| 項目 | 位置 | 原因 |
|---|---|---|
| 資料庫 | Docker volume `quote-system_postgres_data` | 報價單、客戶、設定，以及上傳的 Logo、大小章與圖示 |
| `.env` | 安裝目錄 | 密碼與金鑰；資料庫 volume 只接受建立時的 `POSTGRES_PASSWORD` |
| `branding/` | 安裝目錄 | 僅在仍以圖片檔（而非上傳）設定品牌圖片時需要 |
| Caddy 資料 | Docker volume `quote-system_caddy_data` | 僅在使用 https profile 與 Caddy 自有憑證時需要；遺失後每台裝置都得重新信任新憑證 |

備份資料庫最可靠的方式是匯出資料庫備份檔（見下方），不要在 PostgreSQL 執行中直接複製 volume 的檔案。

## 每日自動備份

```sh
docker compose --profile backup up -d
```

或在 `.env` 加上 `COMPOSE_PROFILES=backup`（或 `https,backup`），再執行 `docker compose up -d`。

`backup` 服務啟動後會立即寫入一份 `backups/quote-YYYYMMDD-HHMMSS.dump`（PostgreSQL custom 格式，已壓縮），之後每隔 `BACKUP_INTERVAL_SECONDS`（預設 86400 秒，即一天）再備份一次，並刪除超過 `BACKUP_KEEP_DAYS`（預設 14 天）的舊檔。`docker compose logs backup` 可查看每次執行的結果。

備份檔和資料放在同一顆硬碟上，硬碟壞了就一起不見了。請定期把 `backups/` 與 `.env` 複製到其他地方，例如使用 `rsync`、`rclone`、Synology Hyper Backup 或 QNAP Hybrid Backup Sync。

每份備份檔都包含所有客戶、報價單與設定（含公司大小章），因此和 `.env` 一樣，只有 `backups` 資料夾的擁有者（執行安裝程式的使用者）能讀取：資料夾權限為 700，備份檔為 600。若資料夾是你手動建立的，請以 `chmod 700 backups` 限制權限。

確認備份檔可以讀取：

```sh
docker compose exec -T db pg_restore --list < backups/quote-20261009-030000.dump | head
```

## 手動備份

```sh
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > quote-$(date +%F).dump
```

## 還原

此操作會刪除整個資料庫，再以備份檔的內容重建。請先停止 App（若有使用備份服務，也一併停止），重新建立空白資料庫並還原，最後再啟動 App：

```sh
docker compose stop app backup
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < quote-2026-10-09.dump
docker compose start app
```

`pg_restore` 必須在沒有任何錯誤訊息的情況下完成。若中途出現錯誤而停止，請先排除原因（通常是檔名打錯，或檔案不是 `pg_dump -Fc` 產生的備份檔），再從 `dropdb` 那一行重新執行；不要讓 App 在只還原一半的資料庫上啟動。若有使用 backup profile，最後再以 `docker compose start backup` 重新啟動備份服務。

因為是還原到空白資料庫，跨版本還原才安全：可以還原舊版本產生的備份檔，App 啟動時會自動套用較新的 migration。但不支援把*較新*版本的備份檔還原到舊版 App。

## 搬移到新伺服器

1. 在舊伺服器手動備份（見上方），並停止 App：`docker compose stop app`。
2. 在新伺服器照常安裝（`sh install.sh`）。使用新產生的 `.env` 即可，備份檔中不含任何密碼。若想沿用舊的 `APP_PASSWORD` 與 `RESEND_API_KEY`，請從舊的 `.env` 複製過來。
3. 將備份檔複製到新伺服器，依照〈[還原](#還原)〉的指令還原。新伺服器的版本比舊伺服器新也沒關係。
4. 若使用 Caddy 自有憑證，請一併複製 `caddy_data` volume，或在每台裝置上信任新伺服器的憑證。

## 更換資料庫密碼

`.env` 中的 `POSTGRES_PASSWORD` 只在資料庫首次建立時套用。之後若要更換：

```sh
docker compose exec db psql -U postgres -d quote-system -c "ALTER USER postgres PASSWORD 'NewPassword123'"
```

（若修改過 `POSTGRES_USER` 或 `POSTGRES_DB`，請改用你的設定值。）接著在 `.env` 設定 `POSTGRES_PASSWORD=NewPassword123`（只用英文字母與數字），再執行 `docker compose up -d`。

如果 `.env` 遺失，也可以用同一個指令設定新密碼；在容器內執行 `psql` 不需要舊密碼。

## 升級 PostgreSQL 主要版本

發行套件固定使用 `postgres:16-alpine`，而 PostgreSQL 的不同主要版本無法直接讀取彼此的資料檔。若要升級到例如 PostgreSQL 17：

1. 手動備份，並另外保留一份複本。
2. 停止所有服務並移除舊的資料 volume：

   ```sh
   docker compose down
   docker volume rm quote-system_postgres_data
   ```

3. 在 `docker-compose.override.yml` 覆寫映像檔（升級發行套件時不會被覆蓋）：

   ```yaml
   services:
     db:
       image: postgres:17-alpine
     backup:
       image: postgres:17-alpine
   ```

4. 先只啟動資料庫並還原，再啟動其他服務：

   ```sh
   docker compose up -d db
   docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --exit-on-error' < quote-2026-10-09.dump
   docker compose up -d
   ```

PostgreSQL 18 的映像檔將資料放在 `/var/lib/postgresql`，而非 `/var/lib/postgresql/data`；若要升級到 18，請一併在 override 中調整 volume 路徑。
