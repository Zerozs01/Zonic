use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Stream, StreamConfig};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecordingStatus {
    pub is_recording: bool,
    pub device_name: String,
    pub sample_rate: u32,
    pub buffer_size: u32,
    pub current_peak_db: f32,
    pub total_samples_captured: u64,
}

pub struct AudioRecorder {
    stream: Option<Stream>,
    is_recording: Arc<AtomicBool>,
    total_samples: Arc<AtomicU64>,
    current_peak: Arc<Mutex<f32>>,
    device_name: Arc<Mutex<String>>,
    sample_rate: Arc<AtomicU64>,
    ring_buffer: Arc<Mutex<Vec<f32>>>,
}

impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            stream: None,
            is_recording: Arc::new(AtomicBool::new(false)),
            total_samples: Arc::new(AtomicU64::new(0)),
            current_peak: Arc::new(Mutex::new(0.0)),
            device_name: Arc::new(Mutex::new("None".to_string())),
            sample_rate: Arc::new(AtomicU64::new(44100)),
            ring_buffer: Arc::new(Mutex::new(Vec::with_capacity(44100 * 5))), // 5s buffer
        }
    }

    pub fn start(&mut self, target_device_name: Option<String>) -> Result<RecordingStatus, String> {
        if self.is_recording.load(Ordering::SeqCst) {
            return Err("Recording is already in progress".to_string());
        }

        let host = cpal::default_host();
        let device = if let Some(ref name) = target_device_name {
            host.input_devices()
                .map_err(|e| e.to_string())?
                .find(|d| d.name().map(|n| n == *name).unwrap_or(false))
                .ok_or_else(|| format!("Device '{}' not found", name))?
        } else {
            host.default_input_device()
                .ok_or_else(|| "No default audio input device available".to_string())?
        };

        let device_name_str = device.name().unwrap_or_else(|_| "Default Microphone".to_string());
        let config: StreamConfig = device
            .default_input_config()
            .map_err(|e| format!("Failed to get input config: {}", e))?
            .into();

        let sample_rate = config.sample_rate.0;
        let channels = config.channels as usize;

        self.sample_rate.store(sample_rate as u64, Ordering::SeqCst);
        *self.device_name.lock() = device_name_str.clone();
        self.total_samples.store(0, Ordering::SeqCst);
        self.ring_buffer.lock().clear();

        let is_recording_flag = self.is_recording.clone();
        let total_samples_counter = self.total_samples.clone();
        let peak_holder = self.current_peak.clone();
        let buffer_holder = self.ring_buffer.clone();

        is_recording_flag.store(true, Ordering::SeqCst);

        let err_fn = move |err| {
            eprintln!("Error on audio input stream: {}", err);
        };

        let stream = match config.sample_format {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &config,
                move |data: &[f32], _| {
                    process_audio_chunk_f32(
                        data,
                        channels,
                        &is_recording_flag,
                        &total_samples_counter,
                        &peak_holder,
                        &buffer_holder,
                    );
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                &config,
                move |data: &[i16], _| {
                    let float_data: Vec<f32> = data.iter().map(|&s| s as f32 / 32768.0).collect();
                    process_audio_chunk_f32(
                        &float_data,
                        channels,
                        &is_recording_flag,
                        &total_samples_counter,
                        &peak_holder,
                        &buffer_holder,
                    );
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::U16 => device.build_input_stream(
                &config,
                move |data: &[u16], _| {
                    let float_data: Vec<f32> = data.iter().map(|&s| (s as f32 - 32768.0) / 32768.0).collect();
                    process_audio_chunk_f32(
                        &float_data,
                        channels,
                        &is_recording_flag,
                        &total_samples_counter,
                        &peak_holder,
                        &buffer_holder,
                    );
                },
                err_fn,
                None,
            ),
            _ => return Err("Unsupported sample format".to_string()),
        }.map_err(|e| format!("Failed to build input stream: {}", e))?;

        stream.play().map_err(|e| format!("Failed to start audio stream: {}", e))?;
        self.stream = Some(stream);

        Ok(RecordingStatus {
            is_recording: true,
            device_name: device_name_str,
            sample_rate,
            buffer_size: 512, // Hardware low-latency buffer target
            current_peak_db: -100.0,
            total_samples_captured: 0,
        })
    }

    pub fn stop(&mut self) -> RecordingStatus {
        self.is_recording.store(false, Ordering::SeqCst);
        self.stream = None;

        RecordingStatus {
            is_recording: false,
            device_name: self.device_name.lock().clone(),
            sample_rate: self.sample_rate.load(Ordering::SeqCst) as u32,
            buffer_size: 512,
            current_peak_db: *self.current_peak.lock(),
            total_samples_captured: self.total_samples.load(Ordering::SeqCst),
        }
    }

    pub fn status(&self) -> RecordingStatus {
        let is_rec = self.is_recording.load(Ordering::SeqCst);
        let peak = *self.current_peak.lock();
        let total = self.total_samples.load(Ordering::SeqCst);
        let name = self.device_name.lock().clone();
        let rate = self.sample_rate.load(Ordering::SeqCst) as u32;

        RecordingStatus {
            is_recording: is_rec,
            device_name: name,
            sample_rate: rate,
            buffer_size: 512,
            current_peak_db: peak,
            total_samples_captured: total,
        }
    }

    pub fn get_buffered_samples(&self, max_count: usize) -> Vec<f32> {
        let buf = self.ring_buffer.lock();
        if buf.len() <= max_count {
            buf.clone()
        } else {
            buf[buf.len() - max_count..].to_vec()
        }
    }
}

fn process_audio_chunk_f32(
    data: &[f32],
    channels: usize,
    is_recording: &Arc<AtomicBool>,
    total_samples: &Arc<AtomicU64>,
    peak_holder: &Arc<Mutex<f32>>,
    ring_buffer: &Arc<Mutex<Vec<f32>>>,
) {
    if !is_recording.load(Ordering::SeqCst) {
        return;
    }

    let mut mono_chunk = Vec::with_capacity(data.len() / channels.max(1));
    let mut max_amp = 0.0f32;

    for chunk in data.chunks(channels.max(1)) {
        let sample = chunk.iter().sum::<f32>() / channels.max(1) as f32;
        max_amp = max_amp.max(sample.abs());
        mono_chunk.push(sample);
    }

    let peak_db = if max_amp > 0.00001 {
        20.0 * max_amp.log10()
    } else {
        -100.0
    };

    *peak_holder.lock() = peak_db;
    total_samples.fetch_add(mono_chunk.len() as u64, Ordering::SeqCst);

    let mut buf = ring_buffer.lock();
    buf.extend(mono_chunk);
    // Keep max 5 seconds buffer at 48kHz (approx 240,000 samples)
    if buf.len() > 240,000 {
        let overflow = buf.len() - 240,000;
        buf.drain(0..overflow);
    }
}
