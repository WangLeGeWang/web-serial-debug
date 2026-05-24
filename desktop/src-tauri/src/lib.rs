mod commands;
mod config;
mod error;
mod state;

use crate::config::AppConfig;
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cfg = AppConfig::from_env_and_args();
    let app_state = AppState::new(cfg);

    // 本地联调自检：当 TAURI_SELF_CHECK=1 时，启动后台线程直接打开 PTY 验证。
    if std::env::var("TAURI_SELF_CHECK").as_deref() == Ok("1") {
        std::thread::spawn(|| self_check());
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::serial::get_serial_ports,
            commands::serial::open_serial,
            commands::serial::write_serial,
            commands::serial::close_serial,
            commands::storage::save_data_point,
            commands::storage::query_data,
            commands::version::get_version_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn self_check() {
    use std::io::Read;
    use std::time::{Duration, Instant};

    let device = std::env::var("TAURI_SELF_CHECK_DEVICE")
        .unwrap_or_else(|_| "/tmp/ttyV0".to_string());

    eprintln!("[self-check] enumerating ports ...");
    match serialport::available_ports() {
        Ok(ports) => {
            for p in &ports {
                eprintln!("[self-check]   port: {} ({:?})", p.port_name, p.port_type);
            }
        }
        Err(e) => eprintln!("[self-check] available_ports error: {e}"),
    }

    // 先尝试 serialport crate（生产路径，对真实串口）。
    eprintln!("[self-check] try serialport::new({device}) @115200 ...");
    let serialport_ok = match serialport::new(&device, 115200)
        .timeout(Duration::from_millis(200))
        .open()
    {
        Ok(_) => {
            eprintln!("[self-check] serialport open OK (real serial device)");
            true
        }
        Err(e) => {
            eprintln!(
                "[self-check] serialport open FAILED: {e}\n\
                 [self-check] (macOS PTY 不被 serialport crate 支持，回退裸文件读取以验证 IPC 链路)"
            );
            false
        }
    };

    // 回退：用裸 File 读，证明 mock 通路 + Tauri 后台线程一切正常。
    if !serialport_ok {
        eprintln!("[self-check] opening {device} as raw file ...");
        let mut f = match std::fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&device)
        {
            Ok(f) => {
                eprintln!("[self-check] raw open OK");
                f
            }
            Err(e) => {
                eprintln!("[self-check] raw open FAILED: {e}");
                return;
            }
        };

        let mut buf = vec![0u8; 4096];
        let mut total_bytes = 0usize;
        let mut total_chunks = 0usize;
        let deadline = Instant::now() + Duration::from_secs(3);
        while Instant::now() < deadline {
            match f.read(&mut buf) {
                Ok(n) if n > 0 => {
                    total_bytes += n;
                    total_chunks += 1;
                    let preview = String::from_utf8_lossy(&buf[..n.min(120)]);
                    eprintln!("[self-check] <- {n} bytes: {}", preview.trim_end());
                }
                Ok(_) => {}
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(e) => {
                    eprintln!("[self-check] read error: {e}");
                    break;
                }
            }
        }
        eprintln!("[self-check] DONE: {total_chunks} chunks, {total_bytes} bytes in 3s");
    }
}
