FROM node:22-alpine AS build
WORKDIR /repo

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY services/api/package.json services/api/package.json
RUN npm ci --workspace @elder-tree/contracts --workspace @elder-tree/api

COPY packages/contracts packages/contracts
COPY services/api services/api
RUN npm run build -w @elder-tree/contracts && npm run build -w @elder-tree/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/node_modules /app/node_modules
COPY --from=build /repo/packages/contracts /app/packages/contracts
COPY --from=build /repo/services/api/dist /app/services/api/dist
COPY --from=build /repo/services/api/package.json /app/services/api/package.json
EXPOSE 8080
CMD ["node", "services/api/dist/main.js"]
