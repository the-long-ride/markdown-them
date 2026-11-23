// These commands hand off to OS dialogs with no picker in the headless coverage job.
use super::dialogs::{
    files_from_folders, files_from_selection, output_folder_from_selection, receive_selection,
};
use super::fs::save_selected_markdown;
use crate::scanner::{DesktopFileEntry, SUPPORTED_EXTENSIONS};
use tauri::{AppHandle, Runtime};
use tauri_plugin_dialog::DialogExt;

/// Native file picker allowing selection of multiple documents
#[tauri::command]
pub async fn choose_files<R: Runtime>(app: AppHandle<R>) -> Result<Vec<DesktopFileEntry>, String> {
    let paths = receive_selection(|tx| {
        app.dialog()
            .file()
            .set_title("Select Documents to Convert")
            .add_filter("Supported Documents", SUPPORTED_EXTENSIONS)
            .pick_files(move |paths| {
                let _ = tx.send(paths);
            });
    })
    .await?;

    Ok(files_from_selection(paths).await)
}

/// Native directory picker with recursive scanning via walkdir on Tokio blocking pool
#[tauri::command]
pub async fn choose_folders<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<DesktopFileEntry>, String> {
    let dirs = receive_selection(|tx| {
        app.dialog()
            .file()
            .set_title("Select Folders to Scan for Documents")
            .pick_folders(move |dirs| {
                let _ = tx.send(dirs);
            });
    })
    .await?;

    files_from_folders(dirs).await
}

/// Native folder picker returning the selected directory path string
#[tauri::command]
pub async fn choose_output_folder<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, String> {
    let dir = receive_selection(|tx| {
        app.dialog()
            .file()
            .set_title("Choose Markdown Output Folder")
            .pick_folder(move |dir| {
                let _ = tx.send(dir);
            });
    })
    .await?;

    Ok(output_folder_from_selection(dir))
}

/// Native save dialog for single markdown exports
#[tauri::command]
pub async fn save_markdown_dialog<R: Runtime>(
    app: AppHandle<R>,
    default_name: String,
    markdown: String,
) -> Result<Option<String>, String> {
    let selected = receive_selection(|tx| {
        app.dialog()
            .file()
            .set_title("Save Converted Markdown")
            .set_file_name(&default_name)
            .add_filter("Markdown", &["md"])
            .save_file(move |file_path| {
                let _ = tx.send(file_path);
            });
    })
    .await?;

    save_selected_markdown(selected, &markdown).await
}
