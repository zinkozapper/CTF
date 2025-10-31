const net = require('net');
const mineflayer = require('mineflayer');

const bot = mineflayer.createBot({
  host: 'minecraft',
  port: 25565,
  username: 'MineBot2000'
});

function startBot(bot) {
  bot.on('login', () => console.log('Bot connected'));
  bot.on('error', err => {
    console.log('Bot error:', err.message);
    setTimeout(startBot, 5000); // retry in 5s
  });
  bot.on('end', () => setTimeout(startBot, 5000));
}

startBot(bot);

const clients = new Set();

const server = net.createServer(socket => {
  socket.write('Connected to Minecraft chat\n');
  clients.add(socket);

  // send chat messages to all connected clients
  const onChat = (username, message) => {
    if (!socket.destroyed) socket.write(`<${username}> ${message}\n`);
  };
  bot.on('chat', onChat);

  // send input from this client to Minecraft chat
  socket.on('data', data => {
    const msg = data.toString().trim();
    if (msg.length && bot.entity) bot.chat(msg);
  });

    // remove listener on close or error
    const cleanup = () => {
      clients.delete(socket);
      bot.removeListener('chat', onChat);
    };
    socket.on('close', cleanup);
    socket.on('error', cleanup);
});

server.listen(9000, '0.0.0.0', () => console.log('TCP chat relay listening on port 9000'));
