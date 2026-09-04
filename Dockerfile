FROM node:20-alpine
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
COPY . .
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node","src/server.js"]
