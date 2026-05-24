use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("serial error: {0}")]
    Serial(String),
    #[error("serial port not initialized")]
    SerialNotInit,
    #[error("influxdb not enabled")]
    InfluxNotEnabled,
    #[error("influxdb error: {0}")]
    Influx(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
