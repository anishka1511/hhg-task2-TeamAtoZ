# Backend image — always-on host (Railway / Fly / VPS)
FROM node:20-bookworm-slim

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

COPY backend/src ./src

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "src/server.js"]
