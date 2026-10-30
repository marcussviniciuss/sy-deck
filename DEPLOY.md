# SY Deck — Como publicar

Três partes:

1. **Repositório no GitHub** — guarda o código e distribui os executáveis.
2. **Landing page no Vercel** — site com os botões de download.
3. **Executáveis via GitHub Actions** — build automático pra Windows/macOS/Linux a cada tag.

## 1. GitHub

```bash
cd pocket-deck
git init
git add .
git commit -m "SY Deck inicial"
gh repo create sy-deck --public --source=. --push
```

(ou cria pela web em github.com/new, depois `git remote add origin ... && git push -u origin main`)

Depois ajuste o link no `web/components/Download.tsx`:
```ts
const REPO = 'https://github.com/SEU-USUARIO/sy-deck';
```

## 2. Vercel

1. Vai em [vercel.com/new](https://vercel.com/new) → importa o repo `sy-deck`.
2. **Root Directory**: `web`
3. Framework: Next.js (detecta sozinho)
4. Deploy.

O site vai pra `https://sy-deck.vercel.app` (ou domínio custom). Toda vez que você faz `git push`, redeploya.

## 3. Executáveis (release automática)

Workflow em `.github/workflows/release.yml` já está pronto. Pra lançar uma versão:

```bash
git tag v0.1.0
git push --tags
```

O GitHub Actions compila `.exe` (Windows), `-mac` (macOS) e `-linux` (Linux) usando `@yao-pkg/pkg` (fork do pkg com suporte a ESM), e publica tudo em **Releases** automaticamente. Os links em `Download.tsx` apontam pra `releases/latest/download/`, então sempre pegam a última versão.

Pra testar o build localmente antes de taguear:
```bash
cd bridge
npm install
npm run pkg
```

Saída em `bridge/dist/sy-deck-*`.

## Fluxo do usuário final

1. Entra em `sy-deck.vercel.app`
2. Baixa o executável do seu sistema
3. Dá dois cliques — abre uma janela de terminal mostrando QR Code + endereço local
4. Com o celular na mesma Wi‑Fi, lê o QR → PWA abre
5. Instala como app ("Adicionar à tela inicial")
6. Controla OBS: cenas, mídia PC, fontes, mute, transmissão, gravação

## Domínio custom (opcional)

Depois do deploy, em Vercel → Settings → Domains → adiciona o domínio. Vercel configura HTTPS automático.

## Troubleshooting

- **"Edge nenhum encontrado" ou similar**: a ponte não tem Node bundled. Confirme que o build do pkg funcionou — o executável tem que ter uns 50+ MB (contém o Node runtime).
- **Firewall do Windows bloqueia**: na primeira execução, Windows pede autorização pra abrir porta. Permita acesso em redes privadas.
- **OBS WebSocket**: cada usuário precisa habilitar manualmente em Ferramentas → WebSocket Server Settings → Enable WebSocket server.
