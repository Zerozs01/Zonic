# Architecture Context & Index (L1)

## 1. System High-Level
- Summary: Desktop Application สำหรับซ้อมร้องเพลงและคาราโอเกะ รองรับ Audio DSP, Pitch Detection, Video Sync, และ AI Stem Separation
- Core Stack: React 18, TypeScript, TailwindCSS 4 (Vite) / Rust 2021 (Tauri 2) / Web Audio API / LocalStorage & App FS
- Key Entry Points:
  - Client / UI: `src/main.tsx` (DOM Bootstrap), `src/App.tsx` (State Orchestrator)
  - Server / Main Process: `src-tauri/src/main.rs` (OS Entry), `src-tauri/src/lib.rs` (Tauri IPC Handlers)
  - Models / Schemas: `src/types/` (TypeScript Interfaces), `src-tauri/src/*/mod.rs` (Rust Core Structs)

## 2. Architecture & Data Flow
User -> React UI -> Hook/Service -> Tauri IPC -> Rust Audio Core / DSP / Sidecar CLI -> Tauri Event Bus -> Web Audio / Canvas
- Global State: `src/App.tsx` (Central React State & Audio Refs, LocalStorage สำหรับคิวเพลง)
- Shared Modules / Services: `src/services/tauriBridge.ts`, `src/utils/audioAnalysis.ts`, `src/utils/webAudioPitch.ts`

## 3. Directory Map (Critical Only)
`src/components/` -> UI Components หลักสำหรับเวทีคาราโอเกะ มิกเซอร์เสียง การซิงค์เนื้อเพลง และหน้าต่างควบคุม
`src/hooks/` -> Custom React Hooks สำหรับจัดการ Downloader Queue, Demucs Splitter, Lyrics Sync, Hotkeys, Scoring และ Video Sync
`src/services/` -> โมดูลเรียก Tauri IPC Commands และดักรับ Event Streams จาก Rust Backend
`src/types/` -> Type Definitions และ Data Contracts ฝั่ง Frontend ทั้งหมด
`src/utils/` -> ฟังก์ชันช่วยคำนวณ Audio DSP fallback (YIN), ถอดรหัส LRC/BPM, และแปลง Hz เป็นโน้ตดนตรี
`src-tauri/src/audio/` -> ดึงสัญญาณไมโครโฟนฮาร์ดแวร์ผ่าน cpal, บริหาร Circular Audio Buffer, และ I/O ไฟล์เสียง
`src-tauri/src/downloader/` -> ควบคุม Process yt-dlp สำหรับดาวน์โหลดเสียง/วิดีโอ และสแกนคลังเพลง Local
`src-tauri/src/dsp/` -> Rust Native YIN Pitch Algorithm, Audio Filtering, และ Real-time Live Stream Analysis
`src-tauri/src/lyrics/` -> ระบบ Forced Alignment ซิงค์คำร้องเข้ากับไทม์ไลน์เสียง
`src-tauri/src/splitter/` -> ควบคุม Demucs AI Child Process สำหรับแยกเสียงร้องและเสียงดนตรี

## 4. Feature-to-File Routing
- Master Audio Playback & Transport
  - Primary: `src/App.tsx`
  - Secondary: `src/components/KaraokeControlBar.tsx`, `src/components/DualWaveformBar.tsx`
  - Scope: ควบคุมการเล่นแทร็กเสียงคู่ ปรับคีย์ Transpose และ Speed
- Canvas Pitch Graph & Visualizer
  - Primary: `src/components/PitchVisualizer.tsx`
  - Secondary: `src/components/KaraokeVisualizerStage.tsx`, `src/utils/webAudioPitch.ts`
  - Scope: เรนเดอร์ Pitch Note Blocks และ Laser Beam บน Canvas 60FPS (ประมวลผล Trail ผ่าน Ref)
- Live Mic Pitch Scoring
  - Primary: `src/hooks/useLivePitchScoring.ts`
  - Secondary: `src/components/KaraokeHUD.tsx`, `src/components/PerformanceModal.tsx`, `src-tauri/src/dsp/analyzer.rs`
  - Scope: สกัดความถี่ไมค์สด เทียบเสียง และคำนวณเกรดคะแนน
- Microphone Hardware & Capture
  - Primary: `src-tauri/src/audio/recorder.rs`
  - Secondary: `src/components/MicSettingsModal.tsx`, `src/services/tauriBridge.ts`, `src-tauri/src/audio/device.rs`
  - Scope: จัดการฮาร์ดแวร์ไมค์ cpal และบันทึก Ring Buffer
- Media Downloader & Local Library
  - Primary: `src/hooks/useAudioDownloaderQueue.ts`
  - Secondary: `src/components/UrlDownloaderModal.tsx`, `src-tauri/src/downloader/mod.rs`, `src/services/downloaderService.ts`
  - Scope: คิวดาวน์โหลด yt-dlp และจัดการไฟล์ในคลังเพลง
- AI Stem Separation (Demucs)
  - Primary: `src/hooks/useStemSplitter.ts`
  - Secondary: `src/components/StemSplitterPanel.tsx`, `src-tauri/src/splitter/mod.rs`, `src/services/splitterService.ts`
  - Scope: ควบคุมการแยกแทร็กเสียงร้องและดนตรีด้วย Demucs
- Lyrics Synchronization & Editing
  - Primary: `src/hooks/useLyricsSync.ts`
  - Secondary: `src/components/LyricsPanel.tsx`, `src-tauri/src/lyrics/mod.rs`, `src/services/lyricsService.ts`
  - Scope: แสดงผล แก้ไข LRC และทำ AI Forced Alignment
- Video Player Synchronization
  - Primary: `src/hooks/useVideoSync.ts`
  - Secondary: `src/components/KaraokeVisualizerStage.tsx`, `src/App.tsx`
  - Scope: ซิงค์วิดีโอ MP4, ควบคุม URL Blob/Asset และสลับโหมด Stage/Video

## 5. High-Risk & Coupling Zones
- Shared State / Types: `src/types/audio.ts` -> กระทบ: `src/App.tsx`, `src/services/tauriBridge.ts` และโครงสร้าง Audio Engine ทั้งระบบ
- API Contracts / IPC Channels: `src-tauri/src/lib.rs` -> กระทบ: `src/services/tauriBridge.ts` และ Services ทั้งหมด หาก signature หรือ event payload เปลี่ยนจะเกิด silent runtime failure
- Real-time Audio Ring Buffer: `src-tauri/src/audio/recorder.rs` (`CircularAudioBuffer`) -> กระทบ: Native DSP Analyzer บริหารหน่วยความจำแบบ Cyclic ป้องกัน Glitch และ Mutex Contention
- Database Schema / Migrations: `localStorage ('zonic_download_queue_v1')` & App FS -> ข้อควรระวัง: โครงสร้างข้อมูลคิวดาวน์โหลดและ Path สื่อ หากปรับ Format ต้องมี Fallback ป้องกันค้าง

## 6. Agent Navigation Rules
- เริ่มงานใหม่ด้วยการเทียบหา Feature ใน Routing Map เสมอ
- อ่านเฉพาะ Primary File ก่อน ห้ามอ่าน Secondary หรือ scan ทั้งโฟลเดอร์เว้นแต่ Primary จะมีข้อมูลไม่พอ
- Source Consistency:
  - หากพบ path ใน context.md ไม่ตรงกับ Codebase ให้ยึด Codebase เป็นหลัก และอัปเดต context.md ทันที
  - ห้ามแก้ไข โยกย้าย หรือสร้างไฟล์โค้ดใหม่ขึ้นมาเพียงเพื่อให้ตรงกับ context.md เด็ดขาด
