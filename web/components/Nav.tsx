import Link from 'next/link';
import { DownloadSimple } from '@phosphor-icons/react/dist/ssr';

export function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg">
      <div className="mx-auto flex max-w-container items-center justify-between px-2 py-1 sm:px-3">
        <Link href="/" className="flex items-center gap-1 text-fg transition-colors hover:text-primary">
          <span aria-hidden className="h-[10px] w-[10px] rounded-full bg-primary" />
          <span className="font-display text-lg font-semibold tracking-tight">SY Deck</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="#how" className="hidden text-sm text-muted transition-colors hover:text-fg sm:inline-flex">
            Como funciona
          </Link>
          <Link href="#features" className="hidden text-sm text-muted transition-colors hover:text-fg sm:inline-flex">
            O que faz
          </Link>
          <Link
            href="#download"
            className="inline-flex items-center gap-1 rounded border border-border bg-bg-elev px-2 py-[6px] text-sm text-fg transition-colors hover:border-muted hover:bg-bg-elev-2"
          >
            <DownloadSimple size={16} weight="regular" />
            <span>Baixar</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
