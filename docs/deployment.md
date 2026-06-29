# 运行与部署说明

Tomo 的本地开发启动、Docker 生产部署、环境变量与升级迁移说明。

- 相关文档:[目录结构](directory-structure.md) · [接口说明](api.md) · [鉴权说明](auth.md)

---

## 本地开发

### 1. 启动后端

```bash
cd server
cp .env.example .env      # 按需修改:仓库路径、端口、共享密码
npm install
npm run dev               # http://localhost:4000
```

首次启动会自动在 `TOMO_REPO_PATH`(默认 `server/tomo-docs`)创建并 `git init` 一个仓库。

### 2. 启动前端

```bash
npm install
npm run dev               # http://localhost:5173
```

前端 `/api` 请求通过 Vite 代理转发到后端 `:4000`。

打开 http://localhost:5173 后会看到登录页,用种子管理员账号登录(默认 `admin` / `admin`,可在 `.env` 改)。

> 若 `npm install` 报 rollup/esbuild 平台二进制缺失,先 `rm -rf node_modules package-lock.json` 再装。

---

## Docker 部署

生产用单容器方案:后端同时托管 API 和前端静态文件,一个镜像、一个端口、一个数据卷。

```bash
# 1. 准备环境变量
cp .env.example .env
# 编辑 .env,至少设置:
#   TOMO_SESSION_SECRET  (openssl rand -hex 32 生成)
#   TOMO_ADMIN_PASSWORD  (管理员初始密码)

# 2. 构建并启动
docker compose up -d --build

# 3. 访问
# http://<服务器>:4000  用 .env 里的管理员账号登录
```

数据绑定挂载到部署目录下的 `appdata/`(容器内 `/data`):

- `appdata/tomo-docs` — 文档 Git 仓库
- `appdata/users.json` — 用户与密码哈希

文档随时可取走:`git -C appdata/tomo-docs log`,或直接 `git clone appdata/tomo-docs`。容器内进程以 root 运行,`appdata/` 内文件归 root,宿主机直接编辑可能需 `sudo`。

### 从旧版 `tomo-data` 命名卷升级

旧版 compose 使用 Docker 命名卷 `tomo-data`。升级到当前 `./appdata:/data` 绑定挂载前,先把旧卷内容复制出来,否则启动后会看到一个全新的空仓库。

```bash
docker compose down
mkdir -p appdata

# 找到旧版 compose 创建的 volume,通常以 tomo-data 结尾
OLD_VOLUME="$(docker volume ls --format '{{.Name}}' | grep 'tomo-data$' | head -n 1)"
test -n "$OLD_VOLUME"

docker run --rm \
  -v "$OLD_VOLUME:/from:ro" \
  -v "$PWD/appdata:/to" \
  alpine sh -c 'cp -a /from/. /to/'

docker compose up -d --build
```

### 反向代理

放到反向代理后面(推荐,便于上 HTTPS):

```text
Internet → Caddy/Nginx (443, TLS) → tomo:4000
```

> 反代记得转发 cookie(会话依赖它)。Caddy 示例:`reverse_proxy localhost:4000`,默认即可。
