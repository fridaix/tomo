import path from 'node:path';

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  /** 文档仓库绝对路径 */
  repoPath: path.resolve(env('TOMO_REPO_PATH', './tomo-docs')),
  port: Number(env('PORT', '4000')),
  /** 共享访问密码，空字符串表示不鉴权 */
  password: env('TOMO_PASSWORD', ''),
  git: {
    authorName: env('TOMO_GIT_AUTHOR_NAME', 'Tomo'),
    authorEmail: env('TOMO_GIT_AUTHOR_EMAIL', 'tomo@local'),
  },
} as const;
