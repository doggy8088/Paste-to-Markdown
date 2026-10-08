'use strict';

// Minimal dependency-free static file server for the E2E tests.
// Usage: node e2e/server.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2] || process.env.E2E_PORT || 4173);
const HOST = '127.0.0.1';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer(function (req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://' + HOST).pathname);
  } catch (error) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  if (pathname.endsWith('/')) {
    pathname += 'index.html';
  }

  const filePath = path.resolve(ROOT, '.' + pathname);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, function (error, data) {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const type = CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

server.listen(PORT, HOST, function () {
  console.log('E2E static server listening on http://' + HOST + ':' + PORT);
});
