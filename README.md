# Tomo

基于本地 Git 仓库的轻量团队文档工具。文档是纯 Markdown，历史是真实 Git commit，随时可 `git clone` 拿走。

## 架构

```
Browser
  └── 前端 (React + Vite, :5173)
        └── /api 代理到后端
              └── 后端 (Node + Express, :4000)
                    └── 本地 Git 仓库 (isomorphic-git)
                          └── Markdown 文件
```

读走文件系统、写走 git library、搜索走内存索引。详见 `TOMO_ARCHITECTURE.md` 第 23–24 节。

## 技术栈

- 前端：React 18 + TypeScript + Vite 6 + TipTap（所见即所得编辑器）
- 后端：Node + Express + TypeScript + isomorphic-git

## 运行

### 1. 启动后端

```bash
cd server
cp .env.example .env      # 按需修改：仓库路径、端口、共享密码
npm install
npm run dev               # http://localhost:4000
```

首次启动会自动在 `TOMO_REPO_PATH`（默认 `server/tomo-docs`）创建并 `git init` 一个仓库。

### 2. 启动前端

```bash
npm install
npm run dev               # http://localhost:5173
```

前端 `/api` 请求通过 Vite 代理转发到后端 `:4000`。

打开 http://localhost:5173 后会看到登录页，用种子管理员账号登录（默认 `admin` / `admin`，可在 `.env` 改）。

> 若 `npm install` 报 rollup/esbuild 平台二进制缺失，先 `rm -rf node_modules package-lock.json` 再装。

## Docker 部署

生产用单容器方案：后端同时托管 API 和前端静态文件，一个镜像、一个端口、一个数据卷。

```bash
# 1. 准备环境变量
cp .env.example .env
# 编辑 .env，至少设置：
#   TOMO_SESSION_SECRET  （openssl rand -hex 32 生成）
#   TOMO_ADMIN_PASSWORD  （管理员初始密码）

# 2. 构建并启动
docker compose up -d --build

# 3. 访问
# http://<服务器>:4000  用 .env 里的管理员账号登录
```

数据绑定挂载到部署目录下的 `appdata/`（容器内 `/data`）：

- `appdata/tomo-docs` — 文档 Git 仓库
- `appdata/users.json` — 用户与密码哈希

文档随时可取走：`git -C appdata/tomo-docs log`，或直接 `git clone appdata/tomo-docs`。容器内进程以 root 运行，`appdata/` 内文件归 root，宿主机直接编辑可能需 `sudo`。

### 从旧版 `tomo-data` 命名卷升级

旧版 compose 使用 Docker 命名卷 `tomo-data`。升级到当前 `./appdata:/data` 绑定挂载前，先把旧卷内容复制出来，否则启动后会看到一个全新的空仓库。

```bash
docker compose down
mkdir -p appdata

# 找到旧版 compose 创建的 volume，通常以 tomo-data 结尾
OLD_VOLUME="$(docker volume ls --format '{{.Name}}' | grep 'tomo-data$' | head -n 1)"
test -n "$OLD_VOLUME"

docker run --rm \
  -v "$OLD_VOLUME:/from:ro" \
  -v "$PWD/appdata:/to" \
  alpine sh -c 'cp -a /from/. /to/'

docker compose up -d --build
```

放到反向代理后面（推荐，便于上 HTTPS）：

```text
Internet → Caddy/Nginx (443, TLS) → tomo:4000
```

> 反代记得转发 cookie（会话依赖它）。Caddy 示例：`reverse_proxy localhost:4000`，默认即可。

## 后端接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查（不鉴权） |
| GET | `/api/tree` | 文档树 |
| GET | `/api/doc?path=` | 读单篇 + 当前 blob oid |
| POST | `/api/doc` | 新建文档（已存在返回 409） |
| PUT | `/api/doc` | 保存 + commit（带冲突检测） |
| DELETE | `/api/doc?path=` | 删除 + commit |
| POST | `/api/move` | 重命名 / 移动 + commit |
| GET | `/api/history?path=` | 历史版本列表 |
| GET | `/api/revision?path=&commit=` | 读历史某版本 |
| GET | `/api/search?q=` | 全文搜索 |
| POST | `/api/upload` | 上传图片（原始二进制，存入 assets/ 并 commit） |
| GET | `/api/asset?path=` | 读取图片附件 |
| POST | `/api/login` | 登录（建立会话 cookie） |
| POST | `/api/logout` | 登出 |
| GET | `/api/whoami` | 当前登录用户 |
| GET/POST/PUT/DELETE | `/api/users…` | 用户管理（仅 writer；含改角色 `/users/role`、改密码 `/users/password`） |

读接口需登录；写接口（save / create / move / delete / upload / users）需 writer 角色。writer 校验读取存储里的实时角色，角色变更立即生效。

## 鉴权

基于会话 cookie + 角色：

- 用户存在 `TOMO_USERS_FILE`（JSON），密码用 bcrypt 哈希，从不明文存储
- 首次启动若无用户，自动创建种子管理员（`TOMO_ADMIN_USER` / `TOMO_ADMIN_PASSWORD`，默认 admin/admin），登录后请尽快改密码
- 两种角色：`writer`（可读写、管理用户）和 `reader`（只读）
- 会话用 `express-session`，cookie 为 httpOnly，签名密钥 `TOMO_SESSION_SECRET`（生产务必改）
- 因为用 cookie，浏览器渲染 `<img>` 会自动带上,图片附件鉴权天然可用

零数据库依赖：用户就是一个 JSON 文件，和「单服务 + 数据目录」架构一致。未来要 OAuth / 2FA 可平滑迁到 Better Auth。

## 目录结构

```
.
├── index.html
├── vite.config.ts          # 含 /api -> :4000 代理
├── src/                     # 前端
│   ├── api.ts               # API 客户端（cookie 会话）
│   ├── App.tsx              # 主布局 + 保存/冲突 + 鉴权门
│   ├── components/
│   │   ├── DocTree.tsx      # 文档树 + 行操作菜单
│   │   ├── Editor.tsx       # 阅读/编辑双模式 + 图片上传
│   │   ├── SearchPanel.tsx  # ⌘K 搜索
│   │   ├── HistoryPanel.tsx # 历史版本
│   │   └── LoginPage.tsx    # 登录页
│   └── styles/
└── server/                  # 后端
    └── src/
        ├── index.ts         # Express 路由
        ├── config.ts
        ├── repo.ts          # 文件系统读（树/文档/附件）
        ├── gitops.ts        # git 写/历史/恢复/附件
        ├── search.ts        # 内存搜索索引
        ├── users.ts         # 用户存储（JSON + bcrypt）
        └── auth.ts          # 会话 + 角色中间件
```

## 已实现

- 文档树、读文档、保存生成 commit
- 乐观锁冲突检测（防覆盖他人修改）
- 历史版本列表 + 历史内容读取 + 恢复
- 新建 / 重命名 / 移动 / 删除文档
- 全文搜索（内存索引，标题权重高于正文，⌘K 唤起）
- 图片粘贴 / 拖拽上传（内容哈希命名 + 去重，存入仓库 assets/ 并 commit）
- 登录页 + 会话鉴权 + reader/writer 角色（reader 只读，UI 自动隐藏编辑入口）
- 用户管理面板（writer 可加人 / 改角色 / 改密码 / 删除；角色变更即时生效，无需重新登录）
- 所见即所得编辑（TipTap）：可视化表格编辑、任务列表、富文本工具栏；文档仍以 markdown 存 git，加载时 md→编辑器、保存时编辑器→md
- 阅读 / 编辑双模式，Cmd/Ctrl+S 保存，保存成功 toast 提示

## 待做

- 修改自己密码的界面
- OAuth / 2FA（如有需要，建议迁移到 Better Auth）
