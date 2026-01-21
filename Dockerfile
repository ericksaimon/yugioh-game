# --- build mínimo do servidor WS/HTTP ---
FROM node:20-alpine

WORKDIR /app

# Copia só o package do server e instala deps
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copia o código do server
COPY server ./server

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "server/index.js"]
