import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  HelpCircle,
  ListOrdered,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export type DialogType = 'alert' | 'confirm' | 'prompt' | 'tier-report';

export interface TierImportReportData {
  categoryName: string;
  placedCount: number;
  placedTitles: string[];
  newPoolCount: number;
  newPoolTitles: string[];
  missingCount: number;
  missingTitles: string[];
}

export interface DialogOptions {
  type: DialogType;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  promptDefaultValue?: string;
  promptPlaceholder?: string;
  tierReport?: TierImportReportData;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
}

export type CustomDialogOptions = DialogOptions;

interface CustomDialogProps {
  options: DialogOptions | null;
  onClose: () => void;
}

export const CustomDialog: React.FC<CustomDialogProps> = ({ options, onClose }) => {
  const [promptValue, setPromptValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (options && options.type === 'prompt') {
      setPromptValue(options.promptDefaultValue || '');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [options]);

  if (!options) return null;

  const handleConfirm = () => {
    if (options.onConfirm) {
      if (options.type === 'prompt') {
        options.onConfirm(promptValue.trim());
      } else {
        options.onConfirm();
      }
    }
    onClose();
  };

  const handleCancel = () => {
    if (options.onCancel) {
      options.onCancel();
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      handleCancel();
    } else if (e.key === 'Enter' && options.type === 'prompt') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div
      id="custom-dialog-overlay"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150"
      onClick={handleCancel}
      onKeyDown={handleKeyDown}
    >
      <div
        id="custom-dialog-box"
        className={`w-full ${
          options.type === 'tier-report' ? 'max-w-xl' : 'max-w-md'
        } bg-[#16181f] border border-white/15 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150 relative`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/30">
          <div className="flex items-center gap-3">
            {options.type === 'alert' && (
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <Info className="w-5 h-5" />
              </div>
            )}
            {options.type === 'confirm' && (
              <div
                className={`p-2 rounded-xl border ${
                  options.isDestructive
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}
              >
                {options.isDestructive ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <HelpCircle className="w-5 h-5" />
                )}
              </div>
            )}
            {options.type === 'prompt' && (
              <div className="p-2 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400">
                <Sparkles className="w-5 h-5" />
              </div>
            )}
            {options.type === 'tier-report' && (
              <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <ListOrdered className="w-5 h-5" />
              </div>
            )}

            <div>
              <h3 className="font-bold text-base text-white">{options.title}</h3>
            </div>
          </div>

          <button
            onClick={handleCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar text-xs sm:text-sm text-slate-300 leading-relaxed">
          {options.message && (
            <p className="whitespace-pre-line text-slate-200">{options.message}</p>
          )}

          {/* Prompt Input */}
          {options.type === 'prompt' && (
            <div className="space-y-1.5 pt-1">
              <input
                ref={inputRef}
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={options.promptPlaceholder || 'Değer girin...'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/20 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>
          )}

          {/* Tier List Import Detailed Report */}
          {options.type === 'tier-report' && options.tierReport && (
            <div className="space-y-3.5 text-xs">
              {/* 1. Placed Cards */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
                <div className="flex items-center justify-between font-semibold text-emerald-300">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Yerleştirilen Yapımlar
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                    {options.tierReport.placedCount} adet
                  </span>
                </div>
                {options.tierReport.placedTitles.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto custom-scrollbar">
                    {options.tierReport.placedTitles.map((title, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-200 text-[11px]"
                      >
                        {title}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Yerleştirilen yapım yok.</p>
                )}
              </div>

              {/* 2. New Library Cards sent to Pool */}
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/25 space-y-2">
                <div className="flex items-center justify-between font-semibold text-sky-300">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-sky-400" /> Havuza Alınan Yeni Yapımlar (Yedekte Olmayan)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono">
                    {options.tierReport.newPoolCount} adet
                  </span>
                </div>
                {options.tierReport.newPoolTitles.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto custom-scrollbar">
                    {options.tierReport.newPoolTitles.map((title, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-sky-950/60 border border-sky-500/30 text-sky-200 text-[11px]"
                      >
                        {title}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Havuza aktarılan yeni yapım yok.</p>
                )}
              </div>

              {/* 3. Missing / Deleted Cards */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                <div className="flex items-center justify-between font-semibold text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Kütüphanede Bulunamayan / Silinmiş (Atlanan)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                    {options.tierReport.missingCount} adet
                  </span>
                </div>
                {options.tierReport.missingTitles.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1 max-h-24 overflow-y-auto custom-scrollbar">
                    {options.tierReport.missingTitles.map((title, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-500/30 text-amber-200 text-[11px]"
                      >
                        {title}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Eksik/silinmiş yapım bulunmuyor.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-white/10 bg-black/20">
          {(options.type === 'confirm' || options.type === 'prompt') && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              {options.cancelText || 'İptal'}
            </button>
          )}

          <button
            id="custom-dialog-confirm-btn"
            onClick={handleConfirm}
            className={`px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              options.isDestructive
                ? 'bg-red-600 hover:bg-red-500 shadow-red-600/30'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
            }`}
          >
            <span>{options.confirmText || 'Tamam'}</span>
            {options.type === 'prompt' && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
