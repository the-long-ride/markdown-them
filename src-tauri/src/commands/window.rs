use tauri::{Runtime, WebviewWindow};

fn window_error(error: tauri::Error) -> String {
    error.to_string()
}

/// Minimizes the application window
#[tauri::command]
pub fn window_minimize<R: Runtime>(window: WebviewWindow<R>) -> Result<(), String> {
    window.minimize().map_err(window_error)
}

/// Toggles between maximized and restored window states
#[tauri::command]
pub fn window_toggle_maximize<R: Runtime>(window: WebviewWindow<R>) -> Result<bool, String> {
    let is_max = window.is_maximized().map_err(window_error)?;
    if is_max {
        window.unmaximize().map_err(window_error)?;
        Ok(false)
    } else {
        window.maximize().map_err(window_error)?;
        Ok(true)
    }
}

/// Closes the application window
#[tauri::command]
pub fn window_close<R: Runtime>(window: WebviewWindow<R>) -> Result<(), String> {
    window.close().map_err(window_error)
}

/// Checks if the window is currently maximized
#[tauri::command]
pub fn window_is_maximized<R: Runtime>(window: WebviewWindow<R>) -> Result<bool, String> {
    window.is_maximized().map_err(window_error)
}

/// Starts dragging the window
#[tauri::command]
pub fn window_start_dragging<R: Runtime>(window: WebviewWindow<R>) -> Result<(), String> {
    window.start_dragging().map_err(window_error)
}

/// Sets the zoom factor for the window webview
#[tauri::command]
pub fn window_set_zoom<R: Runtime>(window: WebviewWindow<R>, factor: f64) -> Result<(), String> {
    window.set_zoom(factor).map_err(window_error)
}

/// Returns true if the desktop binary was compiled with debug assertions
#[tauri::command]
pub fn app_is_debug() -> bool {
    cfg!(debug_assertions)
}
