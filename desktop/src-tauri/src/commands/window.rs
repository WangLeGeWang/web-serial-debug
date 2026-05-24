use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

use crate::error::{AppError, AppResult};

/// 打开一个新窗口（多开支持）。
/// 每次调用都会创建一个独立的 WebviewWindow，共享同一个进程与 Rust 后台状态。
/// 使用 WebviewUrl::App 让 Tauri 自动选择 dev URL 或打包后的 frontendDist。
#[tauri::command]
pub async fn open_new_window(app: AppHandle) -> AppResult<String> {
    let label = format!("win-{}", chrono::Utc::now().timestamp_millis());

    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title("BUS Studio")
        .inner_size(1280.0, 800.0)
        .min_inner_size(640.0, 480.0)
        .resizable(true)
        .build()
        .map_err(|e| AppError::Window(e.to_string()))?;

    Ok(label)
}
