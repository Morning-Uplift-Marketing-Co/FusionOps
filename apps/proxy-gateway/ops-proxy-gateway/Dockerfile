# Pin Node 22: undici v7 (e.g. hoisted from monorepo root) needs global File (Node 20.18+).
# npm ci + lockfile keeps undici 6.x when this folder is built in isolation.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.mjs ./
ENV NODE_ENV=production
EXPOSE 8789
CMD ["node", "index.mjs"]
