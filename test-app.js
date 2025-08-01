const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

/**
 * Test application server for CipherWave
 * This server serves the web application files and proxies WebSocket connections
 * to the signaling server, allowing clients to connect through a single port.
 */

// Create HTTP server
const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Serve files
  let filePath = '.' + req.url;
  
  // If requesting root, serve index.html
  if (filePath === './') {
    filePath = './www/index.html';
  }
  
  // If requesting files from root, redirect to www directory
  if (filePath.startsWith('./') && !filePath.startsWith('./www/')) {
    filePath = './www' + req.url;
  }
  
  // Get file extension
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };
  
  const contentType = mimeTypes[extname] || 'application/octet-stream';
  
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found
        fs.readFile('./404.html', (err, content) => {
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end(content, 'utf-8');
        });
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

// Start server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log('Open two browser windows to test the WebRTC connection:');
  console.log(`  Window 1: http://localhost:${PORT}/`);
  console.log(`  Window 2: http://localhost:${PORT}/`);
});

// Create WebSocket proxy server
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws, req) {
  console.log('WebSocket connection established');
  
  // Connect to the signaling server
  const signalingServer = new WebSocket('ws://localhost:8080');
  
  signalingServer.on('open', function open() {
    console.log('Connected to signaling server');
  });
  
  signalingServer.on('message', function incoming(data) {
    // Forward message from signaling server to client
    ws.send(data);
  });
  
  signalingServer.on('error', function error(err) {
    console.error('Signaling server error:', err);
  });
  
  signalingServer.on('close', function close() {
    console.log('Signaling server connection closed');
  });
  
  // Handle messages from client
  ws.on('message', function incoming(data) {
    // Forward message from client to signaling server
    if (signalingServer.readyState === WebSocket.OPEN) {
      // Parse the message to check if it's a join message
      try {
        const message = JSON.parse(data);
        if (message.type === 'join') {
          console.log('Client joining room:', message.room);
        }
      } catch (e) {
        // Not a JSON message, just forward it
      }
      signalingServer.send(data);
    }
  });
  
  ws.on('error', function error(err) {
    console.error('Client WebSocket error:', err);
  });
  
  ws.on('close', function close() {
    console.log('Client WebSocket connection closed');
    if (signalingServer.readyState === WebSocket.OPEN) {
      signalingServer.close();
    }
  });
});
