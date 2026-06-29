# 目录结构

Tomo 仓库的代码组织。前端在根目录 `src/`,后端在 `server/`。

- 相关文档:[运行与部署](deployment.md) · [接口说明](api.md) · [鉴权说明](auth.md)

---

```
.
├── index.html
├── vite.config.ts          # 含 /api -> :4000 代理
├── src/                     # 前端
│   ├── api.ts               # API 客户端(cookie 会话)
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
        ├── repo.ts          # 文件系统读(树/文档/附件)
        ├── gitops.ts        # git 写/历史/恢复/附件
        ├── search.ts        # 内存搜索索引
        ├── users.ts         # 用户存储(JSON + bcrypt)
        └── auth.ts          # 会话 + 角色中间件
```

## 数据流概览

- **读** 走文件系统(`repo.ts`):文档树、单篇文档、图片附件直接从仓库工作区读。
- **写** 走 git library(`gitops.ts`):保存 / 新建 / 移动 / 删除 / 上传都生成真实 commit。
- **搜索** 走内存索引(`search.ts`):标题权重高于正文,⌘K 唤起。
- **鉴权** 走会话中间件(`auth.ts` + `users.ts`):cookie 会话 + reader/writer 角色。

更深入的架构说明见 `TOMO_ARCHITECTURE.md`。
