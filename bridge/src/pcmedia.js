import { exec } from 'node:child_process';
import { platform } from 'node:os';

const WIN_VK = {
  play: 0xB3,  // VK_MEDIA_PLAY_PAUSE
  pause: 0xB3,
  next: 0xB0,  // VK_MEDIA_NEXT_TRACK
  previous: 0xB1,
  stop: 0xB2,
  mute: 0xAD,
  volup: 0xAF,
  voldown: 0xAE,
};

const MAC_KEY = {
  play: 100, pause: 100, next: 101, previous: 102, stop: 100,
  mute: 74, volup: 72, voldown: 73,
};

const LINUX_XF86 = {
  play: 'XF86AudioPlay',
  pause: 'XF86AudioPause',
  next: 'XF86AudioNext',
  previous: 'XF86AudioPrev',
  stop: 'XF86AudioStop',
  mute: 'XF86AudioMute',
  volup: 'XF86AudioRaiseVolume',
  voldown: 'XF86AudioLowerVolume',
};

function runWindows(action) {
  const vk = WIN_VK[action];
  if (!vk) throw new Error(`unknown action: ${action}`);
  const script = `Add-Type -Name MK -Namespace W -MemberDefinition '[DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, int extra);'
[W.MK]::keybd_event(${vk}, 0, 1, 0)
[W.MK]::keybd_event(${vk}, 0, 3, 0)`;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve, reject) => {
    exec(`powershell -NoProfile -EncodedCommand ${encoded}`, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

function runMac(action) {
  const key = MAC_KEY[action];
  if (key == null) throw new Error(`unknown action: ${action}`);
  return new Promise((resolve, reject) => {
    exec(`osascript -e 'tell application "System Events" to key code ${key}'`, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

function runLinux(action) {
  const key = LINUX_XF86[action];
  if (!key) throw new Error(`unknown action: ${action}`);
  return new Promise((resolve, reject) => {
    exec(`xdotool key ${key}`, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

export async function sendMediaKey(action) {
  const p = platform();
  if (p === 'win32') return runWindows(action);
  if (p === 'darwin') return runMac(action);
  if (p === 'linux') return runLinux(action);
  throw new Error(`unsupported platform: ${p}`);
}

const WIN_STATUS_SCRIPT = `
try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction SilentlyContinue
  [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
  [Windows.Media.Control.GlobalSystemMediaTransportControlsSession,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
  [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
  $asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.ReturnType.IsGenericType }
  $asTaskGeneric = $asTaskGeneric | Select-Object -First 1
  if (-not $asTaskGeneric) { throw 'AsTask not found' }
  function Await($op, $type) {
    $t = $asTaskGeneric.MakeGenericMethod($type)
    $nt = $t.Invoke($null, @($op))
    $nt.Wait(-1) | Out-Null
    $nt.Result
  }
  $mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
  if (-not $mgr) { Write-Output '{"playing":false,"status":"NoManager"}'; exit }
  $session = $mgr.GetCurrentSession()
  if ($session) {
    $pb = $session.GetPlaybackInfo()
    $status = $pb.PlaybackStatus.ToString()
    $info = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $out = @{
      playing = ($status -eq 'Playing')
      status = $status
      title = $info.Title
      artist = $info.Artist
    }
    $out | ConvertTo-Json -Compress
  } else {
    Write-Output '{"playing":false,"status":"NoSession"}'
  }
} catch {
  $msg = $_.Exception.Message -replace '"', ''
  Write-Output ('{"playing":false,"status":"Error","error":"' + $msg + '"}')
}
`.trim();

async function statusWindows() {
  const encoded = Buffer.from(WIN_STATUS_SCRIPT, 'utf16le').toString('base64');
  return new Promise((resolve) => {
    exec(`powershell -NoProfile -EncodedCommand ${encoded}`, { timeout: 2500 }, (err, stdout) => {
      if (err || !stdout) return resolve({ supported: true, playing: false, status: 'Unknown' });
      try {
        const data = JSON.parse(stdout.trim());
        resolve({ supported: true, ...data });
      } catch {
        resolve({ supported: true, playing: false, status: 'ParseError' });
      }
    });
  });
}

export async function getMediaStatus() {
  const p = platform();
  if (p === 'win32') return statusWindows();
  return { supported: false };
}
