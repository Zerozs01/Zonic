# VocalAlign: Advanced Vocal Training App 🎤

## Overview
แอปพลิเคชันสำหรับฝึกร้องเพลงและวิเคราะห์เสียงร้องแบบเจาะลึก (Vocal Clone vs Original) ที่เน้นประสิทธิภาพการประมวลผลขั้นสูง 

## Tech Stack
- **Frontend (UI & Visuals)**: React + TypeScript
- **Core Engine (Audio Processing)**: Rust
- **Framework (Desktop OS Wrapper)**: Tauri

## Core Features
1. **Multi-Track Import**: รองรับการนำเข้าไฟล์ Instrumental และ Vocal Reference แยกกัน
2. **Real-Time / Post-Process Analysis**: บันทึกเสียงร้องผ่านไมค์และเปรียบเทียบคลื่นเสียง
3. **Advanced DSP (Digital Signal Processing)**: สกัดค่า Pitch (Hz), Amplitude (dB), และ Envelope ของเสียง
4. **Scoring System**: ให้คะแนนตามคีย์เสียง (Pitch Accuracy), จังหวะ (Phrasing & Timing), และเทคนิค (Vibrato/Stability)

## Multi-Layer Analysis Architecture
- **Layer 1: Software/OS**: จัดการ Thread การประมวลผลเสียงไม่ให้บล็อก UI Thread (ใช้ Rust Concurrency)
- **Layer 2: Account/Identity**: ระบบเก็บประวัติการฝึกซ้อมและสถิติการพัฒนา (Local SQLite)
- **Layer 3: Hardware/Firmware**: จัดการ Audio Interface Buffer Size และลด Latency ของไมโครโฟน
