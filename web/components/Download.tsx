import Link from 'next/link';
import { WindowsLogo, AppleLogo, LinuxLogo } from '@phosphor-icons/react/dist/ssr';

const REPO = 'https://github.com/marcussviniciuss/sy-deck';
const RELEASE_BASE = `${REPO}/releases/latest/download`;

const builds = [
  { icon: WindowsLogo, label: 'Windows', ext: '.exe', href: `${RELEASE_BASE}/sy-deck-win.exe` },
  { icon: AppleLogo, label: 'macOS', ext: '.dmg', href: `${RELEASE_BASE}/sy-deck-mac.dmg` },
  { icon: LinuxLogo, label: 'Linux', ext: '.AppImage', href: `${RELEASE_BASE}/sy-deck-linux.AppImage` },
];

export function Download() {
  return (
    <section id="download" className="border-b border-border">
      <div className="mx-auto flex max-w-container flex-col gap-3 px-2 py-4 sm:px-3 sm:py-5">
        <div className="flex flex-col gap-1">
          <p className="text-sm uppercase tracking-[0.14em] text-primary">Baixar</p>
          <h2 className="max-w-prose font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Um executável, nenhuma instalação.
          </h2>
          <p className="max-w-prose text-muted">
            Baixe, dê dois cliques, abra o OBS. A janela mostra o QR Code — o resto acontece no celular.
          </p>
        </div>

        <ul className="grid gap-1 sm:grid-cols-3">
          {builds.map(({ icon: Icon, label, ext, href }) => (
            <li key={label}>
              <Link
                href={href}
                className="flex items-center gap-2 rounded border border-border bg-bg-elev p-3 transition-colors hover:border-primary hover:bg-bg-elev-2"
              >
                <Icon size={28} weight="regular" className="text-primary" />
                <span className="flex flex-col">
                  <span className="font-semibold">{label}</span>
                  <span className="text-sm text-muted">SYDeck{ext}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="text-sm text-muted">
          Antes de abrir, ative no OBS: menu <span className="text-fg">Ferramentas</span>, item{' '}
          <span className="text-fg">WebSocket Server Settings</span>, marque{' '}
          <span className="text-fg">Enable WebSocket server</span>.
        </p>
      </div>
    </section>
  );
}
