#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import qrcode from 'qrcode-terminal';
import { config, getLanAddresses } from './config.js';
import { obsClient } from './obs.js';
import { openTunnel } from './tunnel.js';
import { bus } from './bus.js';
import { sendMediaKey, getMediaStatus } from './pcmedia.js';

process.on('uncaughtException', (err) => {
  console.error('[fatal]', err);
  setTimeout(() => process.exit(1), 100);
});
process.on('unhandledRejection', (err) => {
  console.error('[fatal reject]', err);
  setTimeout(() => process.exit(1), 100);
});

function resolveScriptDir() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  if (typeof __dirname !== 'undefined') return __dirname;
  return process.cwd();
}
const scriptDir = resolveScriptDir();
const publicDir = path.resolve(scriptDir, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function handleStream(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    'connection': 'keep-alive',
    'access-control-allow-origin': '*',
    'x-accel-buffering': 'no',
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const onLevels = (l) => send('levels', l);
  const onMute = (m) => send('mute', m);
  const onVolume = (v) => send('volume', v);
  const onSource = (s) => send('source', s);
  const onScene = (s) => send('scene', s);
  const onStream = (s) => send('stream', s);
  const onRecord = (r) => send('record', r);
  const onConnection = (c) => send('connection', c);

  bus.on('levels', onLevels);
  bus.on('mute', onMute);
  bus.on('volume', onVolume);
  bus.on('source', onSource);
  bus.on('scene', onScene);
  bus.on('stream', onStream);
  bus.on('record', onRecord);
  bus.on('connection', onConnection);

  const ping = setInterval(() => res.write(': ping\n\n'), 15000);

  send('hello', { ok: true });

  req.on('close', () => {
    clearInterval(ping);
    bus.off('levels', onLevels);
    bus.off('mute', onMute);
    bus.off('volume', onVolume);
    bus.off('source', onSource);
    bus.off('scene', onScene);
    bus.off('stream', onStream);
    bus.off('record', onRecord);
    bus.off('connection', onConnection);
  });
}

async function handleApi(req, res, url) {
  const route = url.pathname.replace(/^\/api\//, '');
  try {
    if (req.method === 'GET' && route === 'stream') {
      return handleStream(req, res);
    }
    if (req.method === 'GET' && route === 'status') {
      return sendJson(res, 200, await obsClient.status());
    }
    if (req.method === 'GET' && route === 'scenes') {
      return sendJson(res, 200, await obsClient.listScenes());
    }
    if (req.method === 'POST' && route === 'scene') {
      const body = await readJsonBody(req);
      await obsClient.setScene(body.name);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'GET' && route === 'inputs') {
      return sendJson(res, 200, { inputs: await obsClient.listInputs() });
    }
    if (req.method === 'GET' && route === 'audio') {
      return sendJson(res, 200, { inputs: await obsClient.listAudioInputs() });
    }
    if (req.method === 'POST' && route === 'mute') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await obsClient.toggleMute(body.input));
    }
    if (req.method === 'POST' && route === 'volume') {
      const body = await readJsonBody(req);
      await obsClient.setVolume(body.input, Number(body.db));
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST' && route === 'media') {
      const body = await readJsonBody(req);
      await obsClient.mediaAction(body.source, body.action);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST' && route === 'stream/start') {
      return sendJson(res, 200, await obsClient.startStream());
    }
    if (req.method === 'POST' && route === 'stream/stop') {
      return sendJson(res, 200, await obsClient.stopStream());
    }
    if (req.method === 'POST' && route === 'record/toggle') {
      return sendJson(res, 200, await obsClient.toggleRecord());
    }
    if (req.method === 'GET' && route === 'scene-items') {
      return sendJson(res, 200, await obsClient.listAllSceneItems());
    }
    if (req.method === 'POST' && route === 'source-toggle') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await obsClient.toggleSceneItem(body.scene, body.source));
    }
    if (req.method === 'POST' && route === 'pc-media') {
      const body = await readJsonBody(req);
      await sendMediaKey(body.action);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'GET' && route === 'pc-media/status') {
      return sendJson(res, 200, await getMediaStatus());
    }
    return sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    return sendJson(res, 500, { error: err.message });
  }
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const filePath = path.join(publicDir, rel);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end();
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      return res.end('not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
    });
    return res.end();
  }
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  return serveStatic(req, res, url);
});

server.listen(config.httpPort, '0.0.0.0', async () => {
  const addrs = getLanAddresses();
  const primary = addrs[0]?.address ?? '127.0.0.1';
  const localUrl = `http://${primary}:${config.httpPort}`;
  console.log('\nSY Deck Bridge');
  console.log('==================\n');

  const tunnelUrl = await openTunnel(config.httpPort);
  const shareUrl = tunnelUrl ?? localUrl;

  if (tunnelUrl) {
    console.log(`Túnel ngrok: ${tunnelUrl}`);
    console.log(`Fallback LAN: ${localUrl}`);
  } else {
    console.log(`Abra no celular: ${localUrl}`);
    if (addrs.length > 1) {
      console.log('Outras interfaces:');
      for (const a of addrs.slice(1)) console.log(`  http://${a.address}:${config.httpPort}  (${a.iface})`);
    }
  }

  console.log('');
  qrcode.generate(shareUrl, { small: true });
  console.log(`\nOBS WebSocket: ${config.obsUrl}`);
  const s = await obsClient.status();
  console.log(s.connected ? 'OBS conectado.' : `OBS indisponível: ${s.error ?? 'desconhecido'}`);
  console.log('Ctrl+C para encerrar.\n');
});
