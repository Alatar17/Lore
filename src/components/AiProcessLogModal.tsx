import React, { useState } from 'react';
import { AiLogEntry } from '../utils/geminiAi';
import { X, Copy, Check, Terminal, Sparkles, AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface AiProcessLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  logs: AiLogEntry[];
  statusType: 'loading' | 'success' | 'error' | null;
  usedModel?: string;
}

export const AiProcessLogModal: React.FC<AiProcessLogModalProps> = ({
  isOpen,
  onClose,
  title,
  logs,
  statusType,
  usedModel,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyLogs = async () => {
    try {
      const formatted = logs
        .map((l) => {
          let line = `[${l.time}] [${l.level.toUpperCase()}] ${l.message}`;
          if (l.details) {
            line += `\n  Detay: ${l.details}`;
          }
          return line;
        })
        .join('\n');

      const textToCopy = [
        `=== Lore AI İşlem Günlüğü: "${title || 'İsimsiz'}" ===`,
        `Kullanılan/Denenen Model: ${usedModel || 'Bilinmiyor'}`,
        `Durum: ${statusType || 'Bilinmiyor'}`,
        `Tarih: ${new Date().toLocaleString('tr-TR')}`,
        `Toplam Adım: ${logs.length}`,
        '',
        formatted,
      ].join('\n');

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  };

  const getLevelBadge = (level: AiLogEntry['level']) => {
    switch (level) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            BAŞARI
          </span>
        );
      case 'warn':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            UYARI
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            HATA
          </span>
        );
      case 'info':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30">
            <Info className="w-3 h-3 text-sky-400" />
            BİLGİ
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-[#141824] border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Sparkles className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                AI İşlem Günlüğü & Adım Detayları
              </h3>
              <p className="text-[11px] text-slate-400">
                Arka planda yapılan tüm adımlar, model denemeleri ve sonuçlar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Header Toolbar */}
        <div className="px-5 py-2.5 bg-white/[0.02] border-b border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Hedef:</span>
            <span className="font-semibold text-slate-200 truncate max-w-[200px]">
              {title.trim() || 'Afişten Tespit'}
            </span>
            {usedModel && (
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono">
                {usedModel}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleCopyLogs}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] transition-colors cursor-pointer disabled:opacity-40"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Kopyalandı!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Günlüğü Kopyala</span>
              </>
            )}
          </button>
        </div>

        {/* Logs Timeline Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              <Terminal className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Henüz bir AI işlemi kaydı bulunmuyor.
            </div>
          ) : (
            <div className="relative border-l border-white/10 ml-3 pl-4 space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="relative group">
                  {/* Timeline bullet dot */}
                  <div
                    className={`absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-[#141824] ${
                      log.level === 'success'
                        ? 'bg-emerald-400'
                        : log.level === 'warn'
                        ? 'bg-amber-400'
                        : log.level === 'error'
                        ? 'bg-rose-400'
                        : 'bg-sky-400'
                    }`}
                  />

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500">{log.time}</span>
                      {getLevelBadge(log.level)}
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed font-normal">
                      {log.message}
                    </p>

                    {log.details && (
                      <div className="mt-1 p-2 rounded-lg bg-black/40 border border-white/5 text-[11px] font-mono text-slate-400 max-h-36 overflow-y-auto whitespace-pre-wrap break-all custom-scrollbar">
                        {log.details}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Toplam {logs.length} adım kaydedildi
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
