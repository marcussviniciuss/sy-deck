#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Manager, RunEvent};

struct BridgeProcess(Mutex<Option<Child>>);

fn spawn_bridge(app: &tauri::AppHandle) -> Option<Child> {
    let bin = app
        .path()
        .resolve("binaries/pocket-deck-bridge", tauri::path::BaseDirectory::Resource)
        .ok()?;

    Command::new(bin)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .ok()
}

fn main() {
    tauri::Builder::default()
        .manage(BridgeProcess(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(child) = spawn_bridge(&handle) {
                let state = handle.state::<BridgeProcess>();
                *state.0.lock().unwrap() = Some(child);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("erro ao iniciar o Pocket Deck")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { .. } = event {
                let state = app_handle.state::<BridgeProcess>();
                if let Some(mut child) = state.0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
