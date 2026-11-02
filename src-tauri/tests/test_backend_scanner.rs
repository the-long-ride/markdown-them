use std::fs;
use std::path::Path;
use tempfile::tempdir;

use markdown_them_lib::path_resolver::{
    candidate_filename, compute_base_stem, resolve_collision_free_path, resolve_target_dir,
};
use markdown_them_lib::scanner::{
    collect_supported_entries, collect_supported_files, is_supported_extension,
    SUPPORTED_EXTENSIONS,
};

#[test]
fn test_supported_extensions_count_and_content() {
    assert_eq!(SUPPORTED_EXTENSIONS.len(), 16);
    let expected = [
        "docx", "doc", "pdf", "html", "htm", "xlsx", "xls", "xlm", "pptx", "odt", "odp", "ods",
        "rtf", "md", "markdown", "txt",
    ];
    for ext in expected {
        assert!(
            SUPPORTED_EXTENSIONS.contains(&ext),
            "Expected extension '{}' in SUPPORTED_EXTENSIONS",
            ext
        );
    }
}

#[test]
fn test_is_supported_extension_case_insensitivity() {
    assert!(is_supported_extension(Path::new("doc.docx")));
    assert!(is_supported_extension(Path::new("DOC.DOCX")));
    assert!(is_supported_extension(Path::new("SHEET.XLSX")));
    assert!(is_supported_extension(Path::new("presentation.Pptx")));
    assert!(is_supported_extension(Path::new("document.ODT")));
    assert!(is_supported_extension(Path::new("book.PDF")));
    assert!(is_supported_extension(Path::new("index.HTML")));
    assert!(is_supported_extension(Path::new("page.Htm")));
    assert!(is_supported_extension(Path::new("README.MD")));
    assert!(is_supported_extension(Path::new("notes.MARKDOWN")));
    assert!(is_supported_extension(Path::new("log.TXT")));

    // Unsupported extensions
    assert!(!is_supported_extension(Path::new("program.exe")));
    assert!(!is_supported_extension(Path::new("image.png")));
    assert!(!is_supported_extension(Path::new("archive.zip")));
    assert!(!is_supported_extension(Path::new(".DS_Store")));
    assert!(!is_supported_extension(Path::new("data.json")));
}

#[test]
fn test_scanner_collects_all_16_formats_recursively() {
    let tmp = tempdir().expect("Failed to create tempdir");
    let root = tmp.path();

    // Create nested subdirectories
    let sub1 = root.join("sub1");
    let sub2 = sub1.join("sub2");
    fs::create_dir_all(&sub2).expect("Failed to create subdirectories");

    // Write all 16 supported formats spread across directory hierarchy
    let files_to_create = [
        ("report.docx", root),
        ("legacy.doc", root),
        ("handbook.pdf", root),
        ("page.html", &sub1),
        ("page2.htm", &sub1),
        ("data.xlsx", &sub1),
        ("old_data.xls", &sub1),
        ("macro.xlm", &sub1),
        ("slides.pptx", &sub2),
        ("open_doc.odt", &sub2),
        ("open_slides.odp", &sub2),
        ("open_sheet.ods", &sub2),
        ("rich.rtf", &sub2),
        ("readme.md", root),
        ("guide.markdown", &sub1),
        ("notes.txt", &sub2),
    ];

    for (name, dir) in files_to_create {
        fs::write(dir.join(name), b"dummy content").expect("Failed to write test file");
    }

    // Write unsupported files that should be filtered out
    fs::write(root.join("binary.exe"), b"exe").expect("Failed to write exe");
    fs::write(sub1.join("image.png"), b"png").expect("Failed to write png");
    fs::write(sub2.join("archive.zip"), b"zip").expect("Failed to write zip");
    fs::write(sub2.join(".DS_Store"), b"meta").expect("Failed to write DS_Store");

    let found_files = collect_supported_files(root).expect("Scanner failed");
    assert_eq!(found_files.len(), 16);

    let entries = collect_supported_entries(root).expect("Entry scanner failed");
    assert_eq!(entries.len(), 16);

    for entry in entries {
        assert!(!entry.path.is_empty());
        assert!(!entry.name.is_empty());
        assert!(entry.size.is_some());
        assert_eq!(entry.size.unwrap(), 13); // "dummy content".len()
    }
}

#[test]
fn test_scanner_nonexistent_directory() {
    let non_existent = Path::new("F:/does_not_exist_at_all_99999");
    let result = collect_supported_files(non_existent);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("Directory does not exist"));
}

#[test]
fn test_compute_base_stem() {
    // Normal file
    let (stem, is_md) = compute_base_stem(Path::new("report.docx"));
    assert_eq!(stem, "report");
    assert!(!is_md);

    // Markdown file
    let (stem, is_md) = compute_base_stem(Path::new("notes.md"));
    assert_eq!(stem, "notes_converted");
    assert!(is_md);

    let (stem, is_md) = compute_base_stem(Path::new("guide.MARKDOWN"));
    assert_eq!(stem, "guide_converted");
    assert!(is_md);

    // Multi-dot filename
    let (stem, is_md) = compute_base_stem(Path::new("archive.v1.0.final.pptx"));
    assert_eq!(stem, "archive.v1.0.final");
    assert!(!is_md);
}

#[test]
fn test_candidate_filename_generation() {
    assert_eq!(candidate_filename("report", 0), "report.md");
    assert_eq!(candidate_filename("report", 1), "report (1).md");
    assert_eq!(candidate_filename("report", 2), "report (2).md");

    assert_eq!(
        candidate_filename("notes_converted", 0),
        "notes_converted.md"
    );
    assert_eq!(
        candidate_filename("notes_converted", 1),
        "notes_converted (1).md"
    );
}

#[test]
fn test_resolve_target_dir() {
    let source = Path::new("C:/docs/work/report.docx");

    // Output folder None -> use parent
    let dir = resolve_target_dir(source, None);
    assert_eq!(dir, Path::new("C:/docs/work"));

    // Output folder Some -> use output folder
    let custom = Path::new("D:/output");
    let dir = resolve_target_dir(source, Some(custom));
    assert_eq!(dir, custom);
}

#[test]
fn test_resolve_collision_free_path_pure() {
    let tmp = tempdir().expect("tempdir");
    let src = tmp.path().join("spec.docx");
    fs::write(&src, b"spec").expect("write spec");

    // No existing file -> resolves to spec.md
    let candidate1 = resolve_collision_free_path(&src, None).expect("res 1");
    assert_eq!(candidate1, tmp.path().join("spec.md"));

    // Create spec.md -> resolves to spec (1).md
    fs::write(&candidate1, b"first").expect("write candidate1");
    let candidate2 = resolve_collision_free_path(&src, None).expect("res 2");
    assert_eq!(candidate2, tmp.path().join("spec (1).md"));

    // Create spec (1).md -> resolves to spec (2).md
    fs::write(&candidate2, b"second").expect("write candidate2");
    let candidate3 = resolve_collision_free_path(&src, None).expect("res 3");
    assert_eq!(candidate3, tmp.path().join("spec (2).md"));
}
