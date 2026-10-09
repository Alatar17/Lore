import React, { useState, useMemo } from 'react';
import {
  RecommendationMemoryItem,
  RecommendationPoolType,
  RecommendationFilterTab,
  RecommendationCategoryFilter,
  MAX_ARCHIVE_LIMIT,
} from '../utils/recommendationMemory';
import {
  Search,
  X,
  Target,
  Archive,
  Ban,
  Trash2,
  Plus,
  ArrowLeft,
  Sparkles,
  Clapperboard,
  Gamepad2,
  BookOpen,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Check,
} from 'lucide-react';

interface RecommendationMemoryPanelProps {
  memoryItems: RecommendationMemoryItem[];
  onClose: () => void;
  onBackToChat: () => void;
  onMoveItem: (itemId: string, targetPool: RecommendationPoolType) => void;
  onRemoveItem: (itemId: string) => void;
  onClearArchive: () => void;
  onOpenAddItem?: (initialTitle?: string, targetTab?: 'media' | 'game' | 'book') => void;
}

export const RecommendationMemoryPanel: React.FC<RecommendationMemoryPanelProps> = ({
  memoryItems,
  onClose,
  onBackToChat,
  onMoveItem,
  onRemoveItem,
  onClearArchive,
  onOpenAddItem,
}) => {
  const [activeCategory, setActiveCategory] = useState<RecommendationCategoryFilter>('all');
  const [activePool, setActivePool] = useState<RecommendationFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showClearArchiveConfirm, setShowClearArchiveConfirm] = useState(false);
  const [justActionedId, setJustActionedId] = useState<string | null>(null);

  // Counts by pool (for badges)
  const poolCounts = useMemo(() => {
    // Category filtered base
    const base = activeCategory === 'all'
      ? memoryItems
      : memoryItems.filter((it) => it.mainTab === activeCategory);

    return {
      all: base.length,
      radar: base.filter((it) => it.pool === 'radar').length,
      archive: base.filter((it) => it.pool === 'archive').length,
      blacklist: base.filter((it) => it.pool === 'blacklist').length,
    };
  }, [memoryItems, activeCategory]);

  // Overall counts for info
  const totalArchiveCount = useMemo(
    () => memoryItems.filter((it) => it.pool === 'archive').length,
    [memoryItems]
  );

  // Filtered items
  const filteredItems = useMemo(() => {
    return memoryItems.filter((item) => {
      // Category filter
      if (activeCategory !== 'all' && item.mainTab !== activeCategory) {
        return false;
      }

      // Pool filter
      if (activePool !== 'all' && item.pool !== activePool) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(query);
        const matchYear = item.releaseYear ? String(item.releaseYear).includes(query) : false;
        const matchGenres = item.genres?.some((g) => g.toLowerCase().includes(query)) || false;
        if (!matchTitle && !matchYear && !matchGenres) {
          return false;
        }
      }

      return true;
    });
  }, [memoryItems, activeCategory, activePool, searchQuery]);

  const handleActionWithFeedback = (itemId: string, action: () => void) => {
    action();
    setJustActionedId(itemId);
    setTimeout(() => {
      setJustActionedId(null);
    }, 1200);
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#141824] text-slate-100 select-text">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 bg-black/40 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBackToChat}
            title="Sohbete Dön"
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-95 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Sohbete Dön</span>
          </button>

          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
              Öneri Hafızası
            </h2>
            <p className="text-[11px] text-slate-400 hidden xs:block truncate">
              Sıfır tekrar garantisi: Radar, Kara Liste ve Öneri Arşivi yönetimi
            </p>
          </div>
        </div>

        {/* Sağ Taraf: Arama İkonu & Kapat Butonu */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Arama İkonu & Açılan Arama Kutusu */}
          {isSearchOpen || searchQuery ? (
            <div className="relative flex items-center animate-in fade-in zoom-in-95 duration-150">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Hafızada yapım ara..."
                className="w-36 sm:w-56 bg-black/60 border border-indigo-400/50 focus:border-indigo-400 rounded-xl pl-8 pr-7 py-1 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
              />
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearchOpen(false);
                }}
                title="Aramayı Kapat"
                className="absolute right-2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              title="Hafızada Ara"
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer active:scale-95"
            >
              <Search className="w-4 h-4 text-slate-300" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            title="Kapat"
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all flex items-center justify-center cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Control Area: Segment Switcher (Left) + Pool Tabs (Right) - Tek Satır & PC Uyumlu */}
      <div className="px-2.5 sm:px-4 py-2 border-b border-white/10 bg-[#161c2c]/70 shrink-0">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar custom-scrollbar">
          {/* Sol: 1. Üst Kategori Seçici (Segment Switcher) */}
          <div className="inline-flex p-0.5 sm:p-1 rounded-xl bg-black/40 border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              Tümü
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('media')}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === 'media'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Clapperboard className="w-3.5 h-3.5" />
              <span>Medya</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('game')}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === 'game'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Oyun</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('book')}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === 'book'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Kitap</span>
            </button>
          </div>

          {/* Sağ: Havuz Sekmeleri (Tümü, Radar, Arşiv, Kara Liste) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Tümü Tab */}
            <button
              type="button"
              onClick={() => setActivePool('all')}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border whitespace-nowrap ${
                activePool === 'all'
                  ? 'bg-indigo-500/25 border-indigo-400/50 text-indigo-200 shadow-xs'
                  : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <span>Tümü</span>
              <span className="inline-flex items-center justify-center leading-none px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-mono">
                {poolCounts.all}
              </span>
            </button>

            {/* Radar Tab */}
            <button
              type="button"
              onClick={() => setActivePool('radar')}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border whitespace-nowrap ${
                activePool === 'radar'
                  ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-200 shadow-xs'
                  : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-emerald-300 hover:bg-white/[0.06]'
              }`}
            >
              <span>🎯 Radar</span>
              <span className="inline-flex items-center justify-center leading-none px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                {poolCounts.radar}
              </span>
            </button>

            {/* Arşiv Tab */}
            <button
              type="button"
              onClick={() => setActivePool('archive')}
              title={`Öneri Arşivi (${poolCounts.archive} / ${MAX_ARCHIVE_LIMIT})`}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border whitespace-nowrap ${
                activePool === 'archive'
                  ? 'bg-sky-500/25 border-sky-400/50 text-sky-200 shadow-xs'
                  : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-sky-300 hover:bg-white/[0.06]'
              }`}
            >
              <span>📦 Arşiv</span>
              <span className="inline-flex items-center justify-center leading-none px-1.5 py-0.5 rounded-md bg-sky-500/20 text-sky-300 text-[10px] font-mono font-bold">
                {poolCounts.archive}
              </span>
            </button>

            {/* Kara Liste Tab */}
            <button
              type="button"
              onClick={() => setActivePool('blacklist')}
              className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border whitespace-nowrap ${
                activePool === 'blacklist'
                  ? 'bg-rose-500/25 border-rose-400/50 text-rose-200 shadow-xs'
                  : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-rose-300 hover:bg-white/[0.06]'
              }`}
            >
              <span>🚫 Kara Liste</span>
              <span className="inline-flex items-center justify-center leading-none px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold">
                {poolCounts.blacklist}
              </span>
            </button>

            {/* Arşivi Temizle butonu */}
            {activePool === 'archive' && poolCounts.archive > 0 && (
              <div className="relative shrink-0">
                {!showClearArchiveConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowClearArchiveConfirm(true)}
                    className="inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Temizle</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-rose-950/90 border border-rose-500/60 px-2 py-1 rounded-xl shadow-lg">
                    <span className="text-[11px] text-rose-200 font-medium">Emin misiniz?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onClearArchive();
                        setShowClearArchiveConfirm(false);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold cursor-pointer"
                    >
                      Evet
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowClearArchiveConfirm(false)}
                      className="px-1.5 py-0.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-[11px] cursor-pointer"
                    >
                      İptal
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5 space-y-2">
        {filteredItems.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-400 select-none">
            {activePool === 'radar' ? (
              <>
                <Target className="w-10 h-10 text-emerald-400/40 mb-2" />
                <h4 className="text-sm font-bold text-slate-300">Radarınızda yapım bulunmuyor</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  AI öneriler sunduğunda mesaj altındaki 👍 [Radara Ekle] butonuyla dilediğiniz yapımları buraya ekleyebilirsiniz.
                </p>
              </>
            ) : activePool === 'blacklist' ? (
              <>
                <Ban className="w-10 h-10 text-rose-400/40 mb-2" />
                <h4 className="text-sm font-bold text-slate-300">Kara listeniz boş</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Görmek istemediğiniz yapımları 👎 [Kara Listeye Al] butonuyla ekleyebilir, AI'ın bir daha asla önermemesini sağlayabilirsiniz.
                </p>
              </>
            ) : activePool === 'archive' ? (
              <>
                <Archive className="w-10 h-10 text-sky-400/40 mb-2" />
                <h4 className="text-sm font-bold text-slate-300">Öneri Arşivi boş</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  AI'ın size sunduğu tüm yeni yapım kartları otomatik olarak sessizce buraya kaydedilir (maksimum 500 adet).
                </p>
              </>
            ) : (
              <>
                <Sparkles className="w-10 h-10 text-indigo-400/40 mb-2" />
                <h4 className="text-sm font-bold text-slate-300">
                  {searchQuery ? 'Aramanızla eşleşen yapım bulunamadı' : 'Öneri hafızanız henüz boş'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  {searchQuery
                    ? 'Farklı bir anahtar kelime ile aramayı deneyebilirsiniz.'
                    : 'Lore AI Asistan ile sohbet ettikçe ve öneri aldıkça hafıza otomatik olarak dolacaktır.'}
                </p>
              </>
            )}
          </div>
        ) : (
          filteredItems.map((item) => {
            const isGame = item.mainTab === 'game';
            const isJustActioned = justActionedId === item.id;

            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/10 transition-all ${
                  isJustActioned ? 'border-indigo-400/70 bg-indigo-500/10' : ''
                }`}
              >
                {/* Sol: Afiş + Künye */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Minik 2:3 Afiş / İkon (~40x56px) */}
                  <div className="w-10 sm:w-11 aspect-[2/3] rounded-lg overflow-hidden bg-black/50 border border-white/10 shrink-0 relative flex items-center justify-center shadow-xs">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-900/40 to-slate-900/60">
                        {isGame ? (
                          <Gamepad2 className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Clapperboard className="w-4 h-4 text-sky-400" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Başlık, Yıl, Rozetler */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Tür Rozeti */}
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isGame
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        }`}
                      >
                        {isGame ? 'Oyun' : 'Medya'}
                      </span>

                      {/* Havuz Rozeti (Tümü sekmesindeyken özellikle çok yararlı) */}
                      {item.pool === 'radar' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          <Target className="w-2.5 h-2.5" />
                          <span>Radar</span>
                        </span>
                      ) : item.pool === 'blacklist' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          <Ban className="w-2.5 h-2.5" />
                          <span>Kara Liste</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-500/20 text-slate-300 border border-slate-500/30">
                          <Archive className="w-2.5 h-2.5" />
                          <span>Arşiv</span>
                        </span>
                      )}

                      {/* Önerilme Tarihi */}
                      {item.recommendedAt && (
                        <span className="text-[10px] text-slate-400 hidden md:inline">
                          • {formatDate(item.recommendedAt)}
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs sm:text-sm font-bold text-white truncate mt-1">
                      {item.title}
                      {item.releaseYear && (
                        <span className="font-normal text-slate-400 text-xs ml-1.5">
                          ({item.releaseYear})
                        </span>
                      )}
                    </h4>

                    {/* Türler */}
                    {item.genres && item.genres.length > 0 && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {item.genres.join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Sağ: Satır İçi Hızlı Aksiyonlar */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {/* 1. Radara Taşı (Eğer şu an radarda değilse) */}
                  {item.pool !== 'radar' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleActionWithFeedback(item.id, () => onMoveItem(item.id, 'radar'))
                      }
                      title="Radara Al (İzleme/Oynama listesi)"
                      className="p-1.5 sm:px-2 sm:py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 hover:text-emerald-100 transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer active:scale-95"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">Radara Al</span>
                    </button>
                  )}

                  {/* 2. Kara Listeye Taşı (Eğer şu an kara listede değilse) */}
                  {item.pool !== 'blacklist' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleActionWithFeedback(item.id, () => onMoveItem(item.id, 'blacklist'))
                      }
                      title="Kara Listeye Al (Bir daha asla önerme)"
                      className="p-1.5 sm:px-2 sm:py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-300 hover:text-rose-100 transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer active:scale-95"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">Kara Liste</span>
                    </button>
                  )}

                  {/* 3. Arşive Geri Döndür (Eğer radar veya kara listedeyse) */}
                  {item.pool !== 'archive' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleActionWithFeedback(item.id, () => onMoveItem(item.id, 'archive'))
                      }
                      title="Arşive Taşı (Nötr bekleme havuzu)"
                      className="p-1.5 sm:px-2 sm:py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer active:scale-95"
                    >
                      <Archive className="w-3.5 h-3.5 text-sky-400" />
                      <span className="hidden lg:inline">Arşive Al</span>
                    </button>
                  )}

                  {/* 4. Kütüphaneye Ekle Butonu */}
                  {onOpenAddItem && (
                    <button
                      type="button"
                      onClick={() => onOpenAddItem(item.title, item.mainTab)}
                      title="Kütüphaneye Ekle"
                      className="p-1.5 sm:px-2 sm:py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 hover:text-white transition-all flex items-center gap-1 text-xs font-semibold cursor-pointer active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden md:inline">Kütüphaneye Ekle</span>
                    </button>
                  )}

                  {/* 5. Hafızadan Sil (Unut) Butonu */}
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    title="Hafızadan Tamamen Çıkar (Unut)"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Information Footer */}
      <div className="p-3 px-4 sm:px-6 bg-black/40 border-t border-white/10 shrink-0 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span>🎯 Radar & 🚫 Kara Liste: <strong className="text-slate-300">Kalıcı</strong></span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="hidden sm:inline">📦 Öneri Arşivi: <strong className="text-slate-300 font-mono">{totalArchiveCount} / {MAX_ARCHIVE_LIMIT}</strong></span>
        </div>
      </div>
    </div>
  );
};
