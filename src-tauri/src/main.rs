// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // The desktop entry point starts the native event loop.
    markdown_them_lib::run();
}
