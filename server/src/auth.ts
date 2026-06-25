import type { Request, Response, NextFunction } from 'express';
import { config } from './config.js';

/**
 * 简单鉴权中间件。
 * - 若未配置 TOMO_PASSWORD：放行（本地开发）
 * - 否则要求请求头 `x-tomo-password` 匹配
 *
 * 这是为小团队设计的最轻方案；未来可替换为会话/OAuth 而不影响业务路由。
 */
export function auth(req: Request, res: Response, next: NextFunction): void {
  if (!config.password) {
    next();
    return;
  }
  const provided = req.header('x-tomo-password');
  if (provided === config.password) {
    next();
    return;
  }
  res.status(401).json({ error: 'unauthorized' });
}
