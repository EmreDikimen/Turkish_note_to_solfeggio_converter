# The decode server (MVP W9) — Node + onnxruntime-node, running the browser's own decode.ts.
#
# Build from the REPO ROOT, because the server imports `apps/web/src/omr/` by relative path and
# that is the point of the design:
#
#   docker build -f apps/server/Dockerfile -t omr-decode .
#   docker run --rm -p 8080:8080 --cpus 2 -e OMR_ORT_THREADS=2 omr-decode
#
# Two stages: the builder installs from the lockfile, bundles the TypeScript and assembles the
# model directory; the runtime image is node-slim carrying one JS file, the three int8 graphs and
# onnxruntime's native module — no npm install at runtime, no toolchain, no monorepo.

# ---- build ------------------------------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /build

# Manifests first, so editing a source file does not re-download onnxruntime (~260 MB).
# `-w @turkish-omr/server` without `--include-workspace-root` skips the root devDeps, which is
# what keeps Playwright (and its browser download) out of the image build entirely.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
RUN npm ci -w @turkish-omr/server \
 # onnxruntime-node ships prebuilt binaries for six platforms (~260 MB). The runtime image needs
 # one. Pruned HERE rather than after the COPY, because deleting in a later layer does not shrink
 # an image — and image size is cold-start time on Cloud Run.
 && rm -rf node_modules/onnxruntime-node/bin/napi-v6/darwin \
           node_modules/onnxruntime-node/bin/napi-v6/win32

# The bundle deliberately reaches into apps/web/src/omr — one decode implementation, not two.
COPY apps/server ./apps/server
COPY apps/web/src ./apps/web/src
RUN npm run -w @turkish-omr/server bundle

# The three int8 graphs plus a trimmed model.json (gate.json without its 14 test strips).
COPY apps/web/public/models ./apps/web/public/models
RUN node apps/server/tools/prepare-models.mjs --out /models

# ---- runtime ----------------------------------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production MODEL_DIR=/app/models PORT=8080

# Only ORT comes across as a package: pngjs is bundled into server.js by esbuild, and everything
# else in the build stage was a build tool. Copied rather than re-installed so the runtime image
# holds exactly the lockfile's versions and needs no network.
COPY --from=build /build/node_modules/onnxruntime-node ./node_modules/onnxruntime-node
COPY --from=build /build/node_modules/onnxruntime-common ./node_modules/onnxruntime-common
COPY --from=build /build/apps/server/dist/server.js ./server.js
COPY --from=build /models ./models

# A package.json so node treats server.js as ESM.
RUN printf '{"type":"module","private":true}' > package.json

# Run node directly: Cloud Run sends SIGTERM and expects a quick exit, and an `npm` wrapper as
# PID 1 swallows it.
EXPOSE 8080
CMD ["node", "--enable-source-maps", "server.js"]
