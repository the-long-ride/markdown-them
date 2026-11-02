use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tempfile::tempdir;

use markdown_them_lib::commands::fs::{read_file_binary, save_converted_file};
use markdown_them_lib::path_resolver::candidate_filename;

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
async fn test_stress_100_concurrent_saves_same_file() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let target_dir = tmp.path().join("concurrency_100_output");
    fs::create_dir_all(&target_dir).expect("Failed to create output dir");

    let source = tmp.path().join("report.docx");
    fs::write(&source, b"original docx content").expect("Failed to write source file");

    let source_str = source.to_string_lossy().to_string();
    let out_dir_str = target_dir.to_string_lossy().to_string();

    let task_count = 100;
    let mut join_handles = Vec::with_capacity(task_count);

    for i in 0..task_count {
        let src = source_str.clone();
        let out = out_dir_str.clone();
        let payload = format!("Payload content for concurrent task #{:03}", i);

        let handle = tokio::spawn(async move {
            let result = save_converted_file(src, Some(out), payload.clone()).await;
            (i, payload, result)
        });
        join_handles.push(handle);
    }

    let mut returned_paths = Vec::new();
    let mut expected_payloads = HashSet::new();

    for handle in join_handles {
        let (i, payload, res) = handle.await.expect("Task panicked");
        let path = res.unwrap_or_else(|e| panic!("Task {} failed to save: {}", i, e));
        returned_paths.push(path);
        expected_payloads.insert(payload);
    }

    let unique_paths: HashSet<_> = returned_paths.iter().cloned().collect();
    assert_eq!(
        unique_paths.len(),
        task_count,
        "Every concurrent save must return a unique file path"
    );

    let disk_entries: Vec<PathBuf> = fs::read_dir(&target_dir)
        .expect("read_dir")
        .filter_map(|e| e.ok().map(|e| e.path()))
        .collect();

    assert_eq!(
        disk_entries.len(),
        task_count,
        "Directory must contain exactly {} files",
        task_count
    );

    for counter in 0..task_count {
        let expected_name = candidate_filename("report", counter as u32);
        let expected_file = target_dir.join(&expected_name);
        assert!(
            expected_file.exists(),
            "Expected sequential file '{}' does not exist on disk",
            expected_name
        );
    }

    let mut actual_contents = HashSet::new();
    for entry in disk_entries {
        let content = fs::read_to_string(&entry)
            .unwrap_or_else(|e| panic!("Failed to read {}: {}", entry.display(), e));
        actual_contents.insert(content);
    }

    assert_eq!(
        actual_contents, expected_payloads,
        "All 100 unique payloads must be preserved across the 100 files without corruption"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 8)]
async fn test_stress_50_concurrent_saves_markdown_source() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let target_dir = tmp.path().join("md_concurrency_output");
    fs::create_dir_all(&target_dir).expect("Failed to create output dir");

    let source = tmp.path().join("notes.md");
    fs::write(&source, b"# Original Markdown Notes").expect("Failed to write source file");

    let source_str = source.to_string_lossy().to_string();
    let out_dir_str = target_dir.to_string_lossy().to_string();

    let task_count = 50;
    let mut handles = Vec::with_capacity(task_count);

    for i in 0..task_count {
        let src = source_str.clone();
        let out = out_dir_str.clone();
        let payload = format!("Markdown revision #{}", i);

        handles.push(tokio::spawn(async move {
            let res = save_converted_file(src, Some(out), payload.clone()).await;
            (i, payload, res)
        }));
    }

    let mut returned_paths = Vec::new();

    for handle in handles {
        let (i, _payload, res) = handle.await.expect("Task panicked");
        let path = res.unwrap_or_else(|e| panic!("MD Task {} failed: {}", i, e));
        returned_paths.push(path);
    }

    let unique: HashSet<_> = returned_paths.iter().cloned().collect();
    assert_eq!(unique.len(), task_count);

    for counter in 0..task_count {
        let name = candidate_filename("notes_converted", counter as u32);
        let path = target_dir.join(name);
        assert!(path.exists(), "Expected file {:?} missing", path);
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 6)]
async fn test_stress_concurrent_binary_reads_30_tasks() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let file_path = tmp.path().join("shared_target.bin");

    let size = 4 * 1024 * 1024;
    let payload = Arc::new(vec![0xAA; size]);
    fs::write(&file_path, payload.as_slice()).expect("write shared file");

    let path_str = file_path.to_string_lossy().to_string();
    let task_count = 30;
    let mut handles = Vec::with_capacity(task_count);

    for _ in 0..task_count {
        let p = path_str.clone();
        let expected = Arc::clone(&payload);
        handles.push(tokio::spawn(async move {
            let bytes = read_file_binary(Some(p), None).await.expect("read failed");
            assert_eq!(bytes.len(), expected.len());
            assert_eq!(bytes, *expected);
        }));
    }

    for h in handles {
        h.await.expect("Concurrent reader panicked");
    }
}

#[tokio::test]
async fn test_stress_large_binary_read_25mb_byte_fidelity() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let large_file_path = tmp.path().join("large_payload.bin");

    let size: usize = 25 * 1024 * 1024;
    let mut payload = Vec::with_capacity(size);
    for i in 0..size {
        let b = ((i * 31 + 17) ^ (i >> 8)) as u8;
        payload.push(b);
    }

    fs::write(&large_file_path, &payload).expect("Failed to write 25MB test payload");

    let path_str = large_file_path.to_string_lossy().to_string();

    let read_bytes = read_file_binary(Some(path_str.clone()), None)
        .await
        .expect("Failed to read 25MB binary file");

    assert_eq!(
        read_bytes.len(),
        size,
        "Read size must match exact 25MB buffer length"
    );
    assert_eq!(
        read_bytes, payload,
        "Every byte of the 25MB file must match the original generated buffer byte-for-byte"
    );

    let read_bytes_alt = read_file_binary(None, Some(path_str))
        .await
        .expect("Failed to read 25MB binary via path arg");

    assert_eq!(read_bytes_alt.len(), size);
}

#[tokio::test]
async fn test_read_file_binary_adversarial_arguments() {
    let tmp = tempdir().expect("Failed to create tempdir");

    let res = read_file_binary(None, None).await;
    assert!(res.is_err());
    assert!(res
        .unwrap_err()
        .contains("Missing required file path argument"));

    let dir_path = tmp.path().to_string_lossy().to_string();
    let res = read_file_binary(Some(dir_path), None).await;
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("Path is a directory, not a file"));

    let non_existent = tmp.path().join("missing.txt").to_string_lossy().to_string();
    let res = read_file_binary(Some(non_existent), None).await;
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("File not found"));

    let empty_file = tmp.path().join("zero.dat");
    fs::write(&empty_file, b"").expect("write zero");
    let res = read_file_binary(Some(empty_file.to_string_lossy().to_string()), None)
        .await
        .expect("read zero");
    assert!(res.is_empty());
}
