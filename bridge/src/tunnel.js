import { config } from './config.js';

export async function openTunnel(port) {
  if (!config.tunnel) return null;

  let ngrok;
  try {
    ngrok = await import('@ngrok/ngrok');
  } catch {
    console.warn('\n[tunnel] @ngrok/ngrok não instalado. Rode:  npm install @ngrok/ngrok\n');
    return null;
  }

  if (!config.ngrokAuthToken) {
    console.warn('\n[tunnel] NGROK_AUTHTOKEN não definido. Pegue em https://dashboard.ngrok.com/get-started/your-authtoken e exporte antes de rodar.\n');
    return null;
  }

  try {
    const options = {
      addr: port,
      authtoken: config.ngrokAuthToken,
    };
    if (config.ngrokDomain) options.domain = config.ngrokDomain;
    const listener = await ngrok.forward(options);
    return listener.url();
  } catch (err) {
    console.warn(`\n[tunnel] falhou: ${err.message}\n`);
    return null;
  }
}
