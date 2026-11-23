pub mod commands;
pub mod path_resolver;
pub mod scanner;

use tauri::{Emitter, Runtime, Window, WindowEvent};

fn emit_maximized_on_resize<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if let WindowEvent::Resized(_) = event {
        if let Ok(is_max) = window.is_maximized() {
            let _ = window.emit("window:maximized-change", is_max);
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // The native event loop and resize events require a real desktop runtime.
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(commands::invoke_handler())
        .on_window_event(emit_maximized_on_resize)
        .run(tauri::generate_context!())
        .expect("error while running Markdown Them desktop application");
}
