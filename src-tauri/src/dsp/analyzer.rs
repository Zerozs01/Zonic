use super::pitch::{YinConfig, YinDetector, PitchFrame};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalysisResult {
    pub total_duration_seconds: f32,
    pub sample_rate: u32,
    pub total_frames: usize,
    pub voiced_frames: usize,
    pub pitch_frames: Vec<PitchFrame>,
    pub min_pitch_hz: f32,
    pub max_pitch_hz: f32,
    pub avg_pitch_hz: f32,
}

pub fn analyze_pcm_buffer(
    samples: &[f32],
    sample_rate: u32,
    hop_ms: f32, // e.g. 10.0 ms hop size (100 frames per sec)
) -> AnalysisResult {
    let window_size = 2048;
    let config = YinConfig {
        sample_rate,
        window_size,
        threshold: 0.15,
        min_freq_hz: 60.0,
        max_freq_hz: 1200.0,
    };

    let hop_samples = ((sample_rate as f32 * hop_ms) / 1000.0) as usize;
    let hop_samples = hop_samples.max(64);

    let total_samples = samples.len();
    let duration_seconds = total_samples as f32 / sample_rate as f32;

    if total_samples < window_size {
        return AnalysisResult {
            total_duration_seconds: duration_seconds,
            sample_rate,
            total_frames: 0,
            voiced_frames: 0,
            pitch_frames: vec![],
            min_pitch_hz: 0.0,
            max_pitch_hz: 0.0,
            avg_pitch_hz: 0.0,
        };
    }

    let mut frame_indices = Vec::new();
    let mut index = 0;
    while index + window_size <= total_samples {
        frame_indices.push(index);
        index += hop_samples;
    }

    // Multi-threaded parallel pitch detection using Rayon
    let frames: Vec<PitchFrame> = frame_indices
        .par_iter()
        .map(|&idx| {
            let timestamp_ms = (idx as f64 / sample_rate as f64) * 1000.0;
            let chunk = &samples[idx..idx + window_size];
            let mut detector = YinDetector::new(config.clone());
            detector.detect_pitch(chunk, timestamp_ms)
        })
        .collect();

    let mut voiced_count = 0;
    let mut min_hz = f32::MAX;
    let mut max_hz = 0.0f32;
    let mut hz_sum = 0.0f64;

    for frame in &frames {
        if frame.is_voiced {
            voiced_count += 1;
            min_hz = min_hz.min(frame.frequency_hz);
            max_hz = max_hz.max(frame.frequency_hz);
            hz_sum += frame.frequency_hz as f64;
        }
    }

    let avg_hz = if voiced_count > 0 {
        (hz_sum / voiced_count as f64) as f32
    } else {
        0.0
    };

    if min_hz == f32::MAX {
        min_hz = 0.0;
    }

    AnalysisResult {
        total_duration_seconds: duration_seconds,
        sample_rate,
        total_frames: frames.len(),
        voiced_frames: voiced_count,
        pitch_frames: frames,
        min_pitch_hz: min_hz,
        max_pitch_hz: max_hz,
        avg_pitch_hz: avg_hz,
    }
}

