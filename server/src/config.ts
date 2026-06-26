import path from 'node:path';

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  /** 文档仓库绝对路径 */
  repoPath: path.resolve(env('TOMO_REPO_PATH', './tomo-docs')),
  port: Number(env('PORT', '4000')),
  /** 共享访问密码，空字符串表示不鉴权（旧机制，保留兼容） */
  password: env('TOMO_PASSWORD', ''),
  /** 用户数据文件（JSON），独立于文档仓库 */
  usersFile: path.resolve(env('TOMO_USERS_FILE', './.tomo/users.json')),
  /** 会话签名密钥 */
  sessionSecret: env('TOMO_SESSION_SECRET', 'tomo-dev-secret-change-me'),
  /** 首次启动种子管理员账号 */
  seedAdmin: {
    username: env('TOMO_ADMIN_USER', 'admin'),
    password: env('TOMO_ADMIN_PASSWORD', 'admin'),
  },
  git: {
    authorName: env('TOMO_GIT_AUTHOR_NAME', 'Tomo'),
    authorEmail: env('TOMO_GIT_AUTHOR_EMAIL', 'tomo@local'),
  },
} as const;
