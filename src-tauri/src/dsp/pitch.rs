use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PitchFrame {
    pub timestamp_ms: f64,
    pub frequency_hz: f32,
    pub amplitude_db: f32,
    pub clarity: f32,
    pub note_name: String,
    pub cents_offset: f32,
    pub is_voiced: bool,
}

#[derive(Debug, Clone)]
pub struct YinConfig {
    pub sample_rate: u32,
    pub window_size: usize,  // e.g., 1024 or 2048 samples
    pub threshold: f32,      // YIN difference threshold (e.g., 0.15)
    pub min_freq_hz: f32,    // e.g., 50 Hz (E1)
    pub max_freq_hz: f32,    // e.g., 1500 Hz (F6)
}

impl Default for YinConfig {
    fn default() -> Self {
        Self {
            sample_rate: 44100,
            window_size: 2048,
            threshold: 0.15,
            min_freq_hz: 60.0,
            max_freq_hz: 1200.0,
        }
    }
}

pub struct YinDetector {
    config: YinConfig,
    yin_buffer: Vec<f32>,
}

impl YinDetector {
    pub fn new(config: YinConfig) -> Self {
        let half_window = config.window_size / 2;
        Self {
            config,
            yin_buffer: vec![0.0; half_window],
        }
    }

    pub fn detect_pitch(&mut self, samples: &[f32], timestamp_ms: f64) -> PitchFrame {
        let window_size = self.config.window_size;
        if samples.len() < window_size {
            return unvoiced_frame(timestamp_ms, -100.0);
        }

        // 1. Calculate RMS & Amplitude in dB
        let rms = calculate_rms(&samples[..window_size]);
        let amplitude_db = if rms > 0.00001 {
            20.0 * rms.log10()
        } else {
            -100.0
        };

        // Silence gate: if RMS is below threshold (e.g. -50dB), treat as unvoiced
        if amplitude_db < -50.0 {
            return unvoiced_frame(timestamp_ms, amplitude_db);
        }

        let half_window = window_size / 2;
        let min_tau = (self.config.sample_rate as f32 / self.config.max_freq_hz) as usize;
        let max_tau = (self.config.sample_rate as f32 / self.config.min_freq_hz) as usize;
        let max_tau = max_tau.min(half_window - 1);

        if min_tau >= max_tau {
            return unvoiced_frame(timestamp_ms, amplitude_db);
        }

        // Step 1 & 2: Difference Function bounded to valid pitch range + auto-vectorized zip
        let upper_tau = (max_tau + 2).min(half_window);
        self.yin_buffer[0] = 1.0;

        let base_slice = &samples[..half_window];
        for tau in 1..upper_tau {
            let shifted_slice = &samples[tau..half_window + tau];
            let diff: f32 = base_slice
                .iter()
                .zip(shifted_slice.iter())
                .map(|(&a, &b)| {
                    let d = a - b;
                    d * d
                })
                .sum();
            self.yin_buffer[tau] = diff;
        }

        // Step 2: Cumulative Mean Normalized Difference Function
        let mut running_sum = 0.0f32;
        self.yin_buffer[0] = 1.0;
        for tau in 1..upper_tau {
            running_sum += self.yin_buffer[tau];
            if running_sum > 0.0 {
                self.yin_buffer[tau] *= tau as f32 / running_sum;
            } else {
                self.yin_buffer[tau] = 1.0;
            }
        }


        // Step 3: Absolute Thresholding
        let mut best_tau = 0;
        let mut found_threshold = false;

        for tau in min_tau..max_tau {
            if self.yin_buffer[tau] < self.config.threshold {
                let mut tau_min = tau;
                while tau_min + 1 < max_tau && self.yin_buffer[tau_min + 1] < self.yin_buffer[tau_min] {
                    tau_min += 1;
                }
                best_tau = tau_min;
                found_threshold = true;
                break;
            }
        }

        if !found_threshold {
            // Find global minimum in tau range
            let mut min_val = f32::MAX;
            for tau in min_tau..max_tau {
                if self.yin_buffer[tau] < min_val {
                    min_val = self.yin_buffer[tau];
                    best_tau = tau;
                }
            }
        }

        if best_tau == 0 {
            return unvoiced_frame(timestamp_ms, amplitude_db);
        }

        // Step 4: Parabolic Interpolation for Sub-sample Refinement
        let refined_tau = parabolic_interpolation(&self.yin_buffer, best_tau);

        let clarity = 1.0 - self.yin_buffer[best_tau].min(1.0).max(0.0);
        if clarity < 0.35 {
            // Low confidence pitch candidate
            return unvoiced_frame(timestamp_ms, amplitude_db);
        }

        let frequency_hz = self.config.sample_rate as f32 / refined_tau;

        if frequency_hz < self.config.min_freq_hz || frequency_hz > self.config.max_freq_hz {
            return unvoiced_frame(timestamp_ms, amplitude_db);
        }

        let (note_name, cents_offset) = hz_to_note_and_cents(frequency_hz);

        PitchFrame {
            timestamp_ms,
            frequency_hz,
            amplitude_db,
            clarity,
            note_name,
            cents_offset,
            is_voiced: true,
        }
    }
}

fn calculate_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    let sum_sq: f32 = samples.iter().map(|&s| s * s).sum();
    (sum_sq / samples.len() as f32).sqrt()
}

fn parabolic_interpolation(array: &[f32], x: usize) -> f32 {
    if x == 0 || x >= array.len() - 1 {
        return x as f32;
    }
    let s0 = array[x - 1];
    let s1 = array[x];
    let s2 = array[x + 1];

    let denominator = s2 - 2.0 * s1 + s0;
    if denominator.abs() < 1e-6 {
        return x as f32;
    }
    let delta = (s0 - s2) / (2.0 * denominator);
    x as f32 + delta
}

fn unvoiced_frame(timestamp_ms: f64, amplitude_db: f32) -> PitchFrame {
    PitchFrame {
        timestamp_ms,
        frequency_hz: 0.0,
        amplitude_db,
        clarity: 0.0,
        note_name: "Unvoiced".to_string(),
        cents_offset: 0.0,
        is_voiced: false,
    }
}

pub fn hz_to_note_and_cents(freq_hz: f32) -> (String, f32) {
    if freq_hz <= 0.0 {
        return ("-".to_string(), 0.0);
    }
    // A4 = 440 Hz, MIDI 69
    let midi = 69.0 + 12.0 * (freq_hz / 440.0).log2();
    let midi_round = midi.round();
    let cents = (midi - midi_round) * 100.0;

    let notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    let note_idx = (midi_round as i32).rem_euclid(12) as usize;
    let octave = (midi_round as i32) / 12 - 1;

    let note_name = format!("{}{}", notes[note_idx], octave);
    (note_name, cents)
}
