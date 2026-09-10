pub mod audio;
pub mod downloader;
pub mod dsp;
pub mod lyrics;
pub mod splitter;

use audio::{
    align_lyrics_forced, get_microphone_status, get_recorded_buffer, list_microphones,
    load_audio_file, read_audio_file_bytes, save_uploaded_audio, separate_audio_stems,
    set_mic_processing, set_track_gain, set_track_mute, start_microphone, stop_microphone,
    AudioState,
};
use downloader::{
    cancel_download, delete_downloaded_audio, download_audio_stream, list_downloaded_audio,
    open_download_folder, DownloadManager,
};
use dsp::{analyze_audio_file_pitch, analyze_live_stream_pitch};
use lyrics::{cancel_sync_lyrics, sync_lyrics, LyricsSyncManager};
use splitter::{cancel_split, split_audio_stems, SplitterState};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You are running VocalAlign Layer 1 Core.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let audio_state = AudioState::new();
    let download_manager = DownloadManager::new();
    let splitter_state = SplitterState::new();
    let lyrics_manager = LyricsSyncManager::new();

    tauri::Builder::default()
        .manage(audio_state)
        .manage(download_manager)
        .manage(splitter_state)
        .manage(lyrics_manager)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            list_microphones,
            load_audio_file,
            read_audio_file_bytes,
            save_uploaded_audio,
            set_track_gain,
            set_track_mute,
            separate_audio_stems,
            align_lyrics_forced,
            start_microphone,
            stop_microphone,
            get_microphone_status,
            get_recorded_buffer,
            set_mic_processing,
            analyze_audio_file_pitch,
            analyze_live_stream_pitch,
            download_audio_stream,
            cancel_download,
            list_downloaded_audio,
            delete_downloaded_audio,
            open_download_folder,
            split_audio_stems,
            cancel_split,
            sync_lyrics,
            cancel_sync_lyrics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
