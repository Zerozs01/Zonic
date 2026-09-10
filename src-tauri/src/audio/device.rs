use cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub sample_rate: u32,
    pub channels: u16,
    pub preferred_buffer_size: u32,
    pub estimated_latency_ms: f32,
    pub host_name: String,
    pub supported_formats: Vec<String>,
}

pub fn list_input_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    let host = cpal::default_host();
    let host_name = format!("{:?}", host.id());
    let devices = host.input_devices().map_err(|e| format!("Failed to list input devices: {}", e))?;
    
    let default_device_name = host.default_input_device().and_then(|d| d.name().ok());

    let mut device_list = Vec::new();
    for (idx, dev) in devices.enumerate() {
        let name = dev.name().unwrap_or_else(|_| format!("Audio Input Device {}", idx + 1));
        let is_default = default_device_name.as_ref() == Some(&name);

        let default_config = dev.default_input_config().ok();
        let mut supported_48k = false;
        let mut formats = Vec::new();

        if let Ok(supported_configs) = dev.supported_input_configs() {
            for cfg in supported_configs {
                let fmt_str = match cfg.sample_format() {
                    cpal::SampleFormat::I16 => "16-bit PCM",
                    cpal::SampleFormat::I32 => "24/32-bit PCM",
                    cpal::SampleFormat::F32 => "32-bit Float",
                    _ => "Standard PCM",
                };
                if !formats.contains(&fmt_str.to_string()) {
                    formats.push(fmt_str.to_string());
                }
                if cfg.min_sample_rate().0 <= 48000 && 48000 <= cfg.max_sample_rate().0 {
                    supported_48k = true;
                }
            }
        }

        // Enforce 48,000 Hz broadcast standard for dynamic USB mics (e.g. FIFINE K688)
        let sample_rate = if supported_48k {
            48000
        } else if let Some(ref def) = default_config {
            def.sample_rate().0
        } else {
            44100
        };

        let channels = default_config.map(|c| c.channels()).unwrap_or(1);
        let preferred_buffer_size = 256;
        let estimated_latency_ms = (preferred_buffer_size as f32 / sample_rate as f32) * 1000.0;

        device_list.push(AudioDeviceInfo {
            id: format!("device_{}", idx),
            name,
            is_default,
            sample_rate,
            channels,
            preferred_buffer_size,
            estimated_latency_ms: (estimated_latency_ms * 10.0).round() / 10.0,
            host_name: host_name.clone(),
            supported_formats: formats,
        });
    }

    Ok(device_list)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_list_input_devices() {
        let devs = list_input_devices().expect("Failed to list devices");
        assert!(!devs.is_empty());
        for dev in devs {
            println!("Found device: {} | {}Hz | {}ms latency", dev.name, dev.sample_rate, dev.estimated_latency_ms);
            assert!(dev.sample_rate >= 44100);
            assert!(dev.preferred_buffer_size == 256);
        }
    }
}
