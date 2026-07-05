FROM node:22-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
RUN npm ci --workspace @elder-tree/contracts --workspace @elder-tree/admin-web

COPY packages/contracts packages/contracts
COPY apps/admin-web apps/admin-web
RUN npm run build -w @elder-tree/contracts && npm run build -w @elder-tree/admin-web

FROM node:22-alpine
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/contracts packages/contracts
COPY --from=build /repo/apps/admin-web apps/admin-web
EXPOSE 8080
CMD ["sh", "-c", "cd apps/admin-web && node ../../node_modules/next/dist/bin/next start -p ${PORT:-8080}"]
