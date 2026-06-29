# ---------- 阶段 1：构建前端 ----------
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build
# 产物在 /app/dist

# ---------- 阶段 2：构建后端 ----------
FROM node:22-alpine AS backend
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build
# 产物在 /app/server/dist

# ---------- 阶段 3：运行时 ----------
FROM node:22-alpine AS runtime
WORKDIR /app/server
ENV NODE_ENV=production

# 只装后端生产依赖
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 拷入后端构建产物
COPY --from=backend /app/server/dist ./dist
# 拷入前端构建产物（由后端托管）
COPY --from=frontend /app/dist ./public

# 前端静态目录 + 数据目录
ENV TOMO_STATIC_DIR=/app/server/public
ENV TOMO_REPO_PATH=/data/tomo-docs
ENV TOMO_USERS_FILE=/data/users.json
ENV PORT=4000

# git 提交需要的运行时依赖（isomorphic-git 是纯 JS，无需系统 git，
# 但装上 git 方便运维直接进容器 git log/clone）
RUN apk add --no-cache git

# 数据卷：文档仓库 + 用户文件都放这里，持久化
VOLUME ["/data"]

EXPOSE 4000

# 简单健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "dist/index.js"]
