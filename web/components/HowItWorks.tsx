import { Download, QrCode, SlidersHorizontal } from '@phosphor-icons/react/dist/ssr';

const steps = [
  {
    icon: Download,
    title: 'Baixe a ponte',
    body: 'Um executável único (Windows, macOS ou Linux). Dois cliques, nada para configurar.',
  },
  {
    icon: QrCode,
    title: 'Leia o QR Code',
    body: 'A ponte mostra um QR com o endereço local. Aponte o celular, abra o PWA, instale.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Controle o OBS',
    body: 'Cenas, mídia, microfone, transmissão e gravação. Sem conta, sem internet, sem lag.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-border">
      <div className="mx-auto flex max-w-container flex-col gap-3 px-2 py-4 sm:px-3 sm:py-5">
        <div className="flex flex-col gap-1">
          <p className="text-sm uppercase tracking-[0.14em] text-muted">Como funciona</p>
          <h2 className="max-w-prose text-3xl font-semibold tracking-tight sm:text-4xl">
            Três passos, sem servidor no meio.
          </h2>
        </div>

        <ol className="grid gap-1 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li
              key={title}
              className="flex flex-col gap-2 rounded border border-border bg-bg-elev p-3 transition-colors hover:border-muted"
            >
              <div className="flex items-center gap-1">
                <span className="font-mono text-sm text-muted">0{i + 1}</span>
                <Icon size={22} weight="regular" className="text-primary" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
              <p className="text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
