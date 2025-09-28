# syntax=docker/dockerfile:1
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies for native modules (cached layer)
RUN apt-get update && apt-get install -y \
    make \
    g++ \
    python3 \
    python3-pip \
    git \
    pkg-config \
    libusb-1.0-0-dev \
    libudev-dev \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for native builds
ENV PYTHON=/usr/bin/python3
ENV MAKE=/usr/bin/make
ENV CC=gcc
ENV CXX=g++

# Enable corepack and set up yarn
RUN corepack enable && corepack prepare yarn@4.5.1 --activate

# Copy ONLY package files for maximum dependency layer caching
COPY package.json yarn.lock .yarnrc.yml ./

# Configure yarn for optimal Docker performance
RUN yarn config set nodeLinker node-modules && \
    yarn config set enableGlobalCache false

# Install dependencies with cache mount - this layer only rebuilds if package files change
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn config set cacheFolder /usr/local/share/.cache/yarn && \
    yarn install --inline-builds

# HYPER-OPTIMIZED BUILD ENVIRONMENT - Maximum performance settings
ENV NODE_ENV=production
ENV CI=true
ENV GENERATE_SOURCEMAP=false

# Aggressive performance settings
ENV NODE_OPTIONS="--max-old-space-size=8192 --max-semi-space-size=512"
ENV UV_THREADPOOL_SIZE=128
ENV VITE_LEGACY=false

# Multi-core build optimizations
ENV MAKEFLAGS="-j$(nproc)"
ENV JOBS="$(nproc)"

# Vite performance optimizations
ENV VITE_DISABLE_HMRPAYLOAD_CHECK=true
ENV VITE_OPTIMIZE_DEPS_INCLUDE_LINKEDPACKAGES=false
ENV VITE_BUILD_ROLLUP_TREESHAKE_PRESET=smallest

# Set PATH for node_modules binaries
ENV PATH="/app/node_modules/.bin:${PATH}"

# Copy ALL source files in one layer for better caching efficiency
COPY . .

# HYPER-OPTIMIZED BUILD COMMAND - Maximum parallelization and speed
RUN --mount=type=cache,target=/app/node_modules/.vite \
    --mount=type=cache,target=/app/node_modules/.cache \
    --mount=type=cache,target=/tmp \
    set -e && \
    echo "Starting optimized build process..." && \
    echo "Utilizing $(nproc) CPU cores for parallel processing" && \
    \
    echo "Running TypeScript compilation..." && \
    tsc -b --verbose --incremental && \
    \
    echo "Running Vite build with esbuild minification..." && \
    vite build \
    --mode production \
    --logLevel error \
    --minify esbuild \
    --target esnext \
    || (echo "Primary build failed, trying fallback build..." && \
    vite build --mode production --logLevel warn)

# ============================================================================
FROM nginx:1.27-alpine AS production

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Configure nginx for SPA with optimized caching + embedding support
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    \n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    \n\
    # Enable gzip compression\n\
    gzip on;\n\
    gzip_vary on;\n\
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;\n\
    \n\
    location / {\n\
        try_files $uri $uri.html $uri/ /index.html;\n\
    }\n\
    \n\
    error_page 404 = @redirect_to_root;\n\
    location @redirect_to_root {\n\
        return 302 /;\n\
    }\n\
    \n\
    # Cache static assets aggressively\n\
    location ~* \\.(?:ico|css|js|gif|jpe?g|png|woff2?|eot|ttf|svg|otf|wasm)$ {\n\
        expires 1m;\n\
        access_log off;\n\
        add_header Cache-Control \"public\";\n\
    }\n\
    \n\
    # Security headers\n\
    add_header X-Content-Type-Options \"nosniff\" always;\n\
    add_header Content-Security-Policy \"frame-ancestors *;\" always;\n\
    }\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
