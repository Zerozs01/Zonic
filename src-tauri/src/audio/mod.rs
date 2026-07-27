pub mod device;
pub mod file_loader;
pub mod recorder;

use device::{list_input_devices, AudioDeviceInfo};
use file_loader::{read_audio_file, AudioFileMeta};
use parking_lot::Mutex;
use recorder::{AudioRecorder, RecordingStatus};
use std::sync::Arc;

pub struct AudioState {
    pub recorder: Arc<Mutex<AudioRecorder>>,
}

impl AudioState {
    pub fn new() -> Self {
        Self {
            recorder: Arc::new(Mutex::new(AudioRecorder::new())),
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
