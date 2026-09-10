import { isTauriAvailable, safeInvoke } from './tauriBridge';
import { AudioFormat, DownloadCompletePayload, DownloadedFileInfo } from '../types/downloader';

export async function downloadAudioStreamNative(
  taskId: string,
  url: string,
  format: AudioFormat,
  quality: number = 0
): Promise<DownloadCompletePayload | null> {
  if (!isTauriAvailable()) {
    console.info('[DownloaderService] Browser environment: Simulating audio download stream for:', url);
    // Mock simulation for browser preview
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return {
      task_id: taskId,
      file_path: `/mock/cache/downloads/mock_audio_${Date.now()}.${format}`,
      format,
      title: 'YouTube Stream Audio (Mock Preview)',
      duration_secs: 198.5,
    };
  }

  return await safeInvoke<DownloadCompletePayload>('download_audio_stream', {
    taskId,
    url,
    format,
    quality,
  });
}

export async function cancelDownloadNative(taskId: string): Promise<void> {
  if (!isTauriAvailable()) {
    console.info('[DownloaderService] Mock download cancelled for task:', taskId);
    return;
  }

  await safeInvoke<void>('cancel_download', { taskId });
}

export async function listDownloadedAudioNative(): Promise<DownloadedFileInfo[]> {
  if (!isTauriAvailable()) {
    return [];
  }

  const result = await safeInvoke<DownloadedFileInfo[]>('list_downloaded_audio');
  return result || [];
}

export async function deleteDownloadedAudioNative(filePath: string): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  await safeInvoke<void>('delete_downloaded_audio', { filePath });
}

export async function openDownloadFolderNative(): Promise<void> {
  if (!isTauriAvailable()) {
    return;
  }

  await safeInvoke<void>('open_download_folder');
}

