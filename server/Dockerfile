FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY docker-entrypoint.sh /usr/local/bin/
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATA_DIR=/data
EXPOSE 8787
# Starts as root only to fix the data disk's owner; the server itself runs as "node".
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/server.ts"]
