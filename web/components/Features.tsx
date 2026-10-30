import {
  SquaresFour,
  Microphone,
  PlayCircle,
  Broadcast,
  WifiHigh,
  LockKey,
} from '@phosphor-icons/react/dist/ssr';

const items = [
  {
    icon: SquaresFour,
    title: 'Cenas em grade',
    body: 'A cena ativa fica evidente. Trocar é um toque, não um menu.',
  },
  {
    icon: PlayCircle,
    title: 'Controle de mídia',
    body: 'Tocar, pausar, próxima, anterior. Fontes de mídia do OBS, direto do celular.',
  },
  {
    icon: Microphone,
    title: 'Mute do microfone',
    body: 'Um botão largo, próximo do polegar, para quando a cadeira ranger.',
  },
  {
    icon: Broadcast,
    title: 'Transmissão e gravação',
    body: 'Começar e parar sem tirar a mão do mouse. Ou, melhor, sem precisar do mouse.',
  },
  {
    icon: WifiHigh,
    title: 'Só sua rede',
    body: 'A comunicação vai direto do celular ao computador. Nenhum intermediário.',
  },
  {
    icon: LockKey,
    title: 'Sem conta, sem nuvem',
    body: 'Nada que você faz passa por servidor nosso. Nem precisamos saber que você existe.',
  },
];

export function Features() {
  return (
    <section id="features" className="border-b border-border">
      <div className="mx-auto flex max-w-container flex-col gap-3 px-2 py-4 sm:px-3 sm:py-5">
        <div className="flex flex-col gap-1">
          <p className="text-sm uppercase tracking-[0.14em] text-muted">O que faz</p>
          <h2 className="max-w-prose text-3xl font-semibold tracking-tight sm:text-4xl">
            Só o que você usa numa live.
          </h2>
        </div>

        <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex flex-col gap-1 rounded border border-border bg-bg-elev p-3 transition-colors hover:border-muted"
            >
              <Icon size={22} weight="regular" className="text-primary" />
              <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
              <p className="text-sm text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
