use std::path::{Path, PathBuf};

/// Computes the base stem for the markdown output file and indicates whether source was markdown.
pub fn compute_base_stem(source: &Path) -> (String, bool) {
    let file_stem = source
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "converted".to_string());

    let is_source_markdown = source
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let lower = ext.to_lowercase();
            lower == "md" || lower == "markdown"
        })
        .unwrap_or(false);

    let base_stem = if is_source_markdown {
        format!("{}_converted", file_stem)
    } else {
        file_stem
    };

    (base_stem, is_source_markdown)
}

/// Generates a candidate markdown filename based on base_stem and collision counter.
/// Counter 0: "base_stem.md"
/// Counter >= 1: "base_stem (counter).md"
pub fn candidate_filename(base_stem: &str, counter: u32) -> String {
    if counter == 0 {
        format!("{}.md", base_stem)
    } else {
        format!("{} ({}).md", base_stem, counter)
    }
}

/// Resolves destination directory from source path and optional output folder.
pub fn resolve_target_dir(source: &Path, output_folder: Option<&Path>) -> PathBuf {
    match output_folder {
        Some(folder) if !folder.as_os_str().is_empty() => folder.to_path_buf(),
        _ => source
            .parent()
            .map(|p| p.to_path_buf())
            .filter(|p| !p.as_os_str().is_empty())
            .unwrap_or_else(|| PathBuf::from(".")),
    }
}

/// Resolves a collision-free output path by checking filesystem existence.
pub fn resolve_collision_free_path(
    source_path: &Path,
    output_folder: Option<&Path>,
) -> Result<PathBuf, String> {
    let target_dir = resolve_target_dir(source_path, output_folder);
    let (base_stem, _) = compute_base_stem(source_path);

    let mut counter: u32 = 0;
    loop {
        let name = candidate_filename(&base_stem, counter);
        let candidate = target_dir.join(name);
        if !candidate.exists() {
            return Ok(candidate);
        }
        counter += 1;
        if counter > 10_000 {
            return Err(format!(
                "Collision resolution limit exceeded for '{}'",
                source_path.display()
            ));
        }
    }
}
