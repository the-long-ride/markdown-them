use crate::scanner::{self, DesktopFileEntry, SUPPORTED_EXTENSIONS};
use std::path::PathBuf;
use tauri_plugin_dialog::{DialogExt, FilePath};

/// Helper to convert Tauri FilePath to a standard PathBuf
pub fn file_path_to_path_buf(file_path: FilePath) -> Option<PathBuf> {
    match file_path {
        FilePath::Path(buf) => Some(buf),
        FilePath::Url(url) => url.to_file_path().ok(),
    }
}

/// Native file picker allowing selection of multiple documents
#[tauri::command]
pub async fn choose_files(app: tauri::AppHandle) -> Result<Vec<DesktopFileEntry>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .set_title("Select Documents to Convert")
        .add_filter("Supported Documents", SUPPORTED_EXTENSIONS)
        .pick_files(move |paths| {
            let _ = tx.send(paths);
        });

    let paths = rx.await.map_err(|e| e.to_string())?.unwrap_or_default();
    let mut entries = Vec::with_capacity(paths.len());

    for fp in paths {
        if let Some(path_buf) = file_path_to_path_buf(fp) {
            let size = tokio::fs::metadata(&path_buf).await.ok().map(|m| m.len());
            let name = path_buf
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            entries.push(DesktopFileEntry {
                path: path_buf.to_string_lossy().to_string(),
                name,
                size,
            });
        }
    }

    Ok(entries)
}

/// Native directory picker with recursive scanning via walkdir on Tokio blocking pool
#[tauri::command]
pub async fn choose_folders(app: tauri::AppHandle) -> Result<Vec<DesktopFileEntry>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .set_title("Select Folders to Scan for Documents")
        .pick_folders(move |dirs| {
            let _ = tx.send(dirs);
        });

    let dirs = rx.await.map_err(|e| e.to_string())?.unwrap_or_default();
    if dirs.is_empty() {
        return Ok(Vec::new());
    }

    let target_dirs: Vec<PathBuf> = dirs.into_iter().filter_map(file_path_to_path_buf).collect();

    tokio::task::spawn_blocking(move || {
        let mut entries = Vec::new();
        for root_dir in target_dirs {
            match scanner::collect_supported_entries(&root_dir) {
                Ok(found) => entries.extend(found),
                Err(err) => {
                    eprintln!(
                        "Warning: Failed to scan directory '{}': {}",
                        root_dir.display(),
                        err
                    );
                }
            }
        }
        Ok(entries)
    })
    .await
    .map_err(|e| format!("Directory scan task failed: {}", e))?
}

/// Native folder picker returning the selected directory path string
#[tauri::command]
pub async fn choose_output_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .set_title("Choose Markdown Output Folder")
        .pick_folder(move |dir| {
            let _ = tx.send(dir);
        });

    let dir = rx.await.map_err(|e| e.to_string())?;
    Ok(dir
        .and_then(file_path_to_path_buf)
        .map(|p| p.to_string_lossy().to_string()))
}
