pub mod audio;
pub mod dsp;

use audio::{
    align_lyrics_forced, get_microphone_status, get_recorded_buffer, list_microphones,
    load_audio_file, separate_audio_stems, set_track_gain, set_track_mute, start_microphone,
    stop_microphone, AudioState,
};
use dsp::{analyze_audio_file_pitch, analyze_live_stream_pitch};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You are running VocalAlign Layer 1 Core.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let audio_state = AudioState::new();

    tauri::Builder::default()
        .manage(audio_state)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            list_microphones,
            load_audio_file,
            set_track_gain,
            set_track_mute,
            separate_audio_stems,
            align_lyrics_forced,
            start_microphone,
            stop_microphone,
            get_microphone_status,
            get_recorded_buffer,
            analyze_audio_file_pitch,
            analyze_live_stream_pitch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
