pub mod commands;
pub mod path_resolver;
pub mod scanner;

use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::dialogs::choose_files,
            commands::dialogs::choose_folders,
            commands::dialogs::choose_output_folder,
            commands::fs::read_file_binary,
            commands::fs::save_converted_file,
            commands::fs::save_markdown_dialog,
            commands::fs::open_external,
            commands::fs::open_path,
            commands::window::window_minimize,
            commands::window::window_toggle_maximize,
            commands::window::window_close,
            commands::window::window_is_maximized,
            commands::window::window_start_dragging,
            commands::window::window_set_zoom,
            commands::window::app_is_debug,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Resized(_) = event {
                if let Ok(is_max) = window.is_maximized() {
                    let _ = window.emit("window:maximized-change", is_max);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Markdown Them desktop application");
}
