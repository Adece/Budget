FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts
COPY --chown=node:node public ./public
COPY --chown=node:node server.js server-core.js model.js database.js ./
USER node
CMD ["node", "server.js"]
