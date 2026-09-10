# Sidecar Binaries Directory

This directory holds bundled sidecar binaries for `yt-dlp` and `ffmpeg` matching Tauri target triples.

### Required Filename Formats:
- **Windows (x86_64)**:
  - `yt-dlp-x86_64-pc-windows-msvc.exe` (or `yt-dlp.exe` during dev fallback)
  - `ffmpeg-x86_64-pc-windows-msvc.exe` (or `ffmpeg.exe` during dev fallback)
- **macOS (Apple Silicon)**:
  - `yt-dlp-aarch64-apple-darwin`
  - `ffmpeg-aarch64-apple-darwin`
- **macOS (Intel)**:
  - `yt-dlp-x86_64-apple-darwin`
  - `ffmpeg-x86_64-apple-darwin`
- **Linux (x86_64)**:
  - `yt-dlp-x86_64-unknown-linux-gnu`
  - `ffmpeg-x86_64-unknown-linux-gnu`

Note: If binaries are also available in the user's system PATH, the application will automatically fall back to using the system-installed `yt-dlp` and `ffmpeg`.
