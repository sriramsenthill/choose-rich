# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Stage 2: Development image with nodemon
FROM node:20-alpine
WORKDIR /app

# Install nodemon globally for development
RUN npm install -g nodemon

# Copy dependencies and source code
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Start the server with nodemon for hot-reloading
CMD ["nodemon", "server.js"]