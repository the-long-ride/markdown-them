use super::invoke_handler;
use serde::de::DeserializeOwned;
use serde_json::{json, Value};
use std::fs;
use tauri::ipc::CallbackFn;
use tauri::test::{get_ipc_response, mock_builder, MockRuntime, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{App, WebviewWindow, WebviewWindowBuilder};
use tempfile::tempdir;

fn invoke<T: DeserializeOwned>(
    window: &WebviewWindow<MockRuntime>,
    command: &str,
    payload: Value,
) -> Result<T, Value> {
    get_ipc_response(
        window,
        InvokeRequest {
            cmd: command.into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: if cfg!(any(windows, target_os = "android")) {
                "http://tauri.localhost"
            } else {
                "tauri://localhost"
            }
            .parse()
            .unwrap(),
            body: payload.into(),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        },
    )
    .map(|response| response.deserialize().unwrap())
}

fn app_and_window() -> (App<MockRuntime>, WebviewWindow<MockRuntime>) {
    let app = mock_builder()
        .invoke_handler(invoke_handler())
        .build(tauri::generate_context!())
        .unwrap();
    let window = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    (app, window)
}

#[test]
fn window_commands_are_registered_and_accept_frontend_payloads() {
    let (_app, window) = app_and_window();
    assert_eq!(
        invoke::<bool>(&window, "app_is_debug", json!({})),
        Ok(cfg!(debug_assertions))
    );
    assert_eq!(
        invoke::<bool>(&window, "window_is_maximized", json!({})),
        Ok(false)
    );
    assert_eq!(
        invoke::<bool>(&window, "window_toggle_maximize", json!({})),
        Ok(true)
    );
    for command in ["window_minimize", "window_start_dragging"] {
        assert_eq!(invoke::<()>(&window, command, json!({})), Ok(()));
    }
    assert_eq!(
        invoke::<()>(&window, "window_set_zoom", json!({"factor": 1.25})),
        Ok(())
    );
    assert_eq!(invoke::<()>(&window, "window_close", json!({})), Ok(()));
}

#[test]
fn filesystem_ipc_uses_camel_case_arguments_and_returns_errors() {
    let (_app, window) = app_and_window();
    let dir = tempdir().unwrap();
    let source = dir.path().join("report.pdf");
    fs::write(&source, [0, 255]).unwrap();
    assert_eq!(
        invoke::<Vec<u8>>(&window, "read_file_binary", json!({"filePath": source})),
        Ok(vec![0, 255])
    );
    let saved = invoke::<String>(
        &window,
        "save_converted_file",
        json!({"sourcePath": source, "markdown": "# Report"}),
    )
    .unwrap();
    assert_eq!(saved, dir.path().join("report.md").to_string_lossy());
    assert_eq!(fs::read_to_string(saved).unwrap(), "# Report");
    assert_eq!(
        invoke::<()>(&window, "open_path", json!({"path": " "})),
        Err(json!("Path is empty"))
    );
    let url = "https://example.invalid/";
    assert_eq!(
        invoke::<()>(&window, "open_external", json!({"url": url})),
        Err(json!(format!("URL blocked by security whitelist: {url}")))
    );
    assert!(invoke::<()>(&window, "unknown_command", json!({})).is_err());
}
