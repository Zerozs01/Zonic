import React, { useState, useEffect } from 'react';
import { FolderPlus, FolderEdit, X, Star, Tag, Check } from 'lucide-react';
import { LibraryFolder } from '../types/downloader';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderToEdit?: LibraryFolder | null;
  onSaveFolder: (name: string, description: string, rating: number, tags: string[]) => void;
}

export const FolderModal: React.FC<FolderModalProps> = ({
  isOpen,
  onClose,
  folderToEdit,
  onSaveFolder,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  useEffect(() => {
    if (folderToEdit) {
      setName(folderToEdit.name);
      setDescription(folderToEdit.description || '');
      setRating(folderToEdit.rating || 5);
      setTags(folderToEdit.tags || []);
    } else {
      setName('');
      setDescription('');
      setRating(5);
      setTags([]);
    }
    setTagInput('');
  }, [folderToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSaveFolder(name, description, rating, tags);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="w-full max-w-md bg-[#1c1c24] border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-[#22222b]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-300">
              {folderToEdit ? <FolderEdit size={18} /> : <FolderPlus size={18} />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {folderToEdit ? 'แก้ไขโฟลเดอร์เพลย์ลิสต์' : 'สร้างโฟลเดอร์เพลย์ลิสต์ใหม่'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                จัดระเบียบเพลงคาราโอเกะตามหมวดหมู่ สไตล์ Spotify
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Folder Name */}
          <div>
            <label className="block text-zinc-300 font-semibold mb-1">
              ชื่อโฟลเดอร์ (Folder Name) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น Vocal Exercises, เพลงสากล, Artist Hits..."
              className="w-full bg-[#141419] border border-zinc-700/80 rounded-xl px-3.5 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 text-xs shadow-inner"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-zinc-300 font-semibold mb-1">
              คำอธิบาย (Description)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="อธิบายจุดประสงค์ของโฟลเดอร์นี้ เช่น สำหรับวอร์มเสียงเช้า..."
              className="w-full bg-[#141419] border border-zinc-700/80 rounded-xl px-3.5 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 text-xs shadow-inner resize-none"
            />
          </div>

          {/* Star Rating */}
          <div>
            <label className="block text-zinc-300 font-semibold mb-1 flex items-center justify-between">
              <span>ความสำคัญ / เรตติ้ง (Rating)</span>
              <span className="text-amber-400 font-bold">{rating} / 5 ดาว</span>
            </label>
            <div className="flex items-center gap-1.5 bg-[#141419] border border-zinc-700/80 rounded-xl px-3.5 py-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating !== null ? hoverRating : rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-1 text-zinc-600 hover:scale-125 transition-transform cursor-pointer"
                  >
                    <Star
                      size={20}
                      className={
                        isFilled
                          ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                          : 'text-zinc-600'
                      }
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-zinc-300 font-semibold mb-1">
              แท็กหมวดหมู่ (Tags)
            </label>
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Tag size={13} className="absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="พิมพ์ชื่อแท็ก เช่น exercise, warmup แล้วกดเพิ่ม"
                  className="w-full bg-[#141419] border border-zinc-700/80 rounded-xl pl-8 pr-3.5 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 text-xs shadow-inner"
                />
              </div>
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 rounded-xl bg-purple-900/60 hover:bg-purple-800 border border-purple-500/50 text-purple-200 font-semibold cursor-pointer transition-colors"
              >
                + เพิ่มแท็ก
              </button>
            </div>

            {tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-950/70 border border-purple-500/40 text-purple-300 text-[11px] font-medium"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-rose-400 cursor-pointer ml-0.5"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
            >
              <Check size={14} />
              <span>{folderToEdit ? 'บันทึกการแก้ไข' : 'สร้างโฟลเดอร์'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
