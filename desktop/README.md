# Pocket Deck Desktop (Tauri)

Empacota a ponte Node.js como aplicativo nativo com janela.

## Pré-requisitos

- Rust (via `rustup`)
- Node.js 20+
- Dependências de build do Tauri para seu sistema: https://v2.tauri.app/start/prerequisites/

## Fluxo

1. Compile a ponte Node em binário único via `pkg`:

   ```bash
   cd ../bridge
   npm install
   npm run pkg
   ```

   Isso gera `bridge/dist/pocket-deck-bridge-*`.

2. Copie o binário certo para dentro deste projeto, renomeando conforme a plataforma Tauri espera:

   - Windows: `src-tauri/binaries/pocket-deck-bridge-x86_64-pc-windows-msvc.exe`
   - macOS Intel: `src-tauri/binaries/pocket-deck-bridge-x86_64-apple-darwin`
   - macOS Apple Silicon: `src-tauri/binaries/pocket-deck-bridge-aarch64-apple-darwin`
   - Linux: `src-tauri/binaries/pocket-deck-bridge-x86_64-unknown-linux-gnu`

3. Rode em dev:

   ```bash
   npm install
   npm run dev
   ```

4. Gere o instalador final:

   ```bash
   npm run build
   ```

   Saída em `src-tauri/target/release/bundle/`.

## Ícones

Rode `cargo tauri icon <png-grande>` dentro de `src-tauri/` para gerar o conjunto de ícones a partir de um PNG 1024×1024.
