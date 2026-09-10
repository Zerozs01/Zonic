#!/usr/bin/env python3
"""
splitter.py — VocalAlign Audio Stem Separator
Separates an audio file into vocals and instrumental using Demucs.

stdout Protocol:
  [PROGRESS] step=<label> percent=<0-100>
  [RESULT] {"vocal_path": "...", "instrumental_path": "...", "duration_secs": 0.0}
  [ERROR] <message>
"""

import argparse
import json
import os
import sys
import subprocess
import traceback
from pathlib import Path

# Force UTF-8 encoding on standard streams to avoid Windows charmap/cp1252 UnicodeEncodeError
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def emit_progress(step: str, percent: float) -> None:
    print(f"[PROGRESS] step={step} percent={percent:.1f}", flush=True)


def emit_result(vocal_path: str, instrumental_path: str, duration_secs: float) -> None:
    payload = json.dumps(
        {
            "vocal_path": vocal_path,
            "instrumental_path": instrumental_path,
            "duration_secs": duration_secs,
        }
    )
    print(f"[RESULT] {payload}", flush=True)


def emit_error(message: str) -> None:
    print(f"[ERROR] {message}", flush=True)


def get_audio_duration(path: str) -> float:
    """Probe audio duration via torchaudio or fallback to ffprobe."""
    try:
        import torchaudio
        info = torchaudio.info(path)
        return info.num_frames / info.sample_rate
    except Exception:
        pass
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            capture_output=True,
            text=True,
        )
        return float(result.stdout.strip())
    except Exception:
        return 0.0


def ensure_demucs_installed() -> None:
    """Auto-install demucs and diffq into the current environment if missing."""
    try:
        import demucs  # noqa: F401
        import diffq  # noqa: F401
    except ImportError:
        emit_progress("Installing Demucs & DiffQ (one-time setup)", 2)
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "demucs", "diffq",
             "torch", "torchaudio", "--extra-index-url",
             "https://download.pytorch.org/whl/cpu", "-q"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


def prepare_audio_input(input_path: str, output_dir: str) -> tuple[str, str | None]:
    """
    Ensure the audio file is ready for Demucs:
    1. If video container (mp4, mkv, webm, etc.) or audio with potential container/codec quirks,
       extract stereo 44.1kHz 16-bit WAV with FFmpeg to a clean ASCII filename.
    2. If non-ASCII or problematic characters in filename (e.g. full-width colons \uff1a, CJK, etc.),
       extract or copy to a clean ASCII filename (input_source.wav) to avoid Windows charmap/cp1252
       and C-library path encoding bugs.
    """
    ext = Path(input_path).suffix.lower()
    needs_ffmpeg_extract = ext in [".mp4", ".mkv", ".webm", ".mov", ".flv", ".avi", ".m4a", ".aac"]
    has_special_chars = any(ord(c) > 127 or c in r':*?"<>|' for c in Path(input_path).name)

    if needs_ffmpeg_extract or has_special_chars:
        emit_progress("Preparing audio stream", 4)
        clean_wav = os.path.join(output_dir, "input_source.wav")
        cmd = [
            "ffmpeg", "-v", "error", "-y",
            "-i", input_path,
            "-vn",
            "-acodec", "pcm_s16le",
            "-ar", "44100",
            "-ac", "2",
            clean_wav,
        ]
        try:
            subprocess.check_call(cmd)
            if os.path.isfile(clean_wav) and os.path.getsize(clean_wav) > 1024:
                return clean_wav, clean_wav
        except Exception as e:
            print(f"[WARN] FFmpeg preparation failed: {e}", file=sys.stderr)
            if has_special_chars and ext in [".wav", ".mp3", ".flac", ".ogg"]:
                try:
                    import shutil
                    clean_copy = os.path.join(output_dir, f"input_source{ext}")
                    shutil.copy2(input_path, clean_copy)
                    return clean_copy, clean_copy
                except Exception:
                    pass

    return input_path, None


def run_separation(input_path: str, output_dir: str, model: str) -> tuple[str, str]:
    """
    Run Demucs via its CLI (subprocess).
    Returns (vocal_path, instrumental_path).
    """
    audio_input, temp_cleanup = prepare_audio_input(input_path, output_dir)

    try:
        # Auto-use GPU if available (native NVIDIA CUDA), else high-performance multi-core CPU
        device_label = "CPU Multi-Core (4 Threads)"
        use_gpu = False
        try:
            import torch
            if torch.cuda.is_available():
                dev_name = torch.cuda.get_device_name(0)
                # ZLUDA on Windows currently lacks cuFFT / cuDNN LSTM support required by audio models
                if "[ZLUDA]" in dev_name or "AMD" in dev_name:
                    use_gpu = False
                    device_label = "CPU Multi-Core (4 Threads)"
                else:
                    use_gpu = True
                    device_label = f"GPU ({dev_name})"
        except Exception:
            pass

        cmd = [
            sys.executable, "-m", "demucs",
            "--two-stems", "vocals",
            "-n", model,
            "--out", output_dir,
            "--filename", "{stem}.wav",
            audio_input,
        ]

        if not use_gpu:
            # Optimize CPU multi-processing across all physical P-cores (Intel Core i3-12100F)
            cmd += ["-d", "cpu", "-j", "4"]

        emit_progress(f"Initializing Demucs on {device_label}", 6)

        demucs_env = os.environ.copy()
        demucs_env["PYTHONIOENCODING"] = "utf-8"
        demucs_env["PYTHONUTF8"] = "1"

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            env=demucs_env,
        )

        separator_steps = [
            ("Loading model weights", 15),
            ("Preparing audio chunks", 25),
            ("Running inference", 45),
            ("Post-processing", 80),
            ("Writing output files", 92),
        ]
        step_idx = 0
        output_lines: list[str] = []
        last_emitted_pct = 6.0
        import re
        pct_regex = re.compile(r"(\d{1,3})%")

        # Read stream chunks and split on \r and \n to catch tqdm updates in real-time
        def read_stream_tokens(stream):
            buf = []
            while True:
                chunk = stream.read(32)
                if not chunk:
                    if buf:
                        yield "".join(buf)
                    break
                for ch in chunk:
                    if ch in ("\r", "\n"):
                        if buf:
                            yield "".join(buf)
                            buf = []
                    else:
                        buf.append(ch)

        for raw_line in read_stream_tokens(proc.stdout):
            line_str = raw_line.strip()
            if not line_str:
                continue
            output_lines.append(line_str)

            # Check if this line is a tqdm percentage update (e.g. 15%|...)
            m = pct_regex.search(line_str)
            if m:
                sub_pct = float(m.group(1))
                # Map 0-100% of Demucs into 30% - 94% range
                mapped_pct = 30.0 + (sub_pct * 0.64)
                if mapped_pct > last_emitted_pct:
                    last_emitted_pct = mapped_pct
                    emit_progress(f"Separating audio stems ({sub_pct:.0f}%)", mapped_pct)
            elif step_idx < len(separator_steps):
                step_label, step_percent = separator_steps[step_idx]
                if any(kw in line_str.lower() for kw in [
                    "loading", "model", "segment", "chunk", "progress",
                    "writing", "applying", "wav", "track"
                ]):
                    if step_percent > last_emitted_pct:
                        last_emitted_pct = step_percent
                        emit_progress(step_label, step_percent)
                    step_idx += 1

        proc.wait()
        if proc.returncode != 0:
            err_snippet = "\n".join(output_lines[-15:])
            raise RuntimeError(f"Demucs exited with code {proc.returncode}:\n{err_snippet}")

        emit_progress("Locating output files", 96)

        # Demucs places output at: <output_dir>/<model>/<input_stem>/vocals.wav or <output_dir>/<model>/vocals.wav
        input_stem = Path(audio_input).stem
        model_dir = Path(output_dir) / model / input_stem

        # Fallback: search recursively in output_dir
        if not model_dir.exists() or not (model_dir / "vocals.wav").exists():
            for search_dir in Path(output_dir).rglob("vocals.wav"):
                model_dir = search_dir.parent
                break

        vocal_path = str(model_dir / "vocals.wav")
        instrumental_path = str(model_dir / "no_vocals.wav")

        # Rename 'no_vocals.wav' if Demucs produced different filename
        for candidate in ["no_vocals.wav", "accompaniment.wav", "other.wav"]:
            candidate_path = model_dir / candidate
            if candidate_path.exists():
                instrumental_path = str(candidate_path)
                break

        if not Path(vocal_path).exists():
            raise FileNotFoundError(f"vocals.wav not found in {model_dir}")
        if not Path(instrumental_path).exists():
            raise FileNotFoundError(f"no_vocals.wav not found in {model_dir}")

        return vocal_path, instrumental_path
    finally:
        if temp_cleanup and os.path.exists(temp_cleanup):
            try:
                os.remove(temp_cleanup)
            except Exception:
                pass


def main() -> None:
    parser = argparse.ArgumentParser(description="VocalAlign Stem Splitter")
    parser.add_argument("--input", required=True, help="Path to input audio file")
    parser.add_argument("--output", required=True, help="Directory for output stems")
    parser.add_argument("--model", default="htdemucs", help="Demucs model name")
    args = parser.parse_args()

    input_path = args.input
    output_dir = args.output
    model = args.model

    # ── Validate ────────────────────────────────────────────────
    if not os.path.isfile(input_path):
        emit_error(f"Input file not found: {input_path}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    try:
        emit_progress("Checking Demucs installation", 1)
        ensure_demucs_installed()

        emit_progress("Starting separation", 5)
        vocal_path, instrumental_path = run_separation(input_path, output_dir, model)

        emit_progress("Calculating duration", 98)
        duration_secs = get_audio_duration(vocal_path)

        emit_progress("Complete", 100)
        emit_result(vocal_path, instrumental_path, duration_secs)

    except KeyboardInterrupt:
        emit_error("Separation cancelled by user")
        sys.exit(130)
    except Exception as exc:
        emit_error(str(exc))
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
