import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArchiveItem, Category, GameStatus, ItemCharacter, BookFormat, BookQuote, AnkiBlurBox, AnkiExtraImage } from '../types';
import { MEDIA_COLORS, GAME_COLORS, BOOK_COLORS } from '../data/initialData';
import { optimizeImageFile } from '../utils/imageOptimizer';
import { TagInputBox } from './TagInputBox';
import { getFieldScopedTags, getFieldScopedTagCounts } from '../utils/tagUtils';
import { safeLocalStorageGet, safeLocalStorageSet } from '../utils/fileSystem';
import { CustomDialog, DialogOptions } from './CustomDialog';
import { getGeminiApiKey, fetchAiMetadata, formatMetadataModelLabel, AiItemMetadata, AiLogEntry } from '../utils/geminiAi';
import { AiProcessLogModal } from './AiProcessLogModal';
import { AnkiEditorModal } from './AnkiEditorModal';
import { initAnkiCard } from '../utils/ankiUtils';
import {
  X,
  Upload,
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
  Trash2,
  Save,
  PauseCircle,
  Megaphone,
  Plus,
  Image as ImageIcon,
  Layers,
  Info,
  AlertCircle,
  Loader2,
  CheckCircle2,
  RotateCcw,
  BookOpen,
  Quote,
  PenTool,
  Globe,
  Crop,
} from 'lucide-react';

interface ItemDetailModalProps {
  item: ArchiveItem;
  categories: Category[];
  allItems?: ArchiveItem[];
  isReadOnly?: boolean;
  onSave: (updatedItem: ArchiveItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  categories,
  allItems = [],
  isReadOnly = false,
  onSave,
  onDelete,
  onClose,
}) => {
  // Ensure valid category and subgroup upon initialization
  const [formData, setFormData] = useState<ArchiveItem>(() => {
    let cat = item.cat;
    let sub = item.sub;
    const catObj = categories.find((c) => c.id === cat);
    if (!catObj && categories.length > 0) {
      cat = categories[0].id;
      sub = null;
    } else if (catObj) {
      if (sub && !catObj.subgroups.includes(sub)) {
        sub = null;
      }
    }
    return { ...item, cat, sub };
  });
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);
  const [showFollowDetails, setShowFollowDetails] = useState(false);
  const [showFranchiseTooltip, setShowFranchiseTooltip] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<DialogOptions | null>(null);
  const [showAnkiEditor, setShowAnkiEditor] = useState<boolean>(false);
  const [ankiTagSelectionMode, setAnkiTagSelectionMode] = useState<boolean>(false);
  const [ankiNotice, setAnkiNotice] = useState<string | null>(null);

  const handleToggleAnkiFrontTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const current = formData.ankiFrontTags || [];
    const existingIndex = current.findIndex(
      (t) => t.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existingIndex !== -1) {
      setFormData((prev) => ({
        ...prev,
        ankiFrontTags: (prev.ankiFrontTags || []).filter((_, idx) => idx !== existingIndex),
      }));
      setAnkiNotice(null);
    } else {
      if (current.length >= 2) {
        setAnkiNotice('En fazla 2 etiket seçilebilir.');
        setTimeout(() => setAnkiNotice(null), 2500);
        return;
      }
      setFormData((prev) => ({
        ...prev,
        ankiFrontTags: [...(prev.ankiFrontTags || []), trimmed],
      }));
      setAnkiNotice(null);
    }
  };

  // Takip kutularında (Beklenen Dönem veya Gelişme Notu) veri olup olmadığını kontrol eder
  const hasFollowData = !!(
    (formData.expectedDate && formData.expectedDate.trim().length > 0) ||
    (formData.followNotes && formData.followNotes.trim().length > 0)
  );

  // Hatırlanan son izlenme/tamamlanma tarihi (İzleniyor/Oynanıyor seçilip kaldırıldığında tarihi kaybetmemek için)
  const [rememberedDate, setRememberedDate] = useState<string>(() => {
    if (item.lastCompletedDate) return item.lastCompletedDate;
    if (item.date && item.date !== '??' && item.date !== '??.??') return item.date;
    return '';
  });

  // Release Year Range / Single Mode State
  const initialYearStr = formData.releaseYear ? String(formData.releaseYear) : '';
  const isInitialRange = initialYearStr.includes('-') || initialYearStr.includes('—') || initialYearStr.includes('–');
  const [isYearRange, setIsYearRange] = useState(isInitialRange);
  const [startYear, setStartYear] = useState(() => {
    if (isInitialRange) {
      const parts = initialYearStr.split(/[-—–]/);
      return parts[0]?.trim() || '';
    }
    return initialYearStr;
  });
  const [endYear, setEndYear] = useState(() => {
    if (isInitialRange) {
      const parts = initialYearStr.split(/[-—–]/);
      return parts[1]?.trim() || '';
    }
    return '';
  });

  // Book specific states
  const [pageCount, setPageCount] = useState<number | string>(item.pageCount ?? '');
  const [bookFormat, setBookFormat] = useState<BookFormat>(item.format || 'Ciltsiz');
  const [reading, setReading] = useState<boolean>(Boolean(item.reading));
  const [author, setAuthor] = useState<string[]>(item.author || []);
  const [publisher, setPublisher] = useState<string[]>(item.publisher || []);
  const [translator, setTranslator] = useState<string[]>(item.translator || []);
  const [quotes, setQuotes] = useState<BookQuote[]>(item.quotes || []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync formData when item prop changes (e.g. user selected another item)
  useEffect(() => {
    setFormData({ ...item });
    if (item.lastCompletedDate) {
      setRememberedDate(item.lastCompletedDate);
    } else if (item.date && item.date !== '??' && item.date !== '??.??') {
      setRememberedDate(item.date);
    }
    const yearStr = item.releaseYear ? String(item.releaseYear) : '';
    const isRange = yearStr.includes('-') || yearStr.includes('—') || yearStr.includes('–');
    setIsYearRange(isRange);
    if (isRange) {
      const parts = yearStr.split(/[-—–]/);
      setStartYear(parts[0]?.trim() || '');
      setEndYear(parts[1]?.trim() || '');
    } else {
      setStartYear(yearStr);
      setEndYear('');
    }
    setPageCount(item.pageCount ?? '');
    setBookFormat(item.format || 'Ciltsiz');
    setReading(Boolean(item.reading));
    setAuthor(item.author || []);
    setPublisher(item.publisher || []);
    setTranslator(item.translator || []);
    setQuotes(item.quotes || []);
    setAiDescState(null);
    setAiYearState(null);
    setAiTagStates({});
    setAiCharState(null);
    setTagDiffs({});
    setHighlightNewCharacters([]);
  }, [item]);

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
    original: { startYear: string; endYear: string; isYearRange: boolean; releaseYear?: string | number };
    suggested: { startYear: string; endYear: string; isYearRange: boolean; releaseYear?: string | number };
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

    if (!formData.title.trim() && !formData.thumbnail) {
      const err = 'Lütfen önce bir yapım başlığı girin veya bir afiş ekleyin.';
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
        title: formData.title.trim(),
        categoryName: selectedCatObj?.name || '',
        isGame,
        isBook,
        posterBase64: formData.thumbnail,
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
  // Boş alanları otomatik doldurur, dolu alanlar için onay önerileri hazırlar.
  const handleAiFill = async () => {
    if (!formData.title.trim() && !formData.thumbnail) {
      setAiNotice({
        text: 'Lütfen önce bir yapım başlığı girin veya afiş yükleyin.',
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
        const computedAiYear = aiIsRange
          ? (aiEnd ? `${aiStart}–${aiEnd}` : `${aiStart}–`)
          : (!isNaN(Number(aiStart)) ? Number(aiStart) : aiStart);

        setAiYearState({
          original: {
            startYear,
            endYear,
            isYearRange,
            releaseYear: formData.releaseYear,
          },
          suggested: {
            startYear: aiStart,
            endYear: aiEnd,
            isYearRange: aiIsRange,
            releaseYear: computedAiYear,
          },
          isActive: true,
        });

        setIsYearRange(aiIsRange);
        setStartYear(aiStart);
        setEndYear(aiEnd);
        handleChange('releaseYear', computedAiYear);

        if (!curYear) {
          filledCount++;
        } else {
          suggestedCount++;
        }
      }
    }

    // 2. Description (Konu / Özet) - Doğrudan kutuya uygula, yeşil çerçeve ve [↩]/[✨] geçiş durumunu aktifleştir
    const curDesc = (formData.desc || '').trim();
    const aiDesc = (data.description || '').trim();
    if (aiDesc && aiDesc !== curDesc) {
      setAiDescState({
        original: formData.desc || '',
        suggested: aiDesc,
        isActive: true,
      });
      handleChange('desc', aiDesc);

      if (!curDesc) {
        filledCount++;
      } else {
        suggestedCount++;
      }
    }

    // Helper for tag fields
    const processTagField = (
      fieldKey: 'genres' | 'firms' | 'directors' | 'actors' | 'developers' | 'authors' | 'publishers' | 'translators',
      currentTags: string[] | undefined,
      aiTags: string[] | undefined,
      setter: (tags: string[]) => void
    ) => {
      const current = currentTags || [];
      const ai = aiTags || [];
      if (ai.length === 0) return;

      if (current.length === 0) {
        setter(ai);
        filledCount++;
      } else {
        const curSet = new Set(current.map((t) => t.trim().toLowerCase()));
        const aiSet = new Set(ai.map((t) => t.trim().toLowerCase()));
        const newTags = ai.filter((t) => !curSet.has(t.trim().toLowerCase()));
        const removedTags = current.filter((t) => !aiSet.has(t.trim().toLowerCase()));

        if (newTags.length > 0 || removedTags.length > 0) {
          const updated = [...current.filter((t) => aiSet.has(t.trim().toLowerCase())), ...newTags];
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
              original: [...current],
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
    processTagField('genres', formData.genre, data.genres, (tags) => handleChange('genre', tags));

    // 4. Field-scoped tags
    if (isBook) {
      processTagField('authors', author, data.authors, setAuthor);
      processTagField('publishers', publisher, data.publishers, setPublisher);
      processTagField('translators', translator, data.translators, setTranslator);
    } else if (!isGame) {
      processTagField('firms', formData.firm, data.firms, (tags) => handleChange('firm', tags));
      processTagField('directors', formData.director, data.directors, (tags) => handleChange('director', tags));
      const aiActorList = data.actors && data.actors.length > 0
        ? data.actors
        : Array.from(new Set((data.characters || []).map((c) => c.actor?.trim()).filter(Boolean) as string[]));
      processTagField('actors', formData.actors, aiActorList, (tags) => handleChange('actors', tags));
    } else {
      processTagField('developers', formData.developer, data.developers, (tags) => handleChange('developer', tags));
    }

    // 6. Characters (Karakterler & Kadro)
    const aiChars = data.characters || [];
    if (aiChars.length > 0) {
      const cur = formData.characters || [];
      if (cur.length === 0) {
        handleChange(
          'characters',
          aiChars.map((c) => ({ name: c.name, actor: c.actor || '' }))
        );
        filledCount++;
      } else {
        const curNames = new Set(cur.map((c) => c.name.trim().toLowerCase()));
        const newChars = aiChars.filter((c) => !curNames.has(c.name.trim().toLowerCase()));
        if (newChars.length > 0) {
          const updated = [...cur, ...newChars.map((c) => ({ name: c.name, actor: c.actor || '' }))];
          handleChange('characters', updated);
          const highlightNames = newChars.map((c) => c.name.trim().toLowerCase());
          setHighlightNewCharacters(highlightNames);
          setAiCharState({
            original: [...cur],
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
    formKey?: 'genre' | 'firm' | 'director' | 'actors' | 'developer'
  ) => {
    const state = aiTagStates[fieldKey];
    if (!state) return;

    const applyTags = (tags: string[]) => {
      if (formKey) handleChange(formKey, tags);
      else if (fieldKey === 'genres') handleChange('genre', tags);
      else if (fieldKey === 'authors') setAuthor(tags);
      else if (fieldKey === 'publishers') setPublisher(tags);
      else if (fieldKey === 'translators') setTranslator(tags);
    };

    if (state.isActive) {
      applyTags(state.original);
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
      applyTags(state.suggested);
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
      handleChange('characters', aiCharState.original);
      setHighlightNewCharacters([]);
      setAiCharState((prev) => (prev ? { ...prev, isActive: false } : null));
    } else {
      handleChange('characters', aiCharState.suggested);
      setHighlightNewCharacters(aiCharState.highlightNames);
      setAiCharState((prev) => (prev ? { ...prev, isActive: true } : null));
    }
  };

  const handleTagFieldChange = (
    fieldKey: 'genres' | 'firms' | 'directors' | 'actors' | 'developers' | 'authors' | 'publishers' | 'translators',
    formKey: 'genre' | 'firm' | 'director' | 'actors' | 'developer' | 'author' | 'publisher' | 'translator',
    newTags: string[]
  ) => {
    if (formKey === 'author') setAuthor(newTags);
    else if (formKey === 'publisher') setPublisher(newTags);
    else if (formKey === 'translator') setTranslator(newTags);
    else handleChange(formKey, newTags);

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
    let nextTags: string[] = [];
    if (field === 'genres') {
      nextTags = [...(formData.genre || []), tag];
      handleChange('genre', nextTags);
    } else if (field === 'firms') {
      nextTags = [...(formData.firm || []), tag];
      handleChange('firm', nextTags);
    } else if (field === 'directors') {
      nextTags = [...(formData.director || []), tag];
      handleChange('director', nextTags);
    } else if (field === 'actors') {
      nextTags = [...(formData.actors || []), tag];
      handleChange('actors', nextTags);
    } else if (field === 'developers') {
      nextTags = [...(formData.developer || []), tag];
      handleChange('developer', nextTags);
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

  // Auto-sync category if categories list updates or current cat becomes invalid
  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === formData.cat)) {
      setFormData((prev) => ({
        ...prev,
        cat: categories[0].id,
        sub: null,
      }));
    }
  }, [categories, formData.cat]);

  const isGame = formData.mainTab === 'game';
  const isBook = formData.mainTab === 'book';
  const selectedCatObj = categories.find((c) => c.id === formData.cat);
  const palette = isGame ? GAME_COLORS : isBook ? BOOK_COLORS : MEDIA_COLORS;
  const baseColor = palette[formData.cat] || (isBook ? '#8a6fbf' : '#3b82f6');

  // Field-scoped tag lists and count maps
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

  // Book Status & Quotes Handlers
  const handleBookStatusToggle = (type: 'reading' | 'dropped') => {
    if (type === 'reading') {
      const next = !reading;
      setReading(next);
      if (next) {
        handleChange('dropped', false);
        handleChange('date', '');
      }
    } else if (type === 'dropped') {
      const next = !formData.dropped;
      handleChange('dropped', next);
      if (next) {
        setReading(false);
      }
    }
  };

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

  // Aggregated actor suggestions from actors tags and existing characters
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
    formData.actors?.forEach((a) => {
      if (a && a.trim()) set.add(a.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [availableActorsTags, allItems, formData.actors]);

  const handleAddCharacter = () => {
    setFormData((prev) => ({
      ...prev,
      characters: [...(prev.characters || []), { name: '', actor: '' }],
    }));
  };

  const handleUpdateCharacter = (
    index: number,
    field: 'name' | 'actor' | 'image',
    value?: string
  ) => {
    setFormData((prev) => {
      const updated = [...(prev.characters || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, characters: updated };
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
            const optimized = await optimizeImageFile(blob, 1200, 1600, 0.95);
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
      console.warn('Pano okuma hatası:', err);
      setPasteNotice('Panodan okuma başarısız veya izin verilmedi.');
      setTimeout(() => setPasteNotice(null), 2500);
    }
  };

  const handleRemoveCharacter = (index: number) => {
    setFormData((prev) => {
      const updated = (prev.characters || []).filter((_, i) => i !== index);
      return { ...prev, characters: updated };
    });
  };

  // Mutually exclusive toggle for media statuses (watching, following, dropped)
  const handleMediaStatusToggle = (type: 'watching' | 'following' | 'dropped') => {
    setFormData((prev) => {
      const isCurrentlyActive = !!prev[type];
      if (isCurrentlyActive) {
        // Durum kaldırılıyor (örn: İzleniyor kaldırıldı) -> Eski tarihi hatırla ve geri yükle!
        const restoredDate = prev.date || rememberedDate || '';
        return {
          ...prev,
          [type]: false,
          date: restoredDate,
        };
      } else {
        if (type === 'following') {
          setShowFollowDetails(true);
        }
        // Eğer izleniyor veya takip seçiliyorsa geçerli tarihi hafızaya al
        if (prev.date && prev.date !== '??' && prev.date !== '??.??') {
          setRememberedDate(prev.date);
        }
        return {
          ...prev,
          watching: type === 'watching',
          following: type === 'following',
          dropped: type === 'dropped',
          date: prev.date || rememberedDate || '',
        };
      }
    });
  };

  const isDateDisabled = isGame
    ? (formData.status === 'Oynanıyor' || formData.status === 'Oynanacak')
    : isBook
    ? reading
    : !!formData.watching;

  const applyImageBase64 = async (rawInput: File | Blob | string, name?: string) => {
    try {
      const optimized = await optimizeImageFile(rawInput, 800, 1200, 0.88);
      setFormData((prev) => ({
        ...prev,
        thumbnail: optimized,
        thumbnailFileName: name || prev.thumbnailFileName || 'image.png',
      }));
      setPasteNotice('Resim güncellendi!');
      setTimeout(() => setPasteNotice(null), 2500);
    } catch {
      if (typeof rawInput === 'string') {
        setFormData((prev) => ({
          ...prev,
          thumbnail: rawInput,
          thumbnailFileName: name || prev.thumbnailFileName || 'image.png',
        }));
      }
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyImageBase64(file, file.name);
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
            await applyImageBase64(blob, 'clipboard-paste.png');
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
      console.warn('Clipboard error:', err);
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
            applyImageBase64(file, file.name || 'clipboard-paste.png');
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

  // Not: Kullanıcının girdiği verilerin kaza eseri silinmemesi için Escape tuşu ile pencereyi kapatma kaldırılmıştır.

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, thumbnail: undefined, thumbnailFileName: undefined }));
  };

  const handleChange = <K extends keyof ArchiveItem>(key: K, value: ArchiveItem[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Save changes explicitly
  const handleSaveForm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formData.title.trim()) {
      window.alert('Başlık boş bırakılamaz.');
      return;
    }

    const cleanedCharacters = (formData.characters || [])
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

    const trimmedSeries = formData.seriesName?.trim() || undefined;
    const cleanSeriesOrder =
      formData.seriesOrder !== undefined && !isNaN(Number(formData.seriesOrder))
        ? Number(formData.seriesOrder)
        : undefined;

    const finalLastCompleted =
      rememberedDate ||
      (formData.date && formData.date !== '??' && formData.date !== '??.??'
        ? formData.date
        : item.lastCompletedDate);

    onSave({
      ...formData,
      isHidden: formData.isHidden,
      date: isDateDisabled ? '' : (formData.date || '??'),
      lastCompletedDate: finalLastCompleted,
      characters: cleanedCharacters,
      releaseYear: computedReleaseYear,
      seriesName: trimmedSeries,
      seriesOrder: cleanSeriesOrder,
      // Book specific
      reading: isBook ? reading : undefined,
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
      firm: !isGame && !isBook && (formData.firm || []).length > 0 ? formData.firm : undefined,
      director: !isGame && !isBook && (formData.director || []).length > 0 ? formData.director : undefined,
      actors: !isGame && !isBook && (formData.actors || []).length > 0 ? formData.actors : undefined,
      // Game tags
      developer: isGame && (formData.developer || []).length > 0 ? formData.developer : undefined,
      // Media flags
      watching: !isGame && !isBook ? formData.watching : undefined,
      following: !isGame && !isBook ? formData.following : undefined,
      dropped: isBook ? formData.dropped : (!isGame ? formData.dropped : undefined),
      // Anki Front Tags
      ankiFrontTags: (() => {
        if (!formData.anki || !formData.ankiFrontTags || formData.ankiFrontTags.length === 0) return undefined;
        const allEligibleTags = isBook
          ? [...author, ...publisher, ...translator]
          : isGame
          ? [...(formData.developer || [])]
          : [...(formData.firm || []), ...(formData.director || []), ...(formData.actors || [])];
        const cleaned = formData.ankiFrontTags.filter((ft) =>
          allEligibleTags.some(
            (et) => et.trim().toLowerCase() === ft.trim().toLowerCase()
          )
        ).slice(0, 2);
        return cleaned.length > 0 ? cleaned : undefined;
      })(),
      updatedAt: Date.now(),
    });
  };

  const trashTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (trashTimerRef.current) {
        clearTimeout(trashTimerRef.current);
      }
    };
  }, []);

  const handleTrashPressStart = () => {
    longPressTriggeredRef.current = false;
    if (trashTimerRef.current) clearTimeout(trashTimerRef.current);
    trashTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setFormData((prev) => ({
        ...prev,
        isHidden: !prev.isHidden,
      }));
    }, 3000);
  };

  const handleTrashPressEnd = () => {
    if (trashTimerRef.current) {
      clearTimeout(trashTimerRef.current);
      trashTimerRef.current = null;
    }
  };

  const handleClickDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    handleDelete();
  };

  const handleDelete = () => {
    setDeleteConfirmDialog({
      type: 'confirm',
      title: 'Yapımı Sil',
      message: `"${formData.title}" arşivden kalıcı olarak silinecek. Emin misiniz? Bu işlem geri alınamaz.`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDestructive: true,
      onConfirm: () => {
        setDeleteConfirmDialog(null);
        onDelete(formData.id);
        onClose();
      },
      onCancel: () => {
        setDeleteConfirmDialog(null);
      },
    });
  };

  return (
    <div
      id="detail-modal-overlay"
      className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div
        id="detail-modal-box"
        className="relative w-full max-w-2xl bg-[#131722] border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="text-slate-300 font-semibold">{isGame ? '🎮 Oyun' : isBook ? '📚 Kitap' : '🎬 Medya'}</span>
            <span>/</span>
            <span className="text-blue-300 font-semibold">{selectedCatObj?.name || 'Kategorisiz'}</span>
            {formData.sub && (
              <>
                <span>/</span>
                <span className="text-slate-200">{formData.sub}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">

            {/* Delete button (only on desktop/large screens or non-readonly) */}
            {!isReadOnly && (
              <button
                id="delete-item-btn"
                type="button"
                onMouseDown={handleTrashPressStart}
                onMouseUp={handleTrashPressEnd}
                onMouseLeave={handleTrashPressEnd}
                onTouchStart={handleTrashPressStart}
                onTouchEnd={handleTrashPressEnd}
                onTouchCancel={handleTrashPressEnd}
                onClick={handleClickDelete}
                title="Yapımı Sil (Gizleme: 3 sn basılı tutun)"
                className="inline-flex p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer select-none"
              >
                {formData.isHidden ? (
                  /* Karar Verilen Tasarım: Kısa Çizgiler (Hafif ve Zarif) */
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" x2="10" y1="12.5" y2="15.5" />
                    <line x1="14" x2="14" y1="12.5" y2="15.5" />
                  </svg>
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              id="close-detail-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSaveForm} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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
                  backgroundColor: formData.thumbnail ? '#0b0e14' : `${baseColor}22`,
                  borderColor: formData.thumbnail ? 'rgba(255,255,255,0.15)' : `${baseColor}60`,
                }}
              >
                {formData.thumbnail ? (
                  <>
                    <img
                      src={formData.thumbnail}
                      alt={formData.title}
                      className="w-full h-full object-cover rounded-xl"
                    />
                    {/* Top-Right "X" icon to remove image */}
                    <button
                      type="button"
                      onClick={handleRemoveImage}
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
                    {formData.title || 'Resim Yok'}
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
                  <span>{formData.thumbnail ? 'Değiştir' : 'Yükle'}</span>
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
                    id="detail-title-input"
                    type="text"
                    required
                    autoComplete="off"
                    value={formData.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className="flex-1 min-w-0 bg-black/30 text-white font-semibold border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  {!isReadOnly && (
                    <button
                      id="detail-ai-fill-btn"
                      type="button"
                      onClick={handleAiFill}
                      disabled={aiLoading || (!formData.title.trim() && !formData.thumbnail)}
                      title={
                        !formData.title.trim() && !formData.thumbnail
                          ? 'Otomatik doldurma için önce bir başlık yazın veya afiş ekleyin.'
                          : 'Gemini AI ile boş alanları otomatik doldurur, dolu alanlar için öneriler sunar'
                      }
                      className="shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 border border-amber-400/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                      <span>{aiLoading ? 'Dolduruluyor...' : 'AI ile Doldur'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Category & Subgroup Selectors */}
              {isBook ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                      Kategori
                    </label>
                    <select
                      id="detail-category-select"
                      value={formData.cat}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          cat: newCat,
                          sub: null,
                        }));
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

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5">
                      Alt-Grup
                    </label>
                    <select
                      id="detail-subgroup-select"
                      value={formData.sub || ''}
                      onChange={(e) => handleChange('sub', e.target.value || null)}
                      className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="" className="bg-slate-900 text-white">Yok</option>
                      {(selectedCatObj?.subgroups || []).map((s) => (
                        <option key={s} value={s} className="bg-slate-900 text-white">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-indigo-400" /> Sayfa Sayısı
                    </label>
                    <input
                      id="detail-page-count-input"
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
                      id="detail-category-select"
                      value={formData.cat}
                      onChange={(e) => {
                        const newCat = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          cat: newCat,
                          sub: null,
                        }));
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
                        id="detail-subgroup-select"
                        value={formData.sub || ''}
                        onChange={(e) => handleChange('sub', e.target.value || null)}
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
                      <span>Puan (1-10)</span>
                    </label>
                  </div>
                  <select
                    id="detail-rating-select"
                    value={formData.rating}
                    onChange={(e) => handleChange('rating', Number(e.target.value))}
                    className="w-full h-8 bg-black/30 text-amber-300 font-bold border border-white/10 rounded-xl px-2.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <option key={num} value={num} className="bg-slate-900 text-amber-300">
                        ★ {num} / 10
                      </option>
                    ))}
                  </select>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 h-5 mb-1">
                    <label className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1 truncate">
                      <Calendar className="w-3 h-3 text-neutral-400 shrink-0" />
                      <span>{isBook ? 'Basım Yılı' : 'Yapım Yılı'}</span>
                    </label>
                    <button
                      type="button"
                      id="toggle-release-year-range-btn"
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
                    {!isReadOnly && aiYearState && (
                      <div className="ml-auto flex items-center gap-1">
                        {aiYearState.isActive ? (
                          <button
                            type="button"
                            onClick={() => {
                              setStartYear(aiYearState.original.startYear);
                              setEndYear(aiYearState.original.endYear);
                              setIsYearRange(aiYearState.original.isYearRange);
                              handleChange('releaseYear', aiYearState.original.releaseYear);
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
                              handleChange('releaseYear', aiYearState.suggested.releaseYear);
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
                      id="detail-release-year-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="Örn: 2024"
                      value={startYear}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStartYear(val);
                        const s = val.trim();
                        handleChange('releaseYear', s ? (!isNaN(Number(s)) ? Number(s) : s) : undefined);
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
                        id="detail-release-year-start"
                        type="text"
                        inputMode="numeric"
                        placeholder="Başlangıç"
                        value={startYear}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStartYear(val);
                          const s = val.trim();
                          const eVal = endYear.trim();
                          const combined = s ? (eVal ? `${s}–${eVal}` : `${s}–`) : (eVal ? `–${eVal}` : undefined);
                          handleChange('releaseYear', combined);
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
                        id="detail-release-year-end"
                        type="text"
                        placeholder="Bitiş"
                        value={endYear}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEndYear(val);
                          const s = startYear.trim();
                          const eVal = val.trim();
                          const combined = s ? (eVal ? `${s}–${eVal}` : `${s}–`) : (eVal ? `–${eVal}` : undefined);
                          handleChange('releaseYear', combined);
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
                      <span>{isGame ? 'Tamamlama Tarihi' : isBook ? 'Okunma Tarihi' : 'İzlenme Tarihi'}</span>
                    </label>
                  </div>
                  <div className="flex items-center gap-1 min-w-0">
                    {formData.date === '??' || formData.date === '??.??' ? (
                      <div
                        className={`flex-1 min-w-0 h-8 rounded-xl px-2.5 text-xs font-semibold flex items-center justify-between transition-opacity ${
                          isDateDisabled
                            ? 'bg-amber-500/5 text-amber-300/40 border border-amber-500/15 opacity-40 pointer-events-none select-none'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        <span className="truncate">{isDateDisabled ? (isBook ? 'Okunuyor (Kilitli)' : 'Devam Ediyor (Kilitli)') : 'Bilinmiyor (??)'}</span>
                      </div>
                    ) : (
                      <input
                        id="detail-date-input"
                        type={isDateDisabled ? 'text' : 'date'}
                        value={isDateDisabled ? '' : (formData.date || '')}
                        disabled={isDateDisabled}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleChange('date', val);
                          if (val && val !== '??' && val !== '??.??') {
                            setRememberedDate(val);
                          }
                        }}
                        placeholder={isDateDisabled ? (isGame ? 'Oynanıyor (Kilitli)' : isBook ? 'Okunuyor (Kilitli)' : 'İzleniyor (Kilitli)') : ''}
                        className={`flex-1 min-w-0 h-8 border rounded-xl px-2 text-xs focus:outline-none transition-all ${
                          isDateDisabled
                            ? 'bg-black/50 text-neutral-500 border-white/5 opacity-50 cursor-not-allowed pointer-events-none select-none placeholder:text-neutral-500 placeholder:italic'
                            : 'bg-black/40 text-neutral-200 border-white/10 focus:border-neutral-400'
                        }`}
                      />
                    )}
                    <button
                      type="button"
                      id="toggle-unknown-date-btn"
                      disabled={isDateDisabled}
                      onClick={() => {
                        if (formData.date === '??' || formData.date === '??.??' || formData.date === '') {
                          const today = new Date().toISOString().split('T')[0];
                          handleChange('date', rememberedDate || today);
                        } else {
                          handleChange('date', '??');
                        }
                      }}
                      title={isDateDisabled ? (isBook ? 'Kitap henüz okunuyor olduğu için tarih kilitlidir' : 'Yapım tamamlanmadığı için tarih kilitlidir') : 'Tarih Bilinmiyor (??)'}
                      className={`h-8 w-8 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center shrink-0 ${
                        isDateDisabled
                          ? 'opacity-30 cursor-not-allowed pointer-events-none bg-white/5 text-neutral-500 border-white/5'
                          : formData.date === '??' || formData.date === '??.??'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-pointer'
                          : 'bg-white/5 text-neutral-400 border-white/10 hover:text-white hover:bg-white/10 cursor-pointer'
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Description & Notes Area (Moved Up to Top Section next to Poster) */}
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                    KONUSU
                  </label>
                  {!isReadOnly && aiDescState && (
                    <div className="flex items-center gap-1">
                      {aiDescState.isActive ? (
                        <button
                          type="button"
                          onClick={() => {
                            handleChange('desc', aiDescState.original);
                            setAiDescState((prev) => (prev ? { ...prev, isActive: false } : null));
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
                            handleChange('desc', aiDescState.suggested);
                            setAiDescState((prev) => (prev ? { ...prev, isActive: true } : null));
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
                <textarea
                  id="detail-desc-textarea"
                  rows={3}
                  value={formData.desc}
                  onChange={(e) => {
                    handleChange('desc', e.target.value);
                    if (aiDescState?.isActive) {
                      setAiDescState((prev) => (prev ? { ...prev, isActive: false } : null));
                    }
                  }}
                  placeholder="Yıllar sonra hatırlamak için notlar, hisler, önemli detaylar..."
                  className={`w-full text-slate-200 rounded-xl p-2.5 text-xs leading-relaxed focus:outline-none focus:border-blue-500 resize-y custom-scrollbar min-h-[82px] transition-all ${
                    aiDescState?.isActive
                      ? 'border border-emerald-500/80 ring-1 ring-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.18)] bg-emerald-500/[0.04]'
                      : 'border border-white/10 bg-black/30'
                  }`}
                />
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
              /* Book Status Options (Format, Okunuyor, Yarım Bırakıldı, Anki) */
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                {/* Format Dropdown - Compact & Neat */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <label htmlFor="detail-book-format-select" className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1 shrink-0">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> Format:
                  </label>
                  <select
                    id="detail-book-format-select"
                    value={bookFormat}
                    onChange={(e) => setBookFormat(e.target.value as BookFormat)}
                    className="bg-black/30 text-slate-200 border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
                  >
                    <option value="Ciltsiz" className="bg-slate-900 text-white">📖 Ciltsiz</option>
                    <option value="Ciltli" className="bg-slate-900 text-white">📚 Ciltli</option>
                    <option value="E-Kitap" className="bg-slate-900 text-white">📱 E-Kitap</option>
                    <option value="Sesli Kitap" className="bg-slate-900 text-white">🎧 Sesli Kitap</option>
                  </select>
                </div>

                {/* Status Badges: Okunuyor, Yarım Bırakıldı, Anki */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
                  {/* Okunuyor... */}
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap">
                    <input
                      id="detail-book-reading-cb"
                      type="checkbox"
                      checked={reading}
                      onChange={() => handleBookStatusToggle('reading')}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-0 cursor-pointer"
                    />
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-xs">Okunuyor...</span>
                  </label>

                  {/* Yarım Bırakıldı */}
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap">
                    <input
                      id="detail-book-dropped-cb"
                      type="checkbox"
                      checked={!!formData.dropped}
                      onChange={() => handleBookStatusToggle('dropped')}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-rose-500 focus:ring-0 cursor-pointer"
                    />
                    <PauseCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="text-xs">Yarım Bırakıldı</span>
                  </label>

                  {/* Anki */}
                  <div className="flex items-center gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap">
                      <input
                        id="detail-book-anki-cb"
                        type="checkbox"
                        checked={!!formData.anki}
                        onChange={(e) => {
                          handleChange('anki', e.target.checked);
                          if (!e.target.checked) setAnkiTagSelectionMode(false);
                        }}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs">Anki</span>
                    </label>
                    {formData.anki && (
                      <button
                        type="button"
                        id="btn-open-anki-editor-detail-book"
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
            ) : !isGame ? (
              /* Media Status Options (İzlenen, Takip, Yarım Bırakıldı, Anki) */
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <input
                    id="detail-watching-cb"
                    type="checkbox"
                    checked={!!formData.watching}
                    onChange={() => handleMediaStatusToggle('watching')}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <Tv className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="text-xs">İzleniyor...</span>
                </label>

                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <input
                    id="detail-following-cb"
                    type="checkbox"
                    checked={!!formData.following}
                    onChange={() => handleMediaStatusToggle('following')}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <Bookmark className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="text-xs">Takip</span>
                  {formData.following && (
                    <button
                      type="button"
                      id="btn-toggle-detail-follow-details"
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
                      className={`ml-auto p-1 rounded-md transition-colors cursor-pointer border ${
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

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                  <input
                    id="detail-dropped-cb"
                    type="checkbox"
                    checked={!!formData.dropped}
                    onChange={() => handleMediaStatusToggle('dropped')}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-rose-500 focus:ring-0 cursor-pointer"
                  />
                  <PauseCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="text-xs">Yarım Bırakıldı</span>
                </label>

                <div className="flex items-center gap-1.5">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                    <input
                      id="detail-anki-cb"
                      type="checkbox"
                      checked={!!formData.anki}
                      onChange={(e) => {
                        handleChange('anki', e.target.checked);
                        if (!e.target.checked) setAnkiTagSelectionMode(false);
                      }}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                    <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-xs">Anki</span>
                  </label>
                  {formData.anki && (
                    <button
                      type="button"
                      id="btn-open-anki-editor-detail-media"
                      onClick={() => setShowAnkiEditor(true)}
                      className="p-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs"
                      title="Anki Editörü"
                    >
                      <Crop className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Takip Listesi Gelişmeleri & Beklenen Tarih Kutusu (Takip aktifken ve butona tıklandığında açılır, bilgiler asla silinmez) */}
              {formData.following && showFollowDetails && (
                <div
                  id="detail-follow-info-box"
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
                        id="detail-expected-date-input"
                        type="text"
                        value={formData.expectedDate || ''}
                        onChange={(e) => handleChange('expectedDate', e.target.value)}
                        placeholder="Örn: 2027 başı, 2026 Güz, TBA..."
                        className="w-full bg-black/40 text-slate-100 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-sky-400/60 transition-colors placeholder:text-neutral-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        Gelişme Notu / Açıklama
                      </label>
                      <textarea
                        id="detail-follow-notes-input"
                        rows={4}
                        value={formData.followNotes || ''}
                        onChange={(e) => handleChange('followNotes', e.target.value)}
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
                    id="detail-game-status-select"
                    value={formData.status || 'Oynanıyor'}
                    onChange={(e) => {
                      const next = e.target.value as GameStatus;
                      setFormData((prev) => {
                        if (next === 'Tamamlandı') {
                          const restoredDate = prev.date || rememberedDate || new Date().toISOString().split('T')[0];
                          return {
                            ...prev,
                            status: next,
                            date: restoredDate,
                          };
                        } else {
                          if (prev.date && prev.date !== '??' && prev.date !== '??.??') {
                            setRememberedDate(prev.date);
                          }
                          return {
                            ...prev,
                            status: next,
                            date: prev.date || rememberedDate || '',
                          };
                        }
                      });
                    }}
                    className="w-full bg-black/30 text-slate-200 border border-white/10 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Oynanıyor" className="bg-slate-900 text-white">🎮 Oynanıyor</option>
                    <option value="Tamamlandı" className="bg-slate-900 text-white">✅ Tamamlandı</option>
                    <option value="Yarım Bırakıldı" className="bg-slate-900 text-white">⏸ Yarım Bırakıldı</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
                    <Trophy className="w-3 h-3 text-amber-400" /> Başarım (%)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      id="detail-ach-input"
                      type="number"
                      min="0"
                      max={formData.achMax || 100}
                      placeholder="0"
                      value={formData.achPercent ?? ''}
                      onChange={(e) =>
                        handleChange(
                          'achPercent',
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="w-full bg-black/30 text-amber-300 font-semibold border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-slate-400 text-xs">/</span>
                    <input
                      type="number"
                      min="1"
                      title="Üst limit"
                      value={formData.achMax ?? 100}
                      onChange={(e) =>
                        handleChange('achMax', Number(e.target.value) || 100)
                      }
                      className="w-14 bg-black/30 text-slate-300 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-center focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-sky-400" /> Oynanma (Saat)
                  </label>
                  <input
                    id="detail-hours-input"
                    type="number"
                    min="0"
                    value={formData.hours ?? 0}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      handleChange('hours', Number(e.target.value) || 0)
                    }
                    className="w-full bg-black/30 text-sky-300 font-semibold border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-start h-[30px] sm:h-[32px] mb-0.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap">
                      <input
                        id="detail-anki-game-cb"
                        type="checkbox"
                        checked={!!formData.anki}
                        onChange={(e) => {
                          handleChange('anki', e.target.checked);
                          if (!e.target.checked) setAnkiTagSelectionMode(false);
                        }}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                      <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-xs">Anki</span>
                    </label>
                    {formData.anki && (
                      <button
                        type="button"
                        id="btn-open-anki-editor-detail-game"
                        onClick={() => setShowAnkiEditor(true)}
                        className="p-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer shadow-xs shrink-0"
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
                {formData.anki && (
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
              {formData.anki && ankiTagSelectionMode && (
                <div className="flex items-center gap-2">
                  {ankiNotice ? (
                    <span className="text-[11px] text-amber-400 font-medium animate-in fade-in">
                      {ankiNotice}
                    </span>
                  ) : (formData.ankiFrontTags || []).length > 0 ? (
                    <span className="text-[11px] text-emerald-400 font-medium animate-in fade-in">
                      {(formData.ankiFrontTags || []).length}/2 seçili
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
                    placeholder="Örn: Fyodor Dostoyevski, J.R.R. Tolkien..."
                    tags={author}
                    onChange={(newTags) => handleTagFieldChange('authors', 'author', newTags)}
                    availableTags={availableAuthorTags}
                    tagCounts={authorTagCounts}
                    icon={<PenTool className="w-3 h-3 text-amber-400" />}
                    highlightNewTags={tagDiffs.authors?.newTags}
                    highlightRemovedTags={tagDiffs.authors?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('authors', tag)}
                    hideCount={!!aiTagStates.authors}
                    isAnkiMode={Boolean(formData.anki && ankiTagSelectionMode)}
                    isEligibleForAnki={true}
                    selectedAnkiTags={formData.ankiFrontTags || []}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      aiTagStates.authors && (
                        aiTagStates.authors.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('authors')}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('authors')}
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
                    placeholder="Örn: İş Bankası Kültür Yayınları, İthaki, Can..."
                    tags={publisher}
                    onChange={(newTags) => handleTagFieldChange('publishers', 'publisher', newTags)}
                    availableTags={availablePublisherTags}
                    tagCounts={publisherTagCounts}
                    icon={<Building2 className="w-3 h-3 text-purple-400" />}
                    highlightNewTags={tagDiffs.publishers?.newTags}
                    highlightRemovedTags={tagDiffs.publishers?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('publishers', tag)}
                    hideCount={!!aiTagStates.publishers}
                    isAnkiMode={Boolean(formData.anki && ankiTagSelectionMode)}
                    isEligibleForAnki={true}
                    selectedAnkiTags={formData.ankiFrontTags || []}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      aiTagStates.publishers && (
                        aiTagStates.publishers.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('publishers')}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('publishers')}
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
                    placeholder="Örn: Nihal Yalaza Taluy, Roza Hakmen..."
                    tags={translator}
                    onChange={(newTags) => handleTagFieldChange('translators', 'translator', newTags)}
                    availableTags={availableTranslatorTags}
                    tagCounts={translatorTagCounts}
                    icon={<Globe className="w-3 h-3 text-sky-400" />}
                    highlightNewTags={tagDiffs.translators?.newTags}
                    highlightRemovedTags={tagDiffs.translators?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('translators', tag)}
                    hideCount={!!aiTagStates.translators}
                    isAnkiMode={Boolean(formData.anki && ankiTagSelectionMode)}
                    isEligibleForAnki={true}
                    selectedAnkiTags={formData.ankiFrontTags || []}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      aiTagStates.translators && (
                        aiTagStates.translators.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('translators')}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('translators')}
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
                    placeholder="Örn: Klasik, Bilim Kurgu, Felsefe, Distopya..."
                    tags={formData.genre || []}
                    onChange={(newTags) => handleTagFieldChange('genres', 'genre', newTags)}
                    availableTags={availableBookGenreTags}
                    tagCounts={bookGenreTagCounts}
                    icon={<Tags className="w-3 h-3 text-emerald-400" />}
                    highlightNewTags={tagDiffs.genres?.newTags}
                    highlightRemovedTags={tagDiffs.genres?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('genres', tag)}
                    hideCount={!!aiTagStates.genres}
                    isAnkiMode={Boolean(formData.anki && ankiTagSelectionMode)}
                    isEligibleForAnki={false}
                    rightElement={
                      aiTagStates.genres && (
                        aiTagStates.genres.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('genres', 'genre')}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('genres', 'genre')}
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
                    tags={formData.firm || []}
                    onChange={(newTags) => handleTagFieldChange('firms', 'firm', newTags)}
                    availableTags={availableFirmTags}
                    tagCounts={firmTagCounts}
                    icon={<Building2 className="w-3 h-3 text-purple-400" />}
                    highlightNewTags={tagDiffs.firms?.newTags}
                    highlightRemovedTags={tagDiffs.firms?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('firms', tag)}
                    hideCount={!isReadOnly && !!aiTagStates.firms}
                    isAnkiMode={Boolean(formData.anki && ankiTagSelectionMode)}
                    isEligibleForAnki={true}
                    selectedAnkiTags={formData.ankiFrontTags || []}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      !isReadOnly && aiTagStates.firms && (
                        aiTagStates.firms.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('firms', 'firm')}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('firms', 'firm')}
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
                    tags={formData.director || []}
                    onChange={(newTags) => handleTagFieldChange('directors', 'director', newTags)}
                    availableTags={availableDirectorTags}
                    tagCounts={directorTagCounts}
                    icon={<Clapperboard className="w-3 h-3 text-amber-400" />}
                    highlightNewTags={tagDiffs.directors?.newTags}
                    highlightRemovedTags={tagDiffs.directors?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('directors', tag)}
                    hideCount={!isReadOnly && !!aiTagStates.directors}
                    isAnkiMode={Boolean(formData.anki && ankiTagSelectionMode)}
                    isEligibleForAnki={true}
                    selectedAnkiTags={formData.ankiFrontTags || []}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      !isReadOnly && aiTagStates.directors && (
                        aiTagStates.directors.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('directors', 'director')}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('directors', 'director')}
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
                    tags={formData.actors || []}
                    onChange={(newTags) => handleTagFieldChange('actors', 'actors', newTags)}
                    availableTags={availableActorsTags}
                    tagCounts={actorsTagCounts}
                    icon={<Users className="w-3 h-3 text-sky-400" />}
                    highlightNewTags={tagDiffs.actors?.newTags}
                    highlightRemovedTags={tagDiffs.actors?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('actors', tag)}
                    hideCount={!isReadOnly && !!aiTagStates.actors}
                    isAnkiMode={Boolean(formData.anki && ankiTagSelectionMode)}
                    isEligibleForAnki={true}
                    selectedAnkiTags={formData.ankiFrontTags || []}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      !isReadOnly && aiTagStates.actors && (
                        aiTagStates.actors.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('actors', 'actors')}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('actors', 'actors')}
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
                    tags={formData.genre || []}
                    onChange={(newTags) => handleTagFieldChange('genres', 'genre', newTags)}
                    availableTags={availableMediaGenreTags}
                    tagCounts={mediaGenreTagCounts}
                    icon={<Tags className="w-3 h-3 text-emerald-400" />}
                    highlightNewTags={tagDiffs.genres?.newTags}
                    highlightRemovedTags={tagDiffs.genres?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('genres', tag)}
                    hideCount={!isReadOnly && !!aiTagStates.genres}
                    isAnkiMode={Boolean(formData.anki && ankiTagSelectionMode)}
                    isEligibleForAnki={false}
                    rightElement={
                      !isReadOnly && aiTagStates.genres && (
                        aiTagStates.genres.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('genres', 'genre')}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('genres', 'genre')}
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
                    tags={formData.developer || []}
                    onChange={(newTags) => handleTagFieldChange('developers', 'developer', newTags)}
                    availableTags={availableDevTags}
                    tagCounts={devTagCounts}
                    icon={<Building2 className="w-3 h-3 text-purple-400" />}
                    highlightNewTags={tagDiffs.developers?.newTags}
                    highlightRemovedTags={tagDiffs.developers?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('developers', tag)}
                    hideCount={!isReadOnly && !!aiTagStates.developers}
                    isAnkiMode={Boolean(formData.anki && ankiTagSelectionMode)}
                    isEligibleForAnki={true}
                    selectedAnkiTags={formData.ankiFrontTags || []}
                    onToggleAnkiTag={handleToggleAnkiFrontTag}
                    rightElement={
                      !isReadOnly && aiTagStates.developers && (
                        aiTagStates.developers.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('developers', 'developer')}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('developers', 'developer')}
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
                    tags={formData.genre || []}
                    onChange={(newTags) => handleTagFieldChange('genres', 'genre', newTags)}
                    availableTags={availableGameGenreTags}
                    tagCounts={gameGenreTagCounts}
                    icon={<Tags className="w-3 h-3 text-emerald-400" />}
                    highlightNewTags={tagDiffs.genres?.newTags}
                    highlightRemovedTags={tagDiffs.genres?.removedTags}
                    onRestoreRemovedTag={(tag) => handleRestoreRemovedTag('genres', tag)}
                    hideCount={!isReadOnly && !!aiTagStates.genres}
                    isAnkiMode={Boolean(formData.anki && ankiTagSelectionMode)}
                    isEligibleForAnki={false}
                    rightElement={
                      !isReadOnly && aiTagStates.genres && (
                        aiTagStates.genres.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('genres', 'genre')}
                            title="Eski haline dön"
                            className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-all cursor-pointer shadow-xs"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleTagField('genres', 'genre')}
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
                <span>Karakterler & Kadro</span>
              </div>
              <div className="flex items-center gap-2">
                {!isReadOnly && aiCharState && (
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
                  id="btn-add-character-row"
                  onClick={handleAddCharacter}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-semibold text-xs border border-sky-500/30 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Karakter Ekle</span>
                </button>
              </div>
            </div>

            {/* Global Actor Autocomplete Datalist */}
            <datalist id="actor-autocomplete-list">
              {allActorSuggestions.map((act) => (
                <option key={act} value={act} />
              ))}
            </datalist>

            {/* Character Rows List */}
            {(!formData.characters || formData.characters.length === 0) ? (
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-center text-xs text-slate-400">
                Henüz eklenmiş bir karakter bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                {formData.characters.map((char, index) => {
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
                        id={`detail-char-img-${index}`}
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const optimized = await optimizeImageFile(file, 1200, 1600, 0.95);
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
                            htmlFor={`detail-char-img-${index}`}
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

                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Karakter İsmi (örn: Yuta Okkotsu)"
                        value={char.name}
                        onChange={(e) =>
                          handleUpdateCharacter(index, 'name', e.target.value)
                        }
                        className="w-full bg-black/40 text-slate-200 placeholder-slate-500 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-sky-500"
                      />
                    </div>

                    <div className="flex-1 flex items-center gap-1">
                      <input
                        type="text"
                        list="actor-autocomplete-list"
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

          {/* Kitap İçin: Beğenilen Sözler / Alıntılar Bölümü (Karakterler ile Seri Bağlantısı Arasında) */}
          {isBook && (
            <>
              <div className="border-t-2 border-white/20 my-4" />
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Quote className="w-3.5 h-3.5 text-amber-400" />
                    <span>Beğenilen Sözler / Alıntılar ({quotes.length})</span>
                  </div>
                  <button
                    type="button"
                    id="btn-detail-add-quote-row"
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

          {/* Prominent Separator between Characters and Series */}
          <div className="border-t-2 border-white/20 my-4" />

          {/* SERİ / EVREN BİLGİSİ (Karakterler & Kadro Altında) */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Seri / Evren Bağlantısı</span>
              <div className="relative inline-flex items-center group/ftip">
                <button
                  type="button"
                  onClick={() => setShowFranchiseTooltip(!showFranchiseTooltip)}
                  className="p-0.5 text-slate-400 hover:text-indigo-300 rounded transition-colors cursor-pointer"
                  title="Bilgi"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
                <div
                  className={`absolute left-6 top-1/2 -translate-y-1/2 z-50 w-64 p-2.5 rounded-xl bg-slate-900/95 border border-indigo-500/30 text-[11px] text-slate-200 font-normal leading-relaxed shadow-xl backdrop-blur-md transition-opacity pointer-events-none ${
                    showFranchiseTooltip ? 'opacity-100' : 'opacity-0 group-hover/ftip:opacity-100'
                  }`}
                >
                  Aynı evrene veya seriye ait yapımları (örn: film, anime, dizi, oyun) birbirine bağlamak için ortak bir seri adı belirleyin.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Seri / Evren Adı
                </label>
                <input
                  id="detail-series-name-input"
                  type="text"
                  list="detail-series-name-suggestions"
                  value={formData.seriesName || ''}
                  onChange={(e) => handleChange('seriesName', e.target.value)}
                  placeholder="Örn: Jujutsu Kaisen, Harry Potter, Witcher..."
                  className="w-full bg-black/40 text-slate-100 border border-white/10 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-400 transition-colors placeholder:text-neutral-500"
                />
                <datalist id="detail-series-name-suggestions">
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
                  id="detail-series-order-input"
                  type="number"
                  step="any"
                  min="0"
                  value={formData.seriesOrder ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    handleChange(
                      'seriesOrder',
                      val !== '' && !isNaN(Number(val)) ? Number(val) : undefined
                    );
                  }}
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
            id="save-detail-form-btn"
            type="button"
            onClick={() => handleSaveForm()}
            className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-lg shadow-blue-600/30 cursor-pointer shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Kaydet</span>
          </button>
        </div>
      </div>

      {/* AI Process Log Modal */}
      {showAiLogModal && (
        <AiProcessLogModal
          isOpen={showAiLogModal}
          onClose={() => setShowAiLogModal(false)}
          title={formData.title}
          logs={aiLogs}
          statusType={aiStatusType}
          usedModel={aiUsedModel}
        />
      )}

      {/* Centered In-App Delete Confirmation Modal */}
      {deleteConfirmDialog && (
        <CustomDialog
          options={deleteConfirmDialog}
          onClose={() => setDeleteConfirmDialog(null)}
        />
      )}

      {/* Anki Görsel & Blur Editörü */}
      {showAnkiEditor && (
        <AnkiEditorModal
          isOpen={showAnkiEditor}
          itemTitle={formData.title}
          initialThumbnail={formData.thumbnail}
          initialMainBlurs={formData.ankiMainBlurs || []}
          initialExtraImages={formData.ankiExtraImages || []}
          onApply={(data) => {
            setFormData((prev) => ({
              ...prev,
              anki: true,
              thumbnail: data.thumbnail || prev.thumbnail,
              ankiMainBlurs: data.mainBlurs,
              ankiExtraImages: data.extraImages,
              ankiCard: prev.ankiCard || initAnkiCard(),
            }));
          }}
          onClose={() => setShowAnkiEditor(false)}
        />
      )}
    </div>
  );
};
