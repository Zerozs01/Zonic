use std::fs::File;
use std::path::Path;
use serde::{Deserialize, Serialize};
use symphonia::core::audio::{AudioBufferRef, Signal};
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioFileMeta {
    pub file_path: String,
    pub file_name: String,
    pub sample_rate: u32,
    pub channels: u16,
    pub duration_seconds: f32,
    pub total_samples: usize,
    pub peak_amplitude: f32,
}

pub struct DecodedAudio {
    pub meta: AudioFileMeta,
    pub samples: Vec<f32>, // Mono float samples normalized [-1.0, 1.0]
}

pub fn read_audio_file(path_str: &str) -> Result<DecodedAudio, String> {
    let path = Path::new(path_str);
    if !path.exists() {
        return Err(format!("File does not exist: {}", path_str));
    }

    let file_name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    let extension = path
        .extension()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    // Fast path for WAV files using hound
    if extension == "wav" {
        if let Ok(decoded) = read_wav_hound(path_str, &file_name) {
            return Ok(decoded);
        }
    }

    // Fallback/Generic decoder using Symphonia (MP3, WAV, etc.)
    read_generic_symphonia(path_str, &file_name)
}

fn read_wav_hound(path_str: &str, file_name: &str) -> Result<DecodedAudio, String> {
    let mut reader = hound::WavReader::open(path_str).map_err(|e| e.to_string())?;
    let spec = reader.spec();

    let sample_rate = spec.sample_rate;
    let channels = spec.channels as u16;

    let raw_samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => reader.samples::<f32>().map(|s| s.unwrap_or(0.0)).collect(),
        hound::SampleFormat::Int => {
            let max_val = (1i64 << (spec.bits_per_sample - 1)) as f32;
            reader
                .samples::<i32>()
                .map(|s| (s.unwrap_or(0) as f32) / max_val)
                .collect()
        }
    };

    // Convert to Mono if multi-channel
    let mono_samples = to_mono(&raw_samples, channels as usize);
    let peak_amplitude = calculate_peak(&mono_samples);
    let total_samples = mono_samples.len();
    let duration_seconds = total_samples as f32 / sample_rate as f32;

    Ok(DecodedAudio {
        meta: AudioFileMeta {
            file_path: path_str.to_string(),
            file_name: file_name.to_string(),
            sample_rate,
            channels,
            duration_seconds,
            total_samples,
            peak_amplitude,
        },
        samples: mono_samples,
    })
}

fn read_generic_symphonia(path_str: &str, file_name: &str) -> Result<DecodedAudio, String> {
    let file = File::open(path_str).map_err(|e| format!("Failed to open file: {}", e))?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let mut hint = Hint::new();
    if let Some(ext) = Path::new(path_str).extension().and_then(|e| e.to_str()) {
        hint.with_extension(ext);
    }

    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();
    let decoder_opts = DecoderOptions::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| format!("Unsupported audio format: {}", e))?;

    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| "No audio track found in file".to_string())?;

    let sample_rate = track.codec_params.sample_rate.unwrap_or(44100);
    let channels = track.codec_params.channels.map(|c| c.count() as u16).unwrap_or(1);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &decoder_opts)
        .map_err(|e| format!("Failed to create audio decoder: {}", e))?;

    let track_id = track.id;
    let mut pcm_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(SymphoniaError::IoError(ref e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(SymphoniaError::ResetRequired) => break,
            Err(e) => return Err(format!("Error reading packet: {}", e)),
        };

        if packet.track_id() != track_id {
            continue;
        }

        match decoder.decode(&packet) {
            Ok(audio_buf) => {
                append_audio_buffer(&audio_buf, &mut pcm_samples);
            }
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(e) => return Err(format!("Error decoding packet: {}", e)),
        }
    }

    let mono_samples = to_mono(&pcm_samples, channels as usize);
    let peak_amplitude = calculate_peak(&mono_samples);
    let total_samples = mono_samples.len();
    let duration_seconds = total_samples as f32 / sample_rate as f32;

    Ok(DecodedAudio {
        meta: AudioFileMeta {
            file_path: path_str.to_string(),
            file_name: file_name.to_string(),
            sample_rate,
            channels,
            duration_seconds,
            total_samples,
            peak_amplitude,
        },
        samples: mono_samples,
    })
}

fn append_audio_buffer(audio_buf: &AudioBufferRef, out: &mut Vec<f32>) {
    match audio_buf {
        AudioBufferRef::F32(buf) => {
            for &sample in buf.chan(0) {
                out.push(sample);
            }
        }
        AudioBufferRef::S16(buf) => {
            for &sample in buf.chan(0) {
                out.push(sample as f32 / 32768.0);
            }
        }
        AudioBufferRef::U8(buf) => {
            for &sample in buf.chan(0) {
                out.push((sample as f32 - 128.0) / 128.0);
            }
        }
        _ => {}
    }
}

fn to_mono(samples: &[f32], channels: usize) -> Vec<f32> {
    if channels <= 1 {
        return samples.to_vec();
    }
    samples
        .chunks(channels)
        .map(|chunk| chunk.iter().sum::<f32>() / channels as f32)
        .collect()
}

fn calculate_peak(samples: &[f32]) -> f32 {
    samples.iter().map(|s| s.abs()).fold(0.0f32, f32::max)
}
