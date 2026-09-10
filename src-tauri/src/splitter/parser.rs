use once_cell::sync::Lazy;
use regex::Regex;

#[derive(Debug, Clone, PartialEq)]
pub enum SplitterOutputEvent {
    /// [PROGRESS] step=Loading model percent=10
    Progress { step: String, percent: f32 },
    /// [RESULT] {"vocal_path": "...", "instrumental_path": "...", "duration_secs": 215.4}
    Result {
        vocal_path: String,
        instrumental_path: String,
        duration_secs: f64,
    },
    /// [ERROR] some error text
    Error { message: String },
    Other,
}

static PROGRESS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[PROGRESS\]\s+step=(.+?)\s+percent=([\d.]+)").unwrap()
});

static RESULT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[RESULT\]\s+(.+)").unwrap()
});

static ERROR_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[ERROR\]\s+(.+)").unwrap()
});

pub fn parse_splitter_line(line: &str) -> SplitterOutputEvent {
    let trimmed = line.trim();

    if let Some(caps) = PROGRESS_RE.captures(trimmed) {
        let step = caps.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
        let percent = caps
            .get(2)
            .and_then(|m| m.as_str().parse::<f32>().ok())
            .unwrap_or(0.0);
        return SplitterOutputEvent::Progress { step, percent };
    }

    if let Some(caps) = RESULT_RE.captures(trimmed) {
        if let Some(json_str) = caps.get(1) {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(json_str.as_str()) {
                let vocal_path = v["vocal_path"]
                    .as_str()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                let instrumental_path = v["instrumental_path"]
                    .as_str()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                let duration_secs = v["duration_secs"].as_f64().unwrap_or(0.0);
                return SplitterOutputEvent::Result {
                    vocal_path,
                    instrumental_path,
                    duration_secs,
                };
            }
        }
    }

    if let Some(caps) = ERROR_RE.captures(trimmed) {
        let message = caps.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
        return SplitterOutputEvent::Error { message };
    }

    SplitterOutputEvent::Other
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_progress() {
        let line = "[PROGRESS] step=Loading model percent=10";
        match parse_splitter_line(line) {
            SplitterOutputEvent::Progress { step, percent } => {
                assert_eq!(step, "Loading model");
                assert_eq!(percent, 10.0);
            }
            _ => panic!("Expected Progress event"),
        }
    }

    #[test]
    fn test_parse_progress_with_spaces() {
        let line = "[PROGRESS] step=Separating stems percent=67.5";
        match parse_splitter_line(line) {
            SplitterOutputEvent::Progress { step, percent } => {
                assert_eq!(step, "Separating stems");
                assert!((percent - 67.5).abs() < 0.01);
            }
            _ => panic!("Expected Progress event"),
        }
    }

    #[test]
    fn test_parse_result() {
        let line = r#"[RESULT] {"vocal_path": "C:/cache/stems/job/vocals.wav", "instrumental_path": "C:/cache/stems/job/no_vocals.wav", "duration_secs": 215.4}"#;
        match parse_splitter_line(line) {
            SplitterOutputEvent::Result { vocal_path, instrumental_path, duration_secs } => {
                assert!(vocal_path.contains("vocals.wav"));
                assert!(instrumental_path.contains("no_vocals.wav"));
                assert!((duration_secs - 215.4).abs() < 0.01);
            }
            _ => panic!("Expected Result event"),
        }
    }

    #[test]
    fn test_parse_error() {
        let line = "[ERROR] Model 'htdemucs' not found in cache.";
        match parse_splitter_line(line) {
            SplitterOutputEvent::Error { message } => {
                assert!(message.contains("htdemucs"));
            }
            _ => panic!("Expected Error event"),
        }
    }
}
