pub mod parser;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use parser::{parse_aligner_line, AlignerOutputEvent};

// ─────────────────────────────────────────────────────────────────
// Data Transfer Objects
// ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WordTimestampDto {
    pub word: String,
    pub start: f64,
    pub end: f64,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SyncedLyricLineDto {
    pub id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub text: String,
    pub words: Option<Vec<WordTimestampDto>>,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SyncedLyricsResult {
    pub job_id: String,
    pub lines: Vec<SyncedLyricLineDto>,
    #[serde(alias = "duration")]
    pub duration_secs: f64,
    #[serde(alias = "confidence")]
    pub avg_confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SyncProgressPayload {
    pub job_id: String,
    pub percent: f32,
    pub stage: String,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncLyricsRequest {
    pub vocal_path: String,
    pub plain_text: String,
    pub language: Option<String>,
    pub job_id: Option<String>,
}

// ─────────────────────────────────────────────────────────────────
// Manager State
// ─────────────────────────────────────────────────────────────────

#[derive(Default)]
pub struct LyricsSyncManager {
    pub active_jobs: Arc<Mutex<HashMap<String, u32>>>, // job_id -> process PID
}

impl LyricsSyncManager {
    pub fn new() -> Self {
        Self {
            active_jobs: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

// ─────────────────────────────────────────────────────────────────
// Path Resolution Helpers
// ─────────────────────────────────────────────────────────────────

fn resolve_aligner_script(app: &AppHandle) -> Result<PathBuf, String> {
    let candidates = [
        PathBuf::from("scripts").join("aligner.py"),
        PathBuf::from("src-tauri").join("scripts").join("aligner.py"),
    ];

    for p in &candidates {
        if p.exists() {
            if let Ok(abs) = std::fs::canonicalize(p) {
                return Ok(abs);
            }
            return Ok(p.clone());
        }
    }

    if let Ok(res_dir) = app.path().resource_dir() {
        let bundled = [
            res_dir.join("scripts").join("aligner.py"),
            res_dir.join("aligner.py"),
        ];
        for p in &bundled {
            if p.exists() {
                return Ok(p.clone());
            }
        }
    }

    Err("aligner.py script not found".to_string())
}

fn find_python(app: &AppHandle) -> PathBuf {
    let ext = if cfg!(windows) { ".exe" } else { "" };
    if let Ok(data_dir) = app.path().app_data_dir() {
        let venv_root = data_dir.join(".venv-demucs");
        let venv_bin = if cfg!(windows) {
            venv_root.join("Scripts").join(format!("python{}", ext))
        } else {
            venv_root.join("bin").join(format!("python3{}", ext))
        };
        if venv_bin.exists() {
            return venv_bin;
        }
    }

    let fallbacks = if cfg!(windows) {
        &["python.exe", "python3.exe"]
    } else {
        &["python3", "python"]
    };

    PathBuf::from(fallbacks[0])
}

// ─────────────────────────────────────────────────────────────────
// Tauri Commands
// ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn sync_lyrics(
    app: AppHandle,
    state: tauri::State<'_, LyricsSyncManager>,
    vocal_path: String,
    plain_text: String,
    language: Option<String>,
    job_id: Option<String>,
) -> Result<SyncedLyricsResult, String> {
    if vocal_path.trim().is_empty() {
        return Err("Vocal path must not be empty".to_string());
    }
    let vocal_file = Path::new(&vocal_path);
    let resolved_vocal_path: PathBuf = if vocal_file.exists() {
        vocal_file.to_path_buf()
    } else {
        let mut found = None;
        if let Ok(cache_dir) = app.path().app_cache_dir().or_else(|_| app.path().app_data_dir()) {
            let candidate = cache_dir.join("imported").join(&vocal_path);
            if candidate.exists() {
                found = Some(candidate);
            }
        }
        match found {
            Some(p) => p,
            None => return Err(format!("Vocal audio file not found: {}", vocal_path)),
        }
    };
    if plain_text.trim().is_empty() {
        return Err("Plain text lyrics must not be empty".to_string());
    }

    let job_id = job_id.unwrap_or_else(|| {
        format!(
            "sync_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        )
    });

    let script_path = resolve_aligner_script(&app)?;
    let python_path = find_python(&app);
    let language = language.unwrap_or_else(|| "auto".to_string());

    // If plain_text contains newlines or is long, write to temp file to avoid Windows 8191 CLI limit
    let temp_lyrics_file: Option<PathBuf> = if plain_text.len() > 500 || plain_text.contains('\n') {
        let temp_dir = app
            .path()
            .app_cache_dir()
            .or_else(|_| app.path().app_data_dir())
            .unwrap_or_else(|_| std::env::temp_dir());
        let temp_path = temp_dir.join(format!("lyrics_{}.txt", job_id));
        if std::fs::write(&temp_path, &plain_text).is_ok() {
            Some(temp_path)
        } else {
            None
        }
    } else {
        None
    };

    let text_arg = match &temp_lyrics_file {
        Some(p) => p.to_string_lossy().to_string(),
        None => plain_text.clone(),
    };

    // Build command
    let mut cmd = Command::new(&python_path);
    cmd.kill_on_drop(true);
    cmd.arg(&script_path)
        .arg("--vocal")
        .arg(&resolved_vocal_path)
        .arg("--text")
        .arg(&text_arg)
        .arg("--language")
        .arg(&language)
        .arg("--job-id")
        .arg(&job_id)
        .env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUTF8", "1")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| {
        if let Some(ref p) = temp_lyrics_file {
            let _ = std::fs::remove_file(p);
        }
        format!(
            "Failed to launch lyrics alignment process ('{}'): {}",
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
        .ok_or_else(|| "Failed to capture stdout of aligner".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture stderr of aligner".to_string())?;

    let app_handle = app.clone();
    let current_job_id = job_id.clone();

    // Async stream stdout
    let stdout_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut final_result: Option<SyncedLyricsResult> = None;

        while let Ok(Some(line)) = reader.next_line().await {
            match parse_aligner_line(&current_job_id, &line) {
                AlignerOutputEvent::Progress(payload) => {
                    let _ = app_handle.emit("sync-progress", payload);
                }
                AlignerOutputEvent::Result(res) => {
                    final_result = Some(res);
                }
                AlignerOutputEvent::Error(err) => {
                    let _ = app_handle.emit(
                        "sync-error",
                        serde_json::json!({
                            "jobId": current_job_id.clone(),
                            "message": err
                        }),
                    );
                }
                AlignerOutputEvent::Other => {}
            }
        }

        final_result
    });

    let stderr_task = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        let mut err_lines = Vec::new();
        while let Ok(Some(line)) = reader.next_line().await {
            if !line.trim().is_empty() {
                err_lines.push(line);
            }
        }
        err_lines.join("\n")
    });

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Wait error on aligner process: {}", e))?;

    {
        let mut jobs = state.active_jobs.lock();
        jobs.remove(&job_id);
    }

    // Clean up temp lyrics file
    if let Some(ref p) = temp_lyrics_file {
        let _ = std::fs::remove_file(p);
    }

    let parsed_result = stdout_task.await.unwrap_or(None);
    let stderr_output = stderr_task.await.unwrap_or_default();

    if !status.success() {
        let err_msg = if !stderr_output.is_empty() {
            stderr_output
        } else {
            format!("Aligner process exited with code {:?}", status.code())
        };
        return Err(err_msg);
    }

    if let Some(res) = parsed_result {
        let _ = app.emit("sync-complete", res.clone());
        Ok(res)
    } else {
        Err("Aligner completed without emitting valid parsed result".to_string())
    }
}

#[tauri::command]
pub async fn cancel_sync_lyrics(
    state: tauri::State<'_, LyricsSyncManager>,
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
        Ok(())
    } else {
        Err("Job not found or already completed".to_string())
    }
}
