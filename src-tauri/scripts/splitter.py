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
    """Auto-install demucs into the current environment if missing."""
    try:
        import demucs  # noqa: F401
    except ImportError:
        emit_progress("Installing Demucs (one-time setup)", 2)
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "demucs",
             "torch", "torchaudio", "--extra-index-url",
             "https://download.pytorch.org/whl/cpu", "-q"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )


def run_separation(input_path: str, output_dir: str, model: str) -> tuple[str, str]:
    """
    Run Demucs via its CLI (subprocess).
    Returns (vocal_path, instrumental_path).
    """
    # Demucs CLI: python -m demucs --two-stems vocals -n <model> --out <dir> <file>
    cmd = [
        sys.executable, "-m", "demucs",
        "--two-stems", "vocals",
        "-n", model,
        "--out", output_dir,
        "--filename", "{stem}.wav",
        input_path,
    ]

    # Auto-use GPU if available, else CPU
    try:
        import torch
        if not torch.cuda.is_available():
            cmd += ["-d", "cpu"]
    except ImportError:
        cmd += ["-d", "cpu"]

    emit_progress("Initializing model", 5)

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    separator_steps = [
        ("Loading model weights", 15),
        ("Preparing audio chunks", 25),
        ("Running inference", 45),
        ("Post-processing", 80),
        ("Writing output files", 92),
    ]
    step_idx = 0

    for line in proc.stdout:
        line = line.strip()
        # Advance step labels based on known demucs output keywords
        if step_idx < len(separator_steps):
            step_label, step_percent = separator_steps[step_idx]
            if any(kw in line.lower() for kw in [
                "loading", "model", "segment", "chunk", "progress",
                "writing", "applying", "wav", "track"
            ]):
                emit_progress(step_label, step_percent)
                step_idx += 1

    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"Demucs exited with code {proc.returncode}")

    emit_progress("Locating output files", 96)

    # Demucs places output at: <output_dir>/<model>/<input_stem>/vocals.wav
    input_stem = Path(input_path).stem
    model_dir = Path(output_dir) / model / input_stem

    # Fallback: search recursively
    if not model_dir.exists():
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


def main() -> None:
    parser = argparse.ArgumentParser(description="VocalAlign Stem Splitter")
    parser.add_argument("--input", required=True, help="Path to input audio file")
    parser.add_argument("--output", required=True, help="Directory for output stems")
    parser.add_argument("--model", default="mdx_extra_q", help="Demucs model name")
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
