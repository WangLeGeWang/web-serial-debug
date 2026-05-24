use serde::Serialize;

#[derive(Serialize)]
pub struct VersionInfo {
    pub version: &'static str,
    #[serde(rename = "buildTime")]
    pub build_time: &'static str,
}

#[tauri::command]
pub fn get_version_info() -> VersionInfo {
    VersionInfo {
        version: env!("CARGO_PKG_VERSION"),
        build_time: env!("BUILD_TIME"),
    }
}
