pub mod parser;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use parser::{parse_splitter_line, SplitterOutputEvent};

// ─────────────────────────────────────────────────────────────────
// Data Types
// ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum StemModel {
    Htdemucs,
    HtdemucsFt,
    MdxExtra,
    MdxExtraQ,
}

impl StemModel {
    pub fn as_str(&self) -> &'static str {
        match self {
            StemModel::Htdemucs => "htdemucs",
            StemModel::HtdemucsFt => "htdemucs_ft",
            StemModel::MdxExtra => "mdx_extra",
            StemModel::MdxExtraQ => "mdx_extra_q",
        }
    }
}

impl Default for StemModel {
    fn default() -> Self {
        // mdx_extra_q = fastest, quantized — best for first-time users
        StemModel::MdxExtraQ
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SplitProgressPayload {
    pub job_id: String,
    pub step: String,
    pub percent: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct SplitCompletePayload {
    pub job_id: String,
    pub vocal_path: String,
    pub instrumental_path: String,
    pub duration_secs: f64,
    pub model_used: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SplitErrorPayload {
    pub job_id: String,
    pub message: String,
    pub code: Option<i32>,
}

// ─────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct SplitterState {
    pub active_jobs: Arc<Mutex<HashMap<String, u32>>>, // job_id -> PID
}

impl SplitterState {
    pub fn new() -> Self {
        Self {
            active_jobs: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/// Resolve the splitter.py script from resource_dir or dev-time paths.
fn resolve_script_path(app: &AppHandle) -> Result<PathBuf, String> {
    let candidates: Vec<PathBuf> = {
        let mut v = vec![
            PathBuf::from("scripts").join("splitter.py"),
            PathBuf::from("src-tauri").join("scripts").join("splitter.py"),
        ];
        if let Ok(resource_dir) = app.path().resource_dir() {
            v.push(resource_dir.join("scripts").join("splitter.py"));
            v.push(resource_dir.join("splitter.py"));
        }
        v
    };

    for p in &candidates {
        if p.exists() {
            return Ok(p.clone());
        }
    }

    Err(format!(
        "splitter.py not found. Searched: {:?}",
        candidates
    ))
}

/// Find Python interpreter (venv first, then system python3/python).
fn find_python(app: &AppHandle) -> PathBuf {
    // 1. Check app-local venv (first-run setup)
    let ext = if cfg!(windows) { ".exe" } else { "" };
    let venv_candidates = {
        let mut v = vec![];
        if let Ok(data_dir) = app.path().app_data_dir() {
            let venv_root = data_dir.join(".venv-demucs");
            if cfg!(windows) {
                v.push(venv_root.join("Scripts").join(format!("python{}", ext)));
            } else {
                v.push(venv_root.join("bin").join(format!("python3{}", ext)));
            }
        }
        v
    };

    for candidate in venv_candidates {
        if candidate.exists() {
            return candidate;
        }
    }

    // 2. Fallback: system python3/python
    let fallbacks: &[&str] = if cfg!(windows) {
        &["python.exe", "python3.exe"]
    } else {
        &["python3", "python"]
    };

    // Return first likely system python (may not exist — error will surface at spawn)
    PathBuf::from(fallbacks[0])
}

// ─────────────────────────────────────────────────────────────────
// Tauri Commands
// ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn split_audio_stems(
    app: AppHandle,
    state: tauri::State<'_, SplitterState>,
    input_path: String,
    model: Option<StemModel>,
    job_id: Option<String>,
) -> Result<SplitCompletePayload, String> {
    // ── Validate input ─────────────────────────────────────────
    if input_path.is_empty() {
        return Err("input_path must not be empty".to_string());
    }
    let input = Path::new(&input_path);
    if !input.exists() {
        return Err(format!("Input file not found: {}", input_path));
    }

    let model = model.unwrap_or_default();
    let job_id = job_id.unwrap_or_else(|| {
        format!("split_{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0))
    });

    // ── Resolve paths ──────────────────────────────────────────
    let script_path = resolve_script_path(&app)?;
    let python_path = find_python(&app);
    let output_dir = app
        .path()
        .app_cache_dir()
        .or_else(|_| app.path().app_data_dir())
        .map(|d| d.join("stems").join(&job_id))
        .map_err(|e| format!("Cannot resolve cache dir: {}", e))?;

    std::fs::create_dir_all(&output_dir)
        .map_err(|e| format!("Failed to create output dir: {}", e))?;

    // ── Build command ──────────────────────────────────────────
    let mut cmd = Command::new(&python_path);
    cmd.arg(&script_path)
        .arg("--input")
        .arg(&input_path)
        .arg("--output")
        .arg(output_dir.to_string_lossy().as_ref())
        .arg("--model")
        .arg(model.as_str())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    // ── Spawn ──────────────────────────────────────────────────
    let mut child = cmd.spawn().map_err(|e| {
        format!(
            "Failed to launch Python sidecar ('{}').\n\
             Ensure Python is installed and Demucs is set up.\n\
             Error: {}",
            python_path.display(),
            e
        )
    })?;

    let pid = child.id().unwrap_or(0);
    {
        let mut jobs = state.active_jobs.lock();
        jobs.insert(job_id.clone(), pid);
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Could not capture splitter stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Could not capture splitter stderr".to_string())?;

    let app_handle = app.clone();
    let job_id_clone = job_id.clone();
    let model_str = model.as_str().to_string();

    // ── Async stdout reader ────────────────────────────────────
    let stdout_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut result: Option<SplitterOutputEvent> = None;

        while let Ok(Some(line)) = reader.next_line().await {
            match parse_splitter_line(&line) {
                SplitterOutputEvent::Progress { step, percent } => {
                    let payload = SplitProgressPayload {
                        job_id: job_id_clone.clone(),
                        step,
                        percent,
                    };
                    let _ = app_handle.emit("separation-progress", payload.clone());
                    let _ = app_handle.emit("split-progress", payload);
                }
                SplitterOutputEvent::Error { message } => {
                    let payload = SplitErrorPayload {
                        job_id: job_id_clone.clone(),
                        message,
                        code: None,
                    };
                    let _ = app_handle.emit("separation-error", payload.clone());
                    let _ = app_handle.emit("split-error", payload);
                }
                ev @ SplitterOutputEvent::Result { .. } => {
                    result = Some(ev);
                }
                SplitterOutputEvent::Other => {}
            }
        }

        result
    });

    // Capture stderr for error reporting
    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        let mut lines = Vec::new();
        while let Ok(Some(line)) = reader.next_line().await {
            if !line.trim().is_empty() {
                lines.push(line);
            }
        }
        lines.join("\n")
    });

    // ── Wait for process ───────────────────────────────────────
    let exit_status = child
        .wait()
        .await
        .map_err(|e| format!("Process wait error: {}", e))?;

    {
        let mut jobs = state.active_jobs.lock();
        jobs.remove(&job_id);
    }

    let result_event = stdout_task.await.unwrap_or(None);
    let stderr_text = stderr_task.await.unwrap_or_default();

    if !exit_status.success() {
        let error_msg = if !stderr_text.is_empty() {
            stderr_text
        } else {
            format!("splitter.py exited with code {:?}", exit_status.code())
        };

        let err_payload = SplitErrorPayload {
            job_id: job_id.clone(),
            message: error_msg.clone(),
            code: exit_status.code(),
        };
        let _ = app.emit("separation-error", err_payload.clone());
        let _ = app.emit("split-error", err_payload);
        return Err(error_msg);
    }

    // ── Extract result ─────────────────────────────────────────
    match result_event {
        Some(SplitterOutputEvent::Result {
            vocal_path,
            instrumental_path,
            duration_secs,
        }) => {
            let payload = SplitCompletePayload {
                job_id: job_id.clone(),
                vocal_path,
                instrumental_path,
                duration_secs,
                model_used: model_str,
            };
            let _ = app.emit("separation-complete", payload.clone());
            let _ = app.emit("split-complete", payload.clone());
            Ok(payload)
        }
        _ => {
            // Fallback: search output_dir for expected files
            let vocal = output_dir.join("vocals.wav");
            let inst = output_dir.join("no_vocals.wav");
            if vocal.exists() && inst.exists() {
                let payload = SplitCompletePayload {
                    job_id: job_id.clone(),
                    vocal_path: vocal.to_string_lossy().to_string(),
                    instrumental_path: inst.to_string_lossy().to_string(),
                    duration_secs: 0.0,
                    model_used: model_str,
                };
                let _ = app.emit("separation-complete", payload.clone());
                let _ = app.emit("split-complete", payload.clone());
                Ok(payload)
            } else {
                let msg = "Splitter completed but output files not found".to_string();
                let err_payload = SplitErrorPayload {
                    job_id,
                    message: msg.clone(),
                    code: None,
                };
                let _ = app.emit("separation-error", err_payload.clone());
                let _ = app.emit("split-error", err_payload);
                Err(msg)
            }
        }
    }
}

#[tauri::command]
pub async fn cancel_split(
    state: tauri::State<'_, SplitterState>,
    app: AppHandle,
    job_id: String,
) -> Result<(), String> {
    let pid_opt = {
        let mut jobs = state.active_jobs.lock();
        jobs.remove(&job_id)
    };

    if let Some(pid) = pid_opt {
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F", "/T"])
                .output()
                .await;
        }
        #[cfg(not(windows))]
        {
            let _ = Command::new("kill")
                .args(["-9", &pid.to_string()])
                .output()
                .await;
        }

        let _ = app.emit("split-cancelled", serde_json::json!({ "job_id": job_id }));
        Ok(())
    } else {
        Err("Job not found or already finished".to_string())
    }
}
