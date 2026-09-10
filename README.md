# VocalAlign
แอปพลิเคชัน Desktop สำหรับฝึกร้องเพลงและวิเคราะห์เสียงร้องแบบเรียลไทม์ (Advanced Vocal Training & Audio Analysis) พร้อมระบบแยกเสียงและแสดงเนื้อเพลงคาราโอเกะ

## Overview
- **What it does:** VocalAlign ช่วยให้นักร้องและผู้ฝึกซ้อมเสียงสามารถนำเข้าแทร็กเสียงหรือดาวน์โหลดผ่าน URL, แยกแทร็กดนตรีและเสียงร้อง (Stem Splitting), ตรวจจับและเปรียบเทียบระดับเสียง (Pitch Detection & Visualization) แบบเรียลไทม์เทียบกับต้นฉบับ พร้อมระบบซิงค์เนื้อร้องสไตล์คาราโอเกะ
- **Target Audience:** นักร้อง, ผู้ฝึกสอนการขับร้อง (Vocal Coaches), นักดนตรี และผู้สนใจทั่วไปที่ต้องการฝึกทักษะการร้องเพลง

## Key Features
- **Real-time Pitch Visualization:** วิเคราะห์ระดับเสียงสดจากไมโครโฟนและพล็อตเปรียบเทียบกับแทร็กต้นฉบับ
- **Karaoke & Lyrics Sync:** รองรับการซิงค์เนื้อเพลงแบบ LRC พร้อมหน้าจอ Stage แสดงผลแบบคาราโอเกะ
- **Stem Splitter:** แยกองค์ประกอบเสียงร้องและดนตรีออกจากไฟล์เสียง
- **Media Downloader:** ดาวน์โหลดไฟล์เสียงและวิดีโอจาก URL ภายนอกผ่าน yt-dlp & ffmpeg
- **Audio Deck & DSP Controls:** ควบคุมไมโครโฟน, การปรับแต่งระดับ Gain, และจัดการ Input Device

## Tech Stack
- **Core:** Tauri 2.0 (Rust Backend) + React 18 (TypeScript) + Vite 6
- **State / Storage:** React Hooks (Custom State Management)
- **Styling / UI:** Tailwind CSS 4, Lucide React
- **Key Libraries:**
  - Rust: CPAL (Audio I/O), Symphonia (Audio Decoding), Rodio (Playback), Tokio (Async Runtime), Rayon (Parallel Computing)
  - Tauri: `@tauri-apps/api`, `@tauri-apps/plugin-opener`

## High-Level Architecture
สถาปัตยกรรมแบ่งเป็น 2 ส่วนหลัก: Frontend (React/Vite) รับผิดชอบส่วน UI และการ Render Visualization สื่อสารผ่าน Tauri IPC ไปยัง Rust Core Engine ฝั่ง Desktop ที่ทำหน้าที่ประมวลผล Audio I/O, DSP/Pitch Analysis และจัดการ External Binaries (yt-dlp, ffmpeg)

## Project Structure
```text
├── src/                    # Frontend application
│   ├── components/         # UI & Visualizer components
│   ├── hooks/              # Custom hooks & hotkeys
│   ├── services/           # Tauri IPC service abstractions
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Helper utilities
├── src-tauri/              # Rust desktop core & backend
│   ├── src/                # DSP, audio engine, stem splitter & IPC
│   ├── binaries/           # External CLI tools (yt-dlp, ffmpeg)
│   ├── Cargo.toml          # Rust dependencies & build manifest
│   └── tauri.conf.json     # Tauri runtime & bundle configuration
└── package.json            # Node.js dependencies & scripts
```

## Prerequisites
- Node.js >= 18 (แนะนำ 20+)
- Rust & Cargo (edition 2021)
- Package Manager: `pnpm`

## Getting Started

### 1. Installation
```bash
pnpm install
```

### 2. Environment Setup
โปรเจกต์นี้ไม่จำเป็นต้องใช้ Environment Variables เพิ่มเติม สามารถรันและใช้งานผ่าน Local Engine ได้ทันที

### 3. Running Development
```bash
# รัน Tauri Desktop Dev Server พร้อม Vite Frontend
pnpm run dev

# หรือรันเฉพาะ Frontend UI
pnpm run vite
```

### 4. Sidecar Binaries (yt-dlp & ffmpeg)
ไฟล์ binary สำหรับการดาวน์โหลดและแปลงไฟล์เสียง/วิดีโอถูกจัดเก็บไว้ที่ `src-tauri/binaries/`
- เนื่องจากไฟล์ binary มีขนาดเกินเกณฑ์ 100MB ของ GitHub จึงถูกยกเว้นใน `.gitignore` เพื่อไม่ให้กระทบ Git History
- ดูรายละเอียดและรูปแบบชื่อไฟล์ตาม Architecture Target Triple ได้ใน [`src-tauri/binaries/README.md`](file:///c:/App/Tuari/Zonic/src-tauri/binaries/README.md)
- หากในเครื่องของผู้ใช้มี `yt-dlp` และ `ffmpeg` ติดตั้งอยู่ใน System PATH ระบบจะตรวจจับและเรียกใช้เป็น Fallback อัตโนมัติ

### 5. Build & Package
```bash
# Type check และ Build Frontend
pnpm run build

# Build Production Desktop Application ด้วย Tauri
pnpm tauri build
```

## Documentation
- `context.md` — L1 Architecture & Feature Routing Index สำหรับ AI Coding Agents
- `architecture.md` — High-Level Design (HLD), Data Flow, Subsystem Boundaries & State Ownership
