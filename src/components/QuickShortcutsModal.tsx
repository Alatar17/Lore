import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

interface QuickShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  label: string;
  keyName: string;
}

const SHORTCUT_GROUPS: ShortcutItem[][] = [
  [
    { label: 'Medya Ana Sayfası', keyName: '1' },
    { label: 'Oyun Ana Sayfası', keyName: '2' },
    { label: 'Kitap Ana Sayfası', keyName: '3' },
    { label: 'İzlenen & Takip Listesi', keyName: '4' },
  ],
  [
    { label: 'İstatistikler & Grafikler', keyName: 'Q' },
    { label: 'Son Aktiviteler', keyName: 'E' },
    { label: 'Lore AI Asistan', keyName: 'A' },
  ],
  [
    { label: 'Yeni Yapım Ekle (FAB)', keyName: 'W' },
    { label: 'Tam Ekran Aç / Kapat', keyName: 'F' },
    { label: 'Kart Başlıklarını Aç / Kapat', keyName: 'B' },
    { label: 'Yapımı Düzenle', keyName: 'Space' },
    { label: 'Blur Önizle / Şeffaf Yap (Anki Editörü)', keyName: 'Space' },
  ],
];

export const QuickShortcutsModal: React.FC<QuickShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'k' || e.key === 'K') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="quick-shortcuts-backdrop"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="quick-shortcuts-card"
        className="w-full max-w-sm rounded-2xl bg-[#141721] border border-white/10 p-5 shadow-2xl text-neutral-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/10 text-white">
              <Keyboard className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Klavye Kısayolları
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Kapat (ESC / K)"
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcut Groups with Dividers */}
        <div className="space-y-2.5">
          {SHORTCUT_GROUPS.map((group, groupIdx) => (
            <React.Fragment key={groupIdx}>
              {groupIdx > 0 && <div className="border-t border-white/10 my-2" />}
              <div className="space-y-1.5">
                {group.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xs text-neutral-300 font-medium">
                      {item.label}
                    </span>
                    <kbd className="px-2 py-0.5 min-w-[24px] text-center rounded-md bg-neutral-900 border border-white/15 text-[11px] font-mono font-bold text-neutral-200 shadow-inner">
                      {item.keyName}
                    </kbd>
                  </div>
                ))}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
