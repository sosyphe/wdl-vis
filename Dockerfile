# Stage 1: build demo
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:demo

# Stage 2: serve with nginx
FROM nginx:alpine
COPY --from=builder /app/demo-dist /usr/share/nginx/html
EXPOSE 80
