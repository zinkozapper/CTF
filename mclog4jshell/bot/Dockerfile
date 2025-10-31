FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY bot.js .

EXPOSE 9000
CMD ["node", "bot.js"]
