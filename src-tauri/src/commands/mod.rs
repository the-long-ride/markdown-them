pub mod dialogs;
pub mod fs;
mod native_dialogs;
pub mod window;

use tauri::{ipc::Invoke, Runtime};

pub(crate) fn invoke_handler<R: Runtime>() -> impl Fn(Invoke<R>) -> bool + Send + Sync + 'static {
    tauri::generate_handler![
        native_dialogs::choose_files,
        native_dialogs::choose_folders,
        native_dialogs::choose_output_folder,
        fs::read_file_binary,
        fs::save_converted_file,
        native_dialogs::save_markdown_dialog,
        fs::open_external,
        fs::open_path,
        window::window_minimize,
        window::window_toggle_maximize,
        window::window_close,
        window::window_is_maximized,
        window::window_start_dragging,
        window::window_set_zoom,
        window::app_is_debug,
    ]
}

#[cfg(test)]
#[path = "ipc_tests.rs"]
mod tests;
