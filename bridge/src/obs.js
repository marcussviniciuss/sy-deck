import OBSWebSocket, { EventSubscription } from 'obs-websocket-js';
import { config } from './config.js';
import { bus } from './bus.js';

const obs = new OBSWebSocket();
let connected = false;
let connecting = null;
let listenersBound = false;

const SUBSCRIPTIONS = EventSubscription.All | EventSubscription.InputVolumeMeters;

function levelsToDb(inputLevelsMul) {
  if (!Array.isArray(inputLevelsMul) || inputLevelsMul.length === 0) return null;
  let peak = 0;
  for (const ch of inputLevelsMul) {
    const p = Array.isArray(ch) ? Number(ch[1] ?? 0) : 0;
    if (p > peak) peak = p;
  }
  if (peak <= 0) return -60;
  const db = 20 * Math.log10(peak);
  return Math.max(-60, Math.min(0, db));
}

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;

  obs.on('InputVolumeMeters', (data) => {
    const out = {};
    for (const input of data.inputs ?? []) {
      const db = levelsToDb(input.inputLevelsMul);
      if (db !== null) out[input.inputName] = db;
    }
    if (Object.keys(out).length) bus.emit('levels', out);
  });

  obs.on('InputMuteStateChanged', ({ inputName, inputMuted }) => {
    bus.emit('mute', { input: inputName, muted: inputMuted });
  });

  obs.on('InputVolumeChanged', ({ inputName, inputVolumeDb }) => {
    bus.emit('volume', { input: inputName, db: inputVolumeDb });
  });

  obs.on('CurrentProgramSceneChanged', ({ sceneName }) => {
    bus.emit('scene', { current: sceneName });
  });

  obs.on('SceneItemEnableStateChanged', async ({ sceneName, sceneItemId, sceneItemEnabled }) => {
    try {
      const data = await obs.call('GetSceneItemList', { sceneName });
      const item = data.sceneItems.find((i) => i.sceneItemId === sceneItemId);
      if (item) bus.emit('source', { scene: sceneName, source: item.sourceName, enabled: !!sceneItemEnabled });
    } catch {}
  });

  obs.on('StreamStateChanged', ({ outputActive }) => {
    bus.emit('stream', { active: outputActive });
  });

  obs.on('RecordStateChanged', ({ outputActive }) => {
    bus.emit('record', { active: outputActive });
  });

  obs.on('ConnectionClosed', () => {
    connected = false;
    bus.emit('connection', { connected: false });
  });
}

async function connect() {
  if (connected) return;
  if (connecting) return connecting;
  bindListeners();
  connecting = obs
    .connect(config.obsUrl, config.obsPassword || undefined, { eventSubscriptions: SUBSCRIPTIONS })
    .then(() => {
      connected = true;
      connecting = null;
      bus.emit('connection', { connected: true });
    })
    .catch((err) => {
      connecting = null;
      throw err;
    });
  return connecting;
}

async function call(request, params) {
  await connect();
  return obs.call(request, params);
}

export const obsClient = {
  isConnected: () => connected,
  async status() {
    try {
      await connect();
      return { connected: true, url: config.obsUrl };
    } catch (err) {
      return { connected: false, url: config.obsUrl, error: err.message };
    }
  },
  async listScenes() {
    const data = await call('GetSceneList');
    return {
      current: data.currentProgramSceneName,
      scenes: [...data.scenes].reverse().map((s) => s.sceneName),
    };
  },
  async setScene(name) {
    return call('SetCurrentProgramScene', { sceneName: name });
  },
  async toggleMute(inputName) {
    const { inputMuted } = await call('ToggleInputMute', { inputName });
    return { inputName, muted: inputMuted };
  },
  async setVolume(inputName, inputVolumeDb) {
    return call('SetInputVolume', { inputName, inputVolumeDb });
  },
  async listInputs() {
    const { inputs } = await call('GetInputList');
    return inputs.map((i) => ({ name: i.inputName, kind: i.inputKind }));
  },
  async listAudioInputs() {
    const AUDIO = new Set([
      'wasapi_input_capture',
      'wasapi_output_capture',
      'wasapi_process_output_capture',
      'coreaudio_input_capture',
      'coreaudio_output_capture',
      'pulse_input_capture',
      'pulse_output_capture',
    ]);
    const { inputs } = await call('GetInputList');
    const audio = inputs.filter((i) => AUDIO.has(i.inputKind));
    const result = await Promise.all(
      audio.map(async (i) => {
        try {
          const [{ inputMuted }, { inputVolumeDb }] = await Promise.all([
            call('GetInputMute', { inputName: i.inputName }),
            call('GetInputVolume', { inputName: i.inputName }),
          ]);
          return { name: i.inputName, kind: i.inputKind, muted: inputMuted, volumeDb: inputVolumeDb };
        } catch {
          return { name: i.inputName, kind: i.inputKind, muted: null, volumeDb: null };
        }
      }),
    );
    return result;
  },
  async triggerStudioTransition() {
    return call('TriggerStudioModeTransition');
  },

  async listSceneItems(sceneName) {
    const data = await call('GetSceneItemList', { sceneName });
    return data.sceneItems.map((i) => ({
      id: i.sceneItemId,
      name: i.sourceName,
      kind: i.inputKind || '',
      enabled: !!i.sceneItemEnabled,
    }));
  },

  async toggleSceneItem(sceneName, sourceName) {
    const data = await call('GetSceneItemList', { sceneName });
    const item = data.sceneItems.find((i) => i.sourceName === sourceName);
    if (!item) throw new Error(`fonte "${sourceName}" não encontrada em "${sceneName}"`);
    const next = !item.sceneItemEnabled;
    await call('SetSceneItemEnabled', {
      sceneName,
      sceneItemId: item.sceneItemId,
      sceneItemEnabled: next,
    });
    return { enabled: next };
  },

  async listAllSceneItems() {
    const { scenes } = await call('GetSceneList');
    const out = {};
    await Promise.all(
      scenes.map(async (s) => {
        try {
          out[s.sceneName] = await this.listSceneItems(s.sceneName);
        } catch {
          out[s.sceneName] = [];
        }
      }),
    );
    return out;
  },
  async mediaAction(sourceName, action) {
    const map = {
      play: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY',
      pause: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE',
      stop: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP',
      next: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NEXT',
      previous: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PREVIOUS',
      restart: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
    };
    const mediaAction = map[action];
    if (!mediaAction) throw new Error(`unknown media action: ${action}`);
    return call('TriggerMediaInputAction', { inputName: sourceName, mediaAction });
  },
  async startStream() { return call('StartStream'); },
  async stopStream() { return call('StopStream'); },
  async toggleRecord() { return call('ToggleRecord'); },
  async streamStatus() { return call('GetStreamStatus'); },
};
