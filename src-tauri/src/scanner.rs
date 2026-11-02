use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

pub const SUPPORTED_EXTENSIONS: &[&str] = &[
    "docx", "doc", "pdf", "html", "htm", "xlsx", "xls", "xlm", "pptx", "odt", "odp", "ods", "rtf",
    "md", "markdown", "txt",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DesktopFileEntry {
    pub path: String,
    pub name: String,
    pub size: Option<u64>,
}

impl DesktopFileEntry {
    pub fn from_path(path: &Path) -> Self {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let size = std::fs::metadata(path).ok().map(|m| m.len());
        Self {
            path: path.to_string_lossy().to_string(),
            name,
            size,
        }
    }
}

pub fn is_supported_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let lower = ext.to_lowercase();
            SUPPORTED_EXTENSIONS.contains(&lower.as_str())
        })
        .unwrap_or(false)
}

pub fn collect_supported_files(root_dir: &Path) -> Result<Vec<PathBuf>, String> {
    if !root_dir.exists() {
        return Err(format!("Directory does not exist: {}", root_dir.display()));
    }
    if !root_dir.is_dir() {
        return Err(format!("Path is not a directory: {}", root_dir.display()));
    }

    let mut matches = Vec::new();
    for entry in WalkDir::new(root_dir)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() && is_supported_extension(entry.path()) {
            matches.push(entry.path().to_path_buf());
        }
    }

    Ok(matches)
}

pub fn collect_supported_entries(root_dir: &Path) -> Result<Vec<DesktopFileEntry>, String> {
    let files = collect_supported_files(root_dir)?;
    Ok(files
        .into_iter()
        .map(|p| DesktopFileEntry::from_path(&p))
        .collect())
}
