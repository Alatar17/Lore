import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArchiveItem,
  Category,
  GameStatus,
  MediaStatus,
  BookStatus,
  MainTabType,
  ItemCharacter,
  BookFormat,
  BookQuote,
  AnkiBlurBox,
  AnkiExtraImage,
  CustomBadge,
  getBadgeColorOption,
} from '../types';
import { MEDIA_COLORS, GAME_COLORS, BOOK_COLORS } from '../data/initialData';
import { optimizeImageFile } from '../utils/imageOptimizer';
import { TagInputBox } from './TagInputBox';
import { getFieldScopedTags, getFieldScopedTagCounts } from '../utils/tagUtils';
import { getGeminiApiKey, fetchAiMetadata, formatMetadataModelLabel, AiItemMetadata, AiLogEntry } from '../utils/geminiAi';
import { AiProcessLogModal } from './AiProcessLogModal';
import { AnkiEditorModal } from './AnkiEditorModal';
import { initAnkiCard } from '../utils/ankiUtils';
import {
  X,
  Upload,
  Plus,
  Calendar,
  CalendarRange,
  Star,
  Clock,
  Trophy,
  ClipboardPaste,
  Check,
  Tv,
  Bookmark,
  Sparkles,
  HelpCircle,
  Building2,
  Clapperboard,
  Users,
  Tags,
  PauseCircle,
  Megaphone,
  Trash2,
  Image as ImageIcon,
  Layers,
  Info,
  AlertCircle,
  Loader2,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  FileText,
  Quote,
  PenTool,
  Globe,
  Crop,
  MinusCircle,
  Award,
  Settings,
} from 'lucide-react';

interface AddItemModalProps {
  mainTab: MainTabType;
  categories: Category[];
  activeCatId: string | null;
  activeSub: string | null;
  allItems?: ArchiveItem[];
  initialTitle?: string;
  customBadges?: CustomBadge[];
  onOpenSettings?: (tab?: 'categories' | 'tags' | 'themes' | 'shortcuts' | 'storage') => void;
  onAdd: (newItem: ArchiveItem) => void;
  onClose: () => void;
}

function formatReviewDate(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-');
    return `${d}.${m}.${y}`;
  }
  return trimmed;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  mainTab,
  categories,
  activeCatId,
  activeSub,
  allItems = [],
  initialTitle,
  customBadges = [],
  onOpenSettings,
  onAdd,
  onClose,
}) => {
  const isGame = mainTab === 'game';
  const isBook = mainTab === 'book';
  const defaultCat =
    categories.find((c) => c.id === activeCatId) ||
    categories[0] || { id: 'genel', name: 'Genel', subgroups: [] };

  const validDefaultSub =
    activeSub && defaultCat.subgroups?.includes(activeSub) ? activeSub : null;

  const [title, setTitle] = useState(initialTitle || '');
  const [titleError, setTitleError] = useState(false);
  const [cat, setCat] = useState(defaultCat.id);
  const [sub, setSub] = useState<string | null>(validDefaultSub);
  const [rating, setRating] = useState<number>(8);
  const [rememberedRating, setRememberedRating] = useState<number>(8);
  const [date, setDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [desc, setDesc] = useState('');
  const [review, setReview] = useState('');
  const [reviewDate, setReviewDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isReviewDateUpdated, setIsReviewDateUpdated] = useState(false);
  const originalReviewDateRef = useRef<string>(new Date().toISOString().split('T')[0]);
  const [activeTextTab, setActiveTextTab] = useState<'desc' | 'review'>('desc');
  const [thumbnail, setThumbnail] = useState<string | undefined>(undefined);
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  // Field-Scoped Tags state
  const [firm, setFirm] = useState<string[]>([]);
  const [director, setDirector] = useState<string[]>([]);
  const [actors, setActors] = useState<string[]>([]);
  const [developer, setDeveloper] = useState<string[]>([]);
  const [genre, setGenre] = useState<string[]>([]);

  // Book specific states
  const [pageCount, setPageCount] = useState<number | string>('');
  const [bookFormat, setBookFormat] = useState<BookFormat>('Ciltsiz');
  const [bookStatus, setBookStatus] = useState<BookStatus>('Tamamlandı');
  const [reading, setReading] = useState(false);
  const [author, setAuthor] = useState<string[]>([]);
  const [publisher, setPublisher] = useState<string[]>([]);
  const [translator, setTranslator] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<BookQuote[]>([]);

  // Available field-scoped tags and count maps for autocomplete
  const availableFirmTags = useMemo(
    () => getFieldScopedTags(allItems, 'media', 'firm'),
    [allItems]
  );
  const firmTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'media', 'firm'),
    [allItems]
  );

  const availableDirectorTags = useMemo(
    () => getFieldScopedTags(allItems, 'media', 'director'),
    [allItems]
  );
  const directorTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'media', 'director'),
    [allItems]
  );

  const availableActorsTags = useMemo(
    () => getFieldScopedTags(allItems, 'media', 'actors'),
    [allItems]
  );
  const actorsTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'media', 'actors'),
    [allItems]
  );

  const availableMediaGenreTags = useMemo(
    () => getFieldScopedTags(allItems, 'media', 'genre'),
    [allItems]
  );
  const mediaGenreTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'media', 'genre'),
    [allItems]
  );

  const availableDevTags = useMemo(
    () => getFieldScopedTags(allItems, 'game', 'developer'),
    [allItems]
  );
  const devTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'game', 'developer'),
    [allItems]
  );

  const availableGameGenreTags = useMemo(
    () => getFieldScopedTags(allItems, 'game', 'genre'),
    [allItems]
  );
  const gameGenreTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'game', 'genre'),
    [allItems]
  );

  const availableAuthorTags = useMemo(
    () => getFieldScopedTags(allItems, 'book', 'author'),
    [allItems]
  );
  const authorTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'book', 'author'),
    [allItems]
  );

  const availablePublisherTags = useMemo(
    () => getFieldScopedTags(allItems, 'book', 'publisher'),
    [allItems]
  );
  const publisherTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'book', 'publisher'),
    [allItems]
  );

  const availableTranslatorTags = useMemo(
    () => getFieldScopedTags(allItems, 'book', 'translator'),
    [allItems]
  );
  const translatorTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'book', 'translator'),
    [allItems]
  );

  const availableBookGenreTags = useMemo(
    () => getFieldScopedTags(allItems, 'book', 'genre'),
    [allItems]
  );
  const bookGenreTagCounts = useMemo(
    () => getFieldScopedTagCounts(allItems, 'book', 'genre'),
    [allItems]
  );

  // Media Specific
  const [mediaStatus, setMediaStatus] = useState<MediaStatus>('Tamamlandı');
  const [watching, setWatching] = useState(false);
  const [following, setFollowing] = useState(false);
  const [dropped, setDropped] = useState(false);
  const [expectedDate, setExpectedDate] = useState('');
  const [followNotes, setFollowNotes] = useState('');
  const [showFollowDetails, setShowFollowDetails] = useState(false);

  // Takip kutularında (Beklenen Dönem veya Gelişme Notu) veri olup olmadığını kontrol eder
  const hasFollowData = !!(
    (expectedDate && expectedDate.trim().length > 0) ||
    (followNotes && followNotes.trim().length > 0)
  );

  // Additional New Fields (Release Year & Range)
  const [isYearRange, setIsYearRange] = useState(false);
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [characters, setCharacters] = useState<ItemCharacter[]>([]);

  // Series / Franchise (Bağlantılı Yapımlar)
  const [seriesName, setSeriesName] = useState('');
  const [seriesOrder, setSeriesOrder] = useState<string>('');
  const [showFranchiseTooltip, setShowFranchiseTooltip] = useState(false);

  // Gemini AI States
  const [aiLoading, setAiLoading] = useState(false);
  const [aiFetchedData, setAiFetchedData] = useState<AiItemMetadata | null>(null);
  const [aiNotice, setAiNotice] = useState<{ text: string; type: 'success' | 'error' | 'warn' } | null>(null);

  // AI Suggestions tracking for Description & Release Year (Auto-applied with visual glow & instant toggle)
  const [aiDescState, setAiDescState] = useState<{
    original: string;
    suggested: string;
    isActive: boolean;
  } | null>(null);

  const [aiYearState, setAiYearState] = useState<{
    original: { startYear: string; endYear: string; isYearRange: boolean };
    suggested: { startYear: string; endYear: string; isYearRange: boolean };
    isActive: boolean;
  } | null>(null);

  // Tag fields & characters AI toggle states
  const [aiTagStates, setAiTagStates] = useState<{
    genres?: {
      original: string[];
      suggested: string[];
      diff: { newTags: string[]; removedTags: string[] };
      isActive: boolean;
    };
    firms?: {
      original: string[];
      suggested: string[];
      diff: { newTags: string[]; removedTags: string[] };
      isActive: boolean;
    };
    directors?: {
      original: string[];
      suggested: string[];
      diff: { newTags: string[]; removedTags: string[] };
      isActive: boolean;
    };
    actors?: {
      original: string[];
      suggested: string[];
      diff: { newTags: string[]; removedTags: string[] };
      isActive: boolean;
    };
    developers?: {
      original: string[];
      suggested: string[];
      diff: { newTags: string[]; removedTags: string[] };
      isActive: boolean;
    };
    authors?: {
      original: string[];
      suggested: string[];
      diff: { newTags: string[]; removedTags: string[] };
      isActive: boolean;
    };
    publishers?: {
      original: string[];
      suggested: string[];
      diff: { newTags: string[]; removedTags: string[] };
      isActive: boolean;
    };
    translators?: {
      original: string[];
      suggested: string[];
      diff: { newTags: string[]; removedTags: string[] };
      isActive: boolean;
    };
  }>({});

  const [aiCharState, setAiCharState] = useState<{
    original: ItemCharacter[];
    suggested: ItemCharacter[];
    highlightNames: string[];
    isActive: boolean;
  } | null>(null);

  // Undo & Visual Diffing States
  const [fieldUndoHistory, setFieldUndoHistory] = useState<{
    releaseYear?: { startYear: string; endYear: string; isYearRange: boolean };
    desc?: string;
    genres?: string[];
    firms?: string[];
    directors?: string[];
    actors?: string[];
    developers?: string[];
    authors?: string[];
    publishers?: string[];
    translators?: string[];
    characters?: ItemCharacter[];
  }>({});

  const [tagDiffs, setTagDiffs] = useState<{
    genres?: { newTags: string[]; removedTags: string[] };
    firms?: { newTags: string[]; removedTags: string[] };
    directors?: { newTags: string[]; removedTags: string[] };
    actors?: { newTags: string[]; removedTags: string[] };
    developers?: { newTags: string[]; removedTags: string[] };
    authors?: { newTags: string[]; removedTags: string[] };
    publishers?: { newTags: string[]; removedTags: string[] };
    translators?: { newTags: string[]; removedTags: string[] };
  }>({});

  const [highlightNewCharacters, setHighlightNewCharacters] = useState<string[]>([]);
  const [fieldNotices, setFieldNotices] = useState<Record<string, string>>({});

  const showFieldNotice = (field: string, text: string) => {
    setFieldNotices((prev) => ({ ...prev, [field]: text }));
    setTimeout(() => {
      setFieldNotices((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }, 2800);
  };

  // AI Real-time Step Status & Logging States
  const [aiStatusText, setAiStatusText] = useState<string | null>(null);
  const [aiStatusType, setAiStatusType] = useState<'loading' | 'success' | 'error' | null>(null);
  const [aiLogs, setAiLogs] = useState<AiLogEntry[]>([]);
  const [showAiLogModal, setShowAiLogModal] = useState<boolean>(false);
  const [aiUsedModel, setAiUsedModel] = useState<string | undefined>(undefined);

  // Helper to ensure AI data is fetched for this item
  const ensureAiData = async (): Promise<AiItemMetadata | null> => {
    if (aiFetchedData) return aiFetchedData;

    const key = getGeminiApiKey();
    if (!key) {
      const err = 'Lütfen önce Ayarlar > Veri & Dosya Sistemi > Gelişmiş altından Gemini API anahtarınızı kaydedin.';
      setAiNotice({
        text: err,
        type: 'error',
      });
      setAiStatusText('API anahtarı eksik');
      setAiStatusType('error');
      setAiLogs([
        {
          id: `${Date.now()}-err`,
          time: new Date().toTimeString().split(' ')[0],
          level: 'error',
          message: 'Gemini API anahtarı ayarlanmamış.',
          details: 'Ayarlar > Veri & Dosya Sistemi > Gelişmiş Seçenekler altından geçerli bir Google AI Studio anahtarı girin.',
        },
      ]);
      setTimeout(() => setAiNotice(null), 5000);
      return null;
    }

    if (!title.trim() && !thumbnail) {
      const err = 'Lütfen önce bir yapım başlığı girin veya bir afiş yükleyin.';
      setAiNotice({
        text: err,
        type: 'error',
      });
      setAiStatusText('Başlık veya afiş gerekli');
      setAiStatusType('error');
      setTimeout(() => setAiNotice(null), 4000);
      return null;
    }

    setAiLoading(true);
    setAiNotice(null);
    setAiStatusText('İşlem başlatılıyor...');
    setAiStatusType('loading');
    setAiLogs([]);
    setAiUsedModel(undefined);

    try {
      const res = await fetchAiMetadata({
        title: title.trim(),
        categoryName: defaultCat.name,
        isGame,
        isBook,
        posterBase64: thumbnail,
        existingGenres: isBook ? availableBookGenreTags : isGame ? availableGameGenreTags : availableMediaGenreTags,
        existingFirms: availableFirmTags,
        existingDirectors: availableDirectorTags,
        existingDevelopers: availableDevTags,
        existingAuthors: availableAuthorTags,
        existingPublishers: availablePublisherTags,
        existingTranslators: availableTranslatorTags,
        onProgress: (statusText, logEntry) => {
          setAiStatusText(statusText);
          setAiLogs((prev) => [...prev, logEntry]);
        },
      });

      if (res.logs && res.logs.length > 0) {
        setAiLogs(res.logs);
      }
      if (res.usedModel) {
        setAiUsedModel(res.usedModel);
      }

      if (!res.success || !res.data) {
        setAiNotice({
          text: res.error || 'AI yapım bilgilerini getiremedi.',
          type: 'error',
        });
        setAiStatusText(res.error || 'İşlem tamamlanamadı');
        setAiStatusType('error');
        setTimeout(() => setAiNotice(null), 5000);
        return null;
      }

      setAiFetchedData(res.data);
      const formattedModel = formatMetadataModelLabel(res.usedModel);
      setAiStatusText(`Tamamlandı (${formattedModel})`);
      setAiStatusType('success');
      return res.data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAiNotice({
        text: `Hata: ${msg.slice(0, 100)}`,
        type: 'error',
      });
      setAiStatusText(`Hata: ${msg.slice(0, 50)}`);
      setAiStatusType('error');
      setTimeout(() => setAiNotice(null), 5000);
      return null;
    } finally {
      setAiLoading(false);
    }
  };

  // Master AI Action: "✨ AI ile Doldur"
  // Boş alanları otomatik doldurur, dolu alanlar için kutu başında onay önerileri sunar.
  const handleAiFill = async () => {
    // AI Safety Shield: Seamlessly switch to 'desc' tab so user sees the newly populated synopsis
    // while their personal review remains 100% untouched
    setActiveTextTab('desc');

    if (!title.trim() && !thumbnail) {
      setAiNotice({
        text: 'Lütfen önce bir yapım/kitap başlığı girin veya kapak resmi yükleyin.',
        type: 'warn',
      });
      setTimeout(() => setAiNotice(null), 3000);
      return;
    }

    const data = await ensureAiData();
    if (!data) return;

    let filledCount = 0;
    let suggestedCount = 0;

    // 1. Release Year (Çıkış Yılı) - Doğrudan kutuya uygula, yeşil çerçeve ve [↩]/[✨] geçiş durumunu aktifleştir
    const normalizeYear = (val: string) => val.replace(/\s+/g, '').replace(/[-–—]/g, '-');
    const curYear = isYearRange ? `${startYear}–${endYear}`.trim() : startYear.trim();
    if (data.releaseYear) {
      const aiYearStr = String(data.releaseYear).trim();
      if (aiYearStr && (!curYear || normalizeYear(aiYearStr) !== normalizeYear(curYear))) {
        let aiStart = aiYearStr;
        let aiEnd = '';
        let aiIsRange = false;
        if (aiYearStr.includes('-') || aiYearStr.includes('–') || aiYearStr.includes('—')) {
          aiIsRange = true;
          const parts = aiYearStr.split(/[-–—]/);
          aiStart = parts[0]?.trim() || '';
          aiEnd = parts[1]?.trim() || '';
        }
        setAiYearState({
          original: {
            startYear,
            endYear,
            isYearRange,
          },
          suggested: {
            startYear: aiStart,
            endYear: aiEnd,
            isYearRange: aiIsRange,
          },
          isActive: true,
        });
        setIsYearRange(aiIsRange);
        setStartYear(aiStart);
        setEndYear(aiEnd);

        if (!curYear) {
          filledCount++;
        } else {
          suggestedCount++;
        }
      }
    }

    // 2. Description (Konu / Özet) - Doğrudan kutuya uygula, yeşil çerçeve ve [↩]/[✨] geçiş durumunu aktifleştir
    const curDesc = desc.trim();
    const aiDesc = (data.description || '').trim();
    if (aiDesc && aiDesc !== curDesc) {
      setAiDescState({
        original: desc,
        suggested: aiDesc,
        isActive: true,
      });
      setDesc(aiDesc);

      if (!curDesc) {
        filledCount++;
      } else {
        suggestedCount++;
      }
    }

    // Helper for tag fields (Genres, Firms, Directors, Actors, Developers, Authors, Publishers, Translators)
    const processTagField = (
      fieldKey: 'genres' | 'firms' | 'directors' | 'actors' | 'developers' | 'authors' | 'publishers' | 'translators',
      currentTags: string[],
      aiTags: string[] | undefined,
      setter: (tags: string[]) => void
    ) => {
      const ai = aiTags || [];
      if (ai.length === 0) return;

      if (currentTags.length === 0) {
        // Boş -> doğrudan doldur
        setter(ai);
        filledCount++;
      } else {
        // Dolu -> diff oluştur ve kutu başında onay seçeneği sun
        const curSet = new Set(currentTags.map((t) => t.trim().toLowerCase()));
        const aiSet = new Set(ai.map((t) => t.trim().toLowerCase()));
        const newTags = ai.filter((t) => !curSet.has(t.trim().toLowerCase()));
        const removedTags = currentTags.filter((t) => !aiSet.has(t.trim().toLowerCase()));

        if (newTags.length > 0 || removedTags.length > 0) {
          const updated = [...currentTags.filter((t) => aiSet.has(t.trim().toLowerCase())), ...newTags];
          const finalSuggested = updated.length > 0 ? updated : ai;
          const diff = { newTags, removedTags };

          setter(finalSuggested);
          setTagDiffs((prev) => ({
            ...prev,
            [fieldKey]: diff,
          }));
          setAiTagStates((prev) => ({
            ...prev,
            [fieldKey]: {
              original: [...currentTags],
              suggested: finalSuggested,
              diff,
              isActive: true,
            },
          }));
          suggestedCount++;
        }
      }
    };

    // 3. Genres
    processTagField('genres', genre, data.genres, setGenre);

    // 4. Field-scoped tags
    if (isBook) {
      processTagField('authors', author, data.authors, setAuthor);
      processTagField('publishers', publisher, data.publishers, setPublisher);
      processTagField('translators', translator, data.translators, setTranslator);
    } else if (!isGame) {
      processTagField('firms', firm, data.firms, setFirm);
      processTagField('directors', director, data.directors, setDirector);
      const aiActorList = data.actors && data.actors.length > 0
        ? data.actors
        : Array.from(new Set((data.characters || []).map((c) => c.actor?.trim()).filter(Boolean) as string[]));
      processTagField('actors', actors, aiActorList, setActors);
    } else {
      processTagField('developers', developer, data.developers, setDeveloper);
    }

    // 6. Characters (Karakterler & Kadro)
    const aiChars = data.characters || [];
    if (aiChars.length > 0) {
      if (characters.length === 0) {
        // Boş -> doğrudan doldur
        setCharacters(aiChars.map((c) => ({ name: c.name, actor: c.actor || '' })));
        filledCount++;
      } else {
        // Dolu -> yeni karakterleri diff olarak öner
        const curNames = new Set(characters.map((c) => c.name.trim().toLowerCase()));
        const newChars = aiChars.filter((c) => !curNames.has(c.name.trim().toLowerCase()));
        if (newChars.length > 0) {
          const updated = [...characters, ...newChars.map((c) => ({ name: c.name, actor: c.actor || '' }))];
          setCharacters(updated);
          const highlightNames = newChars.map((c) => c.name.trim().toLowerCase());
          setHighlightNewCharacters(highlightNames);
          setAiCharState({
            original: [...characters],
            suggested: updated,
            highlightNames,
            isActive: true,
          });
          suggestedCount++;
        }
      }
    }

    // Bilgilendirme üst bildirimi kullanıcı isteğiyle kaldırıldı (alan içi geri alma butonları mevcuttur)
  };

  const handleToggleTagField = (
    fieldKey: 'genres' | 'firms' | 'directors' | 'actors' | 'developers' | 'authors' | 'publishers' | 'translators',
    setter: (tags: string[]) => void
  ) => {
    const state = aiTagStates[fieldKey];
    if (!state) return;

    if (state.isActive) {
      setter(state.original);
      setTagDiffs((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
      setAiTagStates((prev) => ({
        ...prev,
        [fieldKey]: { ...state, isActive: false },
      }));
    } else {
      setter(state.suggested);
      setTagDiffs((prev) => ({
        ...prev,
        [fieldKey]: state.diff,
      }));
      setAiTagStates((prev) => ({
        ...prev,
        [fieldKey]: { ...state, isActive: true },
      }));
    }
  };

  const handleToggleCharacters = () => {
    if (!aiCharState) return;

    if (aiCharState.isActive) {
      setCharacters(aiCharState.original);
      setHighlightNewCharacters([]);
      setAiCharState((prev) => (prev ? { ...prev, isActive: false } : null));
    } else {
      setCharacters(aiCharState.suggested);
      setHighlightNewCharacters(aiCharState.highlightNames);
      setAiCharState((prev) => (prev ? { ...prev, isActive: true } : null));
    }
  };

  const handleTagFieldChange = (
    fieldKey: 'genres' | 'firms' | 'directors' | 'actors' | 'developers' | 'authors' | 'publishers' | 'translators',
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    newTags: string[]
  ) => {
    setter(newTags);
    const state = aiTagStates[fieldKey];
    if (state && state.isActive) {
      // Retain newTags highlight for any tags still in newTags that were suggested by AI
      const remainingNew = (state.diff.newTags || []).filter((t) =>
        newTags.some((nt) => nt.trim().toLowerCase() === t.trim().toLowerCase())
      );
      // Retain removedTags for any original tag that is not in newTags
      const curSet = new Set(newTags.map((t) => t.trim().toLowerCase()));
      const remainingRemoved = (state.original || []).filter(
        (t) => !curSet.has(t.trim().toLowerCase())
      );

      const updatedDiff = {
        newTags: remainingNew,
        removedTags: remainingRemoved,
      };

      setTagDiffs((prev) => ({
        ...prev,
        [fieldKey]: updatedDiff,
      }));
      setAiTagStates((prev) => ({
        ...prev,
        [fieldKey]: {
          ...state,
          diff: updatedDiff,
        },
      }));
    }
  };

  const handleRestoreRemovedTag = (
    field: 'genres' | 'firms' | 'directors' | 'actors' | 'developers' | 'authors' | 'publishers' | 'translators',
    tag: string
  ) => {
    if (field === 'genres') {
      setGenre((prev) => [...prev, tag]);
    } else if (field === 'firms') {
      setFirm((prev) => [...prev, tag]);
    } else if (field === 'directors') {
      setDirector((prev) => [...prev, tag]);
    } else if (field === 'actors') {
      setActors((prev) => [...prev, tag]);
    } else if (field === 'developers') {
      setDeveloper((prev) => [...prev, tag]);
    } else if (field === 'authors') {
      setAuthor((prev) => [...prev, tag]);
    } else if (field === 'publishers') {
      setPublisher((prev) => [...prev, tag]);
    } else if (field === 'translators') {
      setTranslator((prev) => [...prev, tag]);
    }
    setTagDiffs((prev) => {
      const cur = prev[field];
      if (!cur) return prev;
      return {
        ...prev,
        [field]: {
          ...cur,
          removedTags: cur.removedTags.filter((t) => t.toLowerCase() !== tag.toLowerCase()),
        },
      };
    });
    setAiTagStates((prev) => {
      const cur = prev[field];
      if (!cur) return prev;
      return {
        ...prev,
        [field]: {
          ...cur,
          diff: {
            ...cur.diff,
            removedTags: cur.diff.removedTags.filter((t) => t.toLowerCase() !== tag.toLowerCase()),
          },
        },
      };
    });
  };

  // Series name suggestions for autocomplete
  const availableSeriesNames = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((i) => {
      if (i.seriesName && i.seriesName.trim()) {
        set.add(i.seriesName.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [allItems]);

  // Actor Autocomplete Suggestions
  const allActorSuggestions = useMemo(() => {
    const set = new Set<string>();
    availableActorsTags.forEach((a) => {
      if (a && a.trim()) set.add(a.trim());
    });
    allItems.forEach((it) => {
      it.characters?.forEach((c) => {
        if (c.actor && c.actor.trim()) set.add(c.actor.trim());
      });
      it.actors?.forEach((a) => {
        if (a && a.trim()) set.add(a.trim());
      });
    });
    actors.forEach((a) => {
      if (a && a.trim()) set.add(a.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [availableActorsTags, allItems, actors]);

  const handleAddCharacter = () => {
    setCharacters((prev) => [...prev, { name: '', actor: '' }]);
  };

  const handleUpdateCharacter = (
    index: number,
    field: 'name' | 'actor' | 'image',
    value?: string
  ) => {
    setCharacters((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handlePasteCharacterImage = async (index: number) => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        setPasteNotice('Lütfen klavyeden Ctrl+V tuşlarına basarak yapıştırın.');
        setTimeout(() => setPasteNotice(null), 3000);
        return;
      }
      const items = await navigator.clipboard.read();
      let foundImage = false;
      for (const clipboardItem of items) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            const optimized = await optimizeImageFile(blob, 1200, 1600, 0.88);
            handleUpdateCharacter(index, 'image', optimized);
            foundImage = true;
            break;
          }
        }
        if (foundImage) break;
      }
      if (!foundImage) {
        setPasteNotice('Panoda kopyalanmış görsel bulunamadı.');
        setTimeout(() => setPasteNotice(null), 2500);
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
      setPasteNotice('Panodan okuma başarısız veya izin verilmedi.');
      setTimeout(() => setPasteNotice(null), 2500);
    }
  };

  const handleRemoveCharacter = (index: number) => {
    setCharacters((prev) => prev.filter((_, i) => i !== index));
  };

  // Status Handlers for Media, Book, Game
  const handleMediaStatusChange = (newStatus: MediaStatus) => {
    setMediaStatus(newStatus);
    setWatching(newStatus === 'İzleniyor');
    setDropped(newStatus === 'Yarım Bırakıldı');
    if (newStatus === 'İzleniyor' || newStatus === 'İzlenecek') {
      setDate('');
    } else if (newStatus === 'Tamamlandı') {
      if (!date || date === '??') {
        setDate(new Date().toISOString().split('T')[0]);
      }
    }
    if (newStatus === 'İzlenecek') {
      if (rating > 0) setRememberedRating(rating);
      setRating(0);
    } else if (mediaStatus === 'İzlenecek' && rating === 0) {
      setRating(rememberedRating || 8);
    }
  };

  const handleBookStatusChange = (newStatus: BookStatus) => {
    setBookStatus(newStatus);
    setReading(newStatus === 'Okunuyor');
    setDropped(newStatus === 'Yarım Bırakıldı');
    if (newStatus === 'Okunuyor' || newStatus === 'Okunacak') {
      setDate('');
    } else if (newStatus === 'Tamamlandı') {
      if (!date || date === '??') {
        setDate(new Date().toISOString().split('T')[0]);
      }
    }
    if (newStatus === 'Okunacak') {
      if (rating > 0) setRememberedRating(rating);
      setRating(0);
    } else if (bookStatus === 'Okunacak' && rating === 0) {
      setRating(rememberedRating || 8);
    }
  };

  const handleGameStatusChange = (newStatus: GameStatus) => {
    setStatus(newStatus);
    if (newStatus === 'Oynanıyor' || newStatus === 'Oynanacak') {
      setDate('');
    } else if (newStatus === 'Tamamlandı') {
      if (!date || date === '??') {
        setDate(new Date().toISOString().split('T')[0]);
      }
    }
    if (newStatus === 'Oynanacak') {
      if (rating > 0) setRememberedRating(rating);
      setRating(0);
    } else if (status === 'Oynanacak' && rating === 0) {
      setRating(rememberedRating || 8);
    }
  };

  // Book Quotes Handlers
  const handleAddQuote = () => {
    setQuotes((prev) => [
      ...prev,
      {
        id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        text: '',
        page: '',
      },
    ]);
  };

  const handleUpdateQuote = (index: number, field: 'text' | 'page', value: string) => {
    setQuotes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveQuote = (index: number) => {
    setQuotes((prev) => prev.filter((_, i) => i !== index));
  };

  // Game Specific
  const [status, setStatus] = useState<GameStatus>('Tamamlandı');
  const [achPercent, setAchPercent] = useState<number | null>(null);
  const [achMax, setAchMax] = useState<number>(100);
  const [hours, setHours] = useState<number>(0);

  const isPlanned = isGame
    ? status === 'Oynanacak'
    : isBook
    ? bookStatus === 'Okunacak'
    : mediaStatus === 'İzlenecek';

  const isOngoing = isGame
    ? status === 'Oynanıyor'
    : isBook
    ? bookStatus === 'Okunuyor'
    : mediaStatus === 'İzleniyor';

  const isDateDisabled = isPlanned || isOngoing;
  const isRatingDisabled = isPlanned;

  // Common
  const [anki, setAnki] = useState(false);
  const [ankiMainBlurs, setAnkiMainBlurs] = useState<AnkiBlurBox[]>([]);
  const [ankiExtraImages, setAnkiExtraImages] = useState<AnkiExtraImage[]>([]);
  const [ankiFrontTags, setAnkiFrontTags] = useState<string[]>([]);
  const [ankiTagSelectionMode, setAnkiTagSelectionMode] = useState<boolean>(false);
  const [ankiNotice, setAnkiNotice] = useState<string | null>(null);
  const [showAnkiEditor, setShowAnkiEditor] = useState<boolean>(false);

  const handleToggleAnkiFrontTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const existingIndex = ankiFrontTags.findIndex(
      (t) => t.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existingIndex !== -1) {
      setAnkiFrontTags((prev) => prev.filter((_, idx) => idx !== existingIndex));
      setAnkiNotice(null);
    } else {
      if (ankiFrontTags.length >= 2) {
        setAnkiNotice('En fazla 2 etiket seçilebilir.');
        setTimeout(() => setAnkiNotice(null), 2500);
        return;
      }
      setAnkiFrontTags((prev) => [...prev, trimmed]);
      setAnkiNotice(null);
    }
  };

  // Custom Badges State
  const [badges, setBadges] = useState<string[]>([]);
  const [isBadgePopoverOpen, setIsBadgePopoverOpen] = useState(false);
  const badgePopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        isBadgePopoverOpen &&
        badgePopoverRef.current &&
        !badgePopoverRef.current.contains(e.target as Node)
      ) {
        setIsBadgePopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isBadgePopoverOpen]);

  useEffect(() => {
    if (customBadges.length > 0) {
      setBadges((prev) => prev.filter((id) => customBadges.some((b) => b.id === id)));
    }
  }, [customBadges]);

  const scopedBadges = useMemo(
    () => customBadges.filter((b) => b.targetTab === mainTab),
    [customBadges, mainTab]
  );

  const handleToggleBadge = (badgeId: string) => {
    if (badges.includes(badgeId)) {
      setBadges((prev) => prev.filter((id) => id !== badgeId));
    } else {
      if (badges.length >= 4) return;
      setBadges((prev) => [...prev, badgeId]);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedCatObj = categories.find((c) => c.id === cat);
  const palette = isGame ? GAME_COLORS : isBook ? BOOK_COLORS : MEDIA_COLORS;
  const baseColor = palette[cat] || (isBook ? '#8a6fbf' : '#3b82f6');

  const applyImageBase64 = async (rawInput: File | Blob | string) => {
    try {
      const optimized = await optimizeImageFile(rawInput, 800, 1200, 0.88);
      setThumbnail(optimized);
      setPasteNotice('Resim başarıyla eklendi!');
      setTimeout(() => setPasteNotice(null), 2500);
    } catch {
      if (typeof rawInput === 'string') {
        setThumbnail(rawInput);
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyImageBase64(file);
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        window.alert('Lütfen doğrudan Ctrl+V tuşlarına basarak yapıştırın.');
        return;
      }
      const items = await navigator.clipboard.read();
      let foundImage = false;
      for (const clipboardItem of items) {
        for (const type of clipboardItem.types) {
          if (type.startsWith('image/')) {
            const blob = await clipboardItem.getType(type);
            await applyImageBase64(blob);
            foundImage = true;
            break;
          }
        }
        if (foundImage) break;
      }
      if (!foundImage) {
        setPasteNotice('Panoda resim bulunamadı.');
        setTimeout(() => setPasteNotice(null), 3000);
      }
    } catch (err) {
      console.warn('Clipboard API error:', err);
      setPasteNotice('Panoya erişilemedi. Doğrudan Ctrl+V yapabilirsiniz.');
      setTimeout(() => setPasteNotice(null), 3000);
    }
  };

  // Global Ctrl+V Paste Listener
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            applyImageBase64(file);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, []);

  // Not: Escape tuşu ile kazara pencereyi kapatıp verilerin kaybolmasını engellemek için listener kaldırılmıştır.

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError(true);
      const titleInput = document.getElementById('add-title-input') as HTMLInputElement | null;
      if (titleInput) {
        titleInput.focus();
        titleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const cleanedCharacters = characters
      .map((c) => ({
        name: c.name.trim(),
        actor: c.actor?.trim() || undefined,
        image: c.image || undefined,
      }))
      .filter((c) => c.name.length > 0);

    let computedReleaseYear: number | string | undefined = undefined;
    if (isYearRange) {
      const s = startYear.trim();
      const e = endYear.trim();
      if (s && e) {
        computedReleaseYear = `${s}–${e}`;
      } else if (s) {
        computedReleaseYear = `${s}–`;
      } else if (e) {
        computedReleaseYear = e;
      }
    } else {
      const s = startYear.trim();
      if (s) {
        computedReleaseYear = !isNaN(Number(s)) ? Number(s) : s;
      }
    }

    const generatedId = `${mainTab}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    let generatedThumbnailFileName: string | undefined = undefined;
    if (thumbnail) {
      const mimeMatch = thumbnail.match(/data:image\/([a-zA-Z0-9]+);/);
      const ext = mimeMatch ? (mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1]) : 'jpg';
      generatedThumbnailFileName = `images/posters/${generatedId}_${Date.now()}.${ext}`;
    }

    const newItem: ArchiveItem = {
      id: generatedId,
      mainTab,
      cat,
      sub: sub || null,
      title: title.trim(),
      rating: isRatingDisabled ? 0 : rating,
      date: isDateDisabled ? '' : (date || '??'),
      releaseYear: computedReleaseYear,
      desc: desc.trim(),
      review: review.trim() || undefined,
      reviewDate: review.trim() ? (reviewDate || new Date().toISOString().split('T')[0]) : undefined,
      thumbnail,
      thumbnailFileName: generatedThumbnailFileName,
      characters: cleanedCharacters.length > 0 ? cleanedCharacters : undefined,
      seriesName: seriesName.trim() || undefined,
      seriesOrder: seriesOrder !== '' && !isNaN(Number(seriesOrder)) ? Number(seriesOrder) : undefined,
      // Book specific
      reading: isBook ? (bookStatus === 'Okunuyor') : undefined,
      toRead: isBook ? (bookStatus === 'Okunacak') : undefined,
      bookStatus: isBook ? bookStatus : undefined,
      pageCount: isBook && pageCount !== '' && !isNaN(Number(pageCount)) ? Number(pageCount) : undefined,
      format: isBook ? bookFormat : undefined,
      author: isBook && author.length > 0 ? author : undefined,
      publisher: isBook && publisher.length > 0 ? publisher : undefined,
      translator: isBook && translator.length > 0 ? translator : undefined,
      quotes:
        isBook && quotes.filter((q) => q.text.trim().length > 0).length > 0
          ? quotes
              .filter((q) => q.text.trim().length > 0)
              .map((q) => ({
                id: q.id,
                text: q.text.trim(),
                page:
                  q.page !== undefined && String(q.page).trim().length > 0
                    ? !isNaN(Number(q.page))
                      ? Number(q.page)
                      : String(q.page).trim()
                    : undefined,
              }))
          : undefined,
      // Media tags
      firm: !isGame && !isBook && firm.length > 0 ? firm : undefined,
      director: !isGame && !isBook && director.length > 0 ? director : undefined,
      actors: !isGame && !isBook && actors.length > 0 ? actors : undefined,
      // Game tags
      developer: isGame && developer.length > 0 ? developer : undefined,
      // Common tags
      genre: genre.length > 0 ? genre : undefined,
      // Media flags
      watching: !isGame && !isBook ? (mediaStatus === 'İzleniyor') : undefined,
      toWatch: !isGame && !isBook ? (mediaStatus === 'İzlenecek') : undefined,
      mediaStatus: !isGame && !isBook ? mediaStatus : undefined,
      following: !isGame && !isBook ? following : undefined,
      dropped: isBook ? (bookStatus === 'Yarım Bırakıldı') : (!isGame ? (mediaStatus === 'Yarım Bırakıldı') : (status === 'Yarım Bırakıldı')),
      expectedDate: !isGame && !isBook && expectedDate.trim() ? expectedDate.trim() : undefined,
      followNotes: !isGame && !isBook && followNotes.trim() ? followNotes.trim() : undefined,
      // Game flags
      status: isGame ? status : undefined,
      achPercent:
        isGame && achPercent !== null
          ? Math.min(Math.max(0, achPercent), achMax > 0 ? achMax : 100)
          : undefined,
      achMax: isGame ? (achMax > 0 ? achMax : 100) : undefined,
      hours: isGame ? hours : undefined,
      // Common
      anki,
      ankiCard: anki ? initAnkiCard() : undefined,
      ankiMainBlurs: ankiMainBlurs.length > 0 ? ankiMainBlurs : undefined,
      ankiExtraImages: ankiExtraImages.length > 0 ? ankiExtraImages : undefined,
      ankiFrontTags: (() => {
        if (!anki || ankiFrontTags.length === 0) return undefined;
        const allEligibleTags = isBook
          ? [...author, ...publisher, ...translator]
          : isGame
          ? [...developer]
          : [...firm, ...director, ...actors];
        const cleaned = ankiFrontTags.filter((ft) =>
          allEligibleTags.some(
            (et) => et.trim().toLowerCase() === ft.trim().toLowerCase()
          )
        ).slice(0, 2);
        return cleaned.length > 0 ? cleaned : undefined;
      })(),
      badges: badges.length > 0 ? badges : undefined,
      tier: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onAdd(newItem);
    onClose();
  };

  return (
    <div
      id="add-modal-overlay"
      className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div
        id="add-modal-box"
        className="relative w-full max-w-2xl bg-[#131722] border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2">
            <span className={`p-1 rounded-lg border ${
              isBook
                ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                : 'bg-blue-600/20 text-blue-400 border-blue-500/30'
            }`}>
              {isBook ? <BookOpen className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </span>
            <h2 className="text-sm font-bold text-white">Yeni {isBook ? 'Kitap' : isGame ? 'Oyun' : 'Medya'} Ekle</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="close-add-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {/* AI Banner / Notification (Yalnızca hata veya uyarı durumlarında görünür, başarı uyarısı kaldırıldı) */}
          {aiNotice && aiNotice.type !== 'success' && (
            <div className="p-3 rounded-xl text-xs flex items-center justify-between gap-2 transition-all bg-red-500/15 border border-red-500/30 text-red-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{aiNotice.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setAiNotice(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {/* TOP SECTION: Left Compact Poster (with top-right X and bottom buttons) + Right Info & Notes */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* Left: Compact Poster Column */}
            <div className="w-28 sm:w-32 shrink-0 mx-auto sm:mx-0 flex flex-col gap-1.5">
              <div
                className="relative w-full aspect-[2/3] rounded-xl overflow-hidden border border-white/15 shadow-md flex items-center justify-center text-center group"
                style={{
                  backgroundColor: thumbnail ? '#0b0e14' : `${baseColor}22`,
                  borderColor: thumbnail ? 'rgba(255,255,255,0.15)' : `${baseColor}60`,
                }}
              >
                {thumbnail ? (
                  <>
                    <img
                      src={thumbnail}
                      alt={title || 'Kapak Resmi'}
                      className="w-full h-full object-cover rounded-xl"
                    />
                    {/* Top-Right "X" icon to remove image */}
                    <button
                      type="button"
                      onClick={() => setThumbnail(undefined)}
                      title="Resmi Kaldır"
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 hover:bg-red-600 text-white/80 hover:text-white shadow transition-all cursor-pointer z-10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <span
                    className="text-[11px] font-semibold px-2"
                    style={{ color: `${baseColor}ee` }}
                  >
                    {title || 'Resim Yok'}
                  </span>
                )}
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />

              {/* Below Poster: Text + Icon Buttons (Yükle / Yapıştır) */}
              <div className="grid grid-cols-2 gap-1 w-full">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-semibold text-slate-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Resim Dosyası Seç"
                >
                  <Upload className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>{thumbnail ? 'Değiştir' : 'Yükle'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="px-2 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-[10px] font-semibold text-blue-300 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Panodaki resmi yapıştır (Ctrl+V)"
                >
                  <ClipboardPaste className="w-3 h-3 shrink-0" />
                  <span>Yapıştır</span>
                </button>
              </div>

              {pasteNotice && (
                <p className="text-[9px] text-emerald-400 text-center flex items-center justify-center gap-1">
                  <Check className="w-2.5 h-2.5" /> {pasteNotice}
                </p>
              )}

              {/* Rozet Yönetim Masası (Sol sütun, afiş ve Değiştir / Yapıştır butonlarının hemen altı) */}
              <div className="relative w-full space-y-1.5 pt-1">
                {/* Rozet Başlığı & Sayacı */}
                <button
                  type="button"
                  onClick={() => setIsBadgePopoverOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-0.5 py-0.5 text-[11px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer select-none group"
                  title="Rozet menüsünü aç / kapat"
                >
                  <span className="flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-semibold text-slate-300 group-hover:text-white">Rozetler</span>
                  </span>
                  <span className={`text-[10px] font-mono ${badges.length >= 4 ? 'text-amber-400 font-bold' : 'text-slate-400 group-hover:text-slate-300'}`}>
                    ({badges.length}/4)
                  </span>
                </button>

                {/* Atanmış Rozetler: Yan yana 4 adet saf şeffaf nişan yuvası */}
                <div className="grid grid-cols-4 gap-1.5 w-full">
                  {[0, 1, 2, 3].map((slotIndex) => {
                    const badgeId = badges[slotIndex];
                    const badgeObj = badgeId ? customBadges.find((b) => b.id === badgeId) : null;
                    const colorOpt = badgeObj ? getBadgeColorOption(badgeObj.color) : null;

                    if (badgeObj && colorOpt) {
                      return (
                        <div
                          key={slotIndex}
                          onClick={() => setIsBadgePopoverOpen(true)}
                          className="group relative aspect-square flex items-center justify-center p-0.5 rounded-xl transition-all cursor-pointer select-none hover:bg-white/[0.04]"
                          title={`${badgeObj.name} (Değiştirmek için tıkla)`}
                        >
                          {badgeObj.iconData ? (
                            <img
                              src={badgeObj.iconData}
                              alt={badgeObj.name}
                              className="w-full h-full object-contain pointer-events-none transition-transform duration-200 group-hover:scale-110"
                              style={{
                                transform: badgeObj.scale && badgeObj.scale !== 1 ? `scale(${badgeObj.scale})` : undefined,
                                filter: `drop-shadow(0 0 8px ${colorOpt.hex}) drop-shadow(0 0 16px ${colorOpt.hex}80) drop-shadow(0 2px 6px rgba(0,0,0,0.9))`,
                              }}
                            />
                          ) : (
                            <span className="text-2xl">🏆</span>
                          )}

                          {/* Sağ üstteki minimal (×) butonu ile çıkarma (kutusu kaldırılmış, %10 daha küçük) */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBadges((prev) => prev.filter((id) => id !== badgeId));
                            }}
                            className="absolute -top-1 -right-1 p-0.5 text-slate-400 hover:text-white transition-all cursor-pointer z-10 hover:scale-110 active:scale-90"
                            title="Kaldır"
                          >
                            <X className="w-[9px] h-[9px] stroke-[2.2] drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={slotIndex}
                        type="button"
                        disabled={badges.length >= 4}
                        onClick={() => setIsBadgePopoverOpen(true)}
                        className={`aspect-square rounded-xl border border-dashed border-white/10 hover:border-white/25 bg-white/[0.01] hover:bg-white/[0.04] flex items-center justify-center text-slate-500 hover:text-slate-300 transition-all ${
                          badges.length >= 4 ? 'cursor-not-allowed opacity-20' : 'cursor-pointer'
                        }`}
                        title="Boş Rozet Yuvası (Tıkla ve Rozet Seç)"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>

                {/* Popover Menüsü (Rozet Seçim Popover'ı) */}
                {isBadgePopoverOpen && (
                  <div
                    ref={badgePopoverRef}
                    className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 top-full mt-1.5 z-50 w-[270px] max-w-[295px] bg-[#141722] border border-white/20 rounded-xl shadow-2xl p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-100 text-left"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Popover Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-xs font-semibold text-slate-200">
                      <span className="flex items-center gap-1.5 text-xs text-slate-300">
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                        <span>Rozet Seç ({badges.length}/4)</span>
                        {badges.length >= 4 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                            Dolu
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsBadgePopoverOpen(false);
                              onClose();
                              onOpenSettings('themes');
                            }}
                            className="text-slate-400 hover:text-amber-400 p-0.5 rounded cursor-pointer transition-colors"
                            title="Rozetleri Yönet"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsBadgePopoverOpen(false)}
                          className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                          title="Kapat"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Rozet Listesi (Sadece bu alana ait rozetler) */}
                    <div className="max-h-[240px] overflow-y-auto no-scrollbar space-y-1.5">
                      {scopedBadges.length === 0 ? (
                        <div className="py-4 px-2 text-center space-y-1 text-slate-400">
                          <p className="text-[11px] font-semibold text-slate-300">
                            Henüz bir rozet tanımlamadınız
                          </p>
                          <p className="text-[10px] text-slate-500 leading-snug">
                            {isGame ? 'Oyun' : isBook ? 'Kitap' : 'Medya'} alanı için henüz tanımlanmış rozet bulunmuyor.
                          </p>
                        </div>
                      ) : (
                        scopedBadges.map((b) => {
                          const isSelected = badges.includes(b.id);
                          const colorOpt = getBadgeColorOption(b.color);

                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => handleToggleBadge(b.id)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between gap-2.5 border cursor-pointer group ${
                                isSelected
                                  ? 'bg-blue-600/20 border-blue-500/40 text-blue-200 font-semibold'
                                  : badges.length >= 4
                                  ? 'bg-white/5 border-white/5 text-slate-500 opacity-50 cursor-not-allowed'
                                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200 hover:text-white'
                              }`}
                              disabled={!isSelected && badges.length >= 4}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                                  {b.iconData ? (
                                    <img
                                      src={b.iconData}
                                      alt={b.name}
                                      className="w-9 h-9 object-contain"
                                      style={{
                                        filter: `drop-shadow(0 0 6px ${colorOpt.hex}) drop-shadow(0 1px 3px rgba(0,0,0,0.85))`,
                                      }}
                                    />
                                  ) : (
                                    <span className="text-xl">🏆</span>
                                  )}
                                </div>
                                <span className="truncate text-xs font-medium text-slate-200">{b.name}</span>
                              </div>

                              <span className="shrink-0 text-xs">
                                {isSelected ? (
                                  <span className="text-emerald-400 font-bold">✓</span>
                                ) : (
                                  <span className="text-slate-500 group-hover:text-slate-300">+</span>
                                )}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Main Fields + Notes */}
            <div className="flex-1 w-full space-y-2.5">
              {/* Title with AI Doldur Button */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                  Başlık *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="add-title-input"
                    type="text"
                    required
                    autoComplete="off"
                    placeholder={
                      isBook
                        ? 'Örn: 1984, Suç ve Ceza, Dune...'
                        : isGame
                        ? 'Örn: Elden Ring'
                        : 'Örn: Vinland Saga'
                    }
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (titleError && e.target.value.trim()) {
                        setTitleError(false);
                      }
                    }}
                    className={`flex-1 min-w-0 bg-black/30 text-white font-semibold rounded-xl px-3 py-1.5 text-xs focus:outline-none transition-all ${
                      titleError
                        ? 'border-2 border-rose-500/90 ring-4 ring-rose-500/20 bg-rose-950/20 animate-input-shake'
                        : 'border border-white/10 focus:border-blue-500'
                    }`}
                  />
                  <button
                    id="add-ai-fill-btn"
                    type="button"
                    onClick={handleAiFill}
                    disabled={aiLoading || (!isBook && !title.trim() && !thumbnail)}
                    title={
                      isBook
                        ? 'Kitap modülü için AI desteği 5. aşamada aktif edilecektir.'
                        : !title.trim() && !thumbnail
                        ? 'Otomatik doldurma için önce bir başlık yazın veya afiş ekleyin.'
                        : 'Gemini AI ile boş alanları otomatik doldurur, dolu alanlar için öneriler sunar'
                    }
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 border border-amber-400/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                    <span>{aiLoading ? 'Dolduruluyor...' : 'AI ile Doldur'}</span>
                  </button>
                </div>
                {titleError && (
                  <p className="mt-1.5 text-[11px] font-medium text-rose-400 flex items-center gap-1.5 animate-fadeIn">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Lütfen bir yapım başlığı girin.</span>
                  </p>
                )}
              </div>

              {/* Category & Subgroup Selectors (with Sayfa Sayısı for Book) */}
              {isBook ? (
                <div
                  className={`grid gap-2 ${
                    selectedCatObj && selectedCatObj.subgroups.length > 0
                      ? 'grid-cols-1 sm:grid-cols-3'
                      : 'grid-cols-1 sm:grid-cols-2'
                  }`}
                >
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                      Kategori
                    </label>
                    <select
                      id="add-category-select"
                      value={cat}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setCat(newCat);
                        setSub(null);
                      }}
                      className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="" className="bg-slate-900 text-neutral-400">(Kategorisiz / Havuz)</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subgroup Selector - ONLY visible if category has subgroups */}
                  {selectedCatObj && selectedCatObj.subgroups.length > 0 && (
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                        Alt-Grup
                      </label>
                      <select
                        id="add-subgroup-select"
                        value={sub || ''}
                        onChange={(e) => setSub(e.target.value || null)}
                        className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="" className="bg-slate-900 text-white">Yok</option>
                        {selectedCatObj.subgroups.map((s) => (
                          <option key={s} value={s} className="bg-slate-900 text-white">
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Sayfa Sayısı Input */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-indigo-400" /> Sayfa Sayısı
                    </label>
                    <input
                      id="add-book-page-count"
                      type="number"
                      min="1"
                      placeholder="Örn: 384"
                      value={pageCount}
                      onChange={(e) => setPageCount(e.target.value)}
                      className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                    />
                  </div>
                </div>
              ) : (
                <div className={`grid gap-2 ${selectedCatObj?.subgroups.length ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                      Kategori
                    </label>
                    <select
                      id="add-category-select"
                      value={cat}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setCat(newCat);
                        setSub(null);
                      }}
                      className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="" className="bg-slate-900 text-neutral-400">(Kategorisiz / Havuz)</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subgroup Selector - ONLY visible if category has subgroups */}
                  {selectedCatObj && selectedCatObj.subgroups.length > 0 && (
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                        Alt-Grup
                      </label>
                      <select
                        id="add-subgroup-select"
                        value={sub || ''}
                        onChange={(e) => setSub(e.target.value || null)}
                        className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="" className="bg-slate-900 text-white">Yok</option>
                        {selectedCatObj.subgroups.map((s) => (
                          <option key={s} value={s} className="bg-slate-900 text-white">
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Rating, Release Year & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-start min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-1 h-5 mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1 truncate">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                      <span>{isRatingDisabled ? 'Puan (Kilitli)' : rating === 0 ? 'Puan Verilmedi' : 'Puan (1-10)'}</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    {isRatingDisabled ? (
                      <div className="flex-1 min-w-0 h-8 rounded-xl px-2.5 text-xs font-semibold flex items-center justify-between bg-amber-500/5 text-amber-300/40 border border-amber-500/15 opacity-40 pointer-events-none select-none">
                        <span className="truncate">
                          {isGame
                            ? 'Oynanacak (Kilitli)'
                            : isBook
                            ? 'Okunacak (Kilitli)'
                            : 'İzlenecek (Kilitli)'}
                        </span>
                      </div>
                    ) : (
                      <select
                        id="add-rating-select"
                        value={rating}
                        disabled={isRatingDisabled}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setRating(val);
                          if (val > 0) {
                            setRememberedRating(val);
                          }
                        }}
                        className={`flex-1 min-w-0 h-8 bg-black/30 font-bold border border-white/10 rounded-xl px-2.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer ${
                          rating === 0 ? 'text-amber-300/70' : 'text-amber-300'
                        }`}
                      >
                        <option value={0} className="bg-slate-900 text-amber-300/70">
                          ★ Puan Verilmedi
                        </option>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <option key={num} value={num} className="bg-slate-900 text-amber-300">
                            ★ {num} / 10
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      id="toggle-add-unrated-btn"
                      disabled={isRatingDisabled}
                      onClick={() => {
                        if (rating === 0) {
                          setRating(rememberedRating || 8);
                        } else {
                          setRememberedRating(rating);
                          setRating(0);
                        }
                      }}
                      title={
                        isRatingDisabled
                          ? 'Gelecek yapımlar için puanlama kilitlidir'
                          : rating === 0
                          ? 'Puan Geri Yükle'
                          : 'Puan Henüz Verilmedi (Puansız)'
                      }
                      className={`h-8 w-8 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center shrink-0 ${
                        isRatingDisabled
                          ? 'opacity-30 cursor-not-allowed pointer-events-none bg-white/5 text-neutral-500 border-white/5'
                          : rating === 0
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-pointer'
                          : 'bg-white/5 text-neutral-400 border-white/10 hover:text-white hover:bg-white/10 cursor-pointer'
                      }`}
                    >
                      <MinusCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 h-5 mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1 truncate">
                      <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />
                      <span>{isBook ? 'Basım Yılı' : 'Yapım Yılı'}</span>
                    </label>
                    <button
                      type="button"
                      id="toggle-add-release-year-range-btn"
                      onClick={() => {
                        const next = !isYearRange;
                        setIsYearRange(next);
                        if (!next && !startYear && endYear) {
                          setStartYear(endYear);
                          setEndYear('');
                        }
                      }}
                      title={isYearRange ? 'Tek Yıl Moduna Dön' : 'Yıl Aralığı Modu'}
                      className={`p-0.5 rounded transition-colors cursor-pointer flex items-center justify-center ${
                        isYearRange
                          ? 'bg-blue-500/25 text-blue-400 border border-blue-500/40'
                          : 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
                      }`}
                    >
                      <CalendarRange className="w-3.5 h-3.5 text-blue-400" />
                    </button>

                    {/* AI Status & Actions for Release Year */}
                    {aiYearState && (
                      <div className="ml-auto flex items-center gap-1">
                        {aiYearState.isActive ? (
                          <button
                            type="button"
                            onClick={() => {
                              setStartYear(aiYearState.original.startYear);
                              setEndYear(aiYearState.original.endYear);
                              setIsYearRange(aiYearState.original.isYearRange);
                              setAiYearState((prev) => (prev ? { ...prev, isActive: false } : null));
                            }}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setStartYear(aiYearState.suggested.startYear);
                              setEndYear(aiYearState.suggested.endYear);
                              setIsYearRange(aiYearState.suggested.isYearRange);
                              setAiYearState((prev) => (prev ? { ...prev, isActive: true } : null));
                            }}
                            title="AI önerisine geç"
                            className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {!isYearRange ? (
                    <input
                      id="add-release-year-input"
                      type="text"
                      inputMode="numeric"
                      placeholder={isBook ? 'Örn: 1949' : 'Örn: 2024'}
                      value={startYear}
                      onChange={(e) => {
                        setStartYear(e.target.value);
                        if (aiYearState?.isActive) {
                          setAiYearState((prev) => (prev ? { ...prev, isActive: false } : null));
                        }
                      }}
                      className={`w-full h-8 text-slate-200 font-medium rounded-xl px-2.5 text-xs focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all ${
                        aiYearState?.isActive
                          ? 'border border-emerald-500/80 ring-1 ring-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.18)] bg-emerald-500/[0.04]'
                          : 'border border-white/10 bg-black/30'
                      }`}
                    />
                  ) : (
                    <div className="flex items-center gap-1 min-w-0">
                      <input
                        id="add-release-year-start"
                        type="text"
                        inputMode="numeric"
                        placeholder="Başlangıç"
                        value={startYear}
                        onChange={(e) => {
                          setStartYear(e.target.value);
                          if (aiYearState?.isActive) {
                            setAiYearState((prev) => (prev ? { ...prev, isActive: false } : null));
                          }
                        }}
                        className={`w-full min-w-0 h-8 text-slate-200 font-medium rounded-xl px-1.5 text-xs text-center focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all ${
                          aiYearState?.isActive
                            ? 'border border-emerald-500/80 ring-1 ring-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.18)] bg-emerald-500/[0.04]'
                            : 'border border-white/10 bg-black/30'
                        }`}
                      />
                      <span className="text-slate-500 font-bold text-xs shrink-0">—</span>
                      <input
                        id="add-release-year-end"
                        type="text"
                        placeholder="Bitiş"
                        value={endYear}
                        onChange={(e) => {
                          setEndYear(e.target.value);
                          if (aiYearState?.isActive) {
                            setAiYearState((prev) => (prev ? { ...prev, isActive: false } : null));
                          }
                        }}
                        className={`w-full min-w-0 h-8 text-slate-200 font-medium rounded-xl px-1.5 text-xs text-center focus:outline-none focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-all ${
                          aiYearState?.isActive
                            ? 'border border-emerald-500/80 ring-1 ring-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.18)] bg-emerald-500/[0.04]'
                            : 'border border-white/10 bg-black/30'
                        }`}
                      />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1 h-5 mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1 truncate">
                      <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />
                      <span>{isBook ? 'Okunma Tarihi' : isGame ? 'Tamamlama Tarihi' : 'İzlenme Tarihi'}</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    {date === '??' || date === '??.??' ? (
                      <div
                        className={`flex-1 min-w-0 h-8 rounded-xl px-2.5 text-xs font-semibold flex items-center justify-between transition-opacity ${
                          isDateDisabled
                            ? 'bg-amber-500/5 text-amber-300/40 border border-amber-500/15 opacity-40 pointer-events-none select-none'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        <span className="truncate">
                          {isDateDisabled
                            ? isGame
                              ? status === 'Oynanacak'
                                ? 'Oynanacak (Kilitli)'
                                : 'Oynanıyor (Kilitli)'
                              : isBook
                              ? bookStatus === 'Okunacak'
                                ? 'Okunacak (Kilitli)'
                                : 'Okunuyor (Kilitli)'
                              : mediaStatus === 'İzlenecek'
                                ? 'İzlenecek (Kilitli)'
                                : 'İzleniyor (Kilitli)'
                            : 'Bilinmiyor (??)'}
                        </span>
                      </div>
                    ) : (
                      <input
                        id="add-date-input"
                        type={isDateDisabled ? 'text' : 'date'}
                        value={isDateDisabled ? '' : date}
                        disabled={isDateDisabled}
                        onChange={(e) => setDate(e.target.value)}
                        placeholder={
                          isDateDisabled
                            ? isGame
                              ? status === 'Oynanacak'
                                ? 'Oynanacak (Kilitli)'
                                : 'Oynanıyor (Kilitli)'
                              : isBook
                              ? bookStatus === 'Okunacak'
                                ? 'Okunacak (Kilitli)'
                                : 'Okunuyor (Kilitli)'
                              : mediaStatus === 'İzlenecek'
                                ? 'İzlenecek (Kilitli)'
                                : 'İzleniyor (Kilitli)'
                            : ''
                        }
                        className={`flex-1 min-w-0 h-8 border rounded-xl px-2 text-xs focus:outline-none transition-all ${
                          isDateDisabled
                            ? 'bg-black/50 text-neutral-500 border-white/5 opacity-50 cursor-not-allowed pointer-events-none select-none placeholder:text-neutral-500 placeholder:italic'
                            : 'bg-black/40 text-neutral-200 border-white/10 focus:border-neutral-400'
                        }`}
                      />
                    )}
                    <button
                      type="button"
                      id="toggle-add-unknown-date-btn"
                      disabled={isDateDisabled}
                      onClick={() => {
                        if (date === '??' || date === '??.??' || date === '') {
                          setDate(new Date().toISOString().split('T')[0]);
                        } else {
                          setDate('??');
                        }
                      }}
                      title={
                        isDateDisabled
                          ? isBook
                            ? 'Kitap henüz bitmediği için tarih kilitlidir'
                            : 'Yapım tamamlanmadığı için tarih kilitlidir'
                          : 'Tarih Bilinmiyor (??)'
                      }
                      className={`h-8 w-8 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center shrink-0 ${
                        isDateDisabled
                          ? 'opacity-30 cursor-not-allowed pointer-events-none bg-white/5 text-neutral-500 border-white/5'
                          : date === '??' || date === '??.??'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-pointer'
                          : 'bg-white/5 text-neutral-400 border-white/10 hover:text-white hover:bg-white/10 cursor-pointer'
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Description & Review Area (Top Section next to Poster) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      id="tab-add-desc-btn"
                      onClick={() => setActiveTextTab('desc')}
                      className="text-[10px] uppercase tracking-wider transition-all relative cursor-pointer font-semibold"
                    >
                      <span
                        className={`pb-0.5 transition-all inline-block ${
                          activeTextTab === 'desc'
                            ? 'text-white border-b-2 border-blue-500 font-bold'
                            : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
                        }`}
                      >
                        KONUSU
                      </span>
                    </button>
                    <button
                      type="button"
                      id="tab-add-review-btn"
                      onClick={() => setActiveTextTab('review')}
                      className="text-[10px] uppercase tracking-wider transition-all relative cursor-pointer font-semibold flex items-center gap-1.5"
                    >
                      <span
                        className={`pb-0.5 transition-all inline-block ${
                          activeTextTab === 'review'
                            ? 'text-white border-b-2 border-amber-500 font-bold'
                            : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
                        }`}
                      >
                        YORUM
                      </span>
                      {review.trim().length > 0 && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.9)] inline-block mb-0.5"
                          title="Kişisel yorum mevcut"
                        />
                      )}
                    </button>
                  </div>

                  {activeTextTab === 'desc' && aiDescState && (
                    <div className="flex items-center gap-1">
                      {aiDescState.isActive ? (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTextTab('desc');
                            setDesc(aiDescState.original);
                            setAiDescState((prev) => (prev ? { ...prev, isActive: false } : null));
                          }}
                          title="Konu: Eski haline dön"
                          className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTextTab('desc');
                            setDesc(aiDescState.suggested);
                            setAiDescState((prev) => (prev ? { ...prev, isActive: true } : null));
                          }}
                          title="Konu: AI önerisine geç"
                          className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {activeTextTab === 'review' && review.trim().length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-medium transition-colors ${isReviewDateUpdated ? 'text-amber-300 font-semibold' : 'text-slate-400'}`}>
                        {formatReviewDate(reviewDate || new Date().toISOString().split('T')[0])}
                      </span>
                      <button
                        type="button"
                        id="btn-add-update-review-date-today"
                        onClick={() => {
                          if (isReviewDateUpdated) {
                            setReviewDate(originalReviewDateRef.current);
                            setIsReviewDateUpdated(false);
                          } else {
                            const today = new Date().toISOString().split('T')[0];
                            setReviewDate(today);
                            setIsReviewDateUpdated(true);
                          }
                        }}
                        title={isReviewDateUpdated ? 'Orijinal Tarihe Geri Dön' : 'Tarihi Bugüne Güncelle'}
                        className={`p-1 rounded-md transition-all cursor-pointer shadow-xs flex items-center justify-center border ${
                          isReviewDateUpdated
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                            : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border-white/10'
                        }`}
                      >
                        <Calendar className={`w-3 h-3 ${isReviewDateUpdated ? 'text-amber-400' : 'text-slate-300'}`} />
                      </button>
                    </div>
                  )}
                </div>

                {activeTextTab === 'desc' ? (
                  <textarea
                    id="add-desc-textarea"
                    rows={3}
                    value={desc}
                    onChange={(e) => {
                      setDesc(e.target.value);
                      if (aiDescState?.isActive) {
                        setAiDescState((prev) => (prev ? { ...prev, isActive: false } : null));
                      }
                    }}
                    placeholder="Yıllar sonra hatırlamak için notlar, hisler, önemli detaylar..."
                    className={`w-full text-slate-200 rounded-xl p-2.5 text-xs leading-relaxed focus:outline-none focus:border-blue-500 resize-y custom-scrollbar min-h-[82px] transition-colors ${
                      aiDescState?.isActive
                        ? 'border border-emerald-500/80 ring-1 ring-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.18)] bg-emerald-500/[0.04]'
                        : 'border border-white/10 bg-black/30'
                    }`}
                  />
                ) : (
                  <textarea
                    id="add-review-textarea"
                    rows={3}
                    value={review}
                    onChange={(e) => setReview(e.target.value)}
                    placeholder="Bu yapım hakkındaki kişisel eleştirin, deneyimin ve samimi düşüncelerin... (Puan ve durumdan bağımsız)"
                    className="w-full text-slate-200 rounded-xl p-2.5 text-xs leading-relaxed focus:outline-none border border-amber-500/30 bg-amber-500/[0.02] focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/30 resize-y custom-scrollbar min-h-[82px] transition-colors"
                  />
                )}
              </div>
            </div>
          </div>

          {/* DIVIDER LINE */}
          <div className="border-t border-white/10 pt-1" />

          {/* MIDDLE SECTION: STATUS CONTROLS */}
          <div className="space-y-1.5">
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold">
              DURUM
            </label>
            {isBook ? (
              /* Book Status Options: [Okuma Durumu] [Format] [Anki - Sabit Rezervli] */
              <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1.1fr_115px] gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/5 items-end">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                    Okuma Durumu
                  </label>
                  <select
                    id="add-book-status-select"
                    value={bookStatus}
                    onChange={(e) => handleBookStatusChange(e.target.value as BookStatus)}
                    className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
                  >
                    <option value="Tamamlandı" className="bg-slate-900 text-white">✅ Tamamlandı</option>
                    <option value="Okunacak" className="bg-slate-900 text-white">📖 Okunacak</option>
                    <option value="Okunuyor" className="bg-slate-900 text-white">📚 Okunuyor</option>
                    <option value="Yarım Bırakıldı" className="bg-slate-900 text-white">⏸ Yarım Bırakıldı</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-indigo-400" /> Format
                  </label>
                  <select
                    id="add-book-format-select"
                    value={bookFormat}
                    onChange={(e) => setBookFormat(e.target.value as BookFormat)}
                    className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
                  >
                    <option value="Ciltsiz" className="bg-slate-900 text-white">📖 Ciltsiz</option>
                    <option value="Ciltli" className="bg-slate-900 text-white">📚 Ciltli</option>
                    <option value="E-Kitap" className="bg-slate-900 text-white">📱 E-Kitap</option>
                    <option value="Sesli Kitap" className="bg-slate-900 text-white">🎧 Sesli Kitap</option>
                  </select>
                </div>

                <div className="flex items-center justify-start h-[30px] sm:h-[32px] mb-0.5 shrink-0 w-[115px]">
                  <div className="flex items-center gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap">
                      <input
                        id="add-book-anki-cb"
                        type="checkbox"
                        checked={anki}
                        onChange={(e) => {
                          setAnki(e.target.checked);
                          if (!e.target.checked) setAnkiTagSelectionMode(false);
                        }}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs">Anki</span>
                    </label>
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      {anki && (
                        <button
                          type="button"
                          id="btn-open-anki-editor-book"
                          onClick={() => setShowAnkiEditor(true)}
                          className="p-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                          title="Anki Editörü"
                        >
                          <Crop className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : !isGame ? (
              /* Media Status Options: [İzleme Durumu (kompakt)] [Takip] [Anki (Sabit Rezervli)] */
              <>
                <div className="flex flex-wrap items-end gap-3 sm:gap-4 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                  <div className="w-full sm:w-[170px] shrink-0">
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                      İzleme Durumu
                    </label>
                    <select
                      id="add-media-status-select"
                      value={mediaStatus}
                      onChange={(e) => handleMediaStatusChange(e.target.value as MediaStatus)}
                      className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
                    >
                      <option value="Tamamlandı" className="bg-slate-900 text-white">✅ Tamamlandı</option>
                      <option value="İzlenecek" className="bg-slate-900 text-white">🎬 İzlenecek</option>
                      <option value="İzleniyor" className="bg-slate-900 text-white">📺 İzleniyor</option>
                      <option value="Yarım Bırakıldı" className="bg-slate-900 text-white">⏸ Yarım Bırakıldı</option>
                    </select>
                  </div>

                  <div className="flex items-center h-[30px] sm:h-[32px] mb-0.5 shrink-0 min-w-[92px]">
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                      <input
                        id="add-following-cb"
                        type="checkbox"
                        checked={following}
                        onChange={() => {
                          const next = !following;
                          setFollowing(next);
                          if (next) setShowFollowDetails(true);
                        }}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <Bookmark className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-xs">Takip</span>
                      {following && (
                        <button
                          type="button"
                          id="btn-toggle-add-follow-details"
                          title={
                            hasFollowData
                              ? showFollowDetails
                                ? 'Gelişme kutusunu gizle (Not/tarih mevcut)'
                                : 'Takip ve çıkış bilgilerini düzenle (Not/tarih mevcut)'
                              : showFollowDetails
                              ? 'Gelişme kutusunu gizle'
                              : 'Takip ve çıkış bilgilerini düzenle'
                          }
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowFollowDetails(!showFollowDetails);
                          }}
                          className={`ml-1 p-1 rounded-md transition-colors cursor-pointer border ${
                            hasFollowData
                              ? 'text-sky-400 bg-sky-500/20 hover:bg-sky-500/30 border-sky-500/40 shadow-xs'
                              : showFollowDetails
                              ? 'text-slate-200 bg-white/15 hover:bg-white/20 border-white/10'
                              : 'text-slate-400 hover:text-white hover:bg-white/10 border-transparent'
                          }`}
                        >
                          <Megaphone className="w-3 h-3" />
                        </button>
                      )}
                    </label>
                  </div>

                  <div className="flex items-center justify-start h-[30px] sm:h-[32px] mb-0.5 shrink-0 w-[115px]">
                    <div className="flex items-center gap-1.5">
                      <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap">
                        <input
                          id="add-anki-cb"
                          type="checkbox"
                          checked={anki}
                          onChange={(e) => {
                            setAnki(e.target.checked);
                            if (!e.target.checked) setAnkiTagSelectionMode(false);
                          }}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                        <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-xs">Anki</span>
                      </label>
                      <div className="w-6 h-6 flex items-center justify-center shrink-0">
                        {anki && (
                          <button
                            type="button"
                            id="btn-open-anki-editor-media"
                            onClick={() => setShowAnkiEditor(true)}
                            className="p-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                            title="Anki Editörü"
                          >
                            <Crop className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              {/* Takip Listesi Gelişmeleri & Beklenen Tarih Kutusu (Takip aktifken ve butona tıklandığında açılır, bilgiler asla silinmez) */}
              {following && showFollowDetails && (
                <div
                  id="add-follow-info-box"
                  className="mt-2.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-3 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                      <Megaphone className="w-3.5 h-3.5 text-sky-400" />
                      <span>Takip Notları & Beklenen Çıkış Tarihi</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowFollowDetails(false)}
                      className="text-[10px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Gizle
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-sky-400" /> Beklenen Dönem
                      </label>
                      <input
                        id="add-expected-date-input"
                        type="text"
                        value={expectedDate}
                        onChange={(e) => setExpectedDate(e.target.value)}
                        placeholder="Örn: 2027 başı, 2026 Güz, TBA..."
                        className="w-full bg-black/40 text-slate-100 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-400/60 transition-colors placeholder:text-neutral-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        Gelişme Notu / Açıklama
                      </label>
                      <textarea
                        id="add-follow-notes-input"
                        rows={4}
                        value={followNotes}
                        onChange={(e) => setFollowNotes(e.target.value)}
                        placeholder="Örn: 3. sezon duyuruldu, stüdyo değişti, prodüksiyon başladı..."
                        className="w-full bg-black/40 text-slate-100 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-400/60 transition-colors resize-y placeholder:text-neutral-500 custom-scrollbar min-h-[85px]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
            ) : (
              /* Game Status Options */
              <div className="grid grid-cols-1 sm:grid-cols-[1.15fr_1.1fr_1fr_105px] gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/5 items-end">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                    Oyun Durumu
                  </label>
                  <select
                    id="add-game-status-select"
                    value={status}
                    onChange={(e) => handleGameStatusChange(e.target.value as GameStatus)}
                    className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
                  >
                    <option value="Tamamlandı" className="bg-slate-900 text-white">✅ Tamamlandı</option>
                    <option value="Oynanacak" className="bg-slate-900 text-white">⏳ Oynanacak</option>
                    <option value="Oynanıyor" className="bg-slate-900 text-white">🎮 Oynanıyor</option>
                    <option value="Yarım Bırakıldı" className="bg-slate-900 text-white">⏸ Yarım Bırakıldı</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400" /> Başarım (%)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id="add-ach-input"
                      type="number"
                      min="0"
                      max={achMax}
                      placeholder="0"
                      value={achPercent ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || val === null) {
                          setAchPercent(null);
                          return;
                        }
                        let num = Number(val);
                        if (isNaN(num)) return;
                        const currentMax = achMax > 0 ? achMax : 100;
                        if (num < 0) num = 0;
                        if (num > currentMax) num = currentMax;
                        setAchPercent(num);
                      }}
                      className="w-full bg-black/30 text-amber-300 font-semibold border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-slate-400 text-xs">/</span>
                    <input
                      type="number"
                      min="1"
                      title="Üst limit"
                      value={achMax}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setAchMax(0);
                          return;
                        }
                        const newMax = Number(raw);
                        if (isNaN(newMax)) return;
                        setAchMax(newMax);
                        if (newMax > 0) {
                          setAchPercent((prev) => (prev !== null && prev > newMax ? newMax : prev));
                        }
                      }}
                      onBlur={() => {
                        if (achMax < 1) {
                          setAchMax(100);
                          setAchPercent((prev) => (prev !== null && prev > 100 ? 100 : prev));
                        } else if (achPercent !== null && achPercent > achMax) {
                          setAchPercent(achMax);
                        }
                      }}
                      className="w-14 bg-black/30 text-slate-300 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-center focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-sky-400" /> Oynanma (Saat)
                  </label>
                  <input
                    id="add-hours-input"
                    type="number"
                    min="0"
                    value={hours}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setHours(Number(e.target.value) || 0)}
                    className="w-full bg-black/30 text-sky-300 font-semibold border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-start h-[30px] sm:h-[32px] mb-0.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap">
                      <input
                        id="add-anki-game-cb"
                        type="checkbox"
                        checked={anki}
                        onChange={(e) => {
                          setAnki(e.target.checked);
                          if (!e.target.checked) setAnkiTagSelectionMode(false);
                        }}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs">Anki</span>
                    </label>
                    {anki && (
                      <button
                        type="button"
                        id="btn-open-anki-editor-game"
                        onClick={() => setShowAnkiEditor(true)}
                        className="p-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                        title="Anki Editörü"
                      >
                        <Crop className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Prominent Separator between Status and Field-Scoped Tags */}
          <div className="border-t-2 border-white/20 my-3" />

          {/* BOTTOM SECTION: FIELD-SCOPED TAGS (En Altta, Tam Genişlik) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between min-h-[24px] h-[24px]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Tags className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span>Etiketler</span>
                {anki && (
                  <button
                    type="button"
                    onClick={() => setAnkiTagSelectionMode((prev) => !prev)}
                    title="Anki Etiket"
                    className={`ml-0.5 transition-colors cursor-pointer p-0 bg-transparent border-0 flex items-center justify-center leading-none shrink-0 ${
                      ankiTagSelectionMode
                        ? 'text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 shrink-0" />
                  </button>
                )}
              </div>
              {anki && ankiTagSelectionMode && (
                <div className="flex items-center gap-2">
                  {ankiNotice ? (
                    <span className="text-[11px] text-amber-400 font-medium animate-in fade-in">
                      {ankiNotice}
                    </span>
                  ) : ankiFrontTags.length > 0 ? (
                    <span className="text-[11px] text-emerald-400 font-medium animate-in fade-in">
                      {ankiFrontTags.length}/2 seçili
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {isBook ? (
              /* Book Tag Fields: Yazar, Yayınevi, Çevirmen, Tür */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <TagInputBox
                    label="Yazar"
                    placeholder="Örn: George Orwell, Stefan Zweig, Tolkien..."
                    tags={author}
                    onChange={(newTags) => handleTagFieldChange('authors', setAuthor, newTags)}
                    availableTags={availableAuthorTags}
                    tagCounts={authorTagCounts}
                    icon={<PenTool className="w-3 h-3 text-amber-400" />}
                    highlightNewTags={tagDiffs.authors?.newTags}
                    highlightRemovedTags={tagDiffs.authors?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('authors', tag)}
                    hideCount={!!aiTagStates.authors}
                    isAnkiMode={anki && ankiTagSelectionMode}
                    isEligibleForAnki={true}
                    selectedAnkiTags={ankiFrontTags}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      aiTagStates.authors && (
                        aiTagStates.authors.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('authors', setAuthor)}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('authors', setAuthor)}
                            title="AI önerisine geç"
                            className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )
                      )
                    }
                  />
                </div>

                <div>
                  <TagInputBox
                    label="Yayınevi"
                    placeholder="Örn: Can Yayınları, İthaki, İletişim..."
                    tags={publisher}
                    onChange={(newTags) => handleTagFieldChange('publishers', setPublisher, newTags)}
                    availableTags={availablePublisherTags}
                    tagCounts={publisherTagCounts}
                    icon={<Building2 className="w-3 h-3 text-purple-400" />}
                    highlightNewTags={tagDiffs.publishers?.newTags}
                    highlightRemovedTags={tagDiffs.publishers?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('publishers', tag)}
                    hideCount={!!aiTagStates.publishers}
                    isAnkiMode={anki && ankiTagSelectionMode}
                    isEligibleForAnki={true}
                    selectedAnkiTags={ankiFrontTags}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      aiTagStates.publishers && (
                        aiTagStates.publishers.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('publishers', setPublisher)}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('publishers', setPublisher)}
                            title="AI önerisine geç"
                            className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )
                      )
                    }
                  />
                </div>

                <div>
                  <TagInputBox
                    label="Çevirmen"
                    placeholder="Örn: Celal Üster, Roza Hakmen, Sabri Esat..."
                    tags={translator}
                    onChange={(newTags) => handleTagFieldChange('translators', setTranslator, newTags)}
                    availableTags={availableTranslatorTags}
                    tagCounts={translatorTagCounts}
                    icon={<Globe className="w-3 h-3 text-sky-400" />}
                    highlightNewTags={tagDiffs.translators?.newTags}
                    highlightRemovedTags={tagDiffs.translators?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('translators', tag)}
                    hideCount={!!aiTagStates.translators}
                    isAnkiMode={anki && ankiTagSelectionMode}
                    isEligibleForAnki={true}
                    selectedAnkiTags={ankiFrontTags}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      aiTagStates.translators && (
                        aiTagStates.translators.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('translators', setTranslator)}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('translators', setTranslator)}
                            title="AI önerisine geç"
                            className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )
                      )
                    }
                  />
                </div>

                <div>
                  <TagInputBox
                    label="Tür"
                    placeholder="Örn: Bilimkurgu, Felsefe, Klasik, Distopya..."
                    tags={genre}
                    onChange={(newTags) => handleTagFieldChange('genres', setGenre, newTags)}
                    availableTags={availableBookGenreTags}
                    tagCounts={bookGenreTagCounts}
                    icon={<Tags className="w-3 h-3 text-emerald-400" />}
                    highlightNewTags={tagDiffs.genres?.newTags}
                    highlightRemovedTags={tagDiffs.genres?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('genres', tag)}
                    hideCount={!!aiTagStates.genres}
                    isAnkiMode={anki && ankiTagSelectionMode}
                    isEligibleForAnki={false}
                    rightElement={
                      aiTagStates.genres && (
                        aiTagStates.genres.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('genres', setGenre)}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('genres', setGenre)}
                            title="AI önerisine geç"
                            className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )
                      )
                    }
                  />
                </div>
              </div>
            ) : !isGame ? (
              /* Media Tag Fields: Firma, Yönetmen, Oyuncular, Tür */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <TagInputBox
                    label="Firma / Stüdyo"
                    placeholder="Örn: MAPPA, WIT Studio, Ufotable..."
                    tags={firm}
                    onChange={(newTags) => handleTagFieldChange('firms', setFirm, newTags)}
                    availableTags={availableFirmTags}
                    tagCounts={firmTagCounts}
                    icon={<Building2 className="w-3 h-3 text-purple-400" />}
                    highlightNewTags={tagDiffs.firms?.newTags}
                    highlightRemovedTags={tagDiffs.firms?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('firms', tag)}
                    hideCount={!!aiTagStates.firms}
                    isAnkiMode={anki && ankiTagSelectionMode}
                    isEligibleForAnki={true}
                    selectedAnkiTags={ankiFrontTags}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      aiTagStates.firms && (
                        aiTagStates.firms.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('firms', setFirm)}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('firms', setFirm)}
                            title="AI önerisine geç"
                            className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )
                      )
                    }
                  />
                </div>

                <div>
                  <TagInputBox
                    label="Yönetmen"
                    placeholder="Örn: Christopher Nolan, Miyazaki..."
                    tags={director}
                    onChange={(newTags) => handleTagFieldChange('directors', setDirector, newTags)}
                    availableTags={availableDirectorTags}
                    tagCounts={directorTagCounts}
                    icon={<Clapperboard className="w-3 h-3 text-amber-400" />}
                    highlightNewTags={tagDiffs.directors?.newTags}
                    highlightRemovedTags={tagDiffs.directors?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('directors', tag)}
                    hideCount={!!aiTagStates.directors}
                    isAnkiMode={anki && ankiTagSelectionMode}
                    isEligibleForAnki={true}
                    selectedAnkiTags={ankiFrontTags}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      aiTagStates.directors && (
                        aiTagStates.directors.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('directors', setDirector)}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('directors', setDirector)}
                            title="AI önerisine geç"
                            className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )
                      )
                    }
                  />
                </div>

                <div>
                  <TagInputBox
                    label="Oyuncular / Seslendirme"
                    placeholder="Örn: Kenjiro Tsuda, Cillian Murphy..."
                    tags={actors}
                    onChange={(newTags) => handleTagFieldChange('actors', setActors, newTags)}
                    availableTags={availableActorsTags}
                    tagCounts={actorsTagCounts}
                    icon={<Users className="w-3 h-3 text-sky-400" />}
                    highlightNewTags={tagDiffs.actors?.newTags}
                    highlightRemovedTags={tagDiffs.actors?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('actors', tag)}
                    hideCount={!!aiTagStates.actors}
                    isAnkiMode={anki && ankiTagSelectionMode}
                    isEligibleForAnki={true}
                    selectedAnkiTags={ankiFrontTags}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      aiTagStates.actors && (
                        aiTagStates.actors.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('actors', setActors)}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('actors', setActors)}
                            title="AI önerisine geç"
                            className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )
                      )
                    }
                  />
                </div>

                <div>
                  <TagInputBox
                    label="Tür"
                    placeholder="Örn: Aksiyon, Dram, Bilim Kurgu, Seinen..."
                    tags={genre}
                    onChange={(newTags) => handleTagFieldChange('genres', setGenre, newTags)}
                    availableTags={availableMediaGenreTags}
                    tagCounts={mediaGenreTagCounts}
                    icon={<Tags className="w-3 h-3 text-emerald-400" />}
                    highlightNewTags={tagDiffs.genres?.newTags}
                    highlightRemovedTags={tagDiffs.genres?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('genres', tag)}
                    hideCount={!!aiTagStates.genres}
                    isAnkiMode={anki && ankiTagSelectionMode}
                    isEligibleForAnki={false}
                    rightElement={
                      aiTagStates.genres && (
                        aiTagStates.genres.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('genres', setGenre)}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('genres', setGenre)}
                            title="AI önerisine geç"
                            className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )
                      )
                    }
                  />
                </div>
              </div>
            ) : (
              /* Game Tag Fields: Geliştirici, Tür */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <TagInputBox
                    label="Geliştirici / Stüdyo"
                    placeholder="Örn: FromSoftware, CD Projekt RED, Larian..."
                    tags={developer}
                    onChange={(newTags) => handleTagFieldChange('developers', setDeveloper, newTags)}
                    availableTags={availableDevTags}
                    tagCounts={devTagCounts}
                    icon={<Building2 className="w-3 h-3 text-purple-400" />}
                    highlightNewTags={tagDiffs.developers?.newTags}
                    highlightRemovedTags={tagDiffs.developers?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('developers', tag)}
                    hideCount={!!aiTagStates.developers}
                    isAnkiMode={anki && ankiTagSelectionMode}
                    isEligibleForAnki={true}
                    selectedAnkiTags={ankiFrontTags}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      aiTagStates.developers && (
                        aiTagStates.developers.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('developers', setDeveloper)}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('developers', setDeveloper)}
                            title="AI önerisine geç"
                            className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )
                      )
                    }
                  />
                </div>

                <div>
                  <TagInputBox
                    label="Tür"
                    placeholder="Örn: Souls-like, RPG, Açık Dünya, CRPG..."
                    tags={genre}
                    onChange={(newTags) => handleTagFieldChange('genres', setGenre, newTags)}
                    availableTags={availableGameGenreTags}
                    tagCounts={gameGenreTagCounts}
                    icon={<Tags className="w-3 h-3 text-emerald-400" />}
                    highlightNewTags={tagDiffs.genres?.newTags}
                    highlightRemovedTags={tagDiffs.genres?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('genres', tag)}
                    hideCount={!!aiTagStates.genres}
                    isAnkiMode={anki && ankiTagSelectionMode}
                    isEligibleForAnki={false}
                    rightElement={
                      aiTagStates.genres && (
                        aiTagStates.genres.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('genres', setGenre)}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('genres', setGenre)}
                            title="AI önerisine geç"
                            className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )
                      )
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Prominent Separator between Tags and Characters */}
          <div className="border-t-2 border-white/20 my-4" />

          {/* KARAKTERLER & KADRO */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                <span>{isBook ? 'Karakterler' : 'Karakterler & Kadro'}</span>
              </div>
              <div className="flex items-center gap-2">
                {aiCharState && (
                  <div className="flex items-center gap-1">
                    {aiCharState.isActive ? (
                      <button
                        type="button"
                        onClick={handleToggleCharacters}
                        title="Eski haline dön"
                        className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleToggleCharacters}
                        title="AI önerisine geç"
                        className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  id="btn-add-char-row-add-modal"
                  onClick={handleAddCharacter}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-semibold text-xs border border-sky-500/30 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Karakter Ekle</span>
                </button>
              </div>
            </div>

            {/* Global Actor Autocomplete Datalist */}
            <datalist id="add-actor-autocomplete-list">
              {allActorSuggestions.map((act) => (
                <option key={act} value={act} />
              ))}
            </datalist>

            {/* Character Rows List */}
            {characters.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-400">
                Henüz eklenmiş bir karakter bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                {characters.map((char, index) => {
                  const isNewAi = highlightNewCharacters.includes(char.name.trim().toLowerCase());
                  return (
                  <div
                    key={index}
                    className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl transition-all ${
                      isNewAi
                        ? 'bg-emerald-500/10 border border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : 'bg-white/[0.03] border border-white/10 group hover:border-white/20'
                    }`}
                  >
                    {/* Karakter Görseli Seçici / Önizleme / Panodan Yapıştırma */}
                    <div className="relative shrink-0 flex items-center justify-center">
                      <input
                        type="file"
                        accept="image/*"
                        id={`add-char-img-${index}`}
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const optimized = await optimizeImageFile(file, 1200, 1600, 0.88);
                              handleUpdateCharacter(index, 'image', optimized);
                            } catch (err) {
                              console.error(err);
                            }
                          }
                        }}
                      />
                      {char.image ? (
                        <div className="relative group/cavatar w-9 h-9 rounded-lg overflow-hidden border border-white/25 bg-black/50 shadow shrink-0">
                          <img
                            src={char.image}
                            alt={char.name || 'Karakter'}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateCharacter(index, 'image', undefined)}
                            title="Resmi Kaldır (Sil)"
                            className="absolute inset-0 bg-black/80 opacity-0 group-hover/cavatar:opacity-100 flex items-center justify-center text-rose-400 hover:text-rose-200 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <label
                            htmlFor={`add-char-img-${index}`}
                            title="PC'den Karakter Görseli Seç"
                            className="w-9 h-9 rounded-lg border border-dashed border-white/20 hover:border-sky-400/60 bg-black/30 hover:bg-sky-500/10 flex items-center justify-center text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </label>
                          <button
                            type="button"
                            onClick={() => handlePasteCharacterImage(index)}
                            title="Panodan Görsel Yapıştır (Kopyalanan Resmi Ekle)"
                            className="w-9 h-9 rounded-lg border border-dashed border-white/20 hover:border-emerald-400/60 bg-black/30 hover:bg-emerald-500/10 flex items-center justify-center text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
                          >
                            <ClipboardPaste className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder={isBook ? 'Karakter İsmi (örn: Winston Smith)' : 'Karakter İsmi (örn: Yuta Okkotsu)'}
                        value={char.name}
                        onChange={(e) =>
                          handleUpdateCharacter(index, 'name', e.target.value)
                        }
                        className="w-full bg-black/40 text-slate-200 placeholder-slate-500 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                      />
                      {isNewAi && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 rounded flex items-center gap-0.5 pointer-events-none">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Yeni</span>
                        </span>
                      )}
                    </div>

                    <div className="flex-1 flex items-center gap-1">
                      <input
                        type="text"
                        list="add-actor-autocomplete-list"
                        placeholder={isBook ? 'Rolü / Kimliği (örn: Dedektif, Hukuk Öğrencisi)' : 'Seslendiren / Oyuncu (örn: Kana Hanazawa)'}
                        value={char.actor || ''}
                        onChange={(e) =>
                          handleUpdateCharacter(index, 'actor', e.target.value)
                        }
                        className="w-full bg-black/40 text-sky-300 placeholder-slate-500 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveCharacter(index)}
                      title="Karakteri Sil"
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors self-end sm:self-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* BEĞENİLEN SÖZLER / ALINTILAR (Yalnızca Kitap Modunda, Karakterler ile Seri Arasında) */}
          {isBook && (
            <>
              {/* Prominent Separator between Characters and Quotes */}
              <div className="border-t-2 border-white/20 my-4" />

              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Quote className="w-3.5 h-3.5 text-amber-400" />
                    <span>Beğenilen Sözler / Alıntılar</span>
                  </div>
                  <button
                    type="button"
                    id="btn-add-quote-row"
                    onClick={handleAddQuote}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-xs border border-amber-500/30 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Söz Ekle</span>
                  </button>
                </div>

                {quotes.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-400">
                    Henüz eklenmiş bir alıntı veya söz bulunmuyor.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                    {quotes.map((quoteItem, index) => (
                      <div
                        key={quoteItem.id || index}
                        className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 group hover:border-white/20 transition-all"
                      >
                        <div className="flex-1">
                          <textarea
                            rows={2}
                            placeholder="Kitaptan alıntı veya beğenilen söz..."
                            value={quoteItem.text}
                            onChange={(e) => handleUpdateQuote(index, 'text', e.target.value)}
                            className="w-full bg-black/40 text-slate-200 placeholder-slate-500 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500 resize-y min-h-[52px] custom-scrollbar"
                          />
                        </div>

                        <div className="w-full sm:w-32 shrink-0 flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Sayfa No"
                            value={quoteItem.page ?? ''}
                            onChange={(e) => handleUpdateQuote(index, 'page', e.target.value)}
                            className="w-full bg-black/40 text-amber-300 placeholder-slate-500 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500 text-center font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveQuote(index)}
                            title="Sözü Sil"
                            className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Prominent Separator between Characters/Quotes and Series */}
          <div className="border-t-2 border-white/20 my-4" />

          {/* SERİ / EVREN BİLGİSİ (Karakterler & Kadro Altında) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Seri / Evren Bağlantısı</span>
              <div className="relative inline-flex items-center group/ftip">
                <button
                  type="button"
                  className="p-0.5 text-slate-400 hover:text-indigo-300 rounded transition-colors cursor-pointer"
                  title="Bilgi"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <div
                  className="absolute left-6 top-1/2 -translate-y-1/2 z-50 w-64 p-2.5 rounded-xl bg-slate-900/95 border border-indigo-500/30 text-[11px] text-slate-200 font-normal leading-relaxed shadow-xl backdrop-blur-md transition-opacity pointer-events-none opacity-0 group-hover/ftip:opacity-100"
                >
                  Aynı evrene veya seriye ait yapımları (örn: kitap serisi, film, anime, dizi, oyun) birbirine bağlamak için ortak bir seri adı belirleyin.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Seri / Evren Adı
                </label>
                <input
                  id="add-series-name-input"
                  type="text"
                  list="add-series-name-suggestions"
                  value={seriesName}
                  onChange={(e) => setSeriesName(e.target.value)}
                  placeholder={isBook ? 'Örn: Harry Potter, Dune, Vakıf, Yüzüklerin Efendisi...' : 'Örn: Jujutsu Kaisen, Harry Potter, Witcher...'}
                  className="w-full bg-black/40 text-slate-100 border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-400 transition-colors placeholder:text-neutral-500"
                />
                <datalist id="add-series-name-suggestions">
                  {availableSeriesNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  İzleme / Seri Sırası
                </label>
                <input
                  id="add-series-order-input"
                  type="number"
                  step="any"
                  min="0"
                  value={seriesOrder}
                  onChange={(e) => setSeriesOrder(e.target.value)}
                  placeholder="Örn: 1, 2, 3..."
                  className="w-full bg-black/40 text-indigo-300 font-semibold border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-400 transition-colors placeholder:text-neutral-500"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer with Explicit Action Buttons and Live AI Process Status */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10 bg-black/40 gap-3">
          {/* Left side: AI Status & Info button (visible only when an AI action is triggered) */}
          <div className="flex-1 min-w-0 flex items-center">
            {aiStatusText && (
              <div
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs max-w-full transition-all animate-in fade-in duration-150 ${
                  aiStatusType === 'loading'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : aiStatusType === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {aiStatusType === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-400" />
                ) : aiStatusType === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                )}
                <span className="truncate font-medium">{aiStatusText}</span>

                {/* (i) button to open detailed log dialog */}
                {aiLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAiLogModal(true)}
                    title="AI İşlem Detaylarını ve Günlüğünü Gör"
                    className="p-1 rounded-lg hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0 ml-1 border border-white/10"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            id="save-add-form-btn"
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/30 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Kütüphaneye Ekle</span>
          </button>
        </div>
      </div>

      {/* AI Process Log Modal */}
      {showAiLogModal && (
        <AiProcessLogModal
          isOpen={showAiLogModal}
          onClose={() => setShowAiLogModal(false)}
          title={title}
          logs={aiLogs}
          statusType={aiStatusType}
          usedModel={aiUsedModel}
        />
      )}

      {/* Anki Görsel & Blur Editörü */}
      {showAnkiEditor && (
        <AnkiEditorModal
          isOpen={showAnkiEditor}
          itemTitle={title}
          initialThumbnail={thumbnail}
          initialMainBlurs={ankiMainBlurs}
          initialExtraImages={ankiExtraImages}
          onApply={(data) => {
            if (data.thumbnail && data.thumbnail !== thumbnail) {
              setThumbnail(data.thumbnail);
            }
            setAnkiMainBlurs(data.mainBlurs);
            setAnkiExtraImages(data.extraImages);
            if (!anki) {
              setAnki(true);
            }
          }}
          onClose={() => setShowAnkiEditor(false)}
        />
      )}
    </div>
  );
};
