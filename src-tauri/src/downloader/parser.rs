use once_cell::sync::Lazy;
use regex::Regex;

#[derive(Debug, Clone, PartialEq)]
pub enum YtDlpOutputEvent {
    Progress {
        percent: f32,
        speed: String,
        eta: String,
    },
    Converting {
        phase_text: String,
    },
    Destination {
        file_path: String,
    },
    Other,
}

static PROGRESS_CHECK_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[download\]\s+([\d.]+)%").unwrap()
});

static SPEED_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"at\s+([^\s]+)").unwrap()
});

static ETA_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"ETA\s+([^\s]+)").unwrap()
});

static DESTINATION_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[(?:ExtractAudio|ffmpeg|download)\]\s+Destination:\s+(.+)").unwrap()
});

static ALREADY_DOWNLOADED_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[download\]\s+(.+)\s+has already been downloaded").unwrap()
});

static CONVERTING_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\[(?:ExtractAudio|ffmpeg|Merger)\]").unwrap()
});

pub fn parse_ytdlp_line(line: &str) -> YtDlpOutputEvent {
    let trimmed = line.trim();

    if let Some(caps) = DESTINATION_RE.captures(trimmed) {
        if let Some(m) = caps.get(1) {
            return YtDlpOutputEvent::Destination {
                file_path: m.as_str().trim().to_string(),
            };
        }
    }

    if let Some(caps) = ALREADY_DOWNLOADED_RE.captures(trimmed) {
        if let Some(m) = caps.get(1) {
            return YtDlpOutputEvent::Destination {
                file_path: m.as_str().trim().to_string(),
            };
        }
    }

    if let Some(caps) = PROGRESS_CHECK_RE.captures(trimmed) {
        let percent = caps.get(1).and_then(|m| m.as_str().parse::<f32>().ok()).unwrap_or(0.0);
        let speed = SPEED_RE
            .captures(trimmed)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
            .unwrap_or_else(|| "--/s".to_string());
        let eta = ETA_RE
            .captures(trimmed)
            .and_then(|c| c.get(1))
            .map(|m| m.as_str().to_string())
            .unwrap_or_else(|| "--:--".to_string());

        return YtDlpOutputEvent::Progress { percent, speed, eta };
    }

    if CONVERTING_RE.is_match(trimmed) {
        return YtDlpOutputEvent::Converting {
            phase_text: trimmed.to_string(),
        };
    }

    YtDlpOutputEvent::Other
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_progress() {
        let line = "[download]  45.3% of 12.34MiB at  2.50MiB/s ETA 00:05";
        match parse_ytdlp_line(line) {
            YtDlpOutputEvent::Progress { percent, speed, eta } => {
                assert_eq!(percent, 45.3);
                assert_eq!(speed, "2.50MiB/s");
                assert_eq!(eta, "00:05");
            }
            _ => panic!("Expected progress event"),
        }
    }

    #[test]
    fn test_parse_progress_with_approximate_size() {
        let line = "[download]  45.2% of ~10.20MiB at 2.15MiB/s ETA 00:03";
        match parse_ytdlp_line(line) {
            YtDlpOutputEvent::Progress { percent, speed, eta } => {
                assert_eq!(percent, 45.2);
                assert_eq!(speed, "2.15MiB/s");
                assert_eq!(eta, "00:03");
            }
            _ => panic!("Expected progress event"),
        }
    }

    #[test]
    fn test_parse_destination() {
        let line = "[ExtractAudio] Destination: C:\\App\\downloads\\song.flac";
        match parse_ytdlp_line(line) {
            YtDlpOutputEvent::Destination { file_path } => {
                assert_eq!(file_path, "C:\\App\\downloads\\song.flac");
            }
            _ => panic!("Expected destination event"),
        }
    }
}
