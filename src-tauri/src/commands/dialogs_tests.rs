use super::{
    files_from_folders, files_from_selection, output_folder_from_selection, receive_selection,
};
use std::fs;
use std::path::Path;
use tauri_plugin_dialog::FilePath;
use tempfile::tempdir;

fn remote_url() -> FilePath {
    FilePath::Url("https://example.invalid/document.pdf".parse().unwrap())
}

#[tokio::test]
async fn receives_a_dialog_result_or_reports_a_dropped_callback() {
    assert_eq!(
        receive_selection(|send| send.send(Some("selected")).unwrap()).await,
        Ok(Some("selected"))
    );
    assert_eq!(
        receive_selection(|send| send.send(None::<&str>).unwrap()).await,
        Ok(None)
    );
    assert!(receive_selection::<Option<&str>>(drop).await.is_err());
}

#[tokio::test]
async fn file_selection_returns_metadata_and_handles_missing_files() {
    let dir = tempdir().unwrap();
    let available = dir.path().join("report.pdf");
    let missing = dir.path().join("missing.pdf");
    fs::write(&available, b"report").unwrap();
    let file_url = tauri::Url::from_file_path(&available).unwrap();
    let entries = files_from_selection(Some(vec![
        remote_url(),
        FilePath::Url(file_url),
        missing.clone().into(),
    ]))
    .await;

    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].path, available.to_string_lossy());
    assert_eq!(entries[0].name, "report.pdf");
    assert_eq!(entries[0].size, Some(6));
    assert_eq!(entries[1].path, missing.to_string_lossy());
    assert_eq!(entries[1].name, "missing.pdf");
    assert_eq!(entries[1].size, None);
    assert!(files_from_selection(None).await.is_empty());
}

#[tokio::test]
async fn folder_selection_recurses_and_keeps_results_from_other_folders() {
    let dir = tempdir().unwrap();
    let first = dir.path().join("first");
    let nested = first.join("nested");
    let second = dir.path().join("second");
    fs::create_dir_all(&nested).unwrap();
    fs::create_dir(&second).unwrap();
    fs::write(nested.join("report.PDF"), b"report").unwrap();
    fs::write(second.join("notes.md"), b"notes").unwrap();
    fs::write(second.join("logo.png"), b"ignored").unwrap();

    let entries = files_from_folders(Some(vec![
        first.into(),
        remote_url(),
        dir.path().join("missing").into(),
        second.into(),
    ]))
    .await
    .unwrap();

    let names: Vec<_> = entries.iter().map(|entry| entry.name.as_str()).collect();
    assert_eq!(names, ["report.PDF", "notes.md"]);
    assert!(files_from_folders(None).await.unwrap().is_empty());
}

#[test]
fn output_folder_selection_converts_paths_and_ignores_remote_urls() {
    let dir = tempdir().unwrap();
    let url = tauri::Url::from_directory_path(dir.path()).unwrap();
    let path = dir.path().to_string_lossy().to_string();
    assert_eq!(
        output_folder_from_selection(Some(dir.path().to_path_buf().into())),
        Some(path.clone())
    );
    let from_url = output_folder_from_selection(Some(FilePath::Url(url))).unwrap();
    assert_eq!(Path::new(&from_url), dir.path());
    assert_eq!(output_folder_from_selection(Some(remote_url())), None);
    assert_eq!(output_folder_from_selection(None), None);
}
