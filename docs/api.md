# 接口说明

Tomo 后端 REST 接口。所有接口挂在 `/api` 下,前端开发时经 Vite 代理转发到 `:4000`。

- 相关文档:[鉴权说明](auth.md) · [运行与部署](deployment.md) · [目录结构](directory-structure.md)

---

## 接口列表

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查(不鉴权) |
| GET | `/api/tree` | 文档树 |
| GET | `/api/doc?path=` | 读单篇 + 当前 blob oid |
| POST | `/api/doc` | 新建文档(已存在返回 409) |
| PUT | `/api/doc` | 保存 + commit(带冲突检测) |
| DELETE | `/api/doc?path=` | 删除 + commit |
| POST | `/api/move` | 重命名 / 移动 + commit |
| GET | `/api/history?path=` | 历史版本列表 |
| GET | `/api/revision?path=&commit=` | 读历史某版本 |
| GET | `/api/search?q=` | 全文搜索 |
| POST | `/api/upload` | 上传图片(原始二进制,存入 assets/ 并 commit) |
| GET | `/api/asset?path=` | 读取图片附件 |
| POST | `/api/login` | 登录(建立会话 cookie) |
| POST | `/api/logout` | 登出 |
| GET | `/api/whoami` | 当前登录用户 |
| GET/POST/PUT/DELETE | `/api/users…` | 用户管理(仅 writer;含改角色 `/users/role`、改密码 `/users/password`) |

## 权限要求

- **读接口**(tree / doc / history / revision / search / asset)需登录。
- **写接口**(save / create / move / delete / upload / users)需 **writer** 角色。
- writer 校验读取存储里的实时角色,**角色变更立即生效**,无需重新登录。

## 关键行为

- **冲突检测**:`PUT /api/doc` 携带读取时拿到的 blob oid,服务端比对,若他人已改动则拒绝覆盖(乐观锁)。
- **图片附件**:`POST /api/upload` 以内容哈希命名并去重,存入仓库 `assets/` 并生成 commit;`GET /api/asset` 读取时依赖会话 cookie,浏览器渲染 `<img>` 会自动带上,鉴权天然可用。

鉴权机制详见 [鉴权说明](auth.md)。
