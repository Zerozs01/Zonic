pub mod pitch;
pub mod analyzer;
pub mod filter;

use analyzer::{analyze_pcm_buffer, AnalysisResult};
use pitch::{YinConfig, YinDetector, PitchFrame};
use crate::audio::file_loader::read_audio_file;
use crate::audio::AudioState;

#[tauri::command]
pub fn analyze_audio_file_pitch(
    file_path: String,
    hop_ms: Option<f32>,
) -> Result<AnalysisResult, String> {
    let decoded = read_audio_file(&file_path)?;
    let hop = hop_ms.unwrap_or(10.0);
    let result = analyze_pcm_buffer(&decoded.samples, decoded.meta.sample_rate, hop);
    Ok(result)
}

#[tauri::command]
pub fn analyze_live_stream_pitch(
    state: tauri::State<'_, AudioState>,
    max_samples: Option<usize>,
) -> Result<PitchFrame, String> {
    let recorder = state.recorder.lock();
    let samples = recorder.get_buffered_samples(max_samples.unwrap_or(2048));
    let status = recorder.status();

    if samples.len() < 2048 {
        return Ok(PitchFrame {
            timestamp_ms: 0.0,
            frequency_hz: 0.0,
            amplitude_db: status.current_peak_db,
            clarity: 0.0,
            note_name: "Unvoiced".to_string(),
            cents_offset: 0.0,
            is_voiced: false,
        });
    }

    let window = &samples[samples.len() - 2048..];
    let config = YinConfig {
        sample_rate: status.sample_rate,
        window_size: 2048,
        threshold: 0.15,
        min_freq_hz: 60.0,
        max_freq_hz: 1200.0,
    };

    let mut detector = YinDetector::new(config);
    let frame = detector.detect_pitch(window, 0.0);
    Ok(frame)
}
