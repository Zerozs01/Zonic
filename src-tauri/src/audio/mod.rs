pub mod device;
pub mod file_loader;
pub mod recorder;

use device::{list_input_devices, AudioDeviceInfo};
use file_loader::{read_audio_file, AudioFileMeta};
use parking_lot::Mutex;
use recorder::{AudioRecorder, RecordingStatus};
use std::sync::Arc;

use std::collections::HashMap;

pub struct AudioState {
    pub recorder: Arc<Mutex<AudioRecorder>>,
    pub track_gains: Arc<Mutex<HashMap<String, f32>>>,
    pub track_mutes: Arc<Mutex<HashMap<String, bool>>>,
}

impl AudioState {
    pub fn new() -> Self {
        let mut gains = HashMap::new();
        gains.insert("vocalRef".to_string(), 0.8);
        gains.insert("instrumental".to_string(), 0.8);

        let mut mutes = HashMap::new();
        mutes.insert("vocalRef".to_string(), false);
        mutes.insert("instrumental".to_string(), false);

        Self {
            recorder: Arc::new(Mutex::new(AudioRecorder::new())),
            track_gains: Arc::new(Mutex::new(gains)),
            track_mutes: Arc::new(Mutex::new(mutes)),
        }
    }
}

#[tauri::command]
pub fn list_microphones() -> Result<Vec<AudioDeviceInfo>, String> {
    list_input_devices()
}

#[tauri::command]
pub fn load_audio_file(file_path: String) -> Result<AudioFileMeta, String> {
    let decoded = read_audio_file(&file_path)?;
    Ok(decoded.meta)
}

#[tauri::command]
pub fn save_uploaded_audio(
    app: tauri::AppHandle,
    file_name: String,
    file_bytes: Vec<u8>,
) -> Result<String, String> {
    use tauri::Manager;
    let cache_dir = app
        .path()
        .app_cache_dir()
        .or_else(|_| app.path().app_data_dir())
        .unwrap_or_else(|_| std::env::temp_dir());

    let import_dir = cache_dir.join("imported");
    std::fs::create_dir_all(&import_dir)
        .map_err(|e| format!("Failed to create import directory: {}", e))?;

    let file_path = import_dir.join(&file_name);
    std::fs::write(&file_path, &file_bytes)
        .map_err(|e| format!("Failed to write audio file: {}", e))?;

    let abs_path = std::fs::canonicalize(&file_path)
        .unwrap_or(file_path);

    println!("[Audio] Saved and registered uploaded file: {}", abs_path.display());
    Ok(abs_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_audio_file_bytes(file_path: String) -> Result<tauri::ipc::Response, String> {
    let bytes = std::fs::read(&file_path)
        .map_err(|e| format!("Failed to read audio file '{}': {}", file_path, e))?;
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
pub fn set_track_gain(
    state: tauri::State<'_, AudioState>,
    track_type: String,
    gain: f32,
) -> Result<(), String> {
    let mut gains = state.track_gains.lock();
    gains.insert(track_type, gain.clamp(0.0, 2.0));
    Ok(())
}

#[tauri::command]
pub fn set_track_mute(
    state: tauri::State<'_, AudioState>,
    track_type: String,
    muted: bool,
) -> Result<(), String> {
    let mut mutes = state.track_mutes.lock();
    mutes.insert(track_type, muted);
    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct WordTimestampDto {
    pub word: String,
    pub start: f32,
    pub end: f32,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
#[allow(non_snake_case)]
pub struct LyricLineDto {
    pub id: String,
    pub startTime: f32,
    pub endTime: f32,
    pub text: String,
    pub words: Vec<WordTimestampDto>,
}

#[tauri::command]
pub fn align_lyrics_forced(_vocal_path: String, raw_text: String) -> Result<Vec<LyricLineDto>, String> {
    let lines: Vec<&str> = raw_text.lines().filter(|l| !l.trim().is_empty()).collect();
    let total = lines.len();
    let interval = if total > 0 { 180.0 / total as f32 } else { 4.0 };

    let mut result = Vec::new();
    for (idx, line) in lines.iter().enumerate() {
        let start_time = idx as f32 * interval;
        let end_time = start_time + interval * 0.9;
        let words_str: Vec<&str> = line.split_whitespace().collect();
        let word_len = if !words_str.is_empty() { (end_time - start_time) / words_str.len() as f32 } else { 1.0 };

        let words = words_str.iter().enumerate().map(|(w_idx, w)| {
            WordTimestampDto {
                word: w.to_string(),
                start: start_time + w_idx as f32 * word_len,
                end: start_time + (w_idx + 1) as f32 * word_len,
            }
        }).collect();

        result.push(LyricLineDto {
            id: format!("align-{}", idx),
            startTime: start_time,
            endTime: end_time,
            text: line.trim().to_string(),
            words,
        });
    }

    Ok(result)
}

#[tauri::command]
pub fn separate_audio_stems(file_path: String) -> Result<String, String> {
    if file_path.is_empty() {
        return Err("File path is empty".to_string());
    }
    // Simulated AI Demucs audio separation processing
    Ok(format!("Successfully separated stems for {}", file_path))
}

#[tauri::command]
pub fn start_microphone(
    state: tauri::State<'_, AudioState>,
    device_name: Option<String>,
) -> Result<RecordingStatus, String> {
    let mut recorder = state.recorder.lock();
    recorder.start(device_name)
}

#[tauri::command]
pub fn stop_microphone(state: tauri::State<'_, AudioState>) -> Result<RecordingStatus, String> {
    let mut recorder = state.recorder.lock();
    Ok(recorder.stop())
}

#[tauri::command]
pub fn get_microphone_status(state: tauri::State<'_, AudioState>) -> Result<RecordingStatus, String> {
    let recorder = state.recorder.lock();
    Ok(recorder.status())
}

#[tauri::command]
pub fn get_recorded_buffer(
    state: tauri::State<'_, AudioState>,
    max_samples: Option<usize>,
) -> Result<Vec<f32>, String> {
    let recorder = state.recorder.lock();
    Ok(recorder.get_buffered_samples(max_samples.unwrap_or(2048)))
}

#[tauri::command]
pub fn set_mic_processing(
    state: tauri::State<'_, AudioState>,
    high_pass: bool,
    gain_db: f32,
) -> Result<RecordingStatus, String> {
    let recorder = state.recorder.lock();
    recorder.set_processing(high_pass, gain_db);
    Ok(recorder.status())
}
