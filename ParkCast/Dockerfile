FROM node:22-slim

WORKDIR /app

RUN npm init -y >/dev/null && npm install --no-audit --no-fund ws@8

COPY app.json ./
COPY src/config/pricing.json ./src/config/pricing.json
COPY server ./server

ENV PORT=4848
EXPOSE 4848

CMD ["node", "server/relay-server.js"]
