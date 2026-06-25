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

- 前端：React 18 + TypeScript + Vite 6 + @uiw/react-md-editor
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

> 若 `npm install` 报 rollup/esbuild 平台二进制缺失，先 `rm -rf node_modules package-lock.json` 再装。

## 后端接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查（不鉴权） |
| GET | `/api/tree` | 文档树 |
| GET | `/api/doc?path=` | 读单篇 + 当前 blob oid |
| PUT | `/api/doc` | 保存 + commit（带冲突检测） |
| DELETE | `/api/doc?path=` | 删除 + commit |
| GET | `/api/history?path=` | 历史版本列表 |
| GET | `/api/revision?path=&commit=` | 读历史某版本 |
| GET | `/api/search?q=` | 全文搜索 |

## 鉴权

后端用共享密码中间件：

- `.env` 里 `TOMO_PASSWORD` 留空 = 不鉴权（本地开发）
- 设置后，前端请求需带 `x-tomo-password` 头

这是小团队最轻方案，未来可替换为会话 / OAuth 而不影响业务路由。

## 目录结构

```
.
├── index.html
├── vite.config.ts          # 含 /api -> :4000 代理
├── src/                     # 前端
│   ├── api.ts               # API 客户端
│   ├── App.tsx              # 主布局 + 保存/冲突逻辑
│   ├── components/
│   │   ├── DocTree.tsx
│   │   └── Editor.tsx       # 阅读/编辑双模式
│   └── styles/
└── server/                  # 后端
    └── src/
        ├── index.ts         # Express 路由
        ├── config.ts
        ├── repo.ts          # 文件系统读（树/文档）
        ├── gitops.ts        # git 写/历史/恢复
        ├── search.ts        # 内存搜索索引
        └── auth.ts          # 共享密码中间件
```

## 已实现

- 文档树、读文档、保存生成 commit
- 乐观锁冲突检测（防覆盖他人修改）
- 历史版本列表 + 历史内容读取
- 删除文档
- 全文搜索（内存索引，标题权重高于正文）
- 阅读 / 编辑双模式，Cmd/Ctrl+S 保存

## 待做

- 前端接入搜索框、历史面板 UI（后端接口已就绪）
- 新建 / 重命名 / 移动文档的前端交互
- 图片上传 / 粘贴
- 登录页（当前密码靠请求头传）
