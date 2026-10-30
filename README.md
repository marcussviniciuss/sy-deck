# SY Deck

Stream Deck pela Wi‑Fi. O computador roda uma ponte local que conversa com o OBS WebSocket; o celular acessa um PWA pela rede e aciona cenas, fontes, mídia do PC, microfone, transmissão e gravação.

Nada passa por servidor externo. Nada precisa de conta.

## Estrutura

```
pocket-deck/
├── web/      → landing page (Next.js) — deploy no Vercel
├── bridge/   → servidor Node.js + PWA vanilla + binário standalone
└── desktop/  → wrapper Tauri (opcional)
```

## Rodar em desenvolvimento

```bash
cd bridge
npm install
npm run dev
```

Imprime o QR Code no terminal. Celular na mesma Wi‑Fi lê e abre o PWA.

Alternativa com HTTPS pela internet (via ngrok):

```bash
export NGROK_AUTHTOKEN=seu-token
npm run tunnel
```

## Build do executável

```bash
cd bridge
npm run build:win     # sy-deck-win.exe
npm run build:mac     # sy-deck-mac
npm run build:linux   # sy-deck-linux
```

Pipeline: `esbuild` empacota tudo num único CJS → `@yao-pkg/pkg` embute no Node 22 → sai um executável ~70MB sem dependências externas. Dois cliques pra rodar.

## Deploy em produção

Ver [DEPLOY.md](DEPLOY.md) para o guia completo (GitHub + Vercel + Releases automáticas via GitHub Actions).

TL;DR:
1. `git init && git push` para um repo no GitHub.
2. Importa `web/` no Vercel.
3. `git tag v0.1.0 && git push --tags` → GitHub Actions compila os três binários e publica em Releases automaticamente.

## Pré-requisitos no OBS

Em qualquer máquina que vá rodar a ponte: OBS Studio 28+, menu **Ferramentas → WebSocket Server Settings → Enable WebSocket server** (porta 4455). Se definir senha, exporte `OBS_PASSWORD` antes de rodar.

## Variáveis de ambiente

| Nome | Padrão | Serve para |
|---|---|---|
| `POCKET_DECK_PORT` | `8787` | porta HTTP da ponte |
| `OBS_URL` | `ws://127.0.0.1:4455` | WebSocket do OBS |
| `OBS_PASSWORD` | vazio | senha do OBS WebSocket |
| `POCKET_DECK_TUNNEL` | vazio | `1` para abrir túnel ngrok no boot |
| `NGROK_AUTHTOKEN` | vazio | authtoken do ngrok |

## Licença

MIT.
