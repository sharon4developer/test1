FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY server ./server

ENV PORT=4848
ENV PARKCAST_RELAY_PORT=4848

EXPOSE 4848

CMD ["node", "server/relay-server.js"]
