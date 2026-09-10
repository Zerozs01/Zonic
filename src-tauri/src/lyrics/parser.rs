use once_cell::sync::Lazy;
use regex::Regex;

use super::{SyncProgressPayload, SyncedLyricsResult};

#[derive(Debug, Clone, PartialEq)]
pub enum AlignerOutputEvent {
    Progress(SyncProgressPayload),
    Result(SyncedLyricsResult),
    Error(String),
    Other,
}

static PROGRESS_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[PROGRESS\]\s+percent=([\d.]+)\s+stage=([^\s]+)\s+message=(.+)").unwrap()
});

static RESULT_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[RESULT\]\s+(.+)").unwrap()
});

static ERROR_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[ERROR\]\s+(.+)").unwrap()
});

pub fn parse_aligner_line(job_id: &str, line: &str) -> AlignerOutputEvent {
    let trimmed = line.trim();

    if let Some(caps) = PROGRESS_RE.captures(trimmed) {
        let percent = caps
            .get(1)
            .and_then(|m| m.as_str().parse::<f32>().ok())
            .unwrap_or(0.0);
        let stage = caps
            .get(2)
            .map(|m| m.as_str().to_string())
            .unwrap_or_else(|| "processing".to_string());
        let message = caps
            .get(3)
            .map(|m| m.as_str().to_string())
            .unwrap_or_default();

        return AlignerOutputEvent::Progress(SyncProgressPayload {
            job_id: job_id.to_string(),
            percent,
            stage,
            message,
        });
    }

    if let Some(caps) = RESULT_RE.captures(trimmed) {
        if let Some(json_str) = caps.get(1) {
            match serde_json::from_str::<SyncedLyricsResult>(json_str.as_str()) {
                Ok(result) => return AlignerOutputEvent::Result(result),
                Err(e) => {
                    eprintln!("[LyricsParser] JSON deserialize error: {}", e);
                    eprintln!("[LyricsParser] Raw payload: {}", json_str.as_str());
                    return AlignerOutputEvent::Error(format!("JSON Parse Error: {}", e));
                }
            }
        }
    }

    if let Some(caps) = ERROR_RE.captures(trimmed) {
        let msg = caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
        return AlignerOutputEvent::Error(msg);
    }

    AlignerOutputEvent::Other
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_progress() {
        let line = "[PROGRESS] percent=35.0 stage=vad message=Analyzing vocal wave envelope...";
        match parse_aligner_line("job_1", line) {
            AlignerOutputEvent::Progress(p) => {
                assert_eq!(p.percent, 35.0);
                assert_eq!(p.stage, "vad");
                assert_eq!(p.job_id, "job_1");
            }
            _ => panic!("Expected progress event"),
        }
    }

    #[test]
    fn test_parse_result() {
        let line = r#"[RESULT] {"jobId": "job_1", "vocalPath": "C:\\test.mp3", "durationSecs": 266.82, "avgConfidence": 0.92, "lines": [{"id": "align-0", "startTime": 1.65, "endTime": 13.05, "text": "🎵 VocalAlign", "words": [{"word": "🎵", "start": 1.65, "end": 2.92, "confidence": 0.92}], "confidence": 0.92}]}"#;
        match parse_aligner_line("job_1", line) {
            AlignerOutputEvent::Result(r) => {
                assert_eq!(r.job_id, "job_1");
                assert_eq!(r.duration_secs, 266.82);
                assert_eq!(r.avg_confidence, 0.92);
                assert_eq!(r.lines.len(), 1);
                assert_eq!(r.lines[0].text, "🎵 VocalAlign");
            }
            AlignerOutputEvent::Error(err) => panic!("Parse error: {}", err),
            _ => panic!("Expected result event"),
        }
    }
}
