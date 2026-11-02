use std::fs;
use std::path::Path;
use tempfile::tempdir;

use markdown_them_lib::commands::fs::{read_file_binary, save_converted_file};
use markdown_them_lib::path_resolver::{
    candidate_filename, compute_base_stem, resolve_collision_free_path,
};

#[tokio::test]
async fn test_collision_resolution_with_150_preexisting_files() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let target_dir = tmp.path().join("heavy_collision");
    fs::create_dir_all(&target_dir).expect("Failed to create target_dir");

    let source = tmp.path().join("benchmark.docx");
    fs::write(&source, b"benchmark payload").expect("Failed to write source");

    fs::write(target_dir.join("benchmark.md"), b"version 0").expect("Failed to write benchmark.md");
    for i in 1..=149 {
        let name = format!("benchmark ({}).md", i);
        fs::write(target_dir.join(&name), format!("version {}", i))
            .unwrap_or_else(|e| panic!("Failed to write {}: {}", name, e));
    }

    let saved = save_converted_file(
        source.to_string_lossy().to_string(),
        Some(target_dir.to_string_lossy().to_string()),
        "version 150 content".to_string(),
    )
    .await
    .expect("save_converted_file should resolve collision past 150 files");

    let expected = target_dir.join("benchmark (150).md");
    assert_eq!(Path::new(&saved), expected);
    assert!(expected.exists(), "benchmark (150).md must exist");
    assert_eq!(
        fs::read_to_string(&expected).expect("read content"),
        "version 150 content"
    );

    assert_eq!(
        fs::read_to_string(target_dir.join("benchmark.md")).expect("read v0"),
        "version 0"
    );
    assert_eq!(
        fs::read_to_string(target_dir.join("benchmark (149).md")).expect("read v149"),
        "version 149"
    );
}

#[test]
fn test_collision_resolution_limit_handling() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let dummy_source = tmp.path().join("test.docx");

    assert_eq!(candidate_filename("test", 10_000), "test (10000).md");
    assert_eq!(candidate_filename("test", 10_001), "test (10001).md");

    let target_dir = tmp.path().join("limit_test");
    fs::create_dir_all(&target_dir).expect("create dir");

    let resolved = resolve_collision_free_path(&dummy_source, Some(&target_dir))
        .expect("resolve_collision_free_path should succeed");
    assert_eq!(resolved, target_dir.join("test.md"));
}

#[tokio::test]
async fn test_collision_resolution_when_first_candidate_is_readonly() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let target_dir = tmp.path().join("readonly_collision");
    fs::create_dir_all(&target_dir).expect("Failed to create target_dir");

    let source = tmp.path().join("contract.docx");
    fs::write(&source, b"contract").expect("Failed to write source");

    let first_file = target_dir.join("contract.md");
    fs::write(&first_file, b"original locked contract").expect("Failed to write first_file");

    let mut perms = fs::metadata(&first_file).expect("metadata").permissions();
    perms.set_readonly(true);
    fs::set_permissions(&first_file, perms).expect("set_readonly");

    let saved = save_converted_file(
        source.to_string_lossy().to_string(),
        Some(target_dir.to_string_lossy().to_string()),
        "second revision of contract".to_string(),
    )
    .await
    .expect("save should succeed despite first candidate being read-only");

    let expected = target_dir.join("contract (1).md");
    assert_eq!(Path::new(&saved), expected);
    assert!(expected.exists());
    assert_eq!(
        fs::read_to_string(&expected).expect("read content"),
        "second revision of contract"
    );

    let mut perms = fs::metadata(&first_file).expect("metadata").permissions();
    perms.set_readonly(false);
    let _ = fs::set_permissions(&first_file, perms);
}

#[tokio::test]
async fn test_save_converted_file_readonly_directory_fails_cleanly() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let blocker_file = tmp.path().join("not_a_directory");
    fs::write(&blocker_file, b"I am a file, not a directory").expect("Failed to write blocker");

    let source = tmp.path().join("sample.docx");
    fs::write(&source, b"sample").expect("Failed to write source");

    let impossible_output_dir = blocker_file.join("subfolder");

    let res = save_converted_file(
        source.to_string_lossy().to_string(),
        Some(impossible_output_dir.to_string_lossy().to_string()),
        "content".to_string(),
    )
    .await;

    assert!(res.is_err(), "Must fail when directory cannot be created");
    let err = res.unwrap_err();
    assert!(
        err.contains("Failed to create output directory"),
        "Expected directory creation error, got: {}",
        err
    );
}

#[tokio::test]
async fn test_save_converted_file_invalid_windows_filename_characters() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let target_dir = tmp.path().join("invalid_chars");
    fs::create_dir_all(&target_dir).expect("Failed to create target_dir");

    let invalid_source = "invalid*name?.docx";

    let res = save_converted_file(
        invalid_source.to_string(),
        Some(target_dir.to_string_lossy().to_string()),
        "content".to_string(),
    )
    .await;

    println!("res is: {:?}", res);
    #[cfg(windows)]
    {
        assert!(
            res.is_err(),
            "Invalid characters must fail on Windows. Got: {:?}",
            res
        );
        let err = res.unwrap_err();
        assert!(
            err.contains("Failed to create file")
                || err.contains("Failed to create output directory"),
            "Expected failure message, got: {}",
            err
        );
    }
}

#[test]
fn test_compute_base_stem_adversarial_matrix() {
    let (stem, is_md) = compute_base_stem(Path::new(".docx"));
    assert_eq!(stem, ".docx");
    assert!(!is_md);

    let (stem, is_md) = compute_base_stem(Path::new(".hidden.docx"));
    assert_eq!(stem, ".hidden");
    assert!(!is_md);

    let (stem, is_md) = compute_base_stem(Path::new(".hidden.md"));
    assert_eq!(stem, ".hidden_converted");
    assert!(is_md);

    let (stem, is_md) = compute_base_stem(Path::new("notes.md"));
    assert_eq!(stem, "notes_converted");
    assert!(is_md);

    let (stem, is_md) = compute_base_stem(Path::new("guide.MARKDOWN"));
    assert_eq!(stem, "guide_converted");
    assert!(is_md);

    let (stem, is_md) = compute_base_stem(Path::new("specs.Markdown"));
    assert_eq!(stem, "specs_converted");
    assert!(is_md);

    let (stem, is_md) = compute_base_stem(Path::new("final.version.1.0.odp"));
    assert_eq!(stem, "final.version.1.0");
    assert!(!is_md);

    let (stem, is_md) = compute_base_stem(Path::new("Báo cáo tài chính 2026 📊.docx"));
    assert_eq!(stem, "Báo cáo tài chính 2026 📊");
    assert!(!is_md);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
async fn test_concurrent_save_and_read_stress_under_load() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let target_dir = tmp.path().join("mixed_stress");
    fs::create_dir_all(&target_dir).expect("Failed to create target_dir");

    let source = tmp.path().join("base.docx");
    fs::write(&source, b"base source content").expect("Failed to write base source");

    let source_str = source.to_string_lossy().to_string();
    let out_dir_str = target_dir.to_string_lossy().to_string();

    let mut handles = Vec::new();

    for i in 0..30 {
        let src = source_str.clone();
        let out = out_dir_str.clone();
        let payload = format!("Content from worker #{:02}", i);
        handles.push(tokio::spawn(async move {
            let res = save_converted_file(src, Some(out), payload.clone()).await;
            assert!(res.is_ok(), "Worker save failed");
            let path = res.unwrap();

            let read_bytes = read_file_binary(Some(path.clone()), None)
                .await
                .expect("read back failed");
            assert_eq!(
                String::from_utf8(read_bytes).expect("utf8"),
                payload,
                "Content mismatch for worker file {}",
                path
            );
        }));
    }

    for h in handles {
        h.await.expect("Task panicked");
    }

    let files: Vec<_> = fs::read_dir(&target_dir)
        .expect("read_dir")
        .filter_map(|e| e.ok())
        .collect();
    assert_eq!(files.len(), 30);
}
