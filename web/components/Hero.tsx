import Link from 'next/link';
import { DownloadSimple, GithubLogo } from '@phosphor-icons/react/dist/ssr';

export function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto flex max-w-container flex-col gap-3 px-2 py-4 sm:px-3 sm:py-5">
        <p className="text-sm uppercase tracking-[0.14em] text-primary">
          SY Community · Stream Deck pela Wi‑Fi
        </p>

        <h1 className="max-w-prose font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Seu celular antigo vira o Stream Deck que você nunca comprou.
        </h1>

        <p className="max-w-prose text-base text-muted sm:text-lg">
          Grátis, local, sem conta. Instala a ponte no computador, abre a URL no celular na mesma rede, e você tem
          cenas, mídia e microfone do OBS num toque — sem servidor nenhum no meio.
        </p>

        <div className="mt-2 flex flex-wrap gap-1">
          <Link
            href="#download"
            className="inline-flex items-center gap-1 rounded bg-primary px-3 py-[14px] font-medium text-primary-fg transition-colors hover:bg-primary/90"
          >
            <DownloadSimple size={18} weight="regular" />
            <span>Baixar SY Deck</span>
          </Link>
          <Link
            href="https://github.com"
            className="inline-flex items-center gap-1 rounded border border-border bg-bg-elev px-3 py-[14px] font-medium text-fg transition-colors hover:border-muted hover:bg-bg-elev-2"
          >
            <GithubLogo size={18} weight="regular" />
            <span>Ver no GitHub</span>
          </Link>
        </div>

        <p className="text-sm text-muted">
          Windows · macOS · Linux. Nenhum dado sai da sua rede.
        </p>
      </div>
    </section>
  );
}
