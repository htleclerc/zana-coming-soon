const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const PORT = 3610;
const SB_URL = process.env.SUPABASE_URL || '';
const SB_KEY = process.env.SUPABASE_ANON_KEY || '';
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // max requests per window per IP

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Simple in-memory rate limiter
const hits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const record = hits.get(ip);

  if (!record || now - record.start > RATE_LIMIT_WINDOW) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }

  record.count++;
  return record.count > RATE_LIMIT_MAX;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of hits) {
    if (now - record.start > RATE_LIMIT_WINDOW) hits.delete(ip);
  }
}, 5 * 60 * 1000);

const SECURITY_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    `connect-src 'self' ${SB_URL}`,
    "img-src 'self' data:",
    "frame-ancestors 'none'",
  ].join('; '),
};

const indexPath = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  const ip = req.socket.remoteAddress || 'unknown';

  if (isRateLimited(ip)) {
    res.writeHead(429, { 'Content-Type': 'text/plain', 'Retry-After': '60' });
    res.end('Too many requests. Try again later.');
    return;
  }

  // Only serve GET /
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed');
    return;
  }

  fs.readFile(indexPath, 'utf8', (err, html) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading page');
      return;
    }
    const rendered = html
      .replace('__SB_URL__', escapeHtml(SB_URL))
      .replace('__SB_KEY__', escapeHtml(SB_KEY));
    res.writeHead(200, SECURITY_HEADERS);
    res.end(rendered);
  });
});

server.listen(PORT, () => {
  console.log(`Zana Coming Soon → http://localhost:${PORT}`);
});
