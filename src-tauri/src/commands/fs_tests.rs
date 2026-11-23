#[cfg(unix)]
use super::read_file_binary;
use super::{save_converted_file, save_selected_markdown, write_markdown};
use crate::path_resolver::{candidate_filename, resolve_collision_free_path};
use std::fs;
use std::io;
#[cfg(unix)]
use std::os::unix::net::UnixListener;
use std::path::Path;
use std::pin::Pin;
use std::task::{Context, Poll};
use tauri_plugin_dialog::FilePath;
use tempfile::tempdir;
use tokio::io::AsyncWrite;

#[tokio::test]
async fn selected_export_can_cancel_or_replace_an_existing_file() {
    assert_eq!(save_selected_markdown(None, "unused").await, Ok(None));
    let dir = tempdir().unwrap();
    let output = dir.path().join("new").join("export.md");
    for markdown in ["# Original text", "更新"] {
        assert_eq!(
            save_selected_markdown(Some(output.clone().into()), markdown).await,
            Ok(Some(output.to_string_lossy().into_owned()))
        );
        assert_eq!(fs::read_to_string(&output).unwrap(), markdown);
    }
}

#[tokio::test]
async fn selected_export_reports_invalid_destinations_and_io_errors() {
    let remote = FilePath::Url("https://example.invalid/export.md".parse().unwrap());
    assert_eq!(
        save_selected_markdown(Some(remote), "content").await,
        Err("Invalid destination path selected".to_string())
    );

    let dir = tempdir().unwrap();
    let blocker = dir.path().join("file");
    fs::write(&blocker, b"not a directory").unwrap();
    let nested = save_selected_markdown(Some(blocker.join("export.md").into()), "content")
        .await
        .unwrap_err();
    assert!(nested.starts_with("Failed to create directory"));
    assert_eq!(fs::read(&blocker).unwrap(), b"not a directory");

    let directory = save_selected_markdown(Some(dir.path().to_path_buf().into()), "content")
        .await
        .unwrap_err();
    assert!(directory.starts_with("Failed to save markdown"));
}

enum FailingWriter {
    Write,
    Flush,
}

impl AsyncWrite for FailingWriter {
    fn poll_write(
        self: Pin<&mut Self>,
        _: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        Poll::Ready(match *self {
            Self::Write => Err(io::Error::other("write failed")),
            Self::Flush => Ok(buf.len()),
        })
    }

    fn poll_flush(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Err(io::Error::other("flush failed")))
    }

    fn poll_shutdown(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }
}

#[tokio::test]
async fn write_markdown_distinguishes_write_and_flush_failures() {
    let path = Path::new("export.md");
    assert_eq!(
        write_markdown(&mut FailingWriter::Write, path, "content").await,
        Err("Failed to write content to 'export.md': write failed".to_string())
    );
    assert_eq!(
        write_markdown(&mut FailingWriter::Flush, path, "content").await,
        Err("Failed to flush content to 'export.md': flush failed".to_string())
    );
}

#[tokio::test]
async fn conversion_cannot_create_a_file_with_a_nul_in_its_name() {
    let dir = tempdir().unwrap();
    let result = save_converted_file(
        "not\0valid.docx".to_string(),
        Some(dir.path().to_string_lossy().into_owned()),
        "content".to_string(),
    )
    .await
    .unwrap_err();
    assert!(result.starts_with("Failed to create file"));
    assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
}

#[cfg(unix)]
#[tokio::test]
async fn read_reports_when_an_existing_path_cannot_be_read_as_a_file() {
    let dir = tempdir().unwrap();
    let socket = dir.path().join("file.sock");
    let _listener = UnixListener::bind(&socket).unwrap();
    let error = read_file_binary(Some(socket.to_string_lossy().into_owned()), None)
        .await
        .unwrap_err();
    assert!(error.starts_with("Failed to read file"));
}

#[tokio::test]
async fn exhausted_collision_resolvers_do_not_overwrite_any_existing_file() {
    let dir = tempdir().unwrap();
    let source = dir.path().join("report.docx");
    for counter in 0..=10_000 {
        fs::write(
            dir.path().join(candidate_filename("report", counter)),
            b"existing",
        )
        .unwrap();
    }
    let error = resolve_collision_free_path(&source, None).unwrap_err();
    assert!(error.starts_with("Collision resolution limit exceeded"));

    let error = save_converted_file(source.to_string_lossy().into_owned(), None, "new".into())
        .await
        .unwrap_err();
    assert!(error.starts_with("Collision resolution exceeded limit"));
    assert_eq!(fs::read(dir.path().join("report.md")).unwrap(), b"existing");
    assert_eq!(
        fs::read(dir.path().join("report (10000).md")).unwrap(),
        b"existing"
    );
    assert!(!dir.path().join("report (10001).md").exists());
}
