use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{BufferSize, SampleRate, Stream, StreamConfig};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

use crate::dsp::filter::{GainStage, HighPassFilter};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecordingStatus {
    pub is_recording: bool,
    pub device_name: String,
    pub sample_rate: u32,
    pub buffer_size: u32,
    pub latency_ms: f32,
    pub host_name: String,
    pub current_peak_db: f32,
    pub total_samples_captured: u64,
    pub high_pass_enabled: bool,
    pub gain_db: f32,
}

#[derive(Debug, Clone)]
pub struct CircularAudioBuffer {
    buffer: Vec<f32>,
    write_pos: usize,
    total_written: usize,
    capacity: usize,
}

impl CircularAudioBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: vec![0.0; capacity],
            write_pos: 0,
            total_written: 0,
            capacity,
        }
    }

    pub fn clear(&mut self) {
        self.write_pos = 0;
        self.total_written = 0;
        self.buffer.fill(0.0);
    }

    #[inline(always)]
    pub fn push_sample(&mut self, sample: f32) {
        self.buffer[self.write_pos] = sample;
        self.write_pos = (self.write_pos + 1) % self.capacity;
        self.total_written = self.total_written.saturating_add(1);
    }

    pub fn get_latest_samples(&self, max_count: usize) -> Vec<f32> {
        let available = self.total_written.min(self.capacity);
        let count = max_count.min(available);
        if count == 0 {
            return Vec::new();
        }

        let start_pos = (self.write_pos + self.capacity - count) % self.capacity;
        if start_pos + count <= self.capacity {
            self.buffer[start_pos..start_pos + count].to_vec()
        } else {
            let mut res = Vec::with_capacity(count);
            res.extend_from_slice(&self.buffer[start_pos..]);
            res.extend_from_slice(&self.buffer[..count - (self.capacity - start_pos)]);
            res
        }
    }
}

pub struct AudioRecorder {
    stream: Option<Stream>,
    is_recording: Arc<AtomicBool>,
    total_samples: Arc<AtomicU64>,
    current_peak: Arc<Mutex<f32>>,
    device_name: Arc<Mutex<String>>,
    sample_rate: Arc<AtomicU64>,
    buffer_size: Arc<AtomicU64>,
    host_name: Arc<Mutex<String>>,
    ring_buffer: Arc<Mutex<CircularAudioBuffer>>,
    high_pass_filter: Arc<Mutex<HighPassFilter>>,
    gain_stage: Arc<Mutex<GainStage>>,
}

// cpal::Stream contains a raw pointer (*mut ()) on Windows making it !Send and !Sync by default.
// Since AudioRecorder is always accessed behind a Mutex, it is safe to implement Send and Sync.
unsafe impl Send for AudioRecorder {}
unsafe impl Sync for AudioRecorder {}

impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            stream: None,
            is_recording: Arc::new(AtomicBool::new(false)),
            total_samples: Arc::new(AtomicU64::new(0)),
            current_peak: Arc::new(Mutex::new(-100.0)),
            device_name: Arc::new(Mutex::new("None".to_string())),
            sample_rate: Arc::new(AtomicU64::new(48000)),
            buffer_size: Arc::new(AtomicU64::new(256)),
            host_name: Arc::new(Mutex::new("WASAPI".to_string())),
            ring_buffer: Arc::new(Mutex::new(CircularAudioBuffer::new(48000 * 5))), // 5s circular buffer
            high_pass_filter: Arc::new(Mutex::new(HighPassFilter::new(48000, 80.0))),
            gain_stage: Arc::new(Mutex::new(GainStage::new(6.0))), // +6dB initial sweet spot
        }
    }

    pub fn set_processing(&self, high_pass: bool, gain_db: f32) {
        self.high_pass_filter.lock().set_enabled(high_pass);
        self.gain_stage.lock().set_gain_db(gain_db);
    }

    pub fn start(&mut self, target_device_name: Option<String>) -> Result<RecordingStatus, String> {
        if self.is_recording.load(Ordering::SeqCst) {
            let current_dev = self.device_name.lock().clone();
            if target_device_name.as_ref() == Some(&current_dev) || target_device_name.is_none() {
                return Ok(self.status());
            }
            self.stop();
        }

        let host = cpal::default_host();
        let host_name_str = format!("{:?}", host.id());
        *self.host_name.lock() = host_name_str.clone();

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

        // 1. Check supported configs & enforce 48,000 Hz if available
        let mut supported_48k = false;
        let mut best_format = cpal::SampleFormat::F32;
        if let Ok(supported_configs) = device.supported_input_configs() {
            for cfg in supported_configs {
                if cfg.min_sample_rate().0 <= 48000 && 48000 <= cfg.max_sample_rate().0 {
                    supported_48k = true;
                    best_format = cfg.sample_format();
                }
            }
        }

        let default_config = device.default_input_config().ok();
        let target_sr = if supported_48k {
            48000
        } else if let Some(ref def) = default_config {
            def.sample_rate().0
        } else {
            44100
        };

        let channels = default_config.as_ref().map(|c| c.channels()).unwrap_or(1);
        let sample_format = default_config.as_ref().map(|c| c.sample_format()).unwrap_or(best_format);

        // 2. Build low-latency WASAPI stream with 256 samples target
        let target_buffer_size = 256u32;
        let config_fixed = StreamConfig {
            channels,
            sample_rate: SampleRate(target_sr),
            buffer_size: BufferSize::Fixed(target_buffer_size),
        };

        let sample_rate = target_sr;
        self.sample_rate.store(sample_rate as u64, Ordering::SeqCst);
        self.buffer_size.store(target_buffer_size as u64, Ordering::SeqCst);
        *self.device_name.lock() = device_name_str.clone();
        self.total_samples.store(0, Ordering::SeqCst);
        self.ring_buffer.lock().clear();

        // Update HighPass filter sample rate
        self.high_pass_filter.lock().set_sample_rate(sample_rate);
        self.high_pass_filter.lock().reset();

        let is_recording_flag = self.is_recording.clone();
        let total_samples_counter = self.total_samples.clone();
        let peak_holder = self.current_peak.clone();
        let buffer_holder = self.ring_buffer.clone();
        let hp_filter_holder = self.high_pass_filter.clone();
        let gain_stage_holder = self.gain_stage.clone();

        is_recording_flag.store(true, Ordering::SeqCst);

        let err_fn = move |err| {
            eprintln!("[AudioRecorder] Error on audio input stream: {}", err);
        };

        let channels_count = channels as usize;

        // Try fixed 256 buffer first, with fallback to default buffer
        let stream_result = match sample_format {
            cpal::SampleFormat::F32 => device.build_input_stream(
                &config_fixed,
                move |data: &[f32], _| {
                    process_audio_chunk_f32(
                        data,
                        channels_count,
                        &is_recording_flag,
                        &total_samples_counter,
                        &peak_holder,
                        &buffer_holder,
                        &hp_filter_holder,
                        &gain_stage_holder,
                    );
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::I16 => device.build_input_stream(
                &config_fixed,
                move |data: &[i16], _| {
                    let float_data: Vec<f32> = data.iter().map(|&s| s as f32 / 32768.0).collect();
                    process_audio_chunk_f32(
                        &float_data,
                        channels_count,
                        &is_recording_flag,
                        &total_samples_counter,
                        &peak_holder,
                        &buffer_holder,
                        &hp_filter_holder,
                        &gain_stage_holder,
                    );
                },
                err_fn,
                None,
            ),
            cpal::SampleFormat::I32 => device.build_input_stream(
                &config_fixed,
                move |data: &[i32], _| {
                    let float_data: Vec<f32> = data.iter().map(|&s| s as f32 / 2147483648.0).collect();
                    process_audio_chunk_f32(
                        &float_data,
                        channels_count,
                        &is_recording_flag,
                        &total_samples_counter,
                        &peak_holder,
                        &buffer_holder,
                        &hp_filter_holder,
                        &gain_stage_holder,
                    );
                },
                err_fn,
                None,
            ),
            _ => return Err("Unsupported audio sample format".to_string()),
        };

        let stream = match stream_result {
            Ok(s) => s,
            Err(e) => {
                println!("[AudioRecorder] Fixed buffer rejected ({}), falling back to default buffer config...", e);
                let fallback_config = StreamConfig {
                    channels,
                    sample_rate: SampleRate(target_sr),
                    buffer_size: BufferSize::Default,
                };
                let is_rec = self.is_recording.clone();
                let tot = self.total_samples.clone();
                let pk = self.current_peak.clone();
                let buf = self.ring_buffer.clone();
                let hp = self.high_pass_filter.clone();
                let gs = self.gain_stage.clone();

                match sample_format {
                    cpal::SampleFormat::F32 => device.build_input_stream(
                        &fallback_config,
                        move |data: &[f32], _| {
                            process_audio_chunk_f32(data, channels_count, &is_rec, &tot, &pk, &buf, &hp, &gs);
                        },
                        |err| eprintln!("[AudioRecorder] Fallback stream error: {}", err),
                        None,
                    ),
                    cpal::SampleFormat::I16 => device.build_input_stream(
                        &fallback_config,
                        move |data: &[i16], _| {
                            let float_data: Vec<f32> = data.iter().map(|&s| s as f32 / 32768.0).collect();
                            process_audio_chunk_f32(&float_data, channels_count, &is_rec, &tot, &pk, &buf, &hp, &gs);
                        },
                        |err| eprintln!("[AudioRecorder] Fallback stream error: {}", err),
                        None,
                    ),
                    _ => return Err(format!("Failed to build input stream: {}", e)),
                }.map_err(|e| format!("Failed to build fallback input stream: {}", e))?
            }
        };

        stream.play().map_err(|e| format!("Failed to start audio stream: {}", e))?;
        self.stream = Some(stream);

        let latency_ms = (target_buffer_size as f32 / sample_rate as f32) * 1000.0;

        Ok(RecordingStatus {
            is_recording: true,
            device_name: device_name_str,
            sample_rate,
            buffer_size: target_buffer_size,
            latency_ms: (latency_ms * 10.0).round() / 10.0,
            host_name: host_name_str,
            current_peak_db: -100.0,
            total_samples_captured: 0,
            high_pass_enabled: self.high_pass_filter.lock().is_enabled(),
            gain_db: self.gain_stage.lock().get_gain_db(),
        })
    }

    pub fn stop(&mut self) -> RecordingStatus {
        self.is_recording.store(false, Ordering::SeqCst);
        self.stream = None;

        let sr = self.sample_rate.load(Ordering::SeqCst) as u32;
        let buf_sz = self.buffer_size.load(Ordering::SeqCst) as u32;
        let lat = (buf_sz as f32 / sr.max(1) as f32) * 1000.0;

        RecordingStatus {
            is_recording: false,
            device_name: self.device_name.lock().clone(),
            sample_rate: sr,
            buffer_size: buf_sz,
            latency_ms: (lat * 10.0).round() / 10.0,
            host_name: self.host_name.lock().clone(),
            current_peak_db: *self.current_peak.lock(),
            total_samples_captured: self.total_samples.load(Ordering::SeqCst),
            high_pass_enabled: self.high_pass_filter.lock().is_enabled(),
            gain_db: self.gain_stage.lock().get_gain_db(),
        }
    }

    pub fn status(&self) -> RecordingStatus {
        let is_rec = self.is_recording.load(Ordering::SeqCst);
        let peak = *self.current_peak.lock();
        let total = self.total_samples.load(Ordering::SeqCst);
        let name = self.device_name.lock().clone();
        let sr = self.sample_rate.load(Ordering::SeqCst) as u32;
        let buf_sz = self.buffer_size.load(Ordering::SeqCst) as u32;
        let lat = (buf_sz as f32 / sr.max(1) as f32) * 1000.0;

        RecordingStatus {
            is_recording: is_rec,
            device_name: name,
            sample_rate: sr,
            buffer_size: buf_sz,
            latency_ms: (lat * 10.0).round() / 10.0,
            host_name: self.host_name.lock().clone(),
            current_peak_db: peak,
            total_samples_captured: total,
            high_pass_enabled: self.high_pass_filter.lock().is_enabled(),
            gain_db: self.gain_stage.lock().get_gain_db(),
        }
    }

    pub fn get_buffered_samples(&self, max_count: usize) -> Vec<f32> {
        self.ring_buffer.lock().get_latest_samples(max_count)
    }
}

fn process_audio_chunk_f32(
    data: &[f32],
    channels: usize,
    is_recording: &Arc<AtomicBool>,
    total_samples: &Arc<AtomicU64>,
    peak_holder: &Arc<Mutex<f32>>,
    ring_buffer: &Arc<Mutex<CircularAudioBuffer>>,
    high_pass_filter: &Arc<Mutex<HighPassFilter>>,
    gain_stage: &Arc<Mutex<GainStage>>,
) {
    if !is_recording.load(Ordering::SeqCst) {
        return;
    }

    let ch = channels.max(1);
    let num_samples = data.len() / ch;
    if num_samples == 0 {
        return;
    }

    let mut max_amp = 0.0f32;
    let mut hp = high_pass_filter.lock();
    let gs = gain_stage.lock();
    let mut buf = ring_buffer.lock();

    for chunk in data.chunks(ch) {
        // Mix to mono
        let raw_mono = chunk.iter().sum::<f32>() / ch as f32;

        // 1. Apply 80 Hz Low-Cut (High-Pass) Biquad filter to eliminate desk rumble / plosives
        let filtered = hp.process_sample(raw_mono);

        // 2. Apply Dynamic Mic Studio Gain Staging with soft-knee limiter
        let processed = gs.process_sample(filtered);

        max_amp = max_amp.max(processed.abs());
        buf.push_sample(processed);
    }

    drop(buf);
    drop(hp);
    drop(gs);

    let peak_db = if max_amp > 0.00001 {
        20.0 * max_amp.log10()
    } else {
        -100.0
    };

    *peak_holder.lock() = peak_db;
    total_samples.fetch_add(num_samples as u64, Ordering::SeqCst);
}
