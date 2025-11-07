const net = require('net');
const mineflayer = require('mineflayer');
const { exec } = require('child_process');

let playerCount = 0;

// Track all active containers for cleanup on server exit
const activeContainers = new Set();

const server = net.createServer(socket => {
  socket.write('Enter username: ');

  let bot = null;
  let username = '';
  let gotUsername = false;
  let containerName = '';

  // Spawn a new Docker container for this player
  function spawnContainer(playerName) {
    playerCount++;
    containerName = `player_${playerName}_${playerCount}`;
    activeContainers.add(containerName);

    const cmd = `docker run -d --name ${containerName} --network mclog4j_mcnet mclog4j-webserver`;

    socket.write(`Spawning container ${containerName}...\n`);
    console.log(`Spawning container ${containerName}`);

    exec(cmd, (err) => {
      if (err) {
        console.error(`Error spawning container: ${err}`);
        socket.write(`Error starting container: ${err.message}\n`);
        return;
      }

      console.log(`Container ${containerName} started successfully`);
      socket.write(`Container ${containerName} started\n`);

      // Get container IP
      const inspectCmd = `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${containerName}`;
      exec(inspectCmd, (err2, ipStdout) => {
        if (err2) {
          console.error(`Error retrieving container IP: ${err2}`);
          socket.write(`Error retrieving container IP: ${err2.message}\n`);
          return;
        }

        const ip = ipStdout.trim();
        console.log(`Container ${containerName} IP: ${ip}`);
        socket.write(`Container IP: ${ip}\n`);
        socket.write(`LDAP: ldap://${ip}:1389\n`);
        socket.write(`HTTP: http://${ip}:8000\n`);
      });
    });
  }

  // Stop and remove the Docker container
  function cleanupContainer() {
    if (!containerName) return;

    console.log(`Stopping container ${containerName}...`);
    exec(`docker rm -f ${containerName}`, (err) => {
      if (err) console.error(`Error stopping container: ${err}`);});

    activeContainers.delete(containerName);
    containerName = '';
  }

  socket.on('data', data => {
    const input = data.toString().trim();

    if (!gotUsername) {
      username = input;
      gotUsername = true;
      socket.write(`Connecting as ${username}...\n`);

      // Spawn container
      spawnContainer(username);

      // Connect to Minecraft
      bot = mineflayer.createBot({
        host: 'minecraft',
        port: 25565,
        username
      });

      bot.on('login', () => socket.write(`${username} connected to Minecraft\n`));
      bot.on('chat', (user, message) => {
        if (user !== username) socket.write(`<${user}> ${message}\n`);
      });
      bot.on('whisper', (user, message) => {
        if (user !== username) {
          socket.write(`[Whisper from ${user}]: ${message}\n`);
        }
      });
      bot.on('end', () => socket.write(`${username} disconnected\n`));
      bot.on('error', err => socket.write(`Bot error: ${err.message}\n`));
      socket.write('You are connected to the minecraft chat now!\n')

      return;
    }

    // Send chat input to Minecraft bot
    if (bot && bot.entity) bot.chat(input);
  });

    // Cleanup when socket closes (including Ctrl+C on nc client)
    socket.on('close', () => {
      console.log('Client disconnected, cleaning up...');
      if (bot) bot.quit('Connection closed');
      cleanupContainer();
    });

    socket.on('error', (err) => {
      console.error(`Socket error: ${err}`);
      if (bot) bot.quit('Socket error');
      cleanupContainer();
    });
});

// Handle server Ctrl+C
process.on('SIGINT', () => {
  console.log('\nServer shutting down, cleaning up all containers...');
  for (const cname of Array.from(activeContainers)) {
    console.log(`Stopping container ${cname}...`);
    exec(`docker rm -f ${cname}`, () => {});
  }
  process.exit();
});

server.listen(9000, '0.0.0.0', () => {
  console.log('TCP chat relay listening on port 9000');
});
