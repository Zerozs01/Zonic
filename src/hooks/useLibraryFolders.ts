import { useState, useEffect, useCallback, useMemo } from 'react';
import { LibraryFolder } from '../types/downloader';

const FOLDERS_STORAGE_KEY = 'zonic_library_folders_v1';
const SONG_TAGS_STORAGE_KEY = 'zonic_song_tags_v1';

export type FormatFilter = 'all' | 'mp4' | 'wav';

export function useLibraryFolders() {
  const [folders, setFolders] = useState<LibraryFolder[]>(() => {
    try {
      const saved = localStorage.getItem(FOLDERS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load library folders from localStorage:', e);
    }
    // Default initial folder for first-time users
    return [
      {
        id: 'folder_exercise',
        name: 'Vocal Exercises',
        description: 'แบบฝึกหัดสำหรับซ้อมร้องเพลง สเกล และวอร์มเสียง',
        rating: 5,
        tags: ['exercise', 'warmup', 'scales'],
        filePaths: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];
  });

  const [songTags, setSongTagsMap] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem(SONG_TAGS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load song tags from localStorage:', e);
    }
    return {};
  });

  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [formatFilter, setFormatFilter] = useState<FormatFilter>('all');

  // Persist folders
  useEffect(() => {
    try {
      localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
    } catch (e) {
      console.warn('Failed to save folders to localStorage:', e);
    }
  }, [folders]);

  // Persist song tags
  useEffect(() => {
    try {
      localStorage.setItem(SONG_TAGS_STORAGE_KEY, JSON.stringify(songTags));
    } catch (e) {
      console.warn('Failed to save song tags to localStorage:', e);
    }
  }, [songTags]);

  const createFolder = useCallback(
    (name: string, description: string = '', rating: number = 5, tags: string[] = []) => {
      const newFolder: LibraryFolder = {
        id: `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: name.trim(),
        description: description.trim(),
        rating: Math.max(0, Math.min(5, rating)),
        tags: tags.map((t) => t.trim()).filter(Boolean),
        filePaths: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setFolders((prev) => [...prev, newFolder]);
      return newFolder;
    },
    []
  );

  const updateFolder = useCallback(
    (id: string, updates: Partial<Omit<LibraryFolder, 'id' | 'createdAt'>>) => {
      setFolders((prev) =>
        prev.map((folder) => {
          if (folder.id !== id) return folder;
          return {
            ...folder,
            ...updates,
            updatedAt: Date.now(),
          };
        })
      );
    },
    []
  );

  const deleteFolder = useCallback(
    (id: string) => {
      setFolders((prev) => prev.filter((f) => f.id !== id));
      if (activeFolderId === id) {
        setActiveFolderId(null);
      }
    },
    [activeFolderId]
  );

  const toggleFileInFolder = useCallback((folderId: string, filePath: string) => {
    setFolders((prev) =>
      prev.map((folder) => {
        if (folder.id !== folderId) return folder;
        const exists = folder.filePaths.includes(filePath);
        const nextPaths = exists
          ? folder.filePaths.filter((p) => p !== filePath)
          : [...folder.filePaths, filePath];
        return {
          ...folder,
          filePaths: nextPaths,
          updatedAt: Date.now(),
        };
      })
    );
  }, []);

  const isFileInFolder = useCallback(
    (folderId: string, filePath: string) => {
      const folder = folders.find((f) => f.id === folderId);
      return folder ? folder.filePaths.includes(filePath) : false;
    },
    [folders]
  );

  const getFileFolders = useCallback(
    (filePath: string) => {
      return folders.filter((f) => f.filePaths.includes(filePath));
    },
    [folders]
  );

  const setSongTags = useCallback((filePath: string, tags: string[]) => {
    setSongTagsMap((prev) => ({
      ...prev,
      [filePath]: tags.map((t) => t.trim()).filter(Boolean),
    }));
  }, []);

  const getSongTags = useCallback(
    (filePath: string): string[] => {
      return songTags[filePath] || [];
    },
    [songTags]
  );

  // Computed all unique tags from both folders and individual songs
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    folders.forEach((f) => f.tags.forEach((t) => tagSet.add(t.toLowerCase())));
    Object.values(songTags).forEach((tags) =>
      tags.forEach((t) => tagSet.add(t.toLowerCase()))
    );
    return Array.from(tagSet).sort();
  }, [folders, songTags]);

  const activeFolder = useMemo(() => {
    return folders.find((f) => f.id === activeFolderId) || null;
  }, [folders, activeFolderId]);

  return {
    folders,
    activeFolderId,
    activeFolder,
    setActiveFolderId,
    activeTag,
    setActiveTag,
    formatFilter,
    setFormatFilter,
    createFolder,
    updateFolder,
    deleteFolder,
    toggleFileInFolder,
    isFileInFolder,
    getFileFolders,
    setSongTags,
    getSongTags,
    allTags,
  };
}
