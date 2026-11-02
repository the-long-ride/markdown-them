use std::fs;
use std::path::Path;
use tempfile::tempdir;

use markdown_them_lib::commands::fs::{
    is_trusted_external_url, open_path, read_file_binary, save_converted_file,
};

#[tokio::test]
async fn test_read_file_binary_exact_bytes() {
    let tmp = tempdir().expect("tempdir");
    let file_path = tmp.path().join("sample.bin");
    let payload = vec![
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0xFF, 0xFE,
    ];
    fs::write(&file_path, &payload).expect("write file");

    let path_str = file_path.to_string_lossy().to_string();

    // With file_path parameter
    let bytes1 = read_file_binary(Some(path_str.clone()), None)
        .await
        .expect("read 1");
    assert_eq!(bytes1, payload);

    // With path parameter
    let bytes2 = read_file_binary(None, Some(path_str))
        .await
        .expect("read 2");
    assert_eq!(bytes2, payload);
}

#[tokio::test]
async fn test_read_file_binary_empty_file() {
    let tmp = tempdir().expect("tempdir");
    let file_path = tmp.path().join("empty.txt");
    fs::write(&file_path, b"").expect("write empty file");

    let bytes = read_file_binary(Some(file_path.to_string_lossy().to_string()), None)
        .await
        .expect("read empty");
    assert!(bytes.is_empty());
}

#[tokio::test]
async fn test_read_file_binary_not_found_error() {
    let non_existent = "F:/non_existent_file_12345.docx";
    let res = read_file_binary(Some(non_existent.to_string()), None).await;
    assert!(res.is_err());
    let err = res.unwrap_err();
    assert!(err.contains("File not found"));
}

#[tokio::test]
async fn test_read_file_binary_directory_fails() {
    let tmp = tempdir().expect("tempdir");
    let dir_path = tmp.path().to_string_lossy().to_string();
    let res = read_file_binary(Some(dir_path), None).await;
    assert!(res.is_err());
    let err = res.unwrap_err();
    assert!(err.contains("Path is a directory, not a file"));
}

#[tokio::test]
async fn test_save_converted_file_default_destination() {
    let tmp = tempdir().expect("tempdir");
    let source_path = tmp.path().join("article.docx");
    fs::write(&source_path, b"source").expect("write source");

    let saved_path = save_converted_file(
        source_path.to_string_lossy().to_string(),
        None,
        "# Converted Article".to_string(),
    )
    .await
    .expect("save converted");

    let expected_path = tmp.path().join("article.md");
    assert_eq!(Path::new(&saved_path), expected_path);
    assert!(expected_path.exists());

    let content = fs::read_to_string(expected_path).expect("read content");
    assert_eq!(content, "# Converted Article");
}

#[tokio::test]
async fn test_save_converted_file_sequential_collision_resolution() {
    let tmp = tempdir().expect("tempdir");
    let out_dir = tmp.path().join("output");

    let source = tmp.path().join("document.docx");
    fs::write(&source, b"doc").expect("write doc");

    let out_dir_str = Some(out_dir.to_string_lossy().to_string());

    // 1st save -> document.md
    let path1 = save_converted_file(
        source.to_string_lossy().to_string(),
        out_dir_str.clone(),
        "Version 1".to_string(),
    )
    .await
    .expect("save 1");
    assert_eq!(Path::new(&path1), out_dir.join("document.md"));

    // 2nd save -> document (1).md
    let path2 = save_converted_file(
        source.to_string_lossy().to_string(),
        out_dir_str.clone(),
        "Version 2".to_string(),
    )
    .await
    .expect("save 2");
    assert_eq!(Path::new(&path2), out_dir.join("document (1).md"));

    // 3rd save -> document (2).md
    let path3 = save_converted_file(
        source.to_string_lossy().to_string(),
        out_dir_str.clone(),
        "Version 3".to_string(),
    )
    .await
    .expect("save 3");
    assert_eq!(Path::new(&path3), out_dir.join("document (2).md"));

    // Verify contents remain distinct
    assert_eq!(fs::read_to_string(&path1).unwrap(), "Version 1");
    assert_eq!(fs::read_to_string(&path2).unwrap(), "Version 2");
    assert_eq!(fs::read_to_string(&path3).unwrap(), "Version 3");
}

#[tokio::test]
async fn test_save_converted_file_markdown_source_suffix() {
    let tmp = tempdir().expect("tempdir");
    let md_source = tmp.path().join("README.md");
    fs::write(&md_source, b"# Original").expect("write source");

    let saved = save_converted_file(
        md_source.to_string_lossy().to_string(),
        None,
        "# Converted".to_string(),
    )
    .await
    .expect("save md");

    let expected = tmp.path().join("README_converted.md");
    assert_eq!(Path::new(&saved), expected);
    assert!(expected.exists());

    // Second save resolves collision on converted name: README_converted (1).md
    let saved2 = save_converted_file(
        md_source.to_string_lossy().to_string(),
        None,
        "# Converted 2".to_string(),
    )
    .await
    .expect("save md 2");

    let expected2 = tmp.path().join("README_converted (1).md");
    assert_eq!(Path::new(&saved2), expected2);
    assert!(expected2.exists());
}

#[tokio::test]
async fn test_save_converted_file_nested_directory_creation() {
    let tmp = tempdir().expect("tempdir");
    let deep_output = tmp.path().join("level1").join("level2").join("level3");

    let source = tmp.path().join("test.txt");
    fs::write(&source, b"test").expect("write source");

    let saved = save_converted_file(
        source.to_string_lossy().to_string(),
        Some(deep_output.to_string_lossy().to_string()),
        "Content".to_string(),
    )
    .await
    .expect("save deep");

    assert!(Path::new(&saved).exists());
    assert_eq!(Path::new(&saved), deep_output.join("test.md"));
}

#[tokio::test]
async fn test_save_converted_file_unicode_and_emojis() {
    let tmp = tempdir().expect("tempdir");
    let source = tmp.path().join("Báo cáo tài chính 2026 📊.docx");
    fs::write(&source, b"unicode").expect("write source");

    let markdown =
        "# Báo cáo tài chính 🎉\n\nNội dung tiếng Việt có dấu và biểu tượng cảm xúc: 🚀✨";

    let saved = save_converted_file(
        source.to_string_lossy().to_string(),
        None,
        markdown.to_string(),
    )
    .await
    .expect("save unicode");

    let content = fs::read_to_string(&saved).expect("read unicode");
    assert_eq!(content, markdown);
    assert!(saved.contains("Báo cáo tài chính 2026 📊.md"));
}

#[test]
fn test_open_external_security_whitelist() {
    // Trusted URLs
    assert!(is_trusted_external_url("https://github.com/the-long-ride"));
    assert!(is_trusted_external_url(
        "https://github.com/the-long-ride/markdown-them"
    ));
    assert!(is_trusted_external_url(
        "https://github.com/the-long-ride/markdown-them/releases/tag/v1.3.2"
    ));
    assert!(is_trusted_external_url(
        "https://open-vsx.org/extension/the-long-ride/markdown-them"
    ));
    assert!(is_trusted_external_url(
        "https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them"
    ));
    assert!(is_trusted_external_url(
        "https://www.npmjs.com/package/@the-long-ride/markdown-them"
    ));
    assert!(is_trusted_external_url("https://the-long-ride.github.io/"));
    assert!(is_trusted_external_url(
        "https://the-long-ride.github.io/markdown-them"
    ));
    assert!(is_trusted_external_url(
        "https://the-long-ride.github.io/markdown-them/#/privacy"
    ));

    // Untrusted URLs
    assert!(!is_trusted_external_url("https://evil.com"));
    assert!(!is_trusted_external_url("http://malicious-site.org"));
    assert!(!is_trusted_external_url(
        "file:///C:/Windows/System32/cmd.exe"
    ));
    assert!(!is_trusted_external_url("javascript:alert(1)"));
    assert!(!is_trusted_external_url("ftp://example.com/file"));
}

#[test]
fn test_open_path_validation() {
    assert!(open_path("".to_string()).is_err());
    assert!(open_path("   ".to_string()).is_err());
    assert!(open_path("non_existent_folder_xyz_12345/non_existent.md".to_string()).is_err());
}
