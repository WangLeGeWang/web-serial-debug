use parking_lot::Mutex;
use serialport::SerialPort;
use std::sync::Arc;

use crate::config::AppConfig;

pub struct SerialHandle {
    pub port: Box<dyn SerialPort + Send>,
    pub stop: Arc<std::sync::atomic::AtomicBool>,
}

pub struct AppState {
    pub serial: Mutex<Option<SerialHandle>>,
    pub config: Mutex<AppConfig>,
    pub influx: Mutex<Option<influxdb2::Client>>,
}

impl AppState {
    pub fn new(config: AppConfig) -> Self {
        let influx = if config.use_influxdb {
            Some(influxdb2::Client::new(
                config.influxdb_url.clone(),
                config.influxdb_org.clone(),
                config.influxdb_token.clone(),
            ))
        } else {
            None
        };
        Self {
            serial: Mutex::new(None),
            config: Mutex::new(config),
            influx: Mutex::new(influx),
        }
    }
}
