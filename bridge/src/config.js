import os from 'node:os';

const argv = process.argv.slice(2);

export const config = {
  httpPort: Number(process.env.POCKET_DECK_PORT ?? 8787),
  obsUrl: process.env.OBS_URL ?? 'ws://127.0.0.1:4455',
  obsPassword: process.env.OBS_PASSWORD ?? '',
  tunnel: process.env.POCKET_DECK_TUNNEL === '1' || argv.includes('--tunnel'),
  ngrokAuthToken: process.env.NGROK_AUTHTOKEN ?? '',
  ngrokDomain: process.env.NGROK_DOMAIN ?? '',
};

export function getLanAddresses() {
  const addrs = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        addrs.push({ iface: name, address: net.address });
      }
    }
  }
  return addrs;
}
