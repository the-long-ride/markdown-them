use std::fs;
use std::path::{Path, PathBuf};
use tempfile::tempdir;

use markdown_them_lib::commands::fs::{is_trusted_external_url, save_converted_file};
use markdown_them_lib::scanner::{
    collect_supported_entries, collect_supported_files, is_supported_extension,
};

#[tokio::test]
async fn test_save_converted_file_deep_uncreated_output_directory() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let deep_dir = tmp.path().join("a").join("b").join("c").join("d").join("e");
    assert!(!deep_dir.exists());

    let source = tmp.path().join("sample.docx");
    fs::write(&source, b"test").expect("write test");

    let saved_path = save_converted_file(
        source.to_string_lossy().to_string(),
        Some(deep_dir.to_string_lossy().to_string()),
        "deep content".to_string(),
    )
    .await
    .expect("save deep");

    assert!(deep_dir.exists());
    assert!(Path::new(&saved_path).exists());
    assert_eq!(
        fs::read_to_string(&saved_path).expect("read"),
        "deep content"
    );
}

#[tokio::test]
async fn test_save_converted_file_whitespace_output_folder_fallback() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let source = tmp.path().join("doc.docx");
    fs::write(&source, b"source").expect("write");

    let saved = save_converted_file(
        source.to_string_lossy().to_string(),
        Some("   \t\n  ".to_string()),
        "fallback content".to_string(),
    )
    .await
    .expect("save with whitespace folder");

    let expected = tmp.path().join("doc.md");
    assert_eq!(Path::new(&saved), expected);
    assert!(expected.exists());
}

#[test]
fn test_stress_deeply_nested_directory_traversal_30_levels() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let mut current_dir = tmp.path().to_path_buf();

    let depth = 30;
    let mut expected_files = Vec::new();

    for i in 0..depth {
        current_dir = current_dir.join(format!("level_{:02}", i));
        fs::create_dir_all(&current_dir).expect("Failed to create nested directory");

        let ext = match i % 4 {
            0 => "docx",
            1 => "xlsx",
            2 => "pdf",
            _ => "md",
        };
        let file_name = format!("document_at_level_{:02}.{}", i, ext);
        let file_path = current_dir.join(&file_name);
        fs::write(&file_path, format!("Content at level {}", i)).expect("Failed to write file");
        expected_files.push(file_path);

        fs::write(current_dir.join("ignore.bin"), b"binary noise").expect("noise");
        fs::write(current_dir.join(".DS_Store"), b"metadata").expect("noise");
        let empty_sub = current_dir.join("empty_folder");
        fs::create_dir_all(&empty_sub).expect("empty dir");
    }

    let found = collect_supported_files(tmp.path()).expect("collect_supported_files failed");
    assert_eq!(
        found.len(),
        depth,
        "Scanner should find exactly {} supported files across {} levels",
        depth,
        depth
    );

    let entries = collect_supported_entries(tmp.path()).expect("collect_supported_entries failed");
    assert_eq!(entries.len(), depth);

    for entry in entries {
        assert!(entry.size.is_some());
        assert!(entry.size.unwrap() > 0);
        assert!(is_supported_extension(Path::new(&entry.path)));
    }
}

#[test]
fn test_stress_special_characters_and_unicode_traversal() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let root = tmp.path();

    let dirs = [
        root.join("Asian Languages 日本語 繁體中文 한국어"),
        root.join("Vietnamese Tiếng Việt có dấu và ký tự đặc biệt"),
        root.join("Symbols [Draft] (Final) #1 & 2 + 100%!"),
        root.join("Emojis 📁 Project ✨ 2026 🚀"),
        root.join("Spaces   Multiple   Spaces   In   Name"),
    ];

    for d in &dirs {
        fs::create_dir_all(d).expect("create dir with special characters");
    }

    let test_files: Vec<(PathBuf, &[u8])> = vec![
        (
            dirs[0].join("仕様書_version1.docx"),
            b"docx content".as_slice(),
        ),
        (dirs[0].join("報表_2026.xlsx"), b"xlsx content".as_slice()),
        (
            dirs[1].join("Báo cáo tài chính quý 3 năm 2026.pdf"),
            b"pdf content".as_slice(),
        ),
        (
            dirs[1].join("Hướng dẫn sử dụng hệ thống.odt"),
            b"odt content".as_slice(),
        ),
        (
            dirs[2].join("Slide #1 & Important [Final].pptx"),
            b"pptx content".as_slice(),
        ),
        (
            dirs[2].join("Data (Archived) + Extra.ods"),
            b"ods content".as_slice(),
        ),
        (
            dirs[3].join("🎉_celebration_plan.md"),
            b"markdown content".as_slice(),
        ),
        (
            dirs[3].join("📊_presentation_metrics.odp"),
            b"odp content".as_slice(),
        ),
        (
            dirs[4].join("Spaced   Out   File   Name.txt"),
            b"txt content".as_slice(),
        ),
        (
            dirs[4].join("MiXeD.CaSe.ExTeNsIoN.HtMl"),
            b"html content".as_slice(),
        ),
        (
            root.join(".hidden_supported_doc.docx"),
            b"hidden docx".as_slice(),
        ),
    ];

    for (p, data) in &test_files {
        fs::write(p, data).unwrap_or_else(|e| panic!("Failed to write {}: {}", p.display(), e));
    }

    let noise_files = [
        dirs[0].join("program.exe"),
        dirs[1].join("image.png"),
        dirs[2].join("archive.zip"),
        dirs[3].join(".env"),
        dirs[4].join("LICENSE"),
        dirs[4].join("README"),
        root.join(".DS_Store"),
    ];

    for p in &noise_files {
        fs::write(p, b"noise").expect("write noise");
    }

    let found = collect_supported_files(root).expect("collect_supported_files");
    assert_eq!(
        found.len(),
        test_files.len(),
        "Must match exactly {} supported files, but found {}",
        test_files.len(),
        found.len()
    );

    let entries = collect_supported_entries(root).expect("collect_supported_entries");
    assert_eq!(entries.len(), test_files.len());

    for entry in &entries {
        let p = Path::new(&entry.path);
        assert!(p.exists(), "File '{}' must exist on disk", entry.path);
        assert!(
            is_supported_extension(p),
            "File '{}' must have a supported extension",
            entry.path
        );
    }
}

#[test]
fn test_scanner_edge_cases_and_invalid_inputs() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let empty_dir = tmp.path().join("empty_dir");
    fs::create_dir_all(&empty_dir).expect("create empty dir");

    let files = collect_supported_files(&empty_dir).expect("empty dir scan");
    assert!(files.is_empty());
    let entries = collect_supported_entries(&empty_dir).expect("empty dir entries");
    assert!(entries.is_empty());

    let non_existent = tmp.path().join("does_not_exist_xyz");
    let err = collect_supported_files(&non_existent).unwrap_err();
    assert!(err.contains("Directory does not exist"));

    let single_file = tmp.path().join("standalone.docx");
    fs::write(&single_file, b"content").expect("write file");
    let err = collect_supported_files(&single_file).unwrap_err();
    assert!(err.contains("Path is not a directory"));

    let zero_byte_pdf = empty_dir.join("empty.pdf");
    fs::write(&zero_byte_pdf, b"").expect("write zero byte");
    let entries = collect_supported_entries(&empty_dir).expect("scan with zero byte");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].name, "empty.pdf");
    assert_eq!(entries[0].size, Some(0));
}

#[test]
fn test_symlink_loop_safety() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let root = tmp.path();
    let sub = root.join("sub");
    fs::create_dir_all(&sub).expect("create sub");
    fs::write(sub.join("doc.docx"), b"docx").expect("write doc");

    #[cfg(windows)]
    {
        use std::os::windows::fs::symlink_dir;
        let loop_link = sub.join("loop_link");
        match symlink_dir(root, &loop_link) {
            Ok(_) => {
                let files = collect_supported_files(root).expect("Must not loop infinitely");
                assert_eq!(files.len(), 1);
            }
            Err(_) => {
                let files = collect_supported_files(root).expect("Traversal must succeed");
                assert_eq!(files.len(), 1);
            }
        }
    }
}

#[test]
fn test_adversarial_url_whitelist_security() {
    assert!(is_trusted_external_url("https://github.com/the-long-ride"));
    assert!(is_trusted_external_url(
        "https://github.com/the-long-ride/markdown-them"
    ));
    assert!(is_trusted_external_url(
        "https://the-long-ride.github.io/markdown-them"
    ));

    assert!(!is_trusted_external_url("javascript:alert(1)"));
    assert!(!is_trusted_external_url("file:///etc/passwd"));
    assert!(!is_trusted_external_url(
        "file:///C:/Windows/System32/cmd.exe"
    ));
    assert!(!is_trusted_external_url(
        "data:text/html,<script>evil()</script>"
    ));
    assert!(!is_trusted_external_url(
        "ftp://the-long-ride.github.io/malware"
    ));

    assert!(!is_trusted_external_url("https://attacker-domain.com"));
    assert!(!is_trusted_external_url(
        "https://github.com.evil.com/the-long-ride"
    ));

    let matches_prefix_without_slash =
        is_trusted_external_url("https://github.com/the-long-ride-malicious");
    println!(
        "Observation on prefix boundary for 'https://github.com/the-long-ride-malicious': {}",
        matches_prefix_without_slash
    );
}
