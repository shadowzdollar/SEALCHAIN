# SealChain — API + built web app in one image.
FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @sealchain/api... --filter @sealchain/web...
COPY packages/core packages/core
COPY apps/api apps/api
COPY apps/web apps/web
RUN pnpm --filter @sealchain/web build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=4100 DATA_DIR=/data
COPY --from=build /app /app
RUN mkdir -p /data && chown node:node /data
VOLUME /data
EXPOSE 4100
USER node
WORKDIR /app/apps/api
CMD ["node", "--import", "tsx", "src/server.ts"]
