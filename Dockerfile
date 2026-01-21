# --- Build ---
FROM node:20-alpine

WORKDIR /app

# instala deps do server
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# copia o resto do projeto
COPY . .

# entra no server
WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "index.js"]
