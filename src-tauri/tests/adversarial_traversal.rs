use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::tempdir;

use markdown_them_lib::commands::fs::{read_file_binary, save_converted_file};
use markdown_them_lib::path_resolver::{compute_base_stem, resolve_target_dir};
use markdown_them_lib::scanner::{
    collect_supported_entries, collect_supported_files, is_supported_extension,
};

#[tokio::test]
async fn test_adversarial_path_traversal_relative_parent_dots() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let root = tmp.path();

    let sub = root.join("sub");
    let inner = sub.join("inner");
    fs::create_dir_all(&inner).expect("Failed to create inner dir");

    let doc_path = inner.join("document.docx");
    fs::write(&doc_path, b"test content").expect("Failed to write doc");

    let traversal_source = inner
        .join("..")
        .join("..")
        .join("sub")
        .join("inner")
        .join("document.docx");
    assert!(traversal_source.exists());

    let bytes = read_file_binary(Some(traversal_source.to_string_lossy().to_string()), None)
        .await
        .expect("read_file_binary with relative traversal must succeed");
    assert_eq!(bytes, b"test content");

    let saved = save_converted_file(
        traversal_source.to_string_lossy().to_string(),
        None,
        "# Converted with traversal".to_string(),
    )
    .await
    .expect("save_converted_file with traversal must succeed");

    let saved_path = PathBuf::from(&saved);
    assert!(
        saved_path.exists(),
        "Saved file must exist at {}",
        saved_path.display()
    );

    let content = fs::read_to_string(&saved_path).expect("read content");
    assert_eq!(content, "# Converted with traversal");
}

#[tokio::test]
async fn test_adversarial_path_traversal_output_directory_redirection() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let source_dir = tmp.path().join("source_dir");
    let intended_out = tmp.path().join("intended_out");
    fs::create_dir_all(&source_dir).expect("create source_dir");
    fs::create_dir_all(&intended_out).expect("create intended_out");

    let source_file = source_dir.join("report.docx");
    fs::write(&source_file, b"report data").expect("write report");

    let saved = save_converted_file(
        source_file.to_string_lossy().to_string(),
        Some(intended_out.to_string_lossy().to_string()),
        "output in intended dir".to_string(),
    )
    .await
    .expect("save_converted_file with output_folder must succeed");

    assert_eq!(Path::new(&saved), intended_out.join("report.md"));
    assert!(intended_out.join("report.md").exists());
    assert!(!source_dir.join("report.md").exists());
}

#[test]
fn test_adversarial_path_traversal_stem_and_dir_boundary_cases() {
    let (stem, is_md) = compute_base_stem(Path::new(""));
    assert_eq!(stem, "converted");
    assert!(!is_md);

    let (stem, is_md) = compute_base_stem(Path::new("."));
    assert_eq!(stem, "converted");
    assert!(!is_md);

    let (stem, is_md) = compute_base_stem(Path::new(".."));
    assert_eq!(stem, "converted");
    assert!(!is_md);

    let (stem, is_md) = compute_base_stem(Path::new("...docx"));
    assert_eq!(stem, "..");
    assert!(!is_md);

    let (stem, is_md) = compute_base_stem(Path::new("../../etc/passwd"));
    assert_eq!(stem, "passwd");
    assert!(!is_md);

    let (stem, is_md) = compute_base_stem(Path::new("..\\..\\Windows\\System32\\config\\SAM"));
    assert_eq!(stem, "SAM");
    assert!(!is_md);

    assert_eq!(
        resolve_target_dir(Path::new("file.txt"), None),
        PathBuf::from(".")
    );
    assert_eq!(resolve_target_dir(Path::new(""), None), PathBuf::from("."));
    assert_eq!(
        resolve_target_dir(
            Path::new("C:/folder/file.txt"),
            Some(Path::new("D:/custom"))
        ),
        PathBuf::from("D:/custom")
    );
    assert_eq!(
        resolve_target_dir(Path::new("C:/folder/file.txt"), Some(Path::new(""))),
        PathBuf::from("C:/folder")
    );
    assert_eq!(
        resolve_target_dir(Path::new("C:/folder/file.txt"), Some(Path::new("   "))),
        PathBuf::from("   ")
    );
}

#[test]
fn test_scanner_junction_and_symlink_safety() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let root = tmp.path();

    let sub1 = root.join("sub1");
    fs::create_dir_all(&sub1).expect("Failed to create sub1");

    let doc = sub1.join("document.docx");
    fs::write(&doc, b"doc content").expect("Failed to write doc");

    #[cfg(windows)]
    {
        let junction_path = sub1.join("cycle_junction");
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/C", "mklink", "/J"])
            .arg(&junction_path)
            .arg(root);

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let files =
                    collect_supported_files(root).expect("Scanner must not loop on junction cycle");
                assert_eq!(files.len(), 1, "Only the real file should be collected");
                assert_eq!(files[0], doc);

                let _ = std::process::Command::new("cmd")
                    .args(["/C", "rmdir"])
                    .arg(&junction_path)
                    .output();
            }
        }
    }

    let files = collect_supported_files(root).expect("Scanner must complete");
    assert_eq!(files.len(), 1);
}

#[test]
fn test_scanner_deeply_nested_empty_hierarchy_no_stack_overflow() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let mut current = tmp.path().to_path_buf();

    for i in 0..40 {
        current = current.join(format!("level_{:02}", i));
    }
    fs::create_dir_all(&current).expect("create 40 nested levels");

    let found = collect_supported_files(tmp.path()).expect("scan 40 levels");
    assert!(found.is_empty(), "No files in empty hierarchy");

    let deep_file = current.join("deep.xlsx");
    fs::write(&deep_file, b"deep sheet").expect("write deep file");

    let found2 = collect_supported_files(tmp.path()).expect("scan with deep file");
    assert_eq!(found2.len(), 1);
    assert_eq!(found2[0], deep_file);

    let entries = collect_supported_entries(tmp.path()).expect("entries with deep file");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].name, "deep.xlsx");
    assert_eq!(entries[0].size, Some(10));
}

#[test]
fn test_scanner_double_extensions_and_dotfiles_filtering() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let root = tmp.path();

    let to_create = [
        ("real.docx", true),
        ("real.docx.bak", false),
        ("backup.pdf.tmp", false),
        ("script.sh.txt", true),
        ("data.exe.xlsx", true),
        (".docx", false),
        (".hidden.docx", true),
        ("no_extension", false),
        ("trailing_dot.", false),
        ("archive.v1.0.tar.gz", false),
        ("guide.MD", true),
    ];

    for (name, _) in &to_create {
        fs::write(root.join(name), b"test").expect("write test file");
    }

    let found = collect_supported_files(root).expect("collect_supported_files");
    let found_names: HashSet<String> = found
        .iter()
        .filter_map(|p| p.file_name().map(|n| n.to_string_lossy().to_string()))
        .collect();

    for (name, should_be_collected) in to_create {
        assert_eq!(
            found_names.contains(name),
            should_be_collected,
            "File '{}' collection status mismatch (expected {})",
            name,
            should_be_collected
        );
    }
}

#[test]
fn test_scanner_all_16_extensions_case_matrix() {
    let supported = [
        "docx", "doc", "pdf", "html", "htm", "xlsx", "xls", "xlm", "pptx", "odt", "odp", "ods",
        "rtf", "md", "markdown", "txt",
    ];

    for ext in supported {
        assert!(is_supported_extension(Path::new(&format!("file.{}", ext))));
        assert!(is_supported_extension(Path::new(&format!(
            "file.{}",
            ext.to_uppercase()
        ))));
    }

    let unsupported = [
        "exe", "dll", "zip", "rar", "tar", "gz", "7z", "png", "jpg", "jpeg", "gif", "mp4", "mp3",
        "rs", "ts", "js", "py", "sh", "bat", "cmd",
    ];

    for ext in unsupported {
        assert!(!is_supported_extension(Path::new(&format!("file.{}", ext))));
        assert!(!is_supported_extension(Path::new(&format!(
            "file.{}",
            ext.to_uppercase()
        ))));
    }
}
