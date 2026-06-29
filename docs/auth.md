# 鉴权说明

Tomo 基于会话 cookie + 角色做鉴权,零数据库依赖。

- 相关文档:[接口说明](api.md) · [运行与部署](deployment.md) · [目录结构](directory-structure.md)

---

## 机制

- 用户存在 `TOMO_USERS_FILE`(JSON),密码用 bcrypt 哈希,**从不明文存储**。
- 首次启动若无用户,自动创建种子管理员(`TOMO_ADMIN_USER` / `TOMO_ADMIN_PASSWORD`,默认 admin/admin),登录后请尽快改密码。
- 两种角色:
  - `writer` — 可读写、管理用户
  - `reader` — 只读(UI 自动隐藏编辑入口)
- 会话用 `express-session`,cookie 为 httpOnly,签名密钥 `TOMO_SESSION_SECRET`(**生产务必改**)。
- 因为用 cookie,浏览器渲染 `<img>` 会自动带上,图片附件鉴权天然可用。

## 角色与接口的关系

- 读接口需登录(任意角色)。
- 写接口需 writer 角色。
- writer 校验读取存储里的**实时角色**,角色变更立即生效,无需重新登录。

接口清单见 [接口说明](api.md)。

## 设计取舍

零数据库依赖:用户就是一个 JSON 文件,和「单服务 + 数据目录」架构一致。未来要 OAuth / 2FA 可平滑迁到 Better Auth。
