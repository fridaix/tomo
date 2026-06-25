# Tomo 功能与架构方案

> **架构修订（2026-06-25）**
>
> 经评估实际场景（<10 人小团队、无现成 Git 平台、最看重部署简单），决定**不再强依赖 Gitea**。
> Tomo 改为**自管一个本地 Git 仓库**：后端用 git library（isomorphic-git）直接操作仓库目录，
> 文档仍是纯 Markdown，历史仍是真实 Git commit，随时可 `git clone` 拿走。
>
> 这保留了原方案"文档即 Git、不被数据库锁死"的全部核心价值，同时把部署从
> 「Gitea + Tomo API + 前端」三件套简化为「Tomo 服务 + 数据目录」。
>
> 下文第 1–20 节为最初的 Gitea 方案设计记录（保留备查）；当前实现方案见
> **第 23 节：本地 Git 方案（现行）**与**第 24 节：性能设计**。

## 1. 项目定位（最初方案，已修订）

Tomo 是一个基于 Gitea 的轻量团队文档界面。

它不替代 Gitea，也不修改 Gitea。Tomo 只做一件事：把存放在 Gitea 仓库中的 Markdown 文件，包装成一个简洁、好用、适合团队日常沉淀知识的文档产品。

核心定位：

- 文档内容以 Markdown 文件形式存储在 Gitea 仓库中。
- Git 提交历史就是文档版本历史。
- Gitea 负责用户、团队、仓库、权限和 Git 存储。
- Tomo 负责文档树、编辑器、预览、搜索、附件、历史恢复等文档体验。
- 不引入复杂数据库作为文档主存储，避免被某个文档系统锁死。

一句话描述：

> Tomo 是一个只依赖 Gitea 的轻量团队文档 UI。

## 2. 背景

之前团队文档主要放在 Docmost 中。Docmost 提供了比较现代的文档编辑体验，但在 Docker 部署和版本升级/降级过程中遇到了两个明显问题：

1. 升级到 0.90 后，文档无法编辑。
2. 从 0.90 降级到 0.70 后，服务启动失败，出现 `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`。

经过排查和讨论，判断出几个关键点：

- Docmost 的编辑能力依赖实时连接，例如 WebSocket。反向代理、APP_URL、Redis 或部署配置异常，都可能导致编辑器进入不可编辑状态。
- Docmost 使用数据库迁移。升级后的数据库结构通常不能直接被旧版本兼容，直接降级容易启动失败。
- 文档内容如果主要存放在应用数据库里，一旦部署、迁移、降级、备份出现问题，恢复和迁移成本会比较高。

因此新的方向是：不要再让文档资产被某个文档系统数据库锁住，而是把文档主数据放回 Git。

## 3. 讨论过程与选型

### 3.1 dufs 方案

最初讨论过基于 `dufs` 做 Markdown 文件存储。

`dufs` 适合作为轻量文件服务，具备文件浏览、上传、编辑、WebDAV、访问控制等能力。它可以很好地承担文件层职责。

但如果要做团队文档产品，只靠 `dufs` 还不够，需要额外补充：

- 用户和团队权限。
- 文档历史版本。
- 保存冲突处理。
- Git 提交和远程同步。
- 文档树、搜索、附件引用、预览等产品能力。

因此 `dufs` 更适合作为文件服务或 WebDAV 辅助能力，而不是团队文档系统的核心底座。

### 3.2 Doc UI + Gitea 方案

随后讨论转向直接使用 Gitea。

Gitea 本身已经提供：

- Git 仓库存储。
- 用户和组织。
- 团队权限。
- 仓库权限。
- API。
- Git 历史。
- 文件创建、更新、删除。
- Webhook 和备份迁移能力。

因此 Tomo 不需要重新实现 Git 平台，也不需要重新做用户和权限系统。Tomo 只需要在 Gitea 之上提供一个更适合写文档的 UI。

这是最终确定的方向。

### 3.3 是否使用更轻量的 Git 服务

也讨论过 Gogs、Soft Serve、Gitolite、裸 Git 等更轻量方案。

这些方案各有优势：

- Gogs 比 Gitea 更轻，但生态和安全响应需要更谨慎评估。
- Soft Serve 很适合作为轻量 Git remote，但不适合作为现代团队文档后台。
- Gitolite 适合 SSH 权限控制，但没有友好的 Web API 和团队 UI。
- 裸 Git 最轻，但用户、权限、审计、协作都要自己做。

由于 Tomo 要部署到服务器给团队使用，最终选择 Gitea 作为唯一基础依赖更稳妥。

## 4. 命名

项目名确定为：Tomo。

Tomo 有“书卷、卷册、一本书”的语义，适合作为文档产品名称。它也和另一个产品 Mago 风格接近：

- Mago：像魔法一样处理内容的 AI 助手。
- Tomo：把团队内容沉淀成书卷和知识库。

推荐子域名：

```text
tomo.example.com
```

## 5. 设计原则

Tomo 的设计原则如下：

1. 只做文档体验层，不修改 Gitea。
2. 文档主数据必须是 Markdown 文件。
3. Git 历史就是版本历史。
4. Gitea 是唯一强依赖。
5. 不用数据库保存文档正文。
6. UI 保持轻量、简洁、稳定。
7. 所有文档资产都可以通过 `git clone` 拿走。
8. 系统出问题时，文档仓库仍然是完整可读的。

## 6. 产品范围

### 6.1 第一版必须支持

- 使用 Gitea OAuth 登录。
- 选择或绑定一个 Gitea 文档仓库。
- 显示 Markdown 文档树。
- 新建文档和文件夹。
- 编辑 Markdown 文档。
- Markdown 预览。
- 保存文档并自动生成 Git commit。
- 删除文档。
- 重命名和移动文档。
- 上传图片和附件。
- 粘贴图片自动上传。
- 查看文档历史版本。
- 从历史版本恢复文档。
- 基于 Gitea 权限控制读写能力。
- 全文搜索 Markdown 文档。

### 6.2 第二阶段支持

- 多空间管理。
- 文档模板。
- 最近编辑。
- 收藏文档。
- 草稿状态。
- 文档目录大纲。
- 文档之间的双链引用。
- 断链检测。
- 附件引用清理。
- Webhook 同步索引。
- 文档导出为 PDF 或静态站。

### 6.3 暂不支持

- 多人实时协作编辑。
- 块编辑器。
- 评论系统。
- 复杂审批流。
- 独立权限系统。
- 替代 Gitea 的仓库管理。
- 替代 Gitea 的用户管理。
- 替代 Gitea 的组织和团队管理。

这些能力可以未来扩展，但不进入第一版。

## 7. 总体架构

```text
Browser
  |
  | HTTPS
  v
Tomo Web / Tomo API
  |
  | Gitea API
  v
Gitea
  |
  | Git repository
  v
Markdown docs repository
```

Tomo 服务由两个主要部分组成：

- Tomo Web：前端文档界面。
- Tomo API：后端代理和业务层。

Tomo API 不保存文档正文，只负责：

- 登录态。
- 调用 Gitea API。
- 处理文档树。
- 保存冲突检测。
- Markdown 渲染。
- 附件上传。
- 搜索索引。
- 历史版本读取。

## 8. 核心模块

### 8.1 Web UI

Web UI 负责用户实际使用体验。

主要区域：

- 顶部栏：空间、搜索、用户信息。
- 左侧栏：文档树。
- 中间区：编辑器和预览。
- 右侧栏：目录、历史、页面信息。

第一版可以使用 Markdown 编辑器，而不是块编辑器。

推荐编辑模式：

- 编辑。
- 预览。
- 分屏。

### 8.2 Tomo API

Tomo API 是浏览器和 Gitea 之间的轻量中间层。

不建议浏览器直接持有 Gitea token。token 应由 Tomo API 安全保存或通过服务端会话处理。

Tomo API 职责：

- OAuth 登录回调。
- 会话管理。
- 读取仓库文件树。
- 读取文档内容。
- 保存文档。
- 上传附件。
- 查询提交历史。
- 恢复历史版本。
- 搜索文档。
- 权限校验。

### 8.3 Gitea Adapter

Gitea Adapter 是 Tomo 内部封装 Gitea API 的模块。

它负责屏蔽 Gitea API 细节，让业务层只关心：

- 获取文件。
- 写入文件。
- 删除文件。
- 移动文件。
- 获取提交记录。
- 获取某个 commit 下的文件内容。
- 获取当前用户对仓库的权限。

如果未来要支持 Forgejo，也可以在这一层扩展。

### 8.4 Search Index

第一版搜索可以分为两种模式：

1. 简单模式：启动时或定时扫描仓库 Markdown 文件，在内存中建立索引。
2. 增强模式：通过 Gitea webhook 触发增量索引。

为了保持“只依赖 Gitea”的原则，搜索索引可以作为可重建缓存，不作为文档主数据。

如果服务重启，索引可以从 Gitea 仓库重新构建。

## 9. 仓库结构

推荐每个文档空间对应一个 Gitea 仓库。

示例：

```text
docs/
├── index.md
├── product/
│   ├── index.md
│   ├── roadmap.md
│   └── changelog.md
├── ops/
│   ├── index.md
│   └── deploy.md
├── assets/
│   └── images/
│       └── 2026/
│           └── architecture.png
└── .tomo/
    └── config.yml
```

说明：

- `index.md` 是空间首页。
- 普通目录就是文档分组。
- `.md` 文件就是文档页面。
- `assets/` 存放图片和附件。
- `.tomo/config.yml` 存放非正文配置，例如文档排序、首页路径、显示名称等。

## 10. 文档元数据

Tomo 可以通过两种方式管理元数据。

### 10.1 Markdown Frontmatter

每个 Markdown 文件顶部可以包含 frontmatter：

```yaml
---
title: 部署说明
order: 10
description: 服务器部署和回滚流程
---
```

适合存放页面级信息。

### 10.2 `.tomo/config.yml`

仓库级配置可以存放在 `.tomo/config.yml`：

```yaml
name: Team Docs
homepage: index.md
nav:
  - product/index.md
  - ops/index.md
```

适合存放空间级配置。

## 11. 数据模型

Tomo 的核心数据模型很少。

```text
Space      = 一个 Gitea owner/repo/branch 组合
Page       = 一个 Markdown 文件
Asset      = 一个普通附件文件
Revision   = 一个 Git commit
User       = Gitea 用户
Permission = Gitea 仓库权限
```

所有持久化内容都应能映射回 Gitea 仓库中的文件或 Git 提交。

## 12. 保存流程

```text
1. 用户打开文档。
2. Tomo API 从 Gitea 获取文件内容和当前文件 SHA。
3. 用户编辑 Markdown。
4. 用户点击保存，前端提交 path、content、baseSha。
5. Tomo API 再次校验当前文件 SHA。
6. 如果 SHA 一致，写入文件并生成 commit。
7. 如果 SHA 不一致，返回冲突提示。
8. 用户选择覆盖、合并或查看差异。
```

保存成功后，Gitea 仓库中会出现一个普通 Git commit。

commit message 示例：

```text
docs: update ops/deploy.md
```

## 13. 冲突处理

第一版冲突处理保持简单。

当用户保存时，如果文件已经被别人修改：

- 不直接覆盖。
- 显示当前版本和远程新版本。
- 允许用户复制自己的修改。
- 后续版本再提供三方合并。

这可以避免团队多人编辑时误覆盖内容。

## 14. 附件流程

图片和附件都保存到仓库中。

粘贴图片流程：

```text
1. 用户在编辑器中粘贴图片。
2. 前端上传图片到 Tomo API。
3. Tomo API 写入 assets/images/ 目录。
4. Tomo API 返回 Markdown 引用路径。
5. 编辑器插入图片语法。
6. 保存文档时，图片和 Markdown 一起提交。
```

图片引用示例：

```markdown
![架构图](../assets/images/2026/architecture.png)
```

## 15. 权限设计

Tomo 不单独实现权限系统。

权限来源于 Gitea：

- 能读仓库的人，可以读文档。
- 能写仓库的人，可以编辑文档。
- 仓库管理员，可以配置空间。
- 组织和团队由 Gitea 管理。

Tomo API 在执行写操作前，应调用 Gitea 校验用户对目标仓库的权限。

## 16. 登录设计

推荐使用 Gitea OAuth。

流程：

```text
1. 用户访问 Tomo。
2. Tomo 跳转到 Gitea OAuth 登录。
3. 用户在 Gitea 完成登录和授权。
4. Gitea 回调 Tomo。
5. Tomo 建立服务端会话。
6. 后续 API 请求由 Tomo 服务端调用 Gitea。
```

浏览器不直接暴露长期 Gitea token。

## 17. 部署方案

服务器部署时，Tomo 作为独立服务运行。

```text
Internet
  |
  v
Reverse Proxy
  |
  +-- tomo.example.com  -> Tomo
  |
  +-- git.example.com   -> Gitea
```

Tomo 环境变量示例：

```env
TOMO_BASE_URL=https://tomo.example.com
GITEA_BASE_URL=https://git.example.com
GITEA_OAUTH_CLIENT_ID=xxx
GITEA_OAUTH_CLIENT_SECRET=xxx
TOMO_SESSION_SECRET=xxx
```

第一版可以使用 Docker Compose 部署：

```text
gitea
tomo
reverse-proxy
```

如果已有 Gitea，只需要额外部署 Tomo。

## 18. 安全要求

Tomo 需要注意以下安全点：

- 不在浏览器暴露长期 Gitea token。
- 所有文件路径必须做 path traversal 防护。
- 只允许访问绑定仓库内的文件。
- Markdown 渲染必须做 HTML sanitize。
- 上传文件需要限制大小和类型。
- 附件下载需要经过权限校验，或使用 Gitea 原始文件访问权限。
- OAuth callback 必须校验 state。
- session cookie 使用 `HttpOnly`、`Secure`、`SameSite`。
- 写操作必须校验 CSRF 或使用安全的 API token 机制。

## 19. 技术栈建议

前端：

- React 或 Next.js。
- Markdown 编辑器可选 CodeMirror、Milkdown、ByteMD 或 Toast UI Editor。
- Markdown 渲染使用 markdown-it 或 unified/remark/rehype。

后端：

- Node.js、Bun、Go 都可以。
- 如果追求部署简单，Go 单二进制更适合。
- 如果追求前后端一体开发，Next.js 更快。

推荐第一版：

```text
Next.js + Tomo API routes + Gitea API
```

后续如果需要更轻部署，可以拆成：

```text
React SPA + Go API
```

## 20. 与 Docmost 的差异

Tomo 不追求完整复制 Docmost。

| 能力 | Docmost | Tomo |
| --- | --- | --- |
| 主存储 | 数据库 | Gitea Git 仓库 |
| 文档格式 | 应用内部结构 | Markdown 文件 |
| 实时协作 | 支持 | 第一版不支持 |
| 块编辑器 | 支持 | 第一版不支持 |
| 版本历史 | 应用管理 | Git commit |
| 权限 | 应用管理 | Gitea 管理 |
| 迁移能力 | 依赖应用导出 | 直接 git clone |
| 部署复杂度 | 中等 | 低到中等 |

Tomo 的目标不是做一个更复杂的 Docmost，而是做一个更可控、更轻、更容易迁移的团队文档系统。

## 21. 第一版里程碑

### Milestone 1: 可登录和浏览

- Gitea OAuth 登录。
- 绑定一个仓库。
- 读取仓库 Markdown 文件树。
- 打开 Markdown 页面。
- 渲染预览。

### Milestone 2: 可编辑和保存

- Markdown 编辑器。
- 保存文件到 Gitea。
- 自动生成 commit。
- 新建、删除、重命名文档。
- 基础冲突检测。

### Milestone 3: 附件和搜索

- 图片上传。
- 粘贴图片。
- 附件管理。
- 全文搜索。
- 最近更新。

### Milestone 4: 历史和恢复

- 查看文档 commit 历史。
- 查看历史版本内容。
- 对比当前版本和历史版本。
- 从历史版本恢复。

### Milestone 5: 团队体验

- 多仓库/多空间。
- 收藏。
- 文档模板。
- 文档排序。
- 页面大纲。

## 22. 最终结论

Tomo 的最佳路线是：

```text
只依赖 Gitea，不修改 Gitea。
文档存 Markdown，历史用 Git。
Tomo 只做轻量、简洁、好用的团队文档 UI。
```

这条路线能解决当前最核心的问题：

- 不再被文档系统数据库锁住。
- 不再因为应用版本迁移导致文档资产难以恢复。
- 团队权限和 Git 能力复用 Gitea。
- 文档可以随时通过 `git clone` 完整迁移。
- Tomo 本身可以保持足够轻。

## 23. 本地 Git 方案（现行）

考虑到实际是小团队、没有现成 Git 平台、且最看重部署简单，最终没有采用 Gitea，
而是让 Tomo 自己管理一个本地 Git 仓库。

### 23.1 架构

```text
Browser
  └── Tomo 前端 (React + Vite)
        └── Tomo 后端 (Node + Express)
              └── 本地 Git 仓库 (isomorphic-git 操作)
                    └── Markdown 文件
```

部署单元从三件套缩减为：**一个 Tomo 服务 + 一个数据目录**，Docker 一个容器即可。

### 23.2 职责映射

原本交给 Gitea 的能力，现在的处理方式：

- Git 存储：Tomo 后端用 isomorphic-git 操作本地仓库目录。
- 历史版本：`git log` / `git readBlob`，按文件查。
- 用户与登录：暂用共享密码中间件（`TOMO_PASSWORD`），可平滑替换为会话 / OAuth。
- 权限：小团队场景暂不做细粒度权限；未来可在鉴权层扩展只读 / 可写名单。

### 23.3 后端接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查（不鉴权） |
| GET | `/api/tree` | 文档树（读文件系统） |
| GET | `/api/doc?path=` | 读单篇 + 当前 blob oid |
| PUT | `/api/doc` | 保存 + commit，带冲突检测（baseOid） |
| DELETE | `/api/doc?path=` | 删除 + commit |
| GET | `/api/history?path=` | 文档历史版本列表 |
| GET | `/api/revision?path=&commit=` | 读历史某版本内容 |
| GET | `/api/search?q=` | 全文搜索 |

冲突检测：前端打开文档时记录 blob oid，保存时回传 `baseOid`。
若服务端当前 oid 与之不符，返回 409 + `currentOid`，前端提示重新加载，避免覆盖他人修改。

## 24. 性能设计

依赖 Git 不会成为瓶颈，关键在于"读写分离"和"搜索解耦"。

### 24.1 读走文件系统

读单篇文档、列文档树都直接读文件系统，完全不调 git，毫秒级。
Git 只在写入时介入。

### 24.2 写走 git library，不 fork CLI

写入用 isomorphic-git 在进程内完成，避免每次请求 fork 一个 git 子进程的开销。
并发升高时，真正的瓶颈是频繁起进程，而不是 git 本身的计算。

### 24.3 写操作串行化

同目录并发 commit 会损坏 git 状态，后端用一个写队列把保存 / 删除串行化。
小团队写并发极低，这点排队开销可忽略。

### 24.4 搜索走内存索引，不查 git

不用 `git grep` 当搜索后端。服务启动时扫一遍 `.md` 建内存索引，
保存时增量更新对应条目。索引是可重建缓存，丢了重扫即可，不破坏"Git 是唯一真相"。

### 24.5 规模判断

几人、几百到几千篇文档，上述设计下 git 毫无压力。
git 本身可处理百万级 commit 的仓库，文档库远到不了那个量级。

