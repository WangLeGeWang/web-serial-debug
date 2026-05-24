use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serialport::{available_ports, DataBits, FlowControl, Parity, StopBits};
use tauri::ipc::Channel;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::state::{AppState, SerialHandle};

/// 列出可用串口。
/// 与旧 Go 版本不同，这里直接走 `serialport` 跨平台 API，不再硬编码 COM1..256。
/// 注意：保留 Unknown 类型，方便接入 socat/PTY 等虚拟串口用于本地联调。
#[tauri::command]
pub fn get_serial_ports() -> Vec<String> {
    let mut ports: Vec<String> = match available_ports() {
        Ok(list) => list.into_iter().map(|p| p.port_name).collect(),
        Err(_) => Vec::new(),
    };

    // macOS/Linux 下补充 /tmp/ttyV* 这类用户软链（socat 常用约定）。
    #[cfg(unix)]
    {
        if let Ok(entries) = std::fs::read_dir("/tmp") {
            for entry in entries.flatten() {
                let name = entry.file_name();
                let name_str = name.to_string_lossy();
                if name_str.starts_with("ttyV") {
                    ports.push(format!("/tmp/{}", name_str));
                }
            }
        }
    }

    ports.sort();
    ports.dedup();
    ports
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenSerialOptions {
    pub port_name: String,
    pub baud_rate: u32,
    #[serde(default = "default_data_bits")]
    pub data_bits: u8,
    #[serde(default = "default_stop_bits")]
    pub stop_bits: String,
    #[serde(default = "default_parity")]
    pub parity: String,
    #[serde(default = "default_flow_control")]
    pub flow_control: String,
}

fn default_data_bits() -> u8 { 8 }
fn default_stop_bits() -> String { "1".into() }
fn default_parity() -> String { "none".into() }
fn default_flow_control() -> String { "none".into() }

/// 打开串口，并启动后台读循环，通过 `on_data` Channel 推送二进制数据。
/// 替换旧 `w.Eval(callback(string))` 字符串拼接方案 —— 二进制安全、无注入风险。
#[tauri::command]
pub fn open_serial(
    state: State<'_, AppState>,
    options: OpenSerialOptions,
    on_data: Channel<Vec<u8>>,
) -> AppResult<()> {
    let mut guard = state.serial.lock();
    if let Some(h) = guard.take() {
        h.stop.store(true, Ordering::SeqCst);
        drop(h.port);
    }

    let data_bits = match options.data_bits {
        5 => DataBits::Five,
        6 => DataBits::Six,
        7 => DataBits::Seven,
        _ => DataBits::Eight,
    };
    let stop_bits = match options.stop_bits.as_str() {
        "2" => StopBits::Two,
        _ => StopBits::One,
    };
    let parity = match options.parity.as_str() {
        "odd" => Parity::Odd,
        "even" => Parity::Even,
        _ => Parity::None,
    };
    let flow = match options.flow_control.as_str() {
        "hardware" => FlowControl::Hardware,
        "software" => FlowControl::Software,
        _ => FlowControl::None,
    };

    let port = serialport::new(&options.port_name, options.baud_rate)
        .data_bits(data_bits)
        .stop_bits(stop_bits)
        .parity(parity)
        .flow_control(flow)
        .timeout(Duration::from_millis(50))
        .open()
        .map_err(|e| AppError::Serial(e.to_string()))?;

    let stop = Arc::new(AtomicBool::new(false));
    let stop_cloned = stop.clone();
    let mut reader = port.try_clone().map_err(|e| AppError::Serial(e.to_string()))?;

    std::thread::spawn(move || {
        let mut buf = vec![0u8; 4096];
        while !stop_cloned.load(Ordering::SeqCst) {
            match reader.read(&mut buf) {
                Ok(n) if n > 0 => {
                    if on_data.send(buf[..n].to_vec()).is_err() {
                        break;
                    }
                }
                Ok(_) => {}
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(_) => break,
            }
        }
    });

    *guard = Some(SerialHandle { port, stop });
    Ok(())
}

#[tauri::command]
pub fn write_serial(state: State<'_, AppState>, data: Vec<u8>) -> AppResult<()> {
    let mut guard = state.serial.lock();
    let handle = guard.as_mut().ok_or(AppError::SerialNotInit)?;
    handle
        .port
        .write_all(&data)
        .map_err(|e| AppError::Serial(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn close_serial(state: State<'_, AppState>) -> AppResult<()> {
    let mut guard = state.serial.lock();
    if let Some(h) = guard.take() {
        h.stop.store(true, Ordering::SeqCst);
    }
    Ok(())
}
