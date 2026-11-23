use crate::scanner::{self, DesktopFileEntry};
use std::path::PathBuf;
use tauri_plugin_dialog::FilePath;
use tokio::sync::oneshot;

pub use super::native_dialogs::{choose_files, choose_folders, choose_output_folder};

/// Helper to convert Tauri FilePath to a standard PathBuf
pub fn file_path_to_path_buf(file_path: FilePath) -> Option<PathBuf> {
    match file_path {
        FilePath::Path(buf) => Some(buf),
        FilePath::Url(url) => url.to_file_path().ok(),
    }
}

pub(super) async fn receive_selection<T>(
    start: impl FnOnce(oneshot::Sender<T>),
) -> Result<T, String> {
    let (tx, rx) = oneshot::channel();
    start(tx);
    rx.await.map_err(|e| e.to_string())
}

pub(super) async fn files_from_selection(paths: Option<Vec<FilePath>>) -> Vec<DesktopFileEntry> {
    let paths = paths.unwrap_or_default();
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

    entries
}

pub(super) async fn files_from_folders(
    dirs: Option<Vec<FilePath>>,
) -> Result<Vec<DesktopFileEntry>, String> {
    let dirs = dirs.unwrap_or_default();
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

pub(super) fn output_folder_from_selection(dir: Option<FilePath>) -> Option<String> {
    dir.and_then(file_path_to_path_buf)
        .map(|p| p.to_string_lossy().to_string())
}

#[cfg(test)]
#[path = "dialogs_tests.rs"]
mod tests;
