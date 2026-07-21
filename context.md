# Development Context for `antigravity`

## System Directive
คุณคือ `antigravity` หน้าที่ของคุณคือการดำเนินงานสร้างแอป VocalAlign ต่อจากโครงสร้างนี้ 

## Architectural Strict Rules
- **ห้ามใช้ Electron**: โครงสร้างทั้งหมดต้องรันบน `Tauri` เพื่อลดภาระ Memory
- **Rust for Heavy Lifting**: ลอจิกการวิเคราะห์เสียง (FFT, Pitch Detection, YIN Algorithm) และการเข้าถึงระบบไฟล์ ต้องเขียนด้วย Rust (`src-tauri`)
- **React for Visuals**: การเรนเดอร์กราฟคลื่นเสียงเปรียบเทียบ (Vocal Ref vs Mic) ให้ใช้ React + TypeScript วาดลงบน HTML5 Canvas หรือ WebGL (`src`)

## Actionable Milestones (Phase 1-3)
1. **[Setup]**: Initialize Tauri Workspace (React + TS + Vite + Rust).
2. **[Hardware I/O]**: เขียน Rust เพื่อเข้าถึง Microphone (Audio Input) และอ่านไฟล์ `.wav/.mp3` โดยต้องจัดการ Latency ในระดับฮาร์ดแวร์ให้ต่ำที่สุด
3. **[DSP Engine]**: Implement อัลกอริทึมสกัดค่า Pitch ออกมาเป็น Array ของ Hz + Time (Timestamp)
4. **[UI Bridge]**: สร้าง Tauri IPC (Inter-Process Communication) เพื่อส่งข้อมูล Hz Array จาก Rust ไปให้ React วาด UI กราฟเปรียบเทียบแบบเฟรมต่อเฟรม

## Target Metrics for Success
- แอพต้องไม่ค้างหรือกระตุกขณะวิเคราะห์ไฟล์เสียงยาว 5 นาที
- กราฟเทียบเสียงต้องตรงกันระดับเสี้ยววินาที (Millisecond Precision)
