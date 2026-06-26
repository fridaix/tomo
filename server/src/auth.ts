import type { Request, Response, NextFunction } from 'express';
import { getUser, type Role, type User } from './users.js';

// 扩展 express-session 的 SessionData，挂上当前用户
declare module 'express-session' {
  interface SessionData {
    user?: User;
  }
}

/** 已登录才放行 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.user) {
    next();
    return;
  }
  res.status(401).json({ error: 'unauthorized' });
}

/**
 * 需要 writer 角色才放行（写操作）。
 * 从存储读取实时角色，而不是信任会话里登录时的快照——
 * 这样管理员把某人降级为 reader 后能立即生效，无需等对方重新登录。
 */
export function requireWriter(req: Request, res: Response, next: NextFunction): void {
  const sessionUser = req.session?.user;
  if (!sessionUser) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  void getUser(sessionUser.username).then((live) => {
    if (!live) {
      // 用户已被删除，作废会话
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    // 同步会话里的角色，保持 whoami 等读取一致
    if (live.role !== sessionUser.role) {
      req.session.user = live;
    }
    if (live.role !== 'writer') {
      res.status(403).json({ error: 'forbidden: writer role required' });
      return;
    }
    next();
  });
}

export function hasRole(req: Request, role: Role): boolean {
  return req.session?.user?.role === role;
}

