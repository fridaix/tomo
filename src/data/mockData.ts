export interface DocNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: DocNode[];
}

export const mockDocs: DocNode[] = [
  {
    id: '1',
    name: 'index.md',
    type: 'file',
    path: '/index.md',
  },
  {
    id: '2',
    name: 'product',
    type: 'folder',
    path: '/product',
    children: [
      { id: '2-1', name: 'roadmap.md', type: 'file', path: '/product/roadmap.md' },
      { id: '2-2', name: 'changelog.md', type: 'file', path: '/product/changelog.md' },
    ],
  },
  {
    id: '3',
    name: 'ops',
    type: 'folder',
    path: '/ops',
    children: [
      { id: '3-1', name: 'deploy.md', type: 'file', path: '/ops/deploy.md' },
      { id: '3-2', name: 'monitor.md', type: 'file', path: '/ops/monitor.md' },
    ],
  },
  {
    id: '4',
    name: 'team',
    type: 'folder',
    path: '/team',
    children: [
      { id: '4-1', name: 'onboarding.md', type: 'file', path: '/team/onboarding.md' },
      { id: '4-2', name: 'values.md', type: 'file', path: '/team/values.md' },
    ],
  },
];

export const mockContent: Record<string, string> = {
  '/index.md': `# Welcome to *Tomo*

这是团队文档的首页。Tomo 是一个基于 Gitea 的轻量团队文档 UI。

## 核心特性

- **Git 原生**：文档存储在 Gitea 仓库，历史就是 Git commit
- **Markdown 优先**：纯 Markdown 文件，易迁移、可复用
- **团队协作**：基于 Gitea 权限，无需额外管理
- **轻量简洁**：只做文档体验层，不修改 Gitea

> 文档即代码，知识即资产。

## 快速开始

1. 在左侧文档树中选择文档
2. 切换编辑/预览/分屏模式
3. 保存后自动生成 Git commit
4. 查看历史版本和恢复

---

*Powered by Gitea & Git*
`,

  '/product/roadmap.md': `# Product *Roadmap*

## Q2 2026

### Milestone 1: 核心体验
- [x] Markdown 编辑器集成
- [x] 文档树展示
- [ ] Gitea OAuth 登录
- [ ] 文档保存和提交

### Milestone 2: 协作能力
- [ ] 冲突检测
- [ ] 历史版本查看
- [ ] 图片上传和粘贴
- [ ] 全文搜索

## Q3 2026

### 增强功能
- [ ] 多空间管理
- [ ] 文档模板
- [ ] 双链引用
- [ ] 导出 PDF

## 设计原则

1. 只做文档体验层，不修改 Gitea
2. 文档主数据必须是 Markdown 文件
3. Git 历史就是版本历史
4. 不用数据库保存文档正文
`,

  '/product/changelog.md': `# Changelog

## [0.1.0] - 2026-06-23

### Added
- 初始化 Tomo 项目
- 集成 uiwjs/react-md-editor
- 实现 Tomo 暖色主题
- 创建文档树布局

### Design
- Fraunces 衬线标题
- Terracotta (#C4612F) 强调色
- 温暖底色 (#F7F4EF)
- 柔和圆角和阴影

---

*更多更新敬请期待*
`,

  '/ops/deploy.md': `# 部署说明

## 环境要求

- Node.js 18+
- Gitea 1.20+
- Reverse Proxy (Nginx/Caddy)

## 部署步骤

### 1. 配置环境变量

\`\`\`env
TOMO_BASE_URL=https://tomo.example.com
GITEA_BASE_URL=https://git.example.com
GITEA_OAUTH_CLIENT_ID=xxx
GITEA_OAUTH_CLIENT_SECRET=xxx
TOMO_SESSION_SECRET=xxx
\`\`\`

### 2. Docker Compose

\`\`\`yaml
version: '3.8'
services:
  tomo:
    image: tomo:latest
    ports:
      - "3000:3000"
    environment:
      - TOMO_BASE_URL
      - GITEA_BASE_URL
    depends_on:
      - gitea
\`\`\`

### 3. 反向代理

使用 Caddy:

\`\`\`
tomo.example.com {
  reverse_proxy localhost:3000
}
\`\`\`

## 监控

- 日志: \`/var/log/tomo/\`
- 健康检查: \`/api/health\`
`,

  '/ops/monitor.md': `# 监控和日志

## 日志收集

Tomo 使用结构化日志:

\`\`\`json
{
  "level": "info",
  "msg": "document saved",
  "user": "alice",
  "path": "/ops/deploy.md",
  "timestamp": "2026-06-23T10:30:00Z"
}
\`\`\`

## 关键指标

- 文档保存延迟
- Gitea API 响应时间
- 搜索查询耗时
- 并发编辑冲突率

## 告警规则

- API 错误率 > 1%
- 文档保存失败 > 5 次/小时
- Gitea 连接超时
`,

  '/team/onboarding.md': `# 新人入职指南

## 欢迎加入团队！

### 第一天

1. 获取 Gitea 账号
2. 加入团队组织
3. Clone 文档仓库
4. 访问 Tomo

### 第一周

- 熟悉团队文档结构
- 阅读 [价值观](/team/values.md)
- 了解产品 [Roadmap](/product/roadmap.md)
- 完成部署实践

### 常用资源

- 文档仓库: \`git.example.com/team/docs\`
- Tomo UI: \`tomo.example.com\`
- 部署手册: [部署说明](/ops/deploy.md)

## 写文档的最佳实践

1. 使用清晰的标题结构
2. 代码块标注语言
3. 链接使用相对路径
4. 图片放在 \`assets/images/\`
`,

  '/team/values.md': `# 团队价值观

## 文档即代码

我们相信文档应该像代码一样被管理:

- **版本控制**: 每次修改都有 Git 历史
- **可审查**: Pull Request 保证质量
- **可复用**: Markdown 文件易于迁移
- **可测试**: 断链检测和自动化校验

## 知识共享

> "知识只有分享才有价值"

- 及时记录决策和讨论
- 保持文档更新
- 主动完善缺失内容
- 帮助新人快速上手

## 工具简洁

- 只依赖 Gitea
- 不引入复杂数据库
- 保持轻量可维护
- 出问题时文档仍可读

---

*这些价值观指导着 Tomo 的设计*
`,
};
