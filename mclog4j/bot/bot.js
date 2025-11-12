const net = require('net');
const mineflayer = require('mineflayer');
const { exec } = require('child_process');
const http = require('http');
const httpPort = 9001;

// --- Global State ---
const clientToContainerMap = {};
const activeContainers = new Set();
let playerCount = 0;
// Internal port of the webserver inside the container (constant)
const containerPort = 8000;

// --- 1. NGINX LOOKUP API (Port 9001) ---
const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clientIp = url.searchParams.get('ip');

  res.setHeader('Content-Type', 'application/json');

  if (clientIp && clientToContainerMap[clientIp]) {
    const containerInfo = clientToContainerMap[clientIp];
    res.end(JSON.stringify({ address: `${containerInfo.ip}:${containerInfo.port}` }));
  } else {
    // This is expected if the client hasn't finished the login process
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Container not found or not yet ready' }));
  }
});

httpServer.listen(httpPort, '0.0.0.0', () => {
  console.log(`HTTP API for Nginx lookup listening on port ${httpPort}`);
});

// --- 2. Container Management ---

/**
 * Spawns a dedicated Docker container and maps its internal IP to the client's IP.
 */
function spawnContainer(playerName, clientIP) {
  playerCount++;
  const safePlayerName = playerName.replace(/[^a-z0-9-_]/ig, '-');
  const containerName = `player_${safePlayerName}_${playerCount}`;
  activeContainers.add(containerName);

  // Command uses --expose instead of -p, and no hostPort is needed.
  const cmd = `docker run -d --name ${containerName} --network mclog4j_mcnet --expose ${containerPort} mclog4j-webserver`;

  console.log(`Spawning container ${containerName} for client IP: ${clientIP}`);

  exec(cmd, (err) => {
    if (err) {
      console.error(`Error spawning container: ${err}`);
      return;
    }

    // Get container IP
    const inspectCmd = `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${containerName}`;
    exec(inspectCmd, (err2, ipStdout) => {
      if (err2) {
        console.error(`Error retrieving container IP: ${err2}`);
        return;
      }

      const ip = ipStdout.trim();
      console.log(`Container ${containerName} IP: ${ip}`);

      // CRITICAL: Map the external client's IP to the container address
      clientToContainerMap[clientIP] = { name: containerName, ip: ip, port: containerPort };
      console.log(`[MAP] Mapped Key (Client IP): ${clientIP} to Value: ${ip}:${containerPort}`);

      // Placeholder for socket.write (must be called from within the connection scope)
      // socket.write(`Internal HTTP Server: http://${ip}:8000\n`);
    });
  });

  // Return the name for cleanup later
  return containerName;
}

/**
 * Stop and remove the Docker container and clear the map entry.
 */
function cleanupContainer(containerName, clientIP) {
  if (!containerName) return;

  console.log(`Stopping container ${containerName}...`);
  exec(`docker rm -f ${containerName}`, (err) => {
    if (err) console.error(`Error stopping container: ${err}`);
  });

  activeContainers.delete(containerName);

  // Clear the map entry
  if (clientIP && clientToContainerMap[clientIP]) {
    delete clientToContainerMap[clientIP];
    console.log(`[MAP] Cleared map entry for ${clientIP}`);
  }
}


// --- 3. TCP CHAT SERVER (Port 9000) ---
const server = net.createServer(socket => {
  let clientIP = socket.remoteAddress; // Default to the address connecting (Nginx IP)
let username = '';
let gotUsername = false;
let bot = null;
let containerName = '';

// Handler for the first data chunk to parse the PROXY protocol header
socket.once('data', data => {
  const dataStr = data.toString();

  // Check for the PROXY protocol signature
  if (dataStr.startsWith('PROXY TCP4') || dataStr.startsWith('PROXY TCP6')) {
    const parts = dataStr.split(' ');
    if (parts.length >= 5) {
      // The 4th element (index 4) is the real client IP
      clientIP = parts[2]; // Index 2 is the source IP in the standard format
      console.log(`[PROXY] Real Client IP detected: ${clientIP}`);
    }

    // Find where the PROXY header ends (\r\n)
    const headerEnd = dataStr.indexOf('\r\n') + 2;
    const remainingData = data.slice(headerEnd);

    // Attach the main data handler and re-emit the username input data
    socket.on('data', mainDataHandler);
    if (remainingData.length > 0) {
      socket.emit('data', remainingData);
    }
  } else {
    // No proxy header, proceed normally, assuming no proxy is used
    socket.on('data', mainDataHandler);
    socket.emit('data', data);
  }

  socket.write('Enter username: ');
});

function mainDataHandler(data) {
  const input = data.toString().trim();

  if (!gotUsername) {
    username = input;
    gotUsername = true;
    socket.write(`Connecting as ${username}...\n`);

    // 🌟 Use the potentially corrected clientIP for mapping
    containerName = spawnContainer(username, clientIP);

    // Connect to Minecraft
    bot = mineflayer.createBot({
      host: 'minecraft',
      port: 25565,
      username
    });

    bot.on('login', () => socket.write(`${username} connected to Minecraft\n`));
    bot.on('end', () => socket.write(`${username} disconnected\n`));
    bot.on('error', err => socket.write(`Bot error: ${err.message}\n`));

    // Chat relay setup
    bot.on('chat', (user, message) => {
      if (user !== username) socket.write(`<${user}> ${message}\n`);
    });
    bot.on('whisper', (user, message) => {
      if (user !== username) socket.write(`[Whisper from ${user}]: ${message}\n`);
    });

    socket.write('You are connected to the minecraft chat now!\n')
    socket.write(`Access web ui via the main proxy URL.\n`)
    return;
  }

  // Send chat input to Minecraft bot
  if (bot && bot.entity) bot.chat(input);
}

// Cleanup when socket closes
socket.on('close', () => {
  console.log('Client disconnected, cleaning up...');
  if (bot) bot.quit('Connection closed');
  cleanupContainer(containerName, clientIP);
});

socket.on('error', (err) => {
  console.error(`Socket error: ${err}`);
  if (bot) bot.quit('Socket error');
  cleanupContainer(containerName, clientIP);
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
