import React, { useState } from 'react';
import { ArchiveItem, ViewSettings } from '../types';
import { ItemCard } from './ItemCard';
import { ClipboardList, Check, Sparkles } from 'lucide-react';

interface TrackedViewProps {
  items: ArchiveItem[];
  viewSettings: ViewSettings;
  onItemClick: (item: ArchiveItem) => void;
}

export const TrackedView: React.FC<TrackedViewProps> = ({
  items,
  viewSettings,
  onItemClick,
}) => {
  const [showPromptBox, setShowPromptBox] = useState(false);
  const [copied, setCopied] = useState(false);

  const watchingItems = items.filter((it) => it.watching);
  const followingItems = items.filter((it) => it.following);

  const buildPromptText = () => {
    const names = followingItems.map((it) => `- ${it.title}`).join('\n');
    return `Aşağıdaki dizi/anime isimlerinin güncel bölüm/sezon durumunu web'den araştır.
Her biri için SADECE şunu söyle: en son yayınlanan bölüm/sezon ne zamandı,
yeni bir bölüm/sezon duyurulmuş mu (duyurulduysa tarihini belirt), yoksa şu an
bilinen bir plan yok mu. Kısa ve net cevap ver, madde madde, gereksiz açıklama yapma.

${names || '- (Takip listesinde henüz yapım yok)'}`;
  };

  const handleCopy = async () => {
    const text = buildPromptText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div id="tracked-view" className="space-y-8 mt-2">
      {/* 1. Bölüm: Şu An İzlenenler */}
      <section>
        <div className="flex items-center gap-2 mb-3.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <h2 className="text-base font-semibold text-gray-100 flex items-center gap-2">
            🔵 Şu An İzlenenler
            <span className="text-xs font-normal text-gray-400">
              ({watchingItems.length})
            </span>
          </h2>
        </div>

        {watchingItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3.5">
            {watchingItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                viewSettings={viewSettings}
                onClick={() => onItemClick(item)}
              />
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-xl border border-dashed border-[#2e3340] text-center text-gray-400 text-xs bg-[#16171d]">
            Şu an izlenen listesinde kayıtlı yapım yok.
          </div>
        )}
      </section>

      {/* 2. Bölüm: Takip Edilenler */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">★</span>
            <h2 className="text-base font-semibold text-gray-100 flex items-center gap-2">
              Takip Edilenler
              <span className="text-xs font-normal text-gray-400">
                ({followingItems.length})
              </span>
            </h2>
            <span className="text-xs text-gray-400 hidden sm:inline">
              (Biten ama yeni sezon / bölüm beklenenler)
            </span>
          </div>

          <button
            id="gen-prompt-btn"
            onClick={() => setShowPromptBox(!showPromptBox)}
            title="Takip listesindeki yapımlar için AI sorgu metni oluştur"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
              showPromptBox
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-[#1e212b] border-[#373c4b] text-gray-300 hover:text-white hover:border-gray-500'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Sorgu Metni Oluştur</span>
          </button>
        </div>

        {/* AI Sorgu Metni Kutusu */}
        {showPromptBox && (
          <div
            id="prompt-box-container"
            className="mb-5 p-4 rounded-xl bg-[#1c1e26] border border-amber-500/30 shadow-lg space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4" /> AI Web Araştırma Şablonu
              </span>
              <span className="text-[11px] text-gray-400">
                ChatGPT, Claude veya Gemini'ye yapıştırarak güncel durumları
                öğrenebilirsin
              </span>
            </div>

            <textarea
              id="prompt-text-area"
              readOnly
              value={buildPromptText()}
              rows={8}
              className="w-full bg-[#121318] text-gray-200 border border-[#2e3342] rounded-lg p-3 text-xs font-mono leading-relaxed focus:outline-none select-all custom-scrollbar"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                id="copy-prompt-btn"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs transition-colors shadow"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Kopyalandı ✓</span>
                  </>
                ) : (
                  <>
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span>Panoya Kopyala</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {followingItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3.5">
            {followingItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                viewSettings={viewSettings}
                onClick={() => onItemClick(item)}
              />
            ))}
          </div>
        ) : (
          <div className="p-6 rounded-xl border border-dashed border-[#2e3340] text-center text-gray-400 text-xs bg-[#16171d]">
            Takip listesinde henüz yapım yok. Detay ekranından "Takip
            listesinde" işaretleyebilirsin.
          </div>
        )}
      </section>
    </div>
  );
};
