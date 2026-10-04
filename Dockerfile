FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --chown=node:node server.js ./server.js
COPY --chown=node:node data/ ./data/
COPY --chown=node:node public/ ./public/
RUN mkdir -p data public/assets/uploads \
    && chown node:node data public/assets/uploads

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/content',{signal:AbortSignal.timeout(3000)}).then(async r=>{if(!r.ok)throw new Error('HTTP '+r.status);await r.json()}).then(()=>process.exit(0)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
