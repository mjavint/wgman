# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /workspace/frontend

# Cache npm dependencies separately from source code changes
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --prefer-offline

COPY frontend/ ./
# vite outDir is '../backend/assets' → outputs to /workspace/backend/assets
RUN mkdir -p ../backend/assets && npm run build

# ── Stage 2: Build backend ────────────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM golang:1.23-alpine3.20 AS go-builder
LABEL maintainer="wgman"

ARG TARGETOS=linux
ARG TARGETARCH
ARG APP_VERSION=dev
ARG BUILD_TIME
ARG GIT_COMMIT

RUN apk add --update --no-cache gcc musl-dev

WORKDIR /build

# Cache Go module downloads separately from source changes
COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ .

# Copy compiled frontend assets from stage 1
COPY --from=frontend-builder /workspace/backend/assets ./assets

RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build \
    -ldflags="-X 'main.appVersion=${APP_VERSION}' -X 'main.buildTime=${BUILD_TIME}' -X 'main.gitCommit=${GIT_COMMIT}'" \
    -a -o wgman .

# ── Stage 3: Production runtime ───────────────────────────────────────────────
FROM alpine:3.20

RUN addgroup -S wgman && \
    adduser -S -D -G wgman wgman

RUN apk --no-cache add ca-certificates wireguard-tools jq iptables sudo

# Allow wgman to run WireGuard commands without a password
RUN echo "wgman ALL=(ALL) NOPASSWD: /usr/bin/wg-quick, /usr/bin/ip, /usr/bin/wg" > /etc/sudoers.d/wgman && \
    chmod 0440 /etc/sudoers.d/wgman

WORKDIR /app

RUN mkdir -p db

COPY --from=go-builder --chown=wgman:wgman /build/wgman .
COPY --from=go-builder --chown=wgman:wgman /build/assets ./assets
COPY --chown=wgman:wgman init.sh .
RUN chmod +x wgman init.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:5000/_health || exit 1

EXPOSE 5000/tcp
USER wgman
ENTRYPOINT ["./init.sh"]
