const BRIDGE_KEY = 'pocket-deck:bridge';

function getBridgeUrl() {
  try {
    const saved = localStorage.getItem(BRIDGE_KEY);
    if (saved) return saved;
  } catch {}
  return window.location.origin;
}

function setBridgeUrl(url) {
  try {
    const u = new URL(url);
    localStorage.setItem(BRIDGE_KEY, u.origin);
    return u.origin;
  } catch {
    return null;
  }
}

let bridgeUrl = getBridgeUrl();

const api = {
  async get(path) {
    const r = await fetch(bridgeUrl + path, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(bridgeUrl + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  },
};

const state = {
  tab: 'cenas',
  current: null,
  scenes: [],
  audio: [],
  streaming: false,
  recording: false,
  deck: [],
  editing: false,
};

/* ---------- deck config em localStorage ---------- */

const DECK_KEY = 'pocket-deck:config';

function uid() { return Math.random().toString(36).slice(2, 10); }

function loadDeck() {
  try {
    const raw = localStorage.getItem(DECK_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Array.isArray(data?.buttons)) return data.buttons;
  } catch {}
  return null;
}

function saveDeck() {
  try {
    localStorage.setItem(DECK_KEY, JSON.stringify({ version: 1, buttons: state.deck }));
  } catch {}
}

function defaultDeck(scenes, audioInputs) {
  const out = [];
  for (const name of scenes) {
    out.push({ id: uid(), type: 'scene', label: name, payload: { name } });
  }
  out.push({ id: uid(), type: 'pc-media', label: 'Play/Pause', payload: { action: 'play' } });
  out.push({ id: uid(), type: 'pc-media', label: 'Próxima', payload: { action: 'next' } });
  out.push({ id: uid(), type: 'record', label: 'Gravar', payload: {} });
  out.push({ id: uid(), type: 'stream', label: 'Transmitir', payload: {} });
  const mic = audioInputs.find((i) => i.kind.includes('input_capture'));
  if (mic) out.push({ id: uid(), type: 'mute', label: mic.name, payload: { input: mic.name } });
  return out;
}

const el = {
  connectScreen: document.getElementById('connect-screen'),
  tabs: document.querySelectorAll('[data-tab]'),
  tabButtons: document.querySelectorAll('[data-tab-btn]'),
  tagStream: document.getElementById('tag-stream'),
  tagRecord: document.getElementById('tag-record'),
  deck: document.getElementById('deck-grid'),
  mixer: document.getElementById('mixer-list'),
  toast: document.getElementById('toast'),
  editToggle: document.getElementById('edit-toggle'),
  modal: document.getElementById('deck-modal'),
  modalClose: document.getElementById('deck-modal-close'),
  modalBack: document.getElementById('deck-modal-back'),
  modalTitle: document.getElementById('deck-modal-title'),
  fieldLabel: document.getElementById('deck-field-label'),
  previewKind: document.getElementById('deck-preview-kind'),
  previewTarget: document.getElementById('deck-preview-target'),
  targets: document.getElementById('deck-targets'),
  saveBtn: document.getElementById('deck-save'),
};

/* ---------- toast ---------- */

let toastTimer;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.toast.hidden = true), 2000);
}

/* ---------- modal de confirmação ---------- */

function confirmAction({ title, body, confirm = 'Confirmar', cancel = 'Cancelar', kind = 'danger', icon = '' }) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-title');
  const bodyEl = document.getElementById('confirm-body');
  const iconEl = document.getElementById('confirm-icon');
  const yes = document.getElementById('confirm-yes');
  const no = document.getElementById('confirm-no');

  titleEl.textContent = title;
  bodyEl.textContent = body || '';
  yes.textContent = confirm;
  no.textContent = cancel;
  iconEl.innerHTML = icon;
  iconEl.classList.toggle('ok', kind === 'ok');
  yes.classList.toggle('ok', kind === 'ok');
  modal.hidden = false;

  return new Promise((resolve) => {
    const cleanup = (val) => {
      modal.hidden = true;
      yes.removeEventListener('click', onYes);
      no.removeEventListener('click', onNo);
      modal.removeEventListener('click', onBackdrop);
      resolve(val);
    };
    const onYes = () => cleanup(true);
    const onNo = () => cleanup(false);
    const onBackdrop = (e) => { if (e.target === modal) cleanup(false); };
    yes.addEventListener('click', onYes);
    no.addEventListener('click', onNo);
    modal.addEventListener('click', onBackdrop);
  });
}

/* ---------- status ---------- */

function setConnectState(state) {
  const screen = el.connectScreen;
  const obs = document.getElementById('connect-obs');
  const pair = document.getElementById('connect-pair');
  if (state === 'ok') {
    screen.hidden = true;
    obs.hidden = true;
    pair.hidden = true;
    return;
  }
  screen.hidden = false;
  obs.hidden = state !== 'obs';
  pair.hidden = state !== 'pair';
}

function setConnected(connected) {
  setConnectState(connected ? 'ok' : 'obs');
}

function setNowScene(_name) { /* no-op: card de "Agora" removido */ }

/* ---------- tabs ---------- */

function switchTab(name) {
  state.tab = name;
  for (const section of el.tabs) {
    section.hidden = section.dataset.tab !== name;
  }
  if (name === 'mixer') loadAudio();
}

const mixerToggleBtn = document.getElementById('mixer-toggle');
mixerToggleBtn?.addEventListener('click', () => {
  const next = state.tab === 'mixer' ? 'cenas' : 'mixer';
  switchTab(next);
  mixerToggleBtn.setAttribute('aria-pressed', next === 'mixer' ? 'true' : 'false');
});



/* ---------- scenes ---------- */

/* ---------- deck render ---------- */

const KIND_META = {
  scene: { label: 'Cena', color: 'primary' },
  'pc-media': { label: 'Mídia PC', color: 'primary' },
  mute: { label: 'Mutar', color: 'danger' },
  source: { label: 'Fonte', color: 'primary' },
  stream: { label: 'Transmitir', color: 'danger' },
  record: { label: 'Gravar', color: 'warn' },
};

const ICONS = {
  scene: '<svg viewBox="0 0 256 256" class="icon"><path d="M104 40H56a16 16 0 0 0-16 16v48a16 16 0 0 0 16 16h48a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16Zm96 0h-48a16 16 0 0 0-16 16v48a16 16 0 0 0 16 16h48a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16Zm-96 96H56a16 16 0 0 0-16 16v48a16 16 0 0 0 16 16h48a16 16 0 0 0 16-16v-48a16 16 0 0 0-16-16Zm96 0h-48a16 16 0 0 0-16 16v48a16 16 0 0 0 16 16h48a16 16 0 0 0 16-16v-48a16 16 0 0 0-16-16Z"/></svg>',
  play: '<svg viewBox="0 0 256 256" class="icon"><path d="M232.4 114.49 88.32 26.35A16 16 0 0 0 64 39.87v176.26A16 16 0 0 0 88.36 229.65l144.08-88.14a15.81 15.81 0 0 0 0-27Z"/></svg>',
  pause: '<svg viewBox="0 0 256 256" class="icon"><path d="M200 32h-36a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h36a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16Zm-108 0H56a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h36a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16Z"/></svg>',
  next: '<svg viewBox="0 0 256 256" class="icon"><path d="M208 48v160a8 8 0 0 1-16 0v-61.23L72.43 221.55A16 16 0 0 1 48 208.12V47.88a16 16 0 0 1 24.43-13.43L192 109.23V48a8 8 0 0 1 16 0Z"/></svg>',
  previous: '<svg viewBox="0 0 256 256" class="icon"><path d="M208 47.88v160.24a16 16 0 0 1-24.43 13.43L64 146.77V208a8 8 0 0 1-16 0V48a8 8 0 0 1 16 0v61.23L183.57 34.45A16 16 0 0 1 208 47.88Z"/></svg>',
  stop: '<svg viewBox="0 0 256 256" class="icon"><path d="M208 32H48a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16Z"/></svg>',
  volup: '<svg viewBox="0 0 256 256" class="icon"><path d="M155.51 24.81a8 8 0 0 0-8.42.88L77.25 80H32a16 16 0 0 0-16 16v64a16 16 0 0 0 16 16h45.25l69.84 54.31a8 8 0 0 0 8.42.88 8 8 0 0 0 4.49-7.19V32a8 8 0 0 0-4.49-7.19ZM240 128a8 8 0 0 1-8 8h-24v24a8 8 0 0 1-16 0v-24h-24a8 8 0 0 1 0-16h24V88a8 8 0 0 1 16 0v24h24a8 8 0 0 1 8 8Z"/></svg>',
  voldown: '<svg viewBox="0 0 256 256" class="icon"><path d="M155.51 24.81a8 8 0 0 0-8.42.88L77.25 80H32a16 16 0 0 0-16 16v64a16 16 0 0 0 16 16h45.25l69.84 54.31a8 8 0 0 0 8.42.88 8 8 0 0 0 4.49-7.19V32a8 8 0 0 0-4.49-7.19ZM240 128a8 8 0 0 1-8 8h-32a8 8 0 0 1 0-16h32a8 8 0 0 1 8 8Z"/></svg>',
  mute_pc: '<svg viewBox="0 0 256 256" class="icon"><path d="M53.92 34.62a8 8 0 1 0-11.84 10.76L74.09 80.6l-6.9 5.37L32 80.17V96l1.63 80.14 68.42 36.74A8 8 0 0 0 112 208V134.65l90.08 99.09a8 8 0 1 0 11.84-10.76Z"/></svg>',
  mic: '<svg viewBox="0 0 256 256" class="icon"><path d="M128 176a48.05 48.05 0 0 0 48-48V64a48 48 0 0 0-96 0v64a48.05 48.05 0 0 0 48 48Zm-16-112a16 16 0 0 1 32 0v64a16 16 0 0 1-32 0Zm112 72a8 8 0 0 0-8 8 88 88 0 0 1-176 0 8 8 0 0 0-16 0 104.17 104.17 0 0 0 96 103.73V232a8 8 0 0 0 16 0v-24.27A104.17 104.17 0 0 0 232 136a8 8 0 0 0-8-8Z"/></svg>',
  mic_slash: '<svg viewBox="0 0 256 256" class="icon"><path d="M83.95 56.47 76 48.52a8 8 0 0 0-11.32 11.31l16.75 16.75A47.87 47.87 0 0 0 80 96v32a48 48 0 0 0 48 48 47.4 47.4 0 0 0 20.6-4.68L166.69 189.4a71.65 71.65 0 0 1-38.69 10.6 72.08 72.08 0 0 1-72-72 8 8 0 0 0-16 0 88.11 88.11 0 0 0 80 87.63V232a8 8 0 0 0 16 0v-16.35a87.8 87.8 0 0 0 42.7-14.75l25.63 25.63a8 8 0 1 0 11.32-11.31ZM96 128V96a32.06 32.06 0 0 1 .61-6.21l62.6 62.6A32 32 0 0 1 96 128Zm32-80a16 16 0 0 0-16 16v9.37a8 8 0 0 1-16 0V64a32 32 0 0 1 61.46-12.47 8 8 0 0 1-14.76 6.21A16 16 0 0 0 128 48Zm32 80V96a8 8 0 0 1 16 0v32a7.6 7.6 0 0 1-.17 1.63 8 8 0 0 1-15.66-3.26A1.68 1.68 0 0 0 160 128ZM232 128a104.17 104.17 0 0 1-20.57 62.08 8 8 0 1 1-12.84-9.56A88.11 88.11 0 0 0 216 128a8 8 0 0 1 16 0Z"/></svg>',
  broadcast: '<svg viewBox="0 0 256 256" class="icon"><path d="M181 54.1A96 96 0 0 1 128 232a95.6 95.6 0 0 1-85.2-52.2 8 8 0 0 1 14.2-7.3A79.9 79.9 0 0 0 128 216a80 80 0 0 0 44.3-146.6 8 8 0 0 1 8.7-13.3Zm-77.7 24.6a8 8 0 0 0-11.3 0 72 72 0 0 0 0 101.8 8 8 0 0 0 11.3-11.3 56 56 0 0 1 0-79.2 8 8 0 0 0 0-11.3ZM128 112a16 16 0 1 0 16 16 16 16 0 0 0-16-16Z"/></svg>',
  live_dot: '<svg viewBox="0 0 24 24" class="icon"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>',
  record: '<svg viewBox="0 0 256 256" class="icon"><circle cx="128" cy="128" r="80" fill="none" stroke="currentColor" stroke-width="18"/></svg>',
  record_active: '<svg viewBox="0 0 256 256" class="icon"><circle cx="128" cy="128" r="80" fill="currentColor"/></svg>',
  eye: '<svg viewBox="0 0 256 256" class="icon"><path d="M247.31 124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57 61.26 162.88 48 128 48S61.43 61.26 36.34 86.35C17.51 105.18 9 124 8.69 124.76a8 8 0 0 0 0 6.5c.35.79 8.82 19.57 27.65 38.4C61.43 194.74 93.12 208 128 208s66.57-13.26 91.66-38.34c18.83-18.83 27.3-37.61 27.65-38.4a8 8 0 0 0 0-6.5ZM128 192c-30.78 0-57.67-11.19-79.93-33.25A133.47 133.47 0 0 1 25 128a133.33 133.33 0 0 1 23.07-30.75C70.33 75.19 97.22 64 128 64s57.67 11.19 79.93 33.25A133.46 133.46 0 0 1 231.05 128c-7.21 13.46-38.62 64-103.05 64Zm0-112a48 48 0 1 0 48 48 48.05 48.05 0 0 0-48-48Zm0 80a32 32 0 1 1 32-32 32 32 0 0 1-32 32Z"/></svg>',
  eye_slash: '<svg viewBox="0 0 256 256" class="icon"><path d="M53.92 34.62a8 8 0 1 0-11.84 10.76l19.95 21.95C25.09 92.98 9.08 125.3 8.69 126.74a8 8 0 0 0 0 6.5c.35.79 8.82 19.57 27.65 38.4C61.43 196.74 93.12 210 128 210a123.1 123.1 0 0 0 49.37-10.07l24.71 27.19a8 8 0 1 0 11.84-10.76ZM128 176a48.05 48.05 0 0 1-48-48 47.4 47.4 0 0 1 4.68-20.6l19.6 21.56a24 24 0 0 0 29.73 32.69l19.6 21.56A47.4 47.4 0 0 1 128 176Zm108.07-9.56a139.8 139.8 0 0 1-16.42 20.49 8 8 0 0 1-11.78-10.84 123.09 123.09 0 0 0 23.17-37.09 123.3 123.3 0 0 0-30.3-41A101.4 101.4 0 0 0 128 80c-7.09 0-14.03.7-20.78 2.08a8 8 0 1 1-3.21-15.68A120.14 120.14 0 0 1 128 64c34.88 0 66.57 13.26 91.66 38.35A133.47 133.47 0 0 1 247.31 131.25a8 8 0 0 1-11.24 35.19Z"/></svg>',
};

function iconForButton(btn) {
  if (btn.type === 'scene') return ICONS.scene;
  if (btn.type === 'pc-media') {
    if (btn.payload.action === 'play') return pcPlaying ? ICONS.pause : ICONS.play;
    return ICONS[btn.payload.action] ?? ICONS.play;
  }
  if (btn.type === 'mute') {
    const entry = state.audio.find((i) => i.name === btn.payload.input);
    return entry?.muted ? ICONS.mic_slash : ICONS.mic;
  }
  if (btn.type === 'source') {
    const visible = isSourceVisible(btn.payload.scene, btn.payload.source);
    return visible ? ICONS.eye : ICONS.eye_slash;
  }
  if (btn.type === 'stream') return state.streaming ? ICONS.live_dot : ICONS.broadcast;
  if (btn.type === 'record') return state.recording ? ICONS.record_active : ICONS.record;
  return '';
}

function isSourceVisible(scene, source) {
  const items = state.sceneItems?.[scene] ?? [];
  const item = items.find((i) => i.name === source);
  return !!item?.enabled;
}

const PC_MEDIA_LABELS = {
  play: 'Play/Pause',
  next: 'Próxima',
  previous: 'Anterior',
  stop: 'Parar',
  mute: 'Mutar PC',
  volup: 'Volume +',
  voldown: 'Volume −',
};

function isButtonActive(btn) {
  if (btn.type === 'scene') return btn.payload.name === state.current;
  if (btn.type === 'stream') return state.streaming;
  if (btn.type === 'record') return state.recording;
  if (btn.type === 'mute') {
    const entry = state.audio.find((i) => i.name === btn.payload.input);
    return !!entry?.muted;
  }
  if (btn.type === 'source') return isSourceVisible(btn.payload.scene, btn.payload.source);
  if (btn.type === 'pc-media' && btn.payload.action === 'play') return pcPlaying;
  return false;
}

function renderDeck() {
  if (!state.deck.length) {
    el.deck.innerHTML = '<div class="empty">Toque no lápis no header para começar.</div>';
    if (state.editing) {
      el.deck.innerHTML += '';
      const add = document.createElement('button');
      add.className = 'deck-add';
      add.id = 'deck-add';
      add.innerHTML = '<svg viewBox="0 0 256 256" class="icon" aria-hidden="true"><path d="M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8Z"/></svg><span>Adicionar botão</span>';
      add.addEventListener('click', openAddModal);
      el.deck.appendChild(add);
    }
    return;
  }
  el.deck.innerHTML = '';
  for (const btn of state.deck) {
    const el2 = document.createElement('button');
    el2.className = 'deck-btn';
    el2.type = 'button';
    el2.dataset.id = btn.id;
    el2.dataset.kind = btn.type;
    if (btn.type === 'pc-media') el2.dataset.action = btn.payload.action;
    if (isButtonActive(btn)) el2.dataset.active = 'true';

    if (btn.type === 'pc-media') {
      // card de mídia: ícone grande, sem texto
      el2.classList.add('icon-only');
      el2.innerHTML = `
        <div class="deck-btn-big-icon">${iconForButton(btn)}</div>
        <button class="deck-btn-del" type="button" aria-label="Remover">
          <svg viewBox="0 0 256 256" class="icon"><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg>
        </button>
      `;
    } else {
      let kindLabel = KIND_META[btn.type]?.label ?? btn.type;
      if (btn.type === 'stream' && state.streaming) kindLabel = 'AO VIVO';
      else if (btn.type === 'record' && state.recording) kindLabel = 'GRAVANDO';
      el2.innerHTML = `
        <div class="deck-btn-head">
          <span class="deck-btn-icon">${iconForButton(btn)}</span>
          <span></span>
        </div>
        <div class="deck-btn-label"></div>
        <button class="deck-btn-del" type="button" aria-label="Remover">
          <svg viewBox="0 0 256 256" class="icon"><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z"/></svg>
        </button>
      `;
      el2.querySelector('.deck-btn-head > span:last-child').textContent = kindLabel;
      el2.querySelector('.deck-btn-label').textContent = btn.label;
    }

    el2.querySelector('.deck-btn-del').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      deleteButton(btn.id);
    });
    el2.addEventListener('pointerdown', onDragStart);
    el.deck.appendChild(el2);
  }
  if (state.editing) {
    const add = document.createElement('button');
    add.className = 'deck-add';
    add.id = 'deck-add';
    add.type = 'button';
    add.innerHTML = '<svg viewBox="0 0 256 256" class="icon" aria-hidden="true"><path d="M224 128a8 8 0 0 1-8 8h-80v80a8 8 0 0 1-16 0v-80H40a8 8 0 0 1 0-16h80V40a8 8 0 0 1 16 0v80h80a8 8 0 0 1 8 8Z"/></svg><span>Adicionar botão</span>';
    add.addEventListener('click', openAddModal);
    el.deck.appendChild(add);
  }
}

async function runButton(btn) {
  try {
    if (btn.type === 'scene') return runScene(btn.payload.name);
    if (btn.type === 'pc-media') {
      await api.post('/api/pc-media', { action: btn.payload.action });
      if (btn.payload.action === 'play') {
        setPcPlaying(!pcPlaying);
        if (smtcSupported) setTimeout(pollPcMedia, 400);
      }
      return;
    }
    if (btn.type === 'mute') {
      const r = await api.post('/api/mute', { input: btn.payload.input });
      applyMute(btn.payload.input, r.muted);
      renderDeck();
      return;
    }
    if (btn.type === 'stream') {
      const starting = !state.streaming;
      const ok = await confirmAction({
        title: starting ? 'Iniciar transmissão?' : 'Encerrar transmissão?',
        body: starting
          ? 'O OBS vai começar a transmitir ao vivo. Confirma?'
          : 'A transmissão vai sair do ar imediatamente. Confirma?',
        confirm: starting ? 'Transmitir' : 'Encerrar',
        kind: 'danger',
        icon: ICONS.broadcast,
      });
      if (!ok) return;
      const path = starting ? '/api/stream/start' : '/api/stream/stop';
      await api.post(path);
      state.streaming = starting;
      el.tagStream.dataset.on = starting ? 'true' : 'false';
      renderDeck();
      return;
    }
    if (btn.type === 'record') {
      const starting = !state.recording;
      const ok = await confirmAction({
        title: starting ? 'Iniciar gravação?' : 'Encerrar gravação?',
        body: starting
          ? 'O OBS vai começar a gravar localmente. Confirma?'
          : 'A gravação vai ser finalizada. Confirma?',
        confirm: starting ? 'Gravar' : 'Encerrar',
        kind: 'danger',
        icon: ICONS.record_active,
      });
      if (!ok) return;
      await api.post('/api/record/toggle');
      state.recording = starting;
      el.tagRecord.dataset.on = starting ? 'true' : 'false';
      renderDeck();
      return;
    }
    if (btn.type === 'source') {
      const r = await api.post('/api/source-toggle', { scene: btn.payload.scene, source: btn.payload.source });
      applySourceVisibility(btn.payload.scene, btn.payload.source, r.enabled);
      renderDeck();
      return;
    }
  } catch {
    toast('Falhou ao executar');
  }
}

async function runScene(name) {
  const prev = state.current;
  state.current = name;
  renderDeck();
  try {
    await api.post('/api/scene', { name });
  } catch {
    state.current = prev;
    renderDeck();
    toast('Falhou ao trocar cena');
  }
}

function renderScenes() { renderDeck(); }
function changeScene(name) { return runScene(name); }

/* ---------- edit mode ---------- */

function setEditing(on) {
  state.editing = on;
  el.deck.classList.toggle('editing', on);
  el.editToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
  renderDeck();
}

el.editToggle.addEventListener('click', () => setEditing(!state.editing));

function deleteButton(id) {
  state.deck = state.deck.filter((b) => b.id !== id);
  saveDeck();
  renderDeck();
}

/* ---------- drag & drop (lift + placeholder) ---------- */

let dragState = null;
const LONG_PRESS_MS = 280;

function onDragStart(e) {
  if (e.target.closest('.deck-btn-del')) return;
  if (e.button != null && e.button !== 0) return;
  const el2 = e.currentTarget;
  const id = el2.dataset.id;
  if (!id) return;

  dragState = {
    id,
    el: el2,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    lifted: false,
    btn: state.deck.find((b) => b.id === id),
  };
  dragState.readyTimer = setTimeout(() => liftCard(), LONG_PRESS_MS);

  window.addEventListener('pointermove', onDragMove, { passive: false });
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', onDragEnd);
}

function liftCard() {
  if (!dragState || dragState.lifted) return;
  const el2 = dragState.el;
  const rect = el2.getBoundingClientRect();

  // placeholder ocupa o lugar do card no flex-wrap
  const placeholder = document.createElement('div');
  placeholder.className = 'deck-placeholder';
  placeholder.style.width = rect.width + 'px';
  placeholder.style.height = rect.height + 'px';
  placeholder.style.flex = `1 1 ${rect.width}px`;
  placeholder.style.minWidth = '110px';
  placeholder.style.maxWidth = '180px';
  el.deck.insertBefore(placeholder, el2.nextSibling);

  // "levanta" o card em position: fixed grudado no dedo
  el2.style.position = 'fixed';
  el2.style.left = rect.left + 'px';
  el2.style.top = rect.top + 'px';
  el2.style.width = rect.width + 'px';
  el2.style.height = rect.height + 'px';
  el2.style.margin = '0';
  el2.style.zIndex = '1000';
  el2.style.pointerEvents = 'none';
  el2.style.animation = 'none';
  el2.style.transition = 'transform 160ms var(--ease), box-shadow 160ms var(--ease)';
  el2.style.transform = 'scale(1.05)';
  el2.classList.add('dragging');

  dragState.placeholder = placeholder;
  dragState.offsetX = dragState.startX - rect.left;
  dragState.offsetY = dragState.startY - rect.top;
  dragState.lifted = true;

  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';
  try { navigator.vibrate?.(10); } catch {}
}

function onDragMove(e) {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  const dist = Math.hypot(dx, dy);

  if (!dragState.lifted) {
    if (dist > 10) {
      clearTimeout(dragState.readyTimer);
      cleanupDrag();
    }
    return;
  }
  if (e.cancelable) e.preventDefault();

  // card segue o dedo exato
  const x = e.clientX - dragState.offsetX;
  const y = e.clientY - dragState.offsetY;
  dragState.el.style.left = x + 'px';
  dragState.el.style.top = y + 'px';

  // acha o card mais próximo do cursor
  const cards = Array.from(el.deck.querySelectorAll('.deck-btn:not(.dragging)'));
  if (!cards.length) return;
  let closest = null;
  let minDist = Infinity;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = Math.hypot(e.clientX - cx, e.clientY - cy);
    if (d < minDist) { minDist = d; closest = c; }
  }
  if (!closest) return;

  const r = closest.getBoundingClientRect();
  const sameRow = e.clientY >= r.top && e.clientY <= r.bottom;
  const after = sameRow ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;

  // reposiciona placeholder com animação FLIP nos vizinhos
  const target = after ? closest.nextSibling : closest;
  if (dragState.placeholder !== target && dragState.placeholder.nextSibling !== target) {
    animateFlip(() => {
      el.deck.insertBefore(dragState.placeholder, after ? closest.nextSibling : closest);
    });
  }
}

function animateFlip(mutate) {
  const siblings = Array.from(el.deck.querySelectorAll('.deck-btn:not(.dragging)'));
  const first = new Map();
  for (const b of siblings) first.set(b, b.getBoundingClientRect());
  mutate();
  for (const b of siblings) {
    const f = first.get(b);
    const l = b.getBoundingClientRect();
    const ddx = f.left - l.left;
    const ddy = f.top - l.top;
    if (Math.abs(ddx) < 0.5 && Math.abs(ddy) < 0.5) continue;
    b.style.transition = 'none';
    b.style.transform = `translate(${ddx}px, ${ddy}px)`;
    b.offsetHeight;
    b.style.transition = 'transform 200ms cubic-bezier(.2,.7,.2,1)';
    b.style.transform = '';
  }
}

function onDragEnd(e) {
  if (!dragState) return;
  if (e && e.pointerId !== dragState.pointerId) return;
  clearTimeout(dragState.readyTimer);
  const was = { lifted: dragState.lifted, btn: dragState.btn };

  if (was.lifted) {
    const el2 = dragState.el;
    const placeholder = dragState.placeholder;

    // card "pousa" na posição do placeholder — anima de fixed → fluxo
    const targetRect = placeholder.getBoundingClientRect();
    el2.style.transition = 'left 180ms var(--ease), top 180ms var(--ease), transform 180ms var(--ease)';
    el2.style.left = targetRect.left + 'px';
    el2.style.top = targetRect.top + 'px';
    el2.style.transform = 'scale(1)';

    setTimeout(() => {
      // insere o card de volta no fluxo no lugar do placeholder
      if (placeholder.parentNode) placeholder.parentNode.insertBefore(el2, placeholder);
      placeholder.remove();
      // limpa estilos
      el2.style.cssText = '';
      el2.classList.remove('dragging');

      // reordena state.deck conforme a nova ordem do DOM
      const order = Array.from(el.deck.querySelectorAll('.deck-btn')).map((b) => b.dataset.id);
      state.deck.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      saveDeck();
    }, 180);

    cleanupDragListeners();
  } else {
    cleanupDrag();
    if (was.btn && !state.editing) runButton(was.btn);
  }
}

function cleanupDragListeners() {
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', onDragEnd);
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
  dragState = null;
}

function cleanupDrag() {
  if (!dragState) return;
  const el2 = dragState.el;
  if (dragState.placeholder) dragState.placeholder.remove();
  el2.classList.remove('dragging');
  el2.style.cssText = '';
  cleanupDragListeners();
}

/* ---------- modal wizard (adicionar botão) ---------- */

const draft = { type: null, target: null, label: '' };

const STEP_TITLE = {
  type: 'Tipo de botão',
  target: 'Escolha o alvo',
  label: 'Rótulo e confirmar',
};

function getSteps(type) {
  if (type === 'stream' || type === 'record') return ['type', 'label'];
  if (type === 'source') return ['type', 'target', 'label'];
  return ['type', 'target', 'label'];
}

function showStep(step) {
  for (const s of document.querySelectorAll('.deck-step')) {
    s.hidden = s.dataset.step !== step;
  }
  el.modalTitle.textContent = STEP_TITLE[step] ?? '';
  const steps = draft.type ? getSteps(draft.type) : ['type'];
  el.modalBack.hidden = step === 'type';
  if (step === 'label') prepareLabelStep();
}

function openAddModal() {
  draft.type = null;
  draft.target = null;
  draft.label = '';
  el.modal.hidden = false;
  showStep('type');
}

function closeModal() {
  el.modal.hidden = true;
  draft.type = null;
  draft.target = null;
  draft.label = '';
}

el.modalClose.addEventListener('click', closeModal);
el.modal.addEventListener('click', (e) => {
  if (e.target === el.modal) closeModal();
});

el.modalBack.addEventListener('click', () => {
  const steps = draft.type ? getSteps(draft.type) : ['type'];
  const current = document.querySelector('.deck-step:not([hidden])')?.dataset.step;
  const idx = steps.indexOf(current);
  if (idx > 0) {
    if (steps[idx - 1] === 'type') draft.type = null;
    showStep(steps[idx - 1]);
  }
});

/* passo 1 → clica tipo */
for (const typeBtn of document.querySelectorAll('[data-type]')) {
  typeBtn.addEventListener('click', () => {
    draft.type = typeBtn.dataset.type;
    const steps = getSteps(draft.type);
    if (steps[1] === 'target') {
      renderTargets(draft.type);
      showStep('target');
    } else {
      draft.target = null;
      showStep('label');
    }
  });
}

/* passo 2 → lista alvos */
function renderTargets(type) {
  el.targets.innerHTML = '';
  const chevron = '<svg viewBox="0 0 256 256" class="icon deck-target-chevron" aria-hidden="true"><path d="M181.66 133.66l-80 80a8 8 0 0 1-11.32-11.32L164.69 128 90.34 53.66a8 8 0 0 1 11.32-11.32l80 80a8 8 0 0 1 0 11.32Z"/></svg>';

  const addTarget = (value, display) => {
    const b = document.createElement('button');
    b.className = 'deck-target';
    b.type = 'button';
    b.dataset.value = value;
    b.innerHTML = `<span></span>${chevron}`;
    b.querySelector('span').textContent = display;
    b.addEventListener('click', () => {
      draft.target = value;
      draft.label = display;
      showStep('label');
    });
    el.targets.appendChild(b);
  };

  if (type === 'scene') {
    if (!state.scenes.length) {
      el.targets.innerHTML = '<div class="empty">Nenhuma cena. Crie uma no OBS.</div>';
      return;
    }
    for (const name of state.scenes) addTarget(name, name);
  } else if (type === 'pc-media') {
    for (const [key, label] of Object.entries(PC_MEDIA_LABELS)) addTarget(key, label);
  } else if (type === 'mute') {
    if (!state.audio.length) {
      el.targets.innerHTML = '<div class="empty">Nenhuma entrada de áudio.</div>';
      return;
    }
    for (const input of state.audio) addTarget(input.name, input.name);
  } else if (type === 'source') {
    const items = state.sceneItems ?? {};
    const flat = [];
    for (const scene of Object.keys(items)) {
      for (const item of items[scene]) flat.push({ scene, source: item.name });
    }
    if (!flat.length) {
      el.targets.innerHTML = '<div class="empty">Nenhuma fonte nas cenas.</div>';
      return;
    }
    for (const { scene, source } of flat) {
      const b = document.createElement('button');
      b.className = 'deck-target';
      b.type = 'button';
      b.innerHTML = `<span><span class="target-sub">${scene} · </span>${source}</span><svg viewBox="0 0 256 256" class="icon deck-target-chevron"><path d="M181.66 133.66l-80 80a8 8 0 0 1-11.32-11.32L164.69 128 90.34 53.66a8 8 0 0 1 11.32-11.32l80 80a8 8 0 0 1 0 11.32Z"/></svg>`;
      b.addEventListener('click', () => {
        draft.target = { scene, source };
        draft.label = source;
        showStep('label');
      });
      el.targets.appendChild(b);
    }
  }
}

/* passo 3 → preview + rótulo + salvar */
function prepareLabelStep() {
  const kindLabel = KIND_META[draft.type]?.label ?? draft.type ?? '';
  el.previewKind.textContent = kindLabel;
  el.previewTarget.textContent = draft.target ? draft.label : kindLabel;
  el.fieldLabel.value = draft.label || kindLabel;
  setTimeout(() => el.fieldLabel.focus(), 0);
}

el.saveBtn.addEventListener('click', () => {
  if (!draft.type) return;
  const label = el.fieldLabel.value.trim() || 'botão';
  let payload = {};
  if (draft.type === 'scene') payload = { name: draft.target };
  else if (draft.type === 'pc-media') payload = { action: draft.target };
  else if (draft.type === 'mute') payload = { input: draft.target };
  else if (draft.type === 'source') payload = { scene: draft.target.scene, source: draft.target.source };
  state.deck.push({ id: uid(), type: draft.type, label, payload });
  saveDeck();
  renderDeck();
  closeModal();
});

async function loadScenes() {
  try {
    const data = await api.get('/api/scenes');
    state.current = data.current;
    state.scenes = data.scenes;
    renderScenes();
    setNowScene(state.current);
    setConnected(true);
    return true;
  } catch {
    setConnected(false);
    el.deck.innerHTML = '<div class="empty">Abra o OBS e ative o WebSocket Server.</div>';
    setNowScene(null);
    return false;
  }
}

/* ---------- media (atalhos tab) ---------- */

async function loadMediaSources() { /* não é mais necessário — PC media não precisa de source */ }

let pcPlaying = false;
let smtcSupported = true;

function setPcPlaying(playing) {
  const changed = pcPlaying !== playing;
  pcPlaying = playing;
  if (changed && state.deck?.length) renderDeck();
}

async function pollPcMedia() {
  if (!smtcSupported) return;
  try {
    const s = await api.get('/api/pc-media/status');
    if (s.supported === false) {
      smtcSupported = false;
      return;
    }
    if (s.status && s.status !== 'Error' && s.status !== 'ParseError' && s.status !== 'NoSession') {
      setPcPlaying(!!s.playing);
    } else if (s.status === 'Error' || s.status === 'ParseError') {
      smtcSupported = false;
    }
  } catch {}
}

for (const btn of document.querySelectorAll('[data-pc-media]')) {
  btn.addEventListener('click', async () => {
    try {
      await api.post('/api/pc-media', { action: btn.dataset.pcMedia });
      if (btn.dataset.pcMedia === 'play') {
        // flip imediato pro feedback — se SMTC estiver vivo, corrige no próximo poll
        setPcPlaying(!pcPlaying);
      }
      if (smtcSupported) setTimeout(pollPcMedia, 400);
    } catch {
      toast('Falhou ao enviar comando');
    }
  });
}

setInterval(pollPcMedia, 2500);
pollPcMedia();

/* broadcast toggles agora são botões do deck customizável */

/* ---------- mixer ---------- */

const MIC_SVG = '<svg viewBox="0 0 256 256" class="icon" aria-hidden="true"><path d="M128 176a48.05 48.05 0 0 0 48-48V64a48 48 0 0 0-96 0v64a48.05 48.05 0 0 0 48 48Zm0-128a16 16 0 0 1 16 16v64a16 16 0 0 1-32 0V64a16 16 0 0 1 16-16Zm96 80a8 8 0 0 0-8 8 88 88 0 0 1-176 0 8 8 0 0 0-16 0 104.17 104.17 0 0 0 96 103.73V232a8 8 0 0 0 16 0v-24.27A104.17 104.17 0 0 0 232 136a8 8 0 0 0-8-8Z"/></svg>';
const MIC_SLASH_SVG = '<svg viewBox="0 0 256 256" class="icon" aria-hidden="true"><path d="M83.95 56.47 76 48.52a8 8 0 0 0-11.32 11.31l16.75 16.75A47.87 47.87 0 0 0 80 96v32a48 48 0 0 0 48 48 47.4 47.4 0 0 0 20.6-4.68L166.69 189.4a71.65 71.65 0 0 1-38.69 10.6 72.08 72.08 0 0 1-72-72 8 8 0 0 0-16 0 88.11 88.11 0 0 0 80 87.63V232a8 8 0 0 0 16 0v-16.35a87.8 87.8 0 0 0 42.7-14.75l25.63 25.63a8 8 0 1 0 11.32-11.31ZM96 128V96a32.06 32.06 0 0 1 .61-6.21l62.6 62.6A32 32 0 0 1 96 128Zm32-80a16 16 0 0 0-16 16v9.37a8 8 0 0 1-16 0V64a32 32 0 0 1 61.46-12.47 8 8 0 0 1-14.76 6.21A16 16 0 0 0 128 48Zm32 80V96a8 8 0 0 1 16 0v32a7.6 7.6 0 0 1-.17 1.63 8 8 0 0 1-15.66-3.26A1.68 1.68 0 0 0 160 128ZM232 128a104.17 104.17 0 0 1-20.57 62.08 8 8 0 1 1-12.84-9.56A88.11 88.11 0 0 0 216 128a8 8 0 0 1 16 0Z"/></svg>';

function cssSel(name) {
  if (window.CSS && CSS.escape) return CSS.escape(name);
  return name.replace(/"/g, '\\"');
}

function fmtDb(db) {
  if (db == null || !isFinite(db)) return '—';
  if (db <= -60) return '-∞ dB';
  if (db >= 0) return '0.0 dB';
  return `${db.toFixed(1)} dB`;
}

function dbToPct(db) {
  if (db == null || db <= -60) return 0;
  if (db >= 0) return 100;
  return ((db + 60) / 60) * 100;
}

function renderMixer() {
  if (!state.audio.length) {
    el.mixer.innerHTML = '<div class="empty">Nenhuma entrada de áudio no OBS.</div>';
    return;
  }
  el.mixer.innerHTML = '';
  for (const input of state.audio) {
    const ch = document.createElement('div');
    ch.className = 'mix-ch';
    ch.dataset.input = input.name;
    ch.dataset.muted = input.muted ? 'true' : 'false';
    const vol = input.volumeDb ?? 0;
    ch.innerHTML = `
      <div class="mix-ch-head">
        <span class="mix-ch-name"></span>
        <span class="mix-ch-db"></span>
      </div>
      <div class="mix-meter" aria-hidden="true">
        <div class="mix-meter-bar"></div>
        <div class="mix-meter-ticks">
          <span class="mix-meter-tick" style="left:66%"></span>
          <span class="mix-meter-tick" style="left:83%"></span>
        </div>
      </div>
      <div class="mix-ch-row">
        <input type="range" class="mix-fader" min="-60" max="0" step="0.1">
        <button type="button" class="mix-mute" aria-pressed="${input.muted ? 'true' : 'false'}" aria-label="Mutar">
          <span data-mute-off>${MIC_SVG}</span>
          <span data-mute-on>${MIC_SLASH_SVG}</span>
        </button>
      </div>
    `;
    ch.querySelector('.mix-ch-name').textContent = input.name;
    ch.querySelector('.mix-ch-db').textContent = fmtDb(vol);
    const fader = ch.querySelector('.mix-fader');
    fader.value = String(vol);
    fader.setAttribute('aria-label', `Volume ${input.name}`);
    fader.addEventListener('input', () => onFaderInput(input.name, Number(fader.value), ch));
    fader.addEventListener('change', () => onFaderChange(input.name, Number(fader.value)));
    ch.querySelector('.mix-mute').addEventListener('click', () => toggleMute(input.name));
    el.mixer.appendChild(ch);
  }
}

const faderPending = new Map();
function onFaderInput(name, db, ch) {
  ch.querySelector('.mix-ch-db').textContent = fmtDb(db);
  faderPending.set(name, db);
  if (!faderPending.timer) {
    faderPending.timer = setTimeout(() => {
      for (const [n, v] of faderPending) {
        api.post('/api/volume', { input: n, db: v }).catch(() => {});
      }
      faderPending.clear();
      faderPending.timer = null;
    }, 60);
  }
}

function onFaderChange(name, db) {
  api.post('/api/volume', { input: name, db }).catch(() => toast('Falhou ao ajustar volume'));
}

async function toggleMute(name) {
  try {
    const r = await api.post('/api/mute', { input: name });
    applyMute(name, r.muted);
  } catch {
    toast('Falhou ao mutar');
  }
}

function applyMute(name, muted) {
  const entry = state.audio.find((i) => i.name === name);
  if (entry) entry.muted = muted;
  const ch = el.mixer.querySelector(`[data-input="${cssSel(name)}"]`);
  if (ch) {
    ch.dataset.muted = muted ? 'true' : 'false';
    ch.querySelector('.mix-mute').setAttribute('aria-pressed', muted ? 'true' : 'false');
  }
}

function applyVolume(name, db) {
  const entry = state.audio.find((i) => i.name === name);
  if (entry) entry.volumeDb = db;
  const ch = el.mixer.querySelector(`[data-input="${cssSel(name)}"]`);
  if (!ch) return;
  const fader = ch.querySelector('.mix-fader');
  if (fader && document.activeElement !== fader) fader.value = String(db);
  ch.querySelector('.mix-ch-db').textContent = fmtDb(db);
}

function updateMeter(name, db) {
  const ch = el.mixer.querySelector(`[data-input="${cssSel(name)}"]`);
  if (!ch) return;
  const bar = ch.querySelector('.mix-meter-bar');
  if (bar) bar.style.setProperty('--level', dbToPct(db).toFixed(1) + '%');
}

async function loadAudio() {
  try {
    const { inputs } = await api.get('/api/audio');
    state.audio = inputs;
    renderMixer();
  } catch {
    el.mixer.innerHTML = '<div class="empty">Abra o OBS para ver os canais de áudio.</div>';
  }
}

async function loadSceneItems() {
  try {
    state.sceneItems = await api.get('/api/scene-items');
  } catch {
    state.sceneItems = {};
  }
}

function applySourceVisibility(scene, source, enabled) {
  if (!state.sceneItems) state.sceneItems = {};
  if (!state.sceneItems[scene]) state.sceneItems[scene] = [];
  const list = state.sceneItems[scene];
  const item = list.find((i) => i.name === source);
  if (item) item.enabled = enabled;
  else list.push({ name: source, enabled });
}

/* ---------- refresh buttons ---------- */


/* ---------- status polling ---------- */

async function pollStatus() {
  try {
    const s = await api.get('/api/status');
    if (s.connected) setConnected(true);
    else setConnected(false);
  } catch {
    setConnected(false);
  }
}

/* ---------- scanner QR ---------- */

let scanActive = false;
let scanStop = null;

async function startScan() {
  const overlay = document.getElementById('scan-overlay');
  const video = document.getElementById('scan-video');
  overlay.hidden = false;
  scanActive = true;

  let mediaStream;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  } catch {
    toast('Permita acesso à câmera');
    stopScan();
    return;
  }
  video.srcObject = mediaStream;
  try { await video.play(); } catch {}

  scanStop = () => {
    scanActive = false;
    mediaStream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    overlay.hidden = true;
  };

  if ('BarcodeDetector' in window) {
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const loop = async () => {
      if (!scanActive) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length) {
          handleScan(codes[0].rawValue);
          return;
        }
      } catch {}
      requestAnimationFrame(loop);
    };
    loop();
  } else {
    toast('Scanner não suportado — cole o endereço');
    stopScan();
    document.querySelector('.connect-manual').open = true;
  }
}

function stopScan() {
  if (scanStop) scanStop();
  scanStop = null;
}

function handleScan(value) {
  const origin = setBridgeUrl(value);
  if (!origin) {
    toast('QR inválido');
    stopScan();
    return;
  }
  stopScan();
  bridgeUrl = origin;
  location.reload();
}

document.getElementById('scan-start')?.addEventListener('click', startScan);
document.getElementById('scan-close')?.addEventListener('click', stopScan);

document.getElementById('manual-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('manual-url');
  handleScan(input.value.trim());
});

/* ---------- live stream (SSE) ---------- */

let stream;
let streamRetry;

function openStream() {
  if (stream) return;
  try {
    stream = new EventSource(bridgeUrl + '/api/stream');
  } catch {
    return;
  }
  stream.addEventListener('levels', (e) => {
    const data = JSON.parse(e.data);
    for (const [name, db] of Object.entries(data)) updateMeter(name, db);
  });
  stream.addEventListener('mute', (e) => {
    const { input, muted } = JSON.parse(e.data);
    applyMute(input, muted);
  });
  stream.addEventListener('volume', (e) => {
    const { input, db } = JSON.parse(e.data);
    applyVolume(input, db);
  });
  stream.addEventListener('scene', (e) => {
    const { current } = JSON.parse(e.data);
    state.current = current;
    renderScenes();
    setNowScene(current);
  });
  stream.addEventListener('source', (e) => {
    const { scene, source, enabled } = JSON.parse(e.data);
    applySourceVisibility(scene, source, enabled);
    renderDeck();
  });
  stream.addEventListener('stream', (e) => {
    const { active } = JSON.parse(e.data);
    state.streaming = active;
    el.tagStream.dataset.on = active ? 'true' : 'false';
    renderDeck();
  });
  stream.addEventListener('record', (e) => {
    const { active } = JSON.parse(e.data);
    state.recording = active;
    el.tagRecord.dataset.on = active ? 'true' : 'false';
    renderDeck();
  });
  stream.addEventListener('connection', (e) => {
    const { connected } = JSON.parse(e.data);
    if (connected) {
      setConnected(true);
      loadScenes();
    } else {
      setConnected(false);
    }
  });
  stream.onerror = () => {
    stream.close();
    stream = null;
    clearTimeout(streamRetry);
    streamRetry = setTimeout(openStream, 2000);
  };
}

/* ---------- init ---------- */

async function bootstrap() {
  try {
    const s = await api.get('/api/status');
    if (s.connected) {
      setConnectState('ok');
      await loadScenes();
      await loadAudio();
      await loadSceneItems();
      // deck config: carrega do storage ou monta um default
      const saved = loadDeck();
      if (saved && saved.length) {
        state.deck = saved;
      } else {
        state.deck = defaultDeck(state.scenes, state.audio);
        saveDeck();
      }
      renderDeck();
      openStream();
    } else {
      setConnectState('obs');
      openStream();
    }
  } catch {
    setConnectState('pair');
  }
  setInterval(pollStatus, 5000);
}

bootstrap();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      reg.update();
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'activated' && navigator.serviceWorker.controller) {
            location.reload();
          }
        });
      });
    } catch {}
  });
}

if (location.hash === '#reset') {
  (async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    } catch {}
    location.replace(location.pathname);
  })();
}
