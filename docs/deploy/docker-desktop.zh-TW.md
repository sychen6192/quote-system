# Windows 與 macOS 的 Docker Desktop

[English](docker-desktop.md)

想在筆電上試用 Quote System，或在全天開機的 PC、Mac mini 上給小型辦公室使用，Docker Desktop 是最簡單的方式。請安裝 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 並啟動，等它顯示引擎正在執行即可。

## macOS

開啟「**終端機**」，執行安裝程式，步驟與 Linux 完全相同：

```sh
curl -fsSLO https://github.com/sychen6192/quote-system/releases/latest/download/install.sh
sh install.sh
```

程式會安裝到 `~/quote-system` 並顯示登入密碼。接著開啟 `http://localhost:3000`。

## Windows

### PowerShell

```powershell
mkdir $HOME\quote-system
cd $HOME\quote-system
curl.exe -fsSLO https://github.com/sychen6192/quote-system/releases/latest/download/quote-system-deploy.tar.gz
tar -xzf quote-system-deploy.tar.gz
copy .env.example .env
notepad .env
```

請輸入 `curl.exe` 而不是 `curl`：在 Windows PowerShell 中，`curl` 是另一個指令。在記事本中設定以下三行後存檔：

```ini
POSTGRES_PASSWORD=<只用英文字母與數字>
AUTH_SECRET=<至少 32 個隨機字元>
APP_PASSWORD=<大家共用的登入密碼>
```

以下 PowerShell 指令每次執行都會產生一組合適的隨機字串：

```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
```

啟動後開啟 `http://localhost:3000`：

```powershell
docker compose up -d
```

### WSL（Ubuntu）

開啟 Docker Desktop 的 WSL 整合（「**Settings → Resources → WSL integration**」）後，也可以在 Ubuntu 終端機中執行 `install.sh`，步驟與 Linux 相同。

## 從其他裝置使用

同一個網路中的其他電腦與手機，可以開啟 `http://<這台電腦的 IP>:3000`（Windows 用 `ipconfig` 查詢，macOS 在「**系統設定 → 網路**」查看）。若 Windows 詢問是否允許 Docker Desktop 在私人網路上接受連線，請選擇允許。

要在手機上安裝 App 需要 HTTPS。在桌上型電腦上最簡單的做法是使用 [Tailscale](https.zh-TW.md#tailscale私人網路只有你的裝置能連)，其他方式請見〈[HTTPS 設定指南](https.zh-TW.md)〉。

## 保持運作

- 「**Docker Desktop → Settings → General → Start Docker Desktop when you sign in**」：Docker 啟動後，容器會自動重新啟動。
- 筆電進入睡眠時，其他人也就無法使用 App。辦公室使用建議改用全天開機的電腦或 [NAS](nas.zh-TW.md)。
- 請備份 `backups` 資料夾與 `.env`（見〈[備份指南](backup.zh-TW.md)〉）。

## 升級

```sh
cd ~/quote-system           # PowerShell：cd $HOME\quote-system
docker compose pull
docker compose up -d
```
