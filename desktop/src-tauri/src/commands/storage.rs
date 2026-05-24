use std::collections::HashMap;

use chrono::{DateTime, Utc};
use futures::stream;
use influxdb2::models::DataPoint;
use serde_json::Value;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataPointInput {
    pub measurement: String,
    #[serde(default)]
    pub tags: HashMap<String, String>,
    pub fields: HashMap<String, Value>,
}

#[tauri::command]
pub async fn save_data_point(
    state: State<'_, AppState>,
    point: DataPointInput,
) -> AppResult<()> {
    let (client, bucket) = {
        let cfg = state.config.lock();
        if !cfg.use_influxdb {
            return Err(AppError::InfluxNotEnabled);
        }
        let bucket = cfg.influxdb_bucket.clone();
        let client = state.influx.lock().clone();
        (client, bucket)
    };
    let client = client.ok_or(AppError::InfluxNotEnabled)?;

    let mut builder = DataPoint::builder(&point.measurement);
    for (k, v) in point.tags {
        builder = builder.tag(k, v);
    }
    for (k, v) in point.fields {
        builder = match v {
            Value::Bool(b) => builder.field(k, b),
            Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    builder.field(k, i)
                } else if let Some(f) = n.as_f64() {
                    builder.field(k, f)
                } else {
                    builder.field(k, n.to_string())
                }
            }
            Value::String(s) => builder.field(k, s),
            other => builder.field(k, other.to_string()),
        };
    }

    let dp = builder
        .build()
        .map_err(|e| AppError::Influx(e.to_string()))?;

    client
        .write(&bucket, stream::iter(vec![dp]))
        .await
        .map_err(|e| AppError::Influx(e.to_string()))?;
    Ok(())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryRange {
    pub measurement: String,
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

#[derive(serde::Serialize)]
pub struct QueryRecord {
    pub time: String,
    pub field: String,
    pub value: serde_json::Value,
}

#[tauri::command]
pub async fn query_data(
    state: State<'_, AppState>,
    range: QueryRange,
) -> AppResult<Vec<QueryRecord>> {
    let (client, bucket) = {
        let cfg = state.config.lock();
        if !cfg.use_influxdb {
            return Err(AppError::InfluxNotEnabled);
        }
        let bucket = cfg.influxdb_bucket.clone();
        let client = state.influx.lock().clone();
        (client, bucket)
    };
    let client = client.ok_or(AppError::InfluxNotEnabled)?;

    let flux = format!(
        r#"from(bucket:"{bucket}")
            |> range(start: {start}, stop: {end})
            |> filter(fn: (r) => r["_measurement"] == "{m}")"#,
        bucket = bucket,
        start = range.start.to_rfc3339(),
        end = range.end.to_rfc3339(),
        m = range.measurement,
    );

    let query = influxdb2::models::Query::new(flux);
    let raw = client
        .query_raw(Some(query))
        .await
        .map_err(|e| AppError::Influx(e.to_string()))?;

    let records = raw
        .into_iter()
        .map(|row| {
            let time = row
                .values
                .get("_time")
                .map(|v| format!("{v:?}"))
                .unwrap_or_default();
            let field = row
                .values
                .get("_field")
                .map(|v| format!("{v:?}"))
                .unwrap_or_default();
            let value = row
                .values
                .get("_value")
                .map(|v| serde_json::Value::String(format!("{v:?}")))
                .unwrap_or(serde_json::Value::Null);
            QueryRecord { time, field, value }
        })
        .collect();

    Ok(records)
}
