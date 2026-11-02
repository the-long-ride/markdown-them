use crate::commands::dialogs::file_path_to_path_buf;
use crate::path_resolver;
use std::path::Path;
use tauri_plugin_dialog::DialogExt;
use tokio::io::AsyncWriteExt;

const TRUSTED_PREFIXES: &[&str] = &[
    "https://github.com/the-long-ride",
    "https://open-vsx.org/extension/the-long-ride/markdown-them",
    "https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them",
    "https://www.npmjs.com/package/@the-long-ride/markdown-them",
    "https://the-long-ride.github.io",
];

pub fn is_trusted_external_url(url: &str) -> bool {
    let trimmed = url.trim();
    if !trimmed.starts_with("https://") && !trimmed.starts_with("http://") {
        return false;
    }

    TRUSTED_PREFIXES
        .iter()
        .any(|prefix| trimmed.starts_with(prefix))
}

/// Reads raw binary bytes of a file from disk
#[tauri::command]
pub async fn read_file_binary(
    file_path: Option<String>,
    path: Option<String>,
) -> Result<Vec<u8>, String> {
    let target_path = file_path
        .or(path)
        .ok_or_else(|| "Missing required file path argument".to_string())?;

    let p = Path::new(&target_path);
    if !p.exists() {
        return Err(format!("File not found: {}", target_path));
    }
    if p.is_dir() {
        return Err(format!("Path is a directory, not a file: {}", target_path));
    }

    tokio::fs::read(p)
        .await
        .map_err(|e| format!("Failed to read file '{}': {}", target_path, e))
}

/// Resolves collision-free output path and atomically saves converted markdown
#[tauri::command]
pub async fn save_converted_file(
    source_path: String,
    output_folder: Option<String>,
    markdown: String,
) -> Result<String, String> {
    let source = Path::new(&source_path);
    let output_dir_path = output_folder
        .as_ref()
        .filter(|s| !s.trim().is_empty())
        .map(|s| Path::new(s.as_str()));

    let target_dir = path_resolver::resolve_target_dir(source, output_dir_path);

    tokio::fs::create_dir_all(&target_dir).await.map_err(|e| {
        format!(
            "Failed to create output directory '{}': {}",
            target_dir.display(),
            e
        )
    })?;

    let (base_stem, _) = path_resolver::compute_base_stem(source);

    let mut counter: u32 = 0;
    loop {
        let candidate_filename = path_resolver::candidate_filename(&base_stem, counter);
        let candidate_path = target_dir.join(candidate_filename);

        match tokio::fs::OpenOptions::new()
            .write(true)
            .create_new(true) // Atomic creation fails if file exists
            .open(&candidate_path)
            .await
        {
            Ok(mut file) => {
                file.write_all(markdown.as_bytes()).await.map_err(|e| {
                    format!(
                        "Failed to write content to '{}': {}",
                        candidate_path.display(),
                        e
                    )
                })?;
                file.flush().await.map_err(|e| {
                    format!(
                        "Failed to flush content to '{}': {}",
                        candidate_path.display(),
                        e
                    )
                })?;

                return Ok(candidate_path.to_string_lossy().to_string());
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                counter += 1;
                if counter > 10_000 {
                    return Err(format!(
                        "Collision resolution exceeded limit for '{}'",
                        source_path
                    ));
                }
                continue;
            }
            Err(e) => {
                return Err(format!(
                    "Failed to create file '{}': {}",
                    candidate_path.display(),
                    e
                ));
            }
        }
    }
}

/// Native save dialog for single markdown exports
#[tauri::command]
pub async fn save_markdown_dialog(
    app: tauri::AppHandle,
    default_name: String,
    markdown: String,
) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .set_title("Save Converted Markdown")
        .set_file_name(&default_name)
        .add_filter("Markdown", &["md"])
        .save_file(move |file_path| {
            let _ = tx.send(file_path);
        });

    let selected = rx.await.map_err(|e| e.to_string())?;

    if let Some(fp) = selected {
        let path_buf = file_path_to_path_buf(fp)
            .ok_or_else(|| "Invalid destination path selected".to_string())?;

        if let Some(parent) = path_buf.parent() {
            if !parent.as_os_str().is_empty() {
                tokio::fs::create_dir_all(parent).await.map_err(|e| {
                    format!("Failed to create directory '{}': {}", parent.display(), e)
                })?;
            }
        }

        tokio::fs::write(&path_buf, markdown.as_bytes())
            .await
            .map_err(|e| format!("Failed to save markdown to '{}': {}", path_buf.display(), e))?;

        Ok(Some(path_buf.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

/// Safely opens external URLs restricted to trusted origins
#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    if !is_trusted_external_url(&url) {
        return Err(format!("URL blocked by security whitelist: {}", url));
    }

    open::that(&url).map_err(|e| format!("Failed to open external URL '{}': {}", url, e))
}

/// Opens a file or directory in the system file manager.
/// If the target is a file, reveals/selects it in Windows Explorer / macOS Finder.
/// If the target is a directory, opens that directory.
#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path is empty".to_string());
    }

    let p = Path::new(trimmed);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", trimmed));
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let mut clean_path = trimmed.replace('/', "\\");
        if clean_path.len() > 3 && clean_path.ends_with('\\') {
            clean_path.pop();
        }
        let path_obj = Path::new(&clean_path);

        if path_obj.is_file() {
            let mut cmd = Command::new("explorer");
            // Must use raw_arg so explorer receives `/select,"C:\path with spaces\file.ext"`
            // without quotes around the switch `/select,`
            cmd.raw_arg(format!("/select,\"{}\"", clean_path));
            cmd.creation_flags(CREATE_NO_WINDOW);
            if cmd.spawn().is_ok() {
                return Ok(());
            }
        } else if path_obj.is_dir() {
            let mut cmd = Command::new("explorer");
            cmd.raw_arg(format!("\"{}\"", clean_path));
            cmd.creation_flags(CREATE_NO_WINDOW);
            if cmd.spawn().is_ok() {
                return Ok(());
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        if p.is_file() {
            let res = Command::new("open").args(["-R", trimmed]).spawn();
            if res.is_ok() {
                return Ok(());
            }
        }
    }

    let target = if p.is_file() {
        p.parent().unwrap_or(p)
    } else {
        p
    };

    open::that(target).map_err(|e| format!("Failed to open path '{}': {}", target.display(), e))
}
