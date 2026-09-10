pub mod parser;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use parser::{parse_ytdlp_line, YtDlpOutputEvent};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AudioFormat {
    Flac,
    Mp3,
    Wav,
    Mp4,
}

impl AudioFormat {
    pub fn as_str(&self) -> &'static str {
        match self {
            AudioFormat::Flac => "flac",
            AudioFormat::Mp3 => "mp3",
            AudioFormat::Wav => "wav",
            AudioFormat::Mp4 => "mp4",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgressPayload {
    pub task_id: String,
    pub percent: f32,
    pub speed: String,
    pub eta: String,
    pub phase: String, // "downloading" | "converting"
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadCompletePayload {
    pub task_id: String,
    pub file_path: String,
    pub format: String,
    pub title: String,
    pub duration_secs: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadErrorPayload {
    pub task_id: String,
    pub message: String,
}

#[derive(Default)]
pub struct DownloadManager {
    // Map task_id to process PID or cancellation trigger
    active_tasks: Arc<Mutex<HashMap<String, u32>>>,
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            active_tasks: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

/// Helper function to locate sidecar or system binary
fn resolve_binary_path(app: &AppHandle, binary_name: &str) -> Result<PathBuf, String> {
    // 1. Try resolving in src-tauri/binaries or bundled resource paths
    let target_triple = match std::env::consts::OS {
        "windows" => "x86_64-pc-windows-msvc",
        "macos" => {
            if std::env::consts::ARCH == "aarch64" {
                "aarch64-apple-darwin"
            } else {
                "x86_64-apple-darwin"
            }
        }
        "linux" => "x86_64-unknown-linux-gnu",
        _ => "x86_64-pc-windows-msvc",
    };

    let ext = if cfg!(windows) { ".exe" } else { "" };
    let triple_name = format!("{}-{}{}", binary_name, target_triple, ext);
    let simple_name = format!("{}{}", binary_name, ext);

    let is_valid_binary = |p: &Path| -> bool {
        p.is_file() && p.metadata().map(|m| m.len() > 1024).unwrap_or(false)
    };

    // Check application directory and resource dir
    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidates = [
            resource_dir.join("binaries").join(&triple_name),
            resource_dir.join("binaries").join(&simple_name),
            resource_dir.join(&triple_name),
            resource_dir.join(&simple_name),
        ];
        for candidate in candidates {
            if is_valid_binary(&candidate) {
                return Ok(candidate);
            }
        }
    }

    // Check development directories relative to current working directory
    let dev_candidates = [
        PathBuf::from("binaries").join(&triple_name),
        PathBuf::from("binaries").join(&simple_name),
        PathBuf::from("src-tauri").join("binaries").join(&triple_name),
        PathBuf::from("src-tauri").join("binaries").join(&simple_name),
        PathBuf::from("src-tauri").join("target").join("debug").join(&simple_name),
        PathBuf::from("target").join("debug").join(&simple_name),
    ];
    for candidate in dev_candidates {
        if is_valid_binary(&candidate) {
            if let Ok(abs_path) = std::fs::canonicalize(&candidate) {
                return Ok(abs_path);
            }
            return Ok(candidate);
        }
    }

    // 2. Fallback to system PATH
    Ok(PathBuf::from(simple_name))
}

#[tauri::command]
pub async fn download_audio_stream(
    app: AppHandle,
    state: tauri::State<'_, DownloadManager>,
    task_id: String,
    url: String,
    format: AudioFormat,
    quality: Option<u8>,
) -> Result<DownloadCompletePayload, String> {
    // 1. Resolve Downloads Cache directory
    let cache_base = app
        .path()
        .app_cache_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| format!("Failed to resolve cache dir: {}", e))?;

    let download_dir = cache_base.join("downloads");
    if !download_dir.exists() {
        std::fs::create_dir_all(&download_dir)
            .map_err(|e| format!("Failed to create download directory: {}", e))?;
    }

    // 2. Locate yt-dlp & ffmpeg binaries
    let ytdlp_path = resolve_binary_path(&app, "yt-dlp")?;
    let ffmpeg_path = resolve_binary_path(&app, "ffmpeg").ok();

    let format_str = format.as_str();
    let quality_val = quality.unwrap_or(0).to_string();

    let output_template = download_dir.join("%(title)s.%(ext)s");
    let output_template_str = output_template.to_string_lossy().to_string();

    // 3. Build Command
    let mut cmd = Command::new(&ytdlp_path);
    cmd.arg("--no-playlist");

    if matches!(format, AudioFormat::Mp4) {
        // Download full video and merge audio as mp4
        cmd.arg("-f")
            .arg("bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best")
            .arg("--merge-output-format")
            .arg("mp4");
    } else {
        // Extract audio only
        cmd.arg("-x")
            .arg("--audio-format")
            .arg(format_str)
            .arg("--audio-quality")
            .arg(&quality_val);
    }

    cmd.arg("--newline")
        .arg("--no-colors")
        .arg("-o")
        .arg(&output_template_str)
        .arg(&url)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    if let Some(ref ffmpeg_bin) = ffmpeg_path {
        if let Some(parent) = ffmpeg_bin.parent() {
            cmd.arg("--ffmpeg-location").arg(parent);
        } else {
            cmd.arg("--ffmpeg-location").arg(ffmpeg_bin);
        }
    }

    #[cfg(windows)]
    {
        // CREATE_NO_WINDOW flag to prevent console popup
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    // 4. Spawn child process
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn yt-dlp ({}): {}", ytdlp_path.display(), e))?;

    let pid = child.id().unwrap_or(0);
    {
        let mut tasks = state.active_tasks.lock();
        tasks.insert(task_id.clone(), pid);
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture stdout of yt-dlp".to_string())?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture stderr of yt-dlp".to_string())?;

    let app_handle = app.clone();
    let task_id_clone = task_id.clone();

    // 5. Read stdout stream asynchronously
    let stdout_reader = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut detected_destination: Option<String> = None;

        while let Ok(Some(line)) = reader.next_line().await {
            match parse_ytdlp_line(&line) {
                YtDlpOutputEvent::Progress { percent, speed, eta } => {
                    let _ = app_handle.emit(
                        "download-progress",
                        DownloadProgressPayload {
                            task_id: task_id_clone.clone(),
                            percent,
                            speed,
                            eta,
                            phase: "downloading".to_string(),
                        },
                    );
                }
                YtDlpOutputEvent::Converting { .. } => {
                    let _ = app_handle.emit(
                        "download-progress",
                        DownloadProgressPayload {
                            task_id: task_id_clone.clone(),
                            percent: 99.0,
                            speed: "Converting".to_string(),
                            eta: "00:01".to_string(),
                            phase: "converting".to_string(),
                        },
                    );
                }
                YtDlpOutputEvent::Destination { file_path } => {
                    detected_destination = Some(file_path);
                }
                YtDlpOutputEvent::Other => {}
            }
        }

        detected_destination
    });

    // Capture stderr for debugging/error reporting
    let stderr_reader = tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        let mut last_err = String::new();
        while let Ok(Some(line)) = reader.next_line().await {
            if !line.trim().is_empty() {
                last_err = line;
            }
        }
        last_err
    });

    let status = child.wait().await.map_err(|e| format!("Process error: {}", e))?;

    // Cleanup active task
    {
        let mut tasks = state.active_tasks.lock();
        tasks.remove(&task_id);
    }

    let detected_path = stdout_reader.await.unwrap_or(None);
    let last_stderr = stderr_reader.await.unwrap_or_default();

    if !status.success() {
        let error_msg = if !last_stderr.is_empty() {
            last_stderr
        } else {
            format!("yt-dlp exited with code: {:?}", status.code())
        };

        let _ = app.emit(
            "download-error",
            DownloadErrorPayload {
                task_id: task_id.clone(),
                message: error_msg.clone(),
            },
        );
        return Err(error_msg);
    }

    // Determine final output file path
    let final_path = if let Some(path_str) = detected_path {
        let path = PathBuf::from(path_str);
        if path.exists() {
            path
        } else {
            find_latest_downloaded_file(&download_dir, format_str)
                .ok_or_else(|| "Could not find converted output audio file".to_string())?
        }
    } else {
        find_latest_downloaded_file(&download_dir, format_str)
            .ok_or_else(|| "Could not locate completed audio file".to_string())?
    };

    let title = final_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("audio")
        .to_string();

    let duration_secs = probe_file_duration(&final_path).unwrap_or(0.0);
    let path_string = final_path.to_string_lossy().to_string();

    let complete_payload = DownloadCompletePayload {
        task_id: task_id.clone(),
        file_path: path_string,
        format: format_str.to_string(),
        title,
        duration_secs,
    };

    let _ = app.emit("download-complete", complete_payload.clone());

    Ok(complete_payload)
}

#[tauri::command]
pub async fn cancel_download(
    state: tauri::State<'_, DownloadManager>,
    task_id: String,
) -> Result<(), String> {
    let pid_opt = {
        let mut tasks = state.active_tasks.lock();
        tasks.remove(&task_id)
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
        Err("Task not found or already finished".to_string())
    }
}

/// Fallback helper to find latest downloaded audio in cache
fn find_latest_downloaded_file(dir: &Path, expected_ext: &str) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    let mut files: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if ext.eq_ignore_ascii_case(expected_ext) {
                    if let Ok(meta) = entry.metadata() {
                        let modified = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
                        files.push((path, modified));
                    }
                }
            }
        }
    }

    files.sort_by(|a, b| b.1.cmp(&a.1));
    files.first().map(|(p, _)| p.clone())
}

/// Simple duration probe using symphonia (already bundled in Cargo.toml)
fn probe_file_duration(path: &Path) -> Option<f64> {
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;

    let file = std::fs::File::open(path).ok()?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &FormatOptions::default(), &MetadataOptions::default())
        .ok()?;

    let format = probed.format;
    let track = format.default_track()?;
    let tb = track.codec_params.time_base?;
    let n_frames = track.codec_params.n_frames?;
    let time = tb.calc_time(n_frames);
    Some(time.seconds as f64 + time.frac)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadedFileInfo {
    pub file_path: String,
    pub file_name: String,
    pub format: String,
    pub size_bytes: u64,
    pub modified_timestamp: u64,
    pub duration_secs: Option<f64>,
}

#[tauri::command]
pub fn list_downloaded_audio(app: AppHandle) -> Result<Vec<DownloadedFileInfo>, String> {
    let cache_base = app
        .path()
        .app_cache_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| format!("Failed to resolve cache dir: {}", e))?;

    let download_dir = cache_base.join("downloads");
    if !download_dir.exists() {
        return Ok(Vec::new());
    }

    let mut list = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&download_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    let ext_lower = ext.to_lowercase();
                    if ["flac", "mp3", "wav", "m4a", "ogg", "mp4", "webm", "mkv"].contains(&ext_lower.as_str()) {
                        let meta = entry.metadata().ok();
                        let size_bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                        let modified_timestamp = meta
                            .as_ref()
                            .and_then(|m| m.modified().ok())
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs())
                            .unwrap_or(0);

                        let file_name = path
                            .file_stem()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| "Audio Track".to_string());

                        let duration_secs = probe_file_duration(&path);

                        list.push(DownloadedFileInfo {
                            file_path: path.to_string_lossy().to_string(),
                            file_name,
                            format: ext_lower,
                            size_bytes,
                            modified_timestamp,
                            duration_secs,
                        });
                    }
                }
            }
        }
    }

    list.sort_by(|a, b| b.modified_timestamp.cmp(&a.modified_timestamp));
    Ok(list)
}

#[tauri::command]
pub fn delete_downloaded_audio(file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if path.exists() && path.is_file() {
        std::fs::remove_file(path).map_err(|e| format!("Failed to delete audio file: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn open_download_folder(app: AppHandle) -> Result<(), String> {
    let cache_base = app
        .path()
        .app_cache_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| format!("Failed to resolve cache dir: {}", e))?;
    let download_dir = cache_base.join("downloads");
    if !download_dir.exists() {
        let _ = std::fs::create_dir_all(&download_dir);
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(download_dir.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| format!("Failed to open explorer: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(download_dir.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| format!("Failed to open finder: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(download_dir.to_string_lossy().to_string())
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }
    Ok(())
}

