FROM node:20-alpine

WORKDIR /app

# Install app dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Install nodemon globally
RUN npm install -g nodemon

# Copy the rest of the application code
COPY . .

EXPOSE 3000

CMD ["nodemon", "server.js"]