use tauri::WebviewWindow;

/// Minimizes the application window
#[tauri::command]
pub fn window_minimize(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

/// Toggles between maximized and restored window states
#[tauri::command]
pub fn window_toggle_maximize(window: WebviewWindow) -> Result<bool, String> {
    let is_max = window.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

/// Closes the application window
#[tauri::command]
pub fn window_close(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

/// Checks if the window is currently maximized
#[tauri::command]
pub fn window_is_maximized(window: WebviewWindow) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

/// Starts dragging the window
#[tauri::command]
pub fn window_start_dragging(window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

/// Sets the zoom factor for the window webview
#[tauri::command]
pub fn window_set_zoom(window: WebviewWindow, factor: f64) -> Result<(), String> {
    window.set_zoom(factor).map_err(|e| e.to_string())
}

/// Returns true if the desktop binary was compiled with debug assertions
#[tauri::command]
pub fn app_is_debug() -> bool {
    cfg!(debug_assertions)
}
