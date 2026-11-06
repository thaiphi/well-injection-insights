# SWD Injection Analytics preview server, for the joint Explorer + Analytics Docker Compose stack (Zoomcamp ZC-02).
# Build context: this repository's root. Explorer's compose builds it from a pinned commit:
#   https://github.com/thaiphi/well-injection-insights.git#<commit>
# The Lovable site is built separately and does not use this file.

FROM node:24.13.0-alpine AS build
WORKDIR /app
COPY swd-injection-analytics/package.json swd-injection-analytics/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY swd-injection-analytics/tsconfig.json ./
COPY swd-injection-analytics/src ./src
RUN node node_modules/typescript/bin/tsc -p tsconfig.json

FROM node:24.13.0-alpine
WORKDIR /app
# Only what scripts/serve.mjs serves; the server uses Node built-ins only, so no node_modules.
COPY swd-injection-analytics/package.json ./
COPY swd-injection-analytics/scripts ./scripts
COPY swd-injection-analytics/web ./web
COPY swd-injection-analytics/data ./data
COPY swd-injection-analytics/reference ./reference
COPY swd-injection-analytics/exhibits ./exhibits
COPY swd-injection-analytics/output/pdf ./output/pdf
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4290
USER node
EXPOSE 4290
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||4290)+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "scripts/serve.mjs"]
