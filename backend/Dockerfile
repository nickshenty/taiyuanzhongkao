# 后端 API 镜像
#
# 构建：docker build -t taiyuan-zhongkao-api ./backend
# 运行：见 deploy/docker-compose.yml
#
# 说明：镜像仅包含 API 运行时。
# 数据导入（npm run seed）建议在宿主机执行，或
#   docker compose run --rm -v $(pwd)/data:/data api npm run seed
# 因为种子脚本需要读取仓库 data/ 目录。

FROM node:20-alpine

# 时区设为东八区，日志时间与业务时间一致
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

WORKDIR /app

# 先复制依赖清单，利用镜像层缓存
COPY package.json package-lock.json ./

# 仅安装生产依赖
RUN npm ci --omit=dev && npm cache clean --force

# 复制源码
COPY src ./src

# 以非 root 用户运行
USER node

ENV NODE_ENV=production
ENV PORT=3002
ENV HOST=0.0.0.0

EXPOSE 3002

# 健康检查：/health 返回 200 视为存活
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3002)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
