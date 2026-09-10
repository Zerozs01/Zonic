use std::f32::consts::PI;

/// 2nd-order Butterworth High-Pass Biquad Filter
/// Designed to cut sub-80Hz mechanical rumble, desk vibrations, proximity pops,
/// and 50/60Hz AC electrical hum from dynamic microphones (e.g. FIFINE K688).
#[derive(Debug, Clone)]
pub struct HighPassFilter {
    sample_rate: f32,
    cutoff_hz: f32,
    b0: f32,
    b1: f32,
    b2: f32,
    a1: f32,
    a2: f32,
    // Filter state (Direct Form II Transposed)
    s1: f32,
    s2: f32,
    enabled: bool,
}

impl HighPassFilter {
    pub fn new(sample_rate: u32, cutoff_hz: f32) -> Self {
        let mut filter = Self {
            sample_rate: sample_rate as f32,
            cutoff_hz,
            b0: 1.0,
            b1: 0.0,
            b2: 0.0,
            a1: 0.0,
            a2: 0.0,
            s1: 0.0,
            s2: 0.0,
            enabled: true,
        };
        filter.recalculate();
        filter
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
        if !enabled {
            self.reset();
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn set_sample_rate(&mut self, sample_rate: u32) {
        self.sample_rate = sample_rate as f32;
        self.recalculate();
    }

    pub fn reset(&mut self) {
        self.s1 = 0.0;
        self.s2 = 0.0;
    }

    fn recalculate(&mut self) {
        let sr = self.sample_rate.max(8000.0);
        let fc = self.cutoff_hz.clamp(20.0, sr * 0.45);
        let omega = 2.0 * PI * fc / sr;
        let cos_omega = omega.cos();
        let sin_omega = omega.sin();
        let q = 1.0 / std::f32::consts::SQRT_2; // Butterworth Q = 0.7071
        let alpha = sin_omega / (2.0 * q);

        let a0 = 1.0 + alpha;
        self.b0 = ((1.0 + cos_omega) / 2.0) / a0;
        self.b1 = (-(1.0 + cos_omega)) / a0;
        self.b2 = ((1.0 + cos_omega) / 2.0) / a0;
        self.a1 = (-2.0 * cos_omega) / a0;
        self.a2 = (1.0 - alpha) / a0;
    }

    /// Process a single audio sample (Transposed Direct Form II for numerical stability)
    #[inline]
    pub fn process_sample(&mut self, input: f32) -> f32 {
        if !self.enabled {
            return input;
        }

        let output = self.b0 * input + self.s1;
        self.s1 = self.b1 * input - self.a1 * output + self.s2;
        self.s2 = self.b2 * input - self.a2 * output;
        output
    }

    /// In-place slice processing
    pub fn process_block(&mut self, samples: &mut [f32]) {
        if !self.enabled {
            return;
        }
        for sample in samples.iter_mut() {
            *sample = self.process_sample(*sample);
        }
    }
}

/// Dynamic Microphone Studio Gain Stage
/// Adds clean linear gain and a soft-knee tanh peak limiter to keep
/// dynamic mic vocals in the optimal -18 to -12 dBFS sweet spot without clipping.
#[derive(Debug, Clone)]
pub struct GainStage {
    gain_db: f32,
    linear_gain: f32,
}

impl GainStage {
    pub fn new(gain_db: f32) -> Self {
        let mut stage = Self {
            gain_db: 0.0,
            linear_gain: 1.0,
        };
        stage.set_gain_db(gain_db);
        stage
    }

    pub fn set_gain_db(&mut self, db: f32) {
        self.gain_db = db.clamp(-12.0, 36.0);
        self.linear_gain = 10.0f32.powf(self.gain_db / 20.0);
    }

    pub fn get_gain_db(&self) -> f32 {
        self.gain_db
    }

    /// Process sample with soft-knee saturation limit at 0.98 (-0.18 dBFS)
    #[inline]
    pub fn process_sample(&self, input: f32) -> f32 {
        let amplified = input * self.linear_gain;
        // Soft-knee tanh saturation when approaching 0 dBFS to prevent harsh digital clipping
        if amplified.abs() > 0.85 {
            let sign = amplified.signum();
            let excess = (amplified.abs() - 0.85) / 0.15;
            sign * (0.85 + 0.13 * excess.tanh())
        } else {
            amplified
        }
    }

    pub fn process_block(&self, samples: &mut [f32]) {
        for sample in samples.iter_mut() {
            *sample = self.process_sample(*sample);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_high_pass_filter_attenuation() {
        let mut filter = HighPassFilter::new(48000, 80.0);
        // Process 30Hz sine wave (should be significantly attenuated)
        let mut samples_30hz: Vec<f32> = (0..4800)
            .map(|i| (2.0 * PI * 30.0 * (i as f32 / 48000.0)).sin())
            .collect();
        filter.process_block(&mut samples_30hz);
        let max_amp = samples_30hz[2400..].iter().map(|s| s.abs()).fold(0.0f32, f32::max);
        assert!(max_amp < 0.4, "30Hz signal should be attenuated below 0.4, got {}", max_amp);

        // Process 440Hz sine wave (A4 note, should pass with unity gain ~1.0)
        let mut filter_440 = HighPassFilter::new(48000, 80.0);
        let mut samples_440hz: Vec<f32> = (0..4800)
            .map(|i| (2.0 * PI * 440.0 * (i as f32 / 48000.0)).sin())
            .collect();
        filter_440.process_block(&mut samples_440hz);
        let max_amp_440 = samples_440hz[2400..].iter().map(|s| s.abs()).fold(0.0f32, f32::max);
        assert!(max_amp_440 > 0.95, "440Hz vocal note should pass with unity gain, got {}", max_amp_440);
    }

    #[test]
    fn test_gain_stage_limiting() {
        let gain_stage = GainStage::new(18.0); // +18 dB boost (approx 7.94x)
        let loud_input = 0.5f32; // 0.5 * 7.94 = ~3.97 (would severely clip)
        let limited_output = gain_stage.process_sample(loud_input);
        assert!(limited_output.abs() < 1.0, "Output should be safely limited below 1.0, got {}", limited_output);
    }
}
