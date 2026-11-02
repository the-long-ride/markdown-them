use std::fs;
use std::path::PathBuf;
use tempfile::tempdir;

use markdown_them_lib::commands::dialogs::file_path_to_path_buf;
use markdown_them_lib::commands::fs::{
    is_trusted_external_url, read_file_binary, save_converted_file,
};
use markdown_them_lib::scanner::collect_supported_entries;
use tauri_plugin_dialog::FilePath;

#[tokio::test]
async fn test_read_file_binary_null_byte_rejection() {
    let invalid_path = "some\0null\0byte\0file.docx";
    let res = read_file_binary(Some(invalid_path.to_string()), None).await;
    assert!(res.is_err());
    let err = res.unwrap_err();
    assert!(
        err.contains("File not found") || err.contains("Failed to read file"),
        "Expected file error on null byte path, got: {}",
        err
    );
}

#[tokio::test]
async fn test_read_file_binary_reserved_device_names() {
    let reserved_names = ["CON.docx", "PRN.pdf", "AUX.xlsx", "NUL.txt", "COM1.html"];

    for name in reserved_names {
        let res = read_file_binary(Some(name.to_string()), None).await;
        assert!(res.is_err());
    }
}

#[tokio::test]
async fn test_extreme_binary_read_30mb_byte_fidelity() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let file_path = tmp.path().join("extreme_30mb.bin");

    let size: usize = 30 * 1024 * 1024;
    let mut payload = Vec::with_capacity(size);
    for i in 0..size {
        payload.push(((i * 13 + 7) ^ (i >> 5)) as u8);
    }
    fs::write(&file_path, &payload).expect("Failed to write 30MB test payload");

    let read_bytes = read_file_binary(Some(file_path.to_string_lossy().to_string()), None)
        .await
        .expect("read 30MB binary file failed");

    assert_eq!(read_bytes.len(), size, "Length must be exactly 30MB");
    assert_eq!(
        read_bytes, payload,
        "Bytes must match original buffer exactly"
    );
}

#[tokio::test]
async fn test_zero_byte_fidelity_across_all_apis() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let empty_file = tmp.path().join("empty.docx");
    fs::write(&empty_file, b"").expect("write empty file");

    let bytes = read_file_binary(Some(empty_file.to_string_lossy().to_string()), None)
        .await
        .expect("read zero byte file");
    assert!(bytes.is_empty());

    let saved = save_converted_file(
        empty_file.to_string_lossy().to_string(),
        None,
        "".to_string(),
    )
    .await
    .expect("save empty markdown");

    let saved_path = PathBuf::from(&saved);
    assert!(saved_path.exists());
    assert_eq!(fs::metadata(&saved_path).unwrap().len(), 0);

    let entries = collect_supported_entries(tmp.path()).expect("scan empty file");
    let empty_entry = entries.iter().find(|e| e.name == "empty.docx");
    assert!(empty_entry.is_some());
    assert_eq!(empty_entry.unwrap().size, Some(0));
}

#[test]
fn test_dialog_file_path_to_path_buf_adversarial_conversions() {
    let p1 = FilePath::Path(PathBuf::from("C:\\Users\\test\\doc.docx"));
    assert_eq!(
        file_path_to_path_buf(p1),
        Some(PathBuf::from("C:\\Users\\test\\doc.docx"))
    );

    let p2 = FilePath::Path(PathBuf::from(""));
    assert_eq!(file_path_to_path_buf(p2), Some(PathBuf::from("")));

    let p3 = FilePath::Path(PathBuf::from("../../some/relative/doc.xlsx"));
    assert_eq!(
        file_path_to_path_buf(p3),
        Some(PathBuf::from("../../some/relative/doc.xlsx"))
    );
}

#[test]
fn test_url_whitelist_adversarial_protocols_and_spoofs() {
    assert!(is_trusted_external_url("https://github.com/the-long-ride"));
    assert!(is_trusted_external_url(
        "https://github.com/the-long-ride/markdown-them"
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
    assert!(is_trusted_external_url(
        "https://the-long-ride.github.io/markdown-them"
    ));
    assert!(is_trusted_external_url(
        "https://the-long-ride.github.io/markdown-them/docs/index.html"
    ));

    assert!(is_trusted_external_url(
        "   https://github.com/the-long-ride   "
    ));
    assert!(is_trusted_external_url(
        "\n\thttps://the-long-ride.github.io/markdown-them\r\n"
    ));

    assert!(!is_trusted_external_url(""));
    assert!(!is_trusted_external_url("   "));
    assert!(!is_trusted_external_url("javascript:alert(1)"));
    assert!(!is_trusted_external_url("file:///etc/shadow"));
    assert!(!is_trusted_external_url(
        "file:///C:/Windows/System32/cmd.exe"
    ));
    assert!(!is_trusted_external_url(
        "data:text/html,<script>alert(1)</script>"
    ));
    assert!(!is_trusted_external_url(
        "http://the-long-ride.github.io/markdown-them"
    ));
    assert!(!is_trusted_external_url("ftp://github.com/the-long-ride"));
    assert!(!is_trusted_external_url(
        "blob:https://github.com/the-long-ride"
    ));
    assert!(!is_trusted_external_url("gopher://the-long-ride.github.io"));
    assert!(!is_trusted_external_url("https://evil-attacker.com"));
    assert!(!is_trusted_external_url(
        "https://github.com/other-user/markdown-them"
    ));
}
