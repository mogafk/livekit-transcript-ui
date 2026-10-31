# Build: the UI. Run: the server on plain Node (it strips TypeScript types itself) + ui/dist.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY ui/package.json ui/
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY ui/package.json ui/
RUN npm ci --omit=dev --workspace=@transcript-ui/server && npm cache clean --force
COPY shared/src shared/src
COPY server/src server/src
COPY --from=build /app/ui/dist ui/dist
USER node
EXPOSE 8787
CMD ["node", "server/src/index.ts"]
