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

- 前端:React 18 + TypeScript + Vite 6 + TipTap(所见即所得编辑器)
- 后端:Node + Express + TypeScript + isomorphic-git

## 文档

- [运行与部署说明](docs/deployment.md) — 本地启动、Docker 部署、环境变量、升级迁移
- [目录结构](docs/directory-structure.md) — 代码组织与数据流
- [接口说明](docs/api.md) — REST 接口清单与行为
- [鉴权说明](docs/auth.md) — 会话 cookie + 角色机制

## 已实现

- 文档树、读文档、保存生成 commit
- 乐观锁冲突检测(防覆盖他人修改)
- 历史版本列表 + 历史内容读取 + 恢复
- 新建 / 重命名 / 移动 / 删除文档
- 全文搜索(内存索引，标题权重高于正文，⌘K 唤起)
- 图片粘贴 / 拖拽上传(内容哈希命名 + 去重，存入仓库 assets/ 并 commit)
- 登录页 + 会话鉴权 + reader/writer 角色(reader 只读，UI 自动隐藏编辑入口)
- 用户管理面板(writer 可加人 / 改角色 / 改密码 / 删除；角色变更即时生效，无需重新登录)
- 所见即所得编辑(TipTap)：可视化表格编辑、任务列表、富文本工具栏；文档仍以 markdown 存 git，加载时 md→编辑器、保存时编辑器→md
- 阅读 / 编辑双模式，Cmd/Ctrl+S 保存，保存成功 toast 提示

## 待做

- 修改自己密码的界面
- OAuth / 2FA(如有需要,建议迁移到 Better Auth)

## 关于作者

Tomo 来自一个很朴素的需求:

我自己平时会记录文档，一直自托管使用的Docmost，直到我升级0.90版本，核心功能开始收费，存量文档不支持编辑。

市面上的工具要么太重、要么把数据不在自己手里，于是干脆自己写一个:

本地 Git 打底，Markdown 落地，简单到一个容器、一个端口、一个数据卷就能跑起来。

写文档之外,我也在折腾 AI 内容创作。

如果你有 **AI 生图、生视频、无限画布，以及电商、社媒** 等场景的需求

欢迎来作者的站尝鲜：**https://mago.fridai.top**
