// Minimal static file server WITH HTTP Range support.
// Range is what lets <video> seek (scrub) and stream large files without
// downloading them whole first. Node serves requests concurrently, so every
// frame's preview can load in parallel (unlike a single-threaded server).
//
// Run:  node serve.js     then open  http://localhost:8080/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.m4v': 'video/x-m4v', '.mov': 'video/quicktime',
  '.webm': 'video/webm', '.ogg': 'video/ogg',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400); res.end('Bad request'); return;
  }
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not found'); return; }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const total = stat.size;
    // HTML must always revalidate (it changes); media/fonts are immutable-ish
    // assets — let browsers keep them for a week so repeat visits are instant.
    const cache = (ext === '.html' || ext === '.js' || ext === '.css')
      ? 'no-cache'
      : 'public, max-age=604800';
    const headers = {
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': cache
    };

    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m && m[1] !== '' ? parseInt(m[1], 10) : 0;
      let end = m && m[2] !== '' ? parseInt(m[2], 10) : total - 1;
      if (isNaN(start)) start = 0;
      if (isNaN(end) || end >= total) end = total - 1;
      if (start > end || start >= total) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        res.end(); return;
      }
      headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
      headers['Content-Length'] = end - start + 1;
      res.writeHead(206, headers);
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } else {
      headers['Content-Length'] = total;
      res.writeHead(200, headers);
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = fs.createReadStream(filePath);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    }
  });
});

server.listen(PORT, () => {
  console.log('\n  Film strip server running (Range + concurrent):');
  console.log('   http://localhost:' + PORT + '/\n');
  console.log('  Stop with Ctrl+C.\n');
});
