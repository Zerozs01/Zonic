use cpal::traits::{DeviceTrait, HostTrait};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioDeviceInfo {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub sample_rate: u32,
    pub channels: u16,
}

pub fn list_input_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    let host = cpal::default_host();
    let devices = host.input_devices().map_err(|e| format!("Failed to list input devices: {}", e))?;
    
    let default_device_name = host.default_input_device().and_then(|d| d.name().ok());

    let mut device_list = Vec::new();
    for (idx, dev) in devices.enumerate() {
        let name = dev.name().unwrap_or_else(|_| format!("Audio Input Device {}", idx + 1));
        let is_default = default_device_name.as_ref() == Some(&name);

        let (sample_rate, channels) = match dev.default_input_config() {
            Ok(config) => (config.sample_rate().0, config.channels()),
            Err(_) => (44100, 1),
        };

        device_list.push(AudioDeviceInfo {
            id: format!("device_{}", idx),
            name,
            is_default,
            sample_rate,
            channels,
        });
    }

    Ok(device_list)
}
