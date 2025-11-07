FROM docker:27-cli

RUN apk add --no-cache nodejs npm

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY bot.js .

EXPOSE 9000

ENTRYPOINT []

CMD ["node", "bot.js"]
