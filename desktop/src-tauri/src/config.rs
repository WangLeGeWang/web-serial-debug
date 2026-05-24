use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub use_influxdb: bool,
    pub influxdb_url: String,
    pub influxdb_token: String,
    pub influxdb_org: String,
    pub influxdb_bucket: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            use_influxdb: false,
            influxdb_url: "http://localhost:8086".into(),
            influxdb_token: String::new(),
            influxdb_org: "myorg".into(),
            influxdb_bucket: "mybucket".into(),
        }
    }
}

impl AppConfig {
    /// 解析 CLI 参数（保持与旧 Go 入口一致）：
    /// --use-influxdb / --influxdb-url=... / --influxdb-token=... / --influxdb-org=... / --influxdb-bucket=...
    pub fn from_env_and_args() -> Self {
        let mut cfg = Self::default();
        let args: Vec<String> = env::args().collect();
        let mut i = 1;
        while i < args.len() {
            let a = &args[i];
            match a.as_str() {
                "--use-influxdb" => cfg.use_influxdb = true,
                _ if a.starts_with("--influxdb-url=") => {
                    cfg.influxdb_url = a.trim_start_matches("--influxdb-url=").to_string()
                }
                _ if a.starts_with("--influxdb-token=") => {
                    cfg.influxdb_token = a.trim_start_matches("--influxdb-token=").to_string()
                }
                _ if a.starts_with("--influxdb-org=") => {
                    cfg.influxdb_org = a.trim_start_matches("--influxdb-org=").to_string()
                }
                _ if a.starts_with("--influxdb-bucket=") => {
                    cfg.influxdb_bucket = a.trim_start_matches("--influxdb-bucket=").to_string()
                }
                _ => {}
            }
            i += 1;
        }
        cfg
    }
}
