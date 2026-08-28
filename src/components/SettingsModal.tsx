import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  AppData,
  Category,
  MainTabType,
  AppTheme,
  ViewSettings,
  ArchiveItem,
  TagFieldKey,
  MEDIA_TAG_FIELDS,
  GAME_TAG_FIELDS,
  UiExperimentsState,
} from '../types';
import { createDefaultTierRows, INITIAL_DATA } from '../data/initialData';
import {
  downloadJsonFile,
  parseUploadedJson,
  downloadPhoneHtml,
  exportAppDataToZip,
  importAppDataFromZip,
  cleanOrphanImagesInFolder,
  generateFullBackupInFolder,
  listFolderBackups,
  restoreFromFolderBackup,
  FolderBackupItem,
  getFormattedDateForFilename,
  exportTierListBackup,
  parseTierListBackupFile,
  checkDirectoryHandleAccessibility,
} from '../utils/fileSystem';
import {
  getFieldScopedTags,
  getFieldScopedTagCounts,
  renameTagInItems,
  removeTagFromItems,
} from '../utils/tagUtils';
import { CustomDialog, DialogOptions } from './CustomDialog';
import {
  X,
  Plus,
  Trash2,
  FolderSync,
  Download,
  Upload,
  Smartphone,
  CheckCircle,
  AlertCircle,
  HardDrive,
  Layers,
  Settings,
  Palette,
  Keyboard,
  Check,
  RotateCcw,
  Tags,
  Edit2,
  Film,
  Gamepad2,
  Building2,
  Clapperboard,
  Users,
  FileArchive,
  Sparkles,
  Search,
  ShieldCheck,
  FolderArchive,
  History,
  Calendar,
  Clock,
  FolderTree,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';

interface SettingsModalProps {
  appData: AppData;
  activeMainTab: MainTabType;
  dirHandle: FileSystemDirectoryHandle | null;
  viewSettings: ViewSettings;
  onUpdateViewSettings: (newSettings: Partial<ViewSettings>) => void;
  uiExperiments?: UiExperimentsState;
  onUpdateUiExperiments?: (updater: (prev: UiExperimentsState) => UiExperimentsState) => void;
  onConnectFolder: () => Promise<void>;
  onDisconnectFolder: () => void;
  onUpdateCategories: (mainTab: MainTabType, newCategories: Category[]) => void;
  onUpdateItems?: (newItems: ArchiveItem[]) => void;
  onSelectItem?: (item: ArchiveItem) => void;
  onReplaceAllData: (newData: AppData) => void;
  onClose: () => void;
}

interface ThemeOption {
  id: AppTheme;
  name: string;
  desc: string;
  bgPreview: string;
  accentPreview: string;
  cardPreview: string;
  borderPreview: string;
}

const THEMES: ThemeOption[] = [
  {
    id: 'pure-dark',
    name: 'Saf Siyah (OLED)',
    desc: 'Maksimum kontrast, zifiri siyah zemin (#000000) ve sade metalik çizgiler',
    bgPreview: 'bg-[#000000]',
    cardPreview: 'bg-[#0c0c0e]',
    accentPreview: 'bg-white',
    borderPreview: 'border-white/20',
  },
  {
    id: 'charcoal-gray',
    name: 'Koyu Gri (Dark Slate / Charcoal)',
    desc: 'Çok koyu, şık ve mat antrasit/gri zemin (#0f1115)',
    bgPreview: 'bg-[#0f1115]',
    cardPreview: 'bg-[#181b22]',
    accentPreview: 'bg-slate-300',
    borderPreview: 'border-slate-500/30',
  },
  {
    id: 'nordic-frost',
    name: 'Kuzey Işıkları (Nordic Frost)',
    desc: 'Soğuk antrasit zemin üzerinde ferah buzul mavisi detaylar (#0b131e)',
    bgPreview: 'bg-[#0b131e]',
    cardPreview: 'bg-[#142030]',
    accentPreview: 'bg-sky-400',
    borderPreview: 'border-sky-500/30',
  },
  {
    id: 'crimson-night',
    name: 'Kızıl Gece (Crimson Noir)',
    desc: 'Derin kadife siyah zemin üzerinde zarif yakut ve kızıl ambiyans (#12080a)',
    bgPreview: 'bg-[#12080a]',
    cardPreview: 'bg-[#1f0f13]',
    accentPreview: 'bg-rose-500',
    borderPreview: 'border-rose-500/30',
  },
  {
    id: 'emerald-abyss',
    name: 'Zümrüt Derinliği (Emerald Abyss)',
    desc: 'Büyüleyici derin çam yeşili zemin üzerinde parlak zümrüt detaylar (#071510)',
    bgPreview: 'bg-[#071510]',
    cardPreview: 'bg-[#102920]',
    accentPreview: 'bg-emerald-400',
    borderPreview: 'border-emerald-500/30',
  },
  {
    id: 'amethyst-twilight',
    name: 'Ametist Alacakaranlık (Amethyst Twilight)',
    desc: 'Koyu gece moru zemin üzerinde ışıltılı leylak ve lavanta tonları (#100a1c)',
    bgPreview: 'bg-[#100a1c]',
    cardPreview: 'bg-[#211638]',
    accentPreview: 'bg-purple-400',
    borderPreview: 'border-purple-500/30',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  appData,
  activeMainTab,
  dirHandle,
  viewSettings,
  onUpdateViewSettings,
  uiExperiments = {
    toolbarStyle: 'default',
    cardGlow: false,
    cardVignette: 'none',
    cardRadius: 'normal',
    cardHoverMotion: 'lift',
    bgAtmosphere: 'default',
    badgeStyle: 'default',
    badgeDensity: 'full',
  },
  onUpdateUiExperiments,
  onConnectFolder,
  onDisconnectFolder,
  onUpdateCategories,
  onUpdateItems,
  onSelectItem,
  onReplaceAllData,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'tags' | 'themes' | 'shortcuts' | 'storage'>('categories');
  const [settingsMainTab, setSettingsMainTab] = useState<MainTabType>(activeMainTab);
  const [tagFieldKey, setTagFieldKey] = useState<TagFieldKey>('firm');
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [activeTagPopover, setActiveTagPopover] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [importingZip, setImportingZip] = useState(false);
  const [cleaningImages, setCleaningImages] = useState(false);
  const [takingFullBackup, setTakingFullBackup] = useState(false);
  const [showAdvancedStorage, setShowAdvancedStorage] = useState(false);
  const [isBackupsModalOpen, setIsBackupsModalOpen] = useState(false);
  const [folderBackups, setFolderBackups] = useState<FolderBackupItem[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);

  // Custom in-app dialog state
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipFileInputRef = useRef<HTMLInputElement>(null);
  const tierRestoreInputRef = useRef<HTMLInputElement>(null);

  const currentTheme = viewSettings.theme || 'pure-dark';
  const cats = appData.categories[settingsMainTab] || [];

  const validCatIds = useMemo(() => new Set(cats.map((c) => c.id)), [cats]);
  const uncategorizedItems = useMemo(
    () =>
      appData.items.filter(
        (it) => it.mainTab === settingsMainTab && (!it.cat || !validCatIds.has(it.cat))
      ),
    [appData.items, settingsMainTab, validCatIds]
  );

  // Active tag field list based on media/game
  const currentTagFields = settingsMainTab === 'media' ? MEDIA_TAG_FIELDS : GAME_TAG_FIELDS;

  // Make sure tagFieldKey matches active settingsMainTab
  useEffect(() => {
    if (settingsMainTab === 'media' && tagFieldKey === 'developer') {
      setTagFieldKey('firm');
    } else if (
      settingsMainTab === 'game' &&
      (tagFieldKey === 'firm' || tagFieldKey === 'director' || tagFieldKey === 'actors')
    ) {
      setTagFieldKey('developer');
    }
  }, [settingsMainTab, tagFieldKey]);

  // Tag Management Handlers
  const handleRenameTag = (oldTag: string) => {
    setDialogOptions({
      type: 'prompt',
      title: 'Etiketi Yeniden Adlandır',
      promptDefaultValue: oldTag,
      promptPlaceholder: 'Yeni etiket adı...',
      confirmText: 'Kaydet',
      onConfirm: (newTag) => {
        if (!newTag || newTag === oldTag || !onUpdateItems) return;
        const updated = renameTagInItems(
          appData.items,
          settingsMainTab,
          tagFieldKey,
          oldTag,
          newTag
        );
        onUpdateItems(updated);
      },
    });
  };

  const handleDeleteTag = (tagToDelete: string) => {
    const countsMap = getFieldScopedTagCounts(appData.items, settingsMainTab, tagFieldKey);
    const count = countsMap.get(tagToDelete) || 0;

    setDialogOptions({
      type: 'confirm',
      title: 'Etiketi Sil',
      message: `"${tagToDelete}" etiketini bu alandaki ${count} yapımın tümünden kaldırmak istediğinize emin misiniz?`,
      isDestructive: true,
      confirmText: 'Etiketi Kaldır',
      onConfirm: () => {
        if (!onUpdateItems) return;
        const updated = removeTagFromItems(
          appData.items,
          settingsMainTab,
          tagFieldKey,
          tagToDelete
        );
        onUpdateItems(updated);
      },
    });
  };

  // Verify folder handle accessibility on mount / tab change (e.g. if folder was renamed, moved, or deleted)
  useEffect(() => {
    let isCancelled = false;
    if (dirHandle) {
      checkDirectoryHandleAccessibility(dirHandle).then((isValid) => {
        if (!isCancelled && !isValid && onDisconnectFolder) {
          onDisconnectFolder();
        }
      });
    }
    return () => {
      isCancelled = true;
    };
  }, [dirHandle, activeTab, onDisconnectFolder]);

  // Close with Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !dialogOptions) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, dialogOptions]);

  // Category Actions
  const handleRenameCategory = (catId: string, currentName: string) => {
    setDialogOptions({
      type: 'prompt',
      title: 'Kategori Adını Değiştir',
      promptDefaultValue: currentName,
      promptPlaceholder: 'Yeni kategori adı...',
      confirmText: 'Güncelle',
      onConfirm: (newName) => {
        if (!newName || newName === currentName) return;
        const updated = cats.map((c) =>
          c.id === catId ? { ...c, name: newName } : c
        );
        onUpdateCategories(settingsMainTab, updated);
      },
    });
  };

  const handleToggleTierList = (cat: Category) => {
    if (!cat.tierEnabled) {
      // Enable tier list
      const updated = cats.map((c) =>
        c.id === cat.id
          ? {
              ...c,
              tierEnabled: true,
              tierRows: c.tierRows.length > 0 ? c.tierRows : createDefaultTierRows(),
            }
          : c
      );
      onUpdateCategories(settingsMainTab, updated);
    } else {
      // Disabling tier list: check if placed cards exist
      const hasPlaced = appData.items.some(
        (it) => it.mainTab === settingsMainTab && it.cat === cat.id && it.tier
      );
      if (hasPlaced) {
        setDialogOptions({
          type: 'confirm',
          title: 'Tier List Devre Dışı Bırakılsın mı?',
          message: `"${cat.name}" kategorisinde yerleştirilmiş kartlar bulunuyor. Kapatırsanız tüm yerleştirmeler sıfırlanıp havuza geri dönecektir. Devam etmek istiyor musunuz?`,
          isDestructive: true,
          confirmText: 'Kapat ve Havuza Al',
          onConfirm: () => {
            const updated = cats.map((c) =>
              c.id === cat.id ? { ...c, tierEnabled: false } : c
            );
            onUpdateCategories(settingsMainTab, updated);

            if (onUpdateItems) {
              const updatedItems = appData.items.map((it) => {
                if (it.mainTab === settingsMainTab && it.cat === cat.id && it.tier) {
                  return { ...it, tier: null };
                }
                return it;
              });
              onUpdateItems(updatedItems);
            }
          },
        });
        return;
      }

      const updated = cats.map((c) =>
        c.id === cat.id ? { ...c, tierEnabled: false } : c
      );
      onUpdateCategories(settingsMainTab, updated);
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    const itemCount = appData.items.filter(
      (it) => it.mainTab === settingsMainTab && it.cat === cat.id
    ).length;

    setDialogOptions({
      type: 'confirm',
      title: 'Kategoriyi Sil',
      message:
        itemCount > 0
          ? `"${cat.name}" kategorisinde ${itemCount} adet yapım var. Kategoriyi silerseniz yapımlar silinmez, "Kategorisiz" havuzuna aktarılır. Devam etmek istiyor musunuz?`
          : `"${cat.name}" kategorisini silmek istediğinize emin misiniz?`,
      isDestructive: true,
      confirmText: 'Kategoriyi Sil',
      onConfirm: () => {
        const updated = cats.filter((c) => c.id !== cat.id);
        onUpdateCategories(settingsMainTab, updated);

        if (onUpdateItems) {
          const updatedItems = appData.items.map((it) => {
            if (it.mainTab === settingsMainTab && it.cat === cat.id) {
              return { ...it, sub: null };
            }
            return it;
          });
          onUpdateItems(updatedItems);
        }
      },
    });
  };

  const handleCleanOrphanImages = async () => {
    if (!dirHandle) return;
    setCleaningImages(true);
    try {
      const res = await cleanOrphanImagesInFolder(dirHandle, appData.items);
      if (res.cleanedCount === 0) {
        setDialogOptions({
          type: 'alert',
          title: 'Disk Düzeni Kusursuz',
          message: 'Diskinizdeki "images/" klasörü kontrol edildi: Hiçbir gereksiz/öksüz afiş görseli bulunamadı. Tüm dosyalarınız düzenli.',
        });
      } else {
        setDialogOptions({
          type: 'alert',
          title: 'Öksüz Görsel Temizliği Tamamlandı',
          message: `Temizlik tamamlandı! Arşivde kaydı bulunmayan ${res.cleanedCount} adet artık görsel dosyası diskten silindi:\n\n${res.deletedFiles.slice(0, 8).join(', ')}${res.deletedFiles.length > 8 ? '...' : ''}`,
        });
      }
    } catch (err: any) {
      setDialogOptions({
        type: 'alert',
        title: 'Temizlik Hatası',
        message: 'Disk temizliği sırasında bir hata oluştu: ' + (err.message || err),
      });
    } finally {
      setCleaningImages(false);
    }
  };

  const handleAddSubgroup = (catId: string) => {
    setDialogOptions({
      type: 'prompt',
      title: 'Yeni Alt Grup Ekle',
      promptPlaceholder: 'Ör: Yerli, Yabancı, Shonen, Souls...',
      confirmText: 'Ekle',
      onConfirm: (name) => {
        if (!name) return;
        const updated = cats.map((c) => {
          if (c.id === catId) {
            if (c.subgroups.includes(name)) {
              setDialogOptions({
                type: 'alert',
                title: 'Alt Grup Zaten Mevcut',
                message: `"${name}" alt grubu bu kategoride zaten mevcut.`,
              });
              return c;
            }
            return { ...c, subgroups: [...c.subgroups, name] };
          }
          return c;
        });
        onUpdateCategories(settingsMainTab, updated);
      },
    });
  };

  const handleDeleteSubgroup = (catId: string, subName: string) => {
    setDialogOptions({
      type: 'confirm',
      title: 'Alt Grubu Sil',
      message: `"${subName}" alt grubunu silmek istediğinize emin misiniz? (İçindeki yapımlar silinmez, ana kategoriye aktarılır)`,
      isDestructive: true,
      confirmText: 'Alt Grubu Kaldır',
      onConfirm: () => {
        const updated = cats.map((c) =>
          c.id === catId
            ? { ...c, subgroups: c.subgroups.filter((s) => s !== subName) }
            : c
        );
        onUpdateCategories(settingsMainTab, updated);

        if (onUpdateItems) {
          const updatedItems = appData.items.map((it) => {
            if (it.mainTab === settingsMainTab && it.cat === catId && it.sub === subName) {
              return { ...it, sub: null };
            }
            return it;
          });
          onUpdateItems(updatedItems);
        }
      },
    });
  };

  const handleAddCategory = () => {
    setDialogOptions({
      type: 'prompt',
      title: `Yeni Kategori Ekle (${settingsMainTab === 'media' ? 'Medya' : 'Oyun'})`,
      promptPlaceholder: 'Ör: Belgesel, Korku, Souls, Bilim Kurgu...',
      confirmText: 'Oluştur',
      onConfirm: (name) => {
        if (!name) return;
        const id = `cat_${Date.now()}`;
        const newCat: Category = {
          id,
          name,
          subgroups: [],
          tierEnabled: false,
          tierRows: [],
        };
        onUpdateCategories(settingsMainTab, [...cats, newCat]);
      },
    });
  };

  const handleMoveCategory = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cats.length) return;
    const newCats = [...cats];
    const [moved] = newCats.splice(index, 1);
    newCats.splice(targetIndex, 0, moved);
    onUpdateCategories(settingsMainTab, newCats);
  };

  const handleMoveSubgroup = (catId: string, subIndex: number, direction: 'left' | 'right') => {
    const cat = cats.find((c) => c.id === catId);
    if (!cat || !cat.subgroups) return;
    const targetIndex = direction === 'left' ? subIndex - 1 : subIndex + 1;
    if (targetIndex < 0 || targetIndex >= cat.subgroups.length) return;
    const newSubgroups = [...cat.subgroups];
    const [moved] = newSubgroups.splice(subIndex, 1);
    newSubgroups.splice(targetIndex, 0, moved);
    const updated = cats.map((c) => (c.id === catId ? { ...c, subgroups: newSubgroups } : c));
    onUpdateCategories(settingsMainTab, updated);
  };

  // Connect Folder
  const handleConnect = async () => {
    setConnecting(true);
    try {
      await onConnectFolder();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setDialogOptions({
          type: 'alert',
          title: 'Klasör Bağlantı Hatası',
          message: 'Klasör bağlantısı sırasında hata: ' + (err.message || err),
        });
      }
    } finally {
      setConnecting(false);
    }
  };

  // Export Single Unified ZIP (Database + Images + Tier Lists)
  const handleExportZip = async () => {
    setExportingZip(true);
    try {
      const dateStr = getFormattedDateForFilename();
      const filename = `Lore_Yedek_${dateStr}.zip`;
      await exportAppDataToZip(appData, filename);
    } catch (err: any) {
      setDialogOptions({
        type: 'alert',
        title: 'Dışa Aktarma Hatası',
        message: 'ZIP dışa aktarma hatası: ' + (err.message || err),
      });
    } finally {
      setExportingZip(false);
    }
  };

  // Full Backup to connected folder (Backup/Lore_TumArsiv_YYYY-MM-DD_HH-mm.zip)
  const handleTakeFullBackup = async () => {
    if (!dirHandle) return;
    setTakingFullBackup(true);
    try {
      const relativePath = await generateFullBackupInFolder(dirHandle, appData);
      setDialogOptions({
        type: 'alert',
        title: 'Yedekleme Başarıyla Alındı',
        message: `Tam sistem yedeğiniz başarıyla oluşturuldu!\n\nDosya Yolu: "${dirHandle.name}/${relativePath}"\n\nBu ZIP paketi içinde tüm veritabanınız, afiş görselleriniz ve kategorilerinizin Tier List dizilimleri ile PNG afişleri eksiksiz kaydedilmiştir.`,
      });
    } catch (err: any) {
      setDialogOptions({
        type: 'alert',
        title: 'Yedekleme Hatası',
        message: 'Yedek alma sırasında hata oluştu: ' + (err.message || err),
      });
    } finally {
      setTakingFullBackup(false);
    }
  };

  // Open Folder Backups List Modal
  const handleOpenBackupsModal = async () => {
    if (!dirHandle) {
      setDialogOptions({
        type: 'alert',
        title: 'Klasör Bağlı Değil',
        message: 'Geçmiş yedeklerinizi görüntülemek ve geri yüklemek için lütfen önce ana arşiv klasörünüzü bağlayın.',
      });
      return;
    }
    setLoadingBackups(true);
    setIsBackupsModalOpen(true);
    try {
      const list = await listFolderBackups(dirHandle);
      setFolderBackups(list);
    } catch (err: any) {
      console.error('Error fetching backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  // Restore a specific backup from folder
  const handleRestoreBackup = (backup: FolderBackupItem) => {
    setIsBackupsModalOpen(false);
    setDialogOptions({
      type: 'confirm',
      title: 'Yedekten Geri Yükle',
      message: `"${backup.dateFormatted}" tarihli yedek yüklenecektir.\n\nMevcut kütüphane yapımlarınız, afişleriniz ve Tier List dizilimleriniz bu yedeğin kaydedildiği tarihteki durumuna geri dönecektir.\n\nOnaylıyor musunuz?`,
      confirmText: 'Evet, Geri Yükle',
      cancelText: 'Vazgeç',
      onCancel: () => {
        setIsBackupsModalOpen(true);
      },
      onConfirm: async () => {
        setRestoringBackup(true);
        try {
          const { appData: restoredData, restoredItemCount } = await restoreFromFolderBackup(
            backup,
            dirHandle
          );
          onReplaceAllData(restoredData);
          setDialogOptions({
            type: 'alert',
            title: 'Yedek Başarıyla Yüklendi',
            message: `"${backup.dateFormatted}" tarihli yedek başarıyla yüklendi!\n\nToplam ${restoredItemCount} yapım, afişler ve tüm Tier List dizilimleri geri yüklendi.`,
          });
        } catch (err: any) {
          setIsBackupsModalOpen(true);
          setDialogOptions({
            type: 'alert',
            title: 'Geri Yükleme Hatası',
            message: 'Yedek yüklenirken bir hata oluştu: ' + (err.message || err),
          });
        } finally {
          setRestoringBackup(false);
        }
      },
    });
  };

  // Upload External Unified ZIP
  const handleUploadZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingZip(true);
    try {
      const data = await importAppDataFromZip(file, dirHandle);
      setDialogOptions({
        type: 'confirm',
        title: 'ZIP Yedek Paketi Yükle',
        message: `"${file.name}" dosyasından ${data.items?.length || 0} yapım, afişler ve Tier List dizilimleri çözüldü. Bu yedek mevcut arşive yüklensin mi?`,
        confirmText: 'Yedeği Yükle',
        onConfirm: () => {
          onReplaceAllData(data);
          setDialogOptions({
            type: 'alert',
            title: 'Yükleme Tamamlandı',
            message: 'ZIP yedek paketi başarıyla yüklendi! Tüm yapımlar, afişler ve Tier List dizilimleri aktarıldı.',
          });
        },
      });
    } catch (err: any) {
      setDialogOptions({
        type: 'alert',
        title: 'ZIP İçe Aktarma Hatası',
        message: 'ZIP içe aktarma hatası: ' + (err.message || err),
      });
    } finally {
      setImportingZip(false);
      if (e.target) e.target.value = '';
    }
  };

  // Upload JSON
  const handleUploadJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await parseUploadedJson(file, appData);
      const count = result.importedItems.length;

      if (result.isItemListOnly) {
        setDialogOptions({
          type: 'confirm',
          title: 'Yapımları Arşive Ekle',
          message: `"${file.name}" dosyasından ${count} adet yapım bulundu.\n\nBu yapımları mevcut arşivinize eklemek (birleştirmek) istiyor musunuz?`,
          confirmText: 'Yapımları Ekle',
          onConfirm: () => {
            const existingMap = new Map(appData.items.map((it) => [it.id, it]));
            result.importedItems.forEach((it) => {
              existingMap.set(it.id, it);
            });
            const mergedData: AppData = {
              ...appData,
              items: Array.from(existingMap.values()),
            };
            onReplaceAllData(mergedData);
            setDialogOptions({
              type: 'alert',
              title: 'İşlem Başarılı',
              message: `${count} yapım başarıyla arşivinize eklendi!`,
            });
          },
        });
      } else {
        setDialogOptions({
          type: 'confirm',
          title: 'Tüm Arşivi Yükle',
          message: `Yedek dosyasından ${count} yapım ve tüm kategori ayarları yüklenecek.\n\nMevcut verilerin üzerine yazılsın mı?`,
          isDestructive: true,
          confirmText: 'Üzerine Yaz',
          onConfirm: () => {
            onReplaceAllData(result.appData);
            setDialogOptions({
              type: 'alert',
              title: 'Yedek Yüklendi',
              message: 'Veriler başarıyla yüklendi!',
            });
          },
        });
      }
    } catch (err: any) {
      setDialogOptions({
        type: 'alert',
        title: 'Geçersiz Dosya',
        message: 'Geçersiz dosya: ' + (err.message || err),
      });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Tier List JSON Import Handler with Detailed Reporting (Missing card names, placed names, pool names)
  const handleImportTierListFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    targetCategory: Category
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const backup = await parseTierListBackupFile(file);
      const categoryItems = appData.items.filter(
        (it) => it.mainTab === settingsMainTab && it.cat === targetCategory.id
      );

      const libraryItemMap = new Map<string, ArchiveItem>(categoryItems.map((it) => [it.id, it]));
      const backupItemMap = new Map<string, ArchiveItem>(backup.items.map((it) => [it.id, it]));

      // 1. Placed items
      const placedTitles: string[] = [];
      backup.items.forEach((bIt) => {
        if (bIt.tier && libraryItemMap.has(bIt.id)) {
          placedTitles.push(libraryItemMap.get(bIt.id)!.title);
        }
      });

      // 2. New pool items (in library, but not in backup)
      const newPoolTitles: string[] = [];
      categoryItems.forEach((libIt) => {
        if (!backupItemMap.has(libIt.id)) {
          newPoolTitles.push(libIt.title);
        }
      });

      // 3. Missing/deleted items (in backup, but not in library)
      const missingTitles: string[] = [];
      backup.items.forEach((bIt) => {
        if (!libraryItemMap.has(bIt.id)) {
          missingTitles.push(bIt.title || `ID: ${bIt.id}`);
        }
      });

      // Show confirmation with detailed preview
      setDialogOptions({
        type: 'tier-report',
        title: `"${targetCategory.name}" Tier Listesi İçe Aktarma`,
        message: `Yedekten satır düzeni ve sıralama ayarları uygulanacak. Ayrıntılar:`,
        confirmText: 'Yedekten Geri Yükle',
        tierReport: {
          categoryName: targetCategory.name,
          placedCount: placedTitles.length,
          placedTitles,
          newPoolCount: newPoolTitles.length,
          newPoolTitles,
          missingCount: missingTitles.length,
          missingTitles,
        },
        onConfirm: () => {
          // Restore tier rows from backup if available
          const updatedCats = cats.map((cat) =>
            cat.id === targetCategory.id
              ? {
                  ...cat,
                  tierEnabled: true,
                  tierRows:
                    backup.category.tierRows && backup.category.tierRows.length > 0
                      ? backup.category.tierRows
                      : cat.tierRows,
                }
              : cat
          );
          onUpdateCategories(settingsMainTab, updatedCats);

          // Update item tier placements
          if (onUpdateItems) {
            const updatedItems = appData.items.map((it) => {
              if (it.mainTab === settingsMainTab && it.cat === targetCategory.id) {
                const bItem = backupItemMap.get(it.id);
                return {
                  ...it,
                  tier: bItem ? bItem.tier : null, // Items not in backup are sent to pool
                };
              }
              return it;
            });
            onUpdateItems(updatedItems);
          }
        },
      });
    } catch (err: any) {
      setDialogOptions({
        type: 'alert',
        title: 'Tier List İçe Aktarma Hatası',
        message: 'Tier List içe aktarma hatası: ' + (err.message || err),
      });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  return (
    <>
      <div
        id="settings-modal-overlay"
        className={`fixed inset-0 z-50 ${
          viewSettings.backdropBlur !== false
            ? 'bg-black/75 backdrop-blur-sm'
            : 'bg-transparent backdrop-blur-none pointer-events-auto'
        } flex items-center justify-center p-3 sm:p-6 overflow-y-auto transition-all duration-200`}
        onClick={onClose}
      >
        <div
          id="settings-modal-box"
          className="relative w-full max-w-3xl h-[85vh] max-h-[92vh] min-h-[560px] bg-[#12151f] border border-white/15 rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-black/30">
            <h3 className="font-semibold text-base text-slate-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-blue-400" />
              Ayarlar
            </h3>
            <button
              id="close-settings-btn"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Modal Navigation Tabs */}
          <div className="flex border-b border-white/10 px-4 pt-2 gap-1.5 bg-black/20 overflow-x-auto">
            <button
              id="tab-btn-categories"
              onClick={() => setActiveTab('categories')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'categories'
                  ? 'border-blue-500 text-blue-400 bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Kategoriler
            </button>

            <button
              id="tab-btn-tags"
              onClick={() => setActiveTab('tags')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'tags'
                  ? 'border-blue-500 text-blue-400 bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Tags className="w-3.5 h-3.5" /> Etiketler
            </button>

            <button
              id="tab-btn-themes"
              onClick={() => setActiveTab('themes')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'themes'
                  ? 'border-blue-500 text-blue-400 bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Palette className="w-3.5 h-3.5" /> Görünüm & Atmosfer
            </button>

            <button
              id="tab-btn-shortcuts"
              onClick={() => setActiveTab('shortcuts')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'shortcuts'
                  ? 'border-blue-500 text-blue-400 bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" /> Kısayollar
            </button>

            <button
              id="tab-btn-storage"
              onClick={() => setActiveTab('storage')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'storage'
                  ? 'border-blue-500 text-blue-400 bg-white/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" /> Veri & Dosya Sistemi
            </button>
          </div>

          {/* Body */}
          <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
            {/* TAB 1: CATEGORIES */}
            {activeTab === 'categories' && (
              <div>
                {/* Media / Game toggle in settings */}
                <div className="flex gap-2 mb-4 p-1 bg-black/40 rounded-xl border border-white/10 w-fit">
                  <button
                    id="settings-media-tab-btn"
                    onClick={() => setSettingsMainTab('media')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      settingsMainTab === 'media'
                        ? 'bg-white/15 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🎬 Medya Kategorileri
                  </button>
                  <button
                    id="settings-game-tab-btn"
                    onClick={() => setSettingsMainTab('game')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      settingsMainTab === 'game'
                        ? 'bg-white/15 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🎮 Oyun Kategorileri
                  </button>
                </div>

                {/* Uncategorized / Orphan Items Alert & Action */}
                {uncategorizedItems.length > 0 && (
                  <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-400" /> {uncategorizedItems.length} adet sahipsiz / kategorisiz yapım mevcut
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Kategorisi silinmiş veya eşleşmeyen bu yapımları mevcut bir kategoriye tek tıkla topluca taşıyabilirsiniz.
                    </p>
                    {cats.length > 0 && (
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className="text-xs text-slate-400">Şu kategoriye aktar:</span>
                        {cats.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setDialogOptions({
                                type: 'confirm',
                                title: 'Sahipsiz Yapımları Aktar',
                                message: `${uncategorizedItems.length} adet sahipsiz yapım "${c.name}" kategorisine taşınsın mı?`,
                                confirmText: 'Aktar',
                                onConfirm: () => {
                                  if (onUpdateItems) {
                                    const updated = appData.items.map((it) => {
                                      if (
                                        it.mainTab === settingsMainTab &&
                                        (!it.cat || !validCatIds.has(it.cat))
                                      ) {
                                        return { ...it, cat: c.id, sub: null };
                                      }
                                      return it;
                                    });
                                    onUpdateItems(updated);
                                  }
                                },
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            ➡️ {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Categories list */}
                <div className="space-y-3">
                  {cats.map((c, idx) => {
                    const itemCount = appData.items.filter(
                      (it) => it.mainTab === settingsMainTab && it.cat === c.id
                    ).length;

                    return (
                      <div
                        key={c.id}
                        id={`manage-cat-${c.id}`}
                        className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          {/* Reorder Buttons + Name + Item count */}
                          <div className="flex items-center gap-2">
                            {/* Up / Down category order - Minimalist styling */}
                            <div className="flex items-center">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveCategory(idx, 'up');
                                }}
                                title="Kategoriyi Yukarı Taşı"
                                className={`p-1 rounded-md transition-colors ${
                                  idx === 0
                                    ? 'text-slate-600 cursor-not-allowed opacity-20'
                                    : 'text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer'
                                }`}
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === cats.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveCategory(idx, 'down');
                                }}
                                title="Kategoriyi Aşağı Taşı"
                                className={`p-1 rounded-md transition-colors ${
                                  idx === cats.length - 1
                                    ? 'text-slate-600 cursor-not-allowed opacity-20'
                                    : 'text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer'
                                }`}
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div
                              onClick={() => handleRenameCategory(c.id, c.name)}
                              className="flex items-center gap-2 cursor-pointer group"
                            >
                              <span className="font-semibold text-sm text-slate-100 group-hover:text-blue-400 transition-colors">
                                {c.name}
                              </span>
                              <span className="text-xs text-slate-400">
                                ({itemCount} yapım)
                              </span>
                              <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                ✎ Adı Değiştir
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 sm:gap-3">
                            {c.tierEnabled && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => exportTierListBackup(settingsMainTab, c, appData.items)}
                                  title="Bu kategorinin Tier Listesini Yedekle (.json)"
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-blue-400 border border-blue-500/20 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Yedek Al</span>
                                </button>

                                <label
                                  title="Bu kategorinin Tier Listesi Yedeğini Yükle (.json)"
                                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-400 border border-emerald-500/20 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Upload className="w-3 h-3" />
                                  <span>Yedek Yükle</span>
                                  <input
                                    type="file"
                                    accept=".json"
                                    className="hidden"
                                    onChange={(e) => handleImportTierListFile(e, c)}
                                  />
                                </label>
                              </div>
                            )}

                            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer select-none hover:text-white">
                              <input
                                type="checkbox"
                                checked={c.tierEnabled}
                                onChange={() => handleToggleTierList(c)}
                                className="rounded border-white/20 text-blue-600 focus:ring-0 focus:ring-offset-0 bg-black/40"
                              />
                              <span>Tier List Aktif</span>
                            </label>

                            <button
                              onClick={() => handleDeleteCategory(c)}
                              title="Kategoriyi Sil"
                              className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Subgroups */}
                        <div className="pt-2 border-t border-white/5">
                          <div className="text-[11px] text-slate-400 mb-1.5 font-medium flex items-center justify-between">
                            <span>Alt Gruplar:</span>
                            <button
                              onClick={() => handleAddSubgroup(c.id)}
                              className="text-blue-400 hover:text-blue-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" /> Alt Grup Ekle
                            </button>
                          </div>

                          {c.subgroups && c.subgroups.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {c.subgroups.map((sub, subIdx) => (
                                <span
                                  key={sub}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-200"
                                >
                                  {/* Reorder Subgroup */}
                                  <button
                                    type="button"
                                    disabled={subIdx === 0}
                                    onClick={() => handleMoveSubgroup(c.id, subIdx, 'left')}
                                    className={`p-0.5 rounded transition-colors ${
                                      subIdx === 0 ? 'text-slate-600 opacity-30 cursor-not-allowed' : 'text-slate-400 hover:text-white cursor-pointer'
                                    }`}
                                    title="Sola / Öne Taşı"
                                  >
                                    <ChevronLeft className="w-3 h-3" />
                                  </button>

                                  <span className="font-medium px-0.5">{sub}</span>

                                  <button
                                    type="button"
                                    disabled={subIdx === c.subgroups.length - 1}
                                    onClick={() => handleMoveSubgroup(c.id, subIdx, 'right')}
                                    className={`p-0.5 rounded transition-colors ${
                                      subIdx === c.subgroups.length - 1 ? 'text-slate-600 opacity-30 cursor-not-allowed' : 'text-slate-400 hover:text-white cursor-pointer'
                                    }`}
                                    title="Sağa / Arkaya Taşı"
                                  >
                                    <ChevronRight className="w-3 h-3" />
                                  </button>

                                  {/* Delete */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSubgroup(c.id, sub)}
                                    className="ml-1 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                                    title="Alt grubu kaldır"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-500 italic">
                              Tanımlı alt grup yok.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <button
                    id="add-new-category-btn"
                    onClick={handleAddCategory}
                    className="w-full py-2.5 border border-dashed border-white/20 hover:border-blue-500/50 rounded-xl text-slate-300 hover:text-blue-400 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-blue-500/5 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Yeni Kategori Ekle ({settingsMainTab === 'media' ? 'Medya' : 'Oyun'})
                  </button>
                </div>
              </div>
            )}

            {/* TAB: TAGS (FIELD-SCOPED) */}
            {activeTab === 'tags' && (
              <div className="space-y-4">
                {/* Header: Media / Game toggle + Search Input */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/10 w-fit shrink-0">
                    <button
                      onClick={() => {
                        setSettingsMainTab('media');
                        setTagFieldKey('firm');
                        setActiveTagPopover(null);
                      }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        settingsMainTab === 'media'
                          ? 'bg-white/15 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Film className="w-3.5 h-3.5" /> Medya Etiketleri
                    </button>
                    <button
                      onClick={() => {
                        setSettingsMainTab('game');
                        setTagFieldKey('developer');
                        setActiveTagPopover(null);
                      }}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        settingsMainTab === 'game'
                          ? 'bg-white/15 text-white shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Gamepad2 className="w-3.5 h-3.5" /> Oyun Etiketleri
                    </button>
                  </div>

                  {/* Tag Search Input with Clear button */}
                  <div className="relative flex-1 sm:max-w-xs">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                      placeholder="Etiket ara..."
                      className="w-full pl-8.5 pr-7 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                    {tagSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setTagSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                        title="Aramayı Temizle"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Field selector tabs */}
                <div className="flex gap-1.5 border-b border-white/10 pb-2 overflow-x-auto">
                  {currentTagFields.map((field) => (
                    <button
                      key={field.key}
                      onClick={() => {
                        setTagFieldKey(field.key);
                        setActiveTagPopover(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                        tagFieldKey === field.key
                          ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 shadow-sm'
                          : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border border-white/5'
                      }`}
                    >
                      <span>{field.label}</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-black/40 rounded-full text-slate-400 font-mono">
                        {getFieldScopedTags(appData.items, settingsMainTab, field.key).length}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Active Field Tags List */}
                {(() => {
                  const rawTagsList = getFieldScopedTags(appData.items, settingsMainTab, tagFieldKey);
                  const tagCounts = getFieldScopedTagCounts(appData.items, settingsMainTab, tagFieldKey);

                  const trimmedQuery = tagSearchQuery.trim().toLowerCase();
                  const filteredTags = trimmedQuery
                    ? rawTagsList.filter((t) => t.toLowerCase().includes(trimmedQuery))
                    : rawTagsList;

                  if (rawTagsList.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-500 text-xs">
                        Bu alanda kayıtlı etiket bulunmuyor. Yapım detayından etiket ekleyebilirsiniz.
                      </div>
                    );
                  }

                  if (filteredTags.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-500 text-xs">
                        "{tagSearchQuery}" aramasına uygun etiket bulunamadı.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredTags.map((tag) => {
                        const count = tagCounts.get(tag) || 0;
                        const isPopoverOpen = activeTagPopover === tag;

                        const associatedItems = isPopoverOpen
                          ? appData.items.filter((it) => {
                              if (it.mainTab !== settingsMainTab) return false;
                              const arr = (it[tagFieldKey] as string[]) || [];
                              return Array.isArray(arr) && arr.includes(tag);
                            })
                          : [];

                        return (
                          <div
                            key={tag}
                            className="relative flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group"
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="text-xs font-medium text-slate-200 truncate group-hover:text-blue-300 transition-colors">
                                {tag}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTagPopover(isPopoverOpen ? null : tag);
                                }}
                                className={`text-[10px] px-2 py-0.5 rounded-md shrink-0 font-mono font-semibold transition-all cursor-pointer ${
                                  isPopoverOpen
                                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                                    : 'bg-white/10 text-slate-300 hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-400/30'
                                }`}
                                title="Bu etikete sahip yapımları gör"
                              >
                                {count} yapım
                              </button>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleRenameTag(tag)}
                                title="Etiketi Yeniden Adlandır"
                                className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTag(tag)}
                                title="Etiketi Sil (Tüm yapımlardan kaldırılır)"
                                className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Popover list of associated items */}
                            {isPopoverOpen && (
                              <div
                                className="absolute left-0 top-full mt-1.5 z-40 w-full min-w-[240px] max-w-sm bg-[#181b24] border border-white/20 rounded-xl shadow-2xl p-2.5 space-y-1.5 animate-in fade-in zoom-in-95 duration-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-[11px] font-semibold text-slate-300 px-1">
                                  <span className="truncate">"{tag}" Yapımları ({associatedItems.length})</span>
                                  <button
                                    type="button"
                                    onClick={() => setActiveTagPopover(null)}
                                    className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1 pr-0.5">
                                  {associatedItems.length === 0 ? (
                                    <div className="py-3 text-center text-[11px] text-slate-500">
                                      Bağlı yapım bulunamadı.
                                    </div>
                                  ) : (
                                    associatedItems.map((item, idx) => (
                                      <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                          if (onSelectItem) {
                                            onSelectItem(item);
                                          }
                                        }}
                                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-blue-600/20 hover:text-blue-200 border border-transparent hover:border-blue-500/30 transition-all cursor-pointer flex items-center gap-2 group/item"
                                      >
                                        <span className="text-[11px] text-slate-400 font-mono font-medium group-hover/item:text-blue-400 shrink-0">
                                          {idx + 1}.
                                        </span>
                                        <span className="truncate font-medium">{item.title}</span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 2: APPEARANCE & THEMES */}
            {activeTab === 'themes' && (
              <div className="space-y-6">
                <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-200 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Görünüm & Atmosfer Özelleştirme:</span> Ekran altı hızlı görünüm çubuğunu, pencere buzlu cam efektini ve renk temalarını buradan yönetebilirsiniz.
                  </div>
                </div>

                {/* Section 1: Hızlı Araçlar ve Ekran Ayarları */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" /> Ekran & Hızlı Deneyim Araçları
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Floating Appearance Bar Toggle */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <div className="space-y-0.5 pr-2">
                        <span className="text-xs font-semibold text-slate-100 block">
                          Ekran Altı Hızlı Görünüm Çubuğu
                        </span>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          Ana ekranın altındaki yüzen hızlı özelleştirme çubuğunu açar veya gizler.
                        </p>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={viewSettings.showQuickAppearanceBar !== false}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            onUpdateViewSettings({ showQuickAppearanceBar: isChecked });
                            if (isChecked) {
                              // If activated, close settings so bottom appearance popup bar is clearly visible
                              onClose();
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5.5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* Backdrop Blur Toggle */}
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <div className="space-y-0.5 pr-2">
                        <span className="text-xs font-semibold text-slate-100 block">
                          Arka Plan Buzlu Cam (Blur)
                        </span>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          Pencerelerin arkasını hafif buzlu/bulanık yaparak derinlik hissi katar.
                        </p>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={viewSettings.backdropBlur !== false}
                          onChange={(e) => onUpdateViewSettings({ backdropBlur: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5.5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Section 2: Renk Temaları */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-blue-400" /> Renk Temaları (6 Tema)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {THEMES.map((th) => {
                      const isSelected = currentTheme === th.id;
                      return (
                        <div
                          key={th.id}
                          onClick={() => onUpdateViewSettings({ theme: th.id })}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2.5 relative ${
                            isSelected
                              ? 'border-blue-500 bg-white/10 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/50'
                              : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                              {th.name}
                            </span>
                            {isSelected && (
                              <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-400 leading-relaxed">
                            {th.desc}
                          </p>

                          {/* Mini preview bar */}
                          <div className={`p-2 rounded-lg ${th.bgPreview} border ${th.borderPreview} flex items-center gap-2`}>
                            <div className={`w-7 h-7 rounded ${th.cardPreview} border border-white/10 flex items-center justify-center`}>
                              <div className={`w-2.5 h-2.5 rounded-full ${th.accentPreview}`} />
                            </div>
                            <div className="flex-1 space-y-1">
                              <div className="h-1.5 w-14 rounded bg-white/20" />
                              <div className="h-1 w-9 rounded bg-white/10" />
                            </div>
                            <div className={`px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${th.accentPreview}`}>
                              Örnek
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: SHORTCUTS */}
            {activeTab === 'shortcuts' && (
              <div className="space-y-4">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-300">
                  ⌨️ <span className="font-semibold text-slate-100">Klavye Kısayolları:</span> Herhangi bir modal veya yazı kutusunda olmadığınızda bu tuşlara basarak hızlı aksiyon alabilirsiniz.
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-slate-100">Medya Ana Sayfası</span>
                      <p className="text-xs text-slate-400">Nerede olursanız olun Medya Ana Sayfasına götürür</p>
                    </div>
                    <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                      1
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-slate-100">Oyun Ana Sayfası</span>
                      <p className="text-xs text-slate-400">Nerede olursanız olun Oyun Ana Sayfasına götürür</p>
                    </div>
                    <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                      2
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-slate-100">İzlenen & Takip Listesi</span>
                      <p className="text-xs text-slate-400">İzlenen & Takip Listesi vitrinini açar</p>
                    </div>
                    <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                      3
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-slate-100">Akıllı ESC / Ayarlar</span>
                      <p className="text-xs text-slate-400">Pencere açıksa kapatır; ekranda açık pencere yoksa doğrudan Ayarlar'ı açar</p>
                    </div>
                    <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                      ESC
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-slate-100">Yeni Yapım Ekle (FAB)</span>
                      <p className="text-xs text-slate-400">Yeni dizi, film, anime veya oyun ekleme penceresini açar</p>
                    </div>
                    <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                      W
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-slate-100">Tam Ekran Aç / Kapat</span>
                      <p className="text-xs text-slate-400">Uygulamayı tam ekrana geçirir veya tam ekrandan çıkar</p>
                    </div>
                    <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                      SPACE
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-slate-100">Büyük Afiş / Resim Önizleme (Hover)</span>
                      <p className="text-xs text-slate-400">Fare kartın üzerindeyken büyük görseli açar; F, ESC veya boşluğa tıklayarak kapatılır</p>
                    </div>
                    <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                      F
                    </kbd>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-slate-100">Izgara / Tier List Görünüm Değiştir</span>
                      <p className="text-xs text-slate-400">Aktif kategoride tier list açıksa görünümler arasında geçiş yapar</p>
                    </div>
                    <kbd className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/20 text-slate-200 text-xs font-mono font-bold shadow-inner">
                      TAB
                    </kbd>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: STORAGE & FILE SYSTEM */}
            {activeTab === 'storage' && (
              <div className="space-y-5">
                {/* 1. SEPARATE BOX: LOCAL FOLDER SYNC */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FolderSync className="w-4 h-4 text-blue-400" />
                      Yerel Klasör Senkronizasyonu
                    </span>
                    {dirHandle ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle className="w-3.5 h-3.5" /> Bağlı: {dirHandle.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        <AlertCircle className="w-3.5 h-3.5" /> Klasör Bağlı Değil
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {dirHandle
                      ? `Verileriniz bilgisayarınızdaki "${dirHandle.name}" klasörüne anlık olarak JSON ve görseller halinde yazılıyor.`
                      : 'Bilgisayarınızdan bir klasör seçerek yapımlarınızın ve afişlerinizin doğrudan sabit diskinizde saklanmasını sağlayabilirsiniz.'}
                  </p>

                  <div className="flex gap-2 pt-1 flex-wrap">
                    {dirHandle ? (
                      <>
                        <button
                          id="clean-orphan-images-btn"
                          onClick={handleCleanOrphanImages}
                          disabled={cleaningImages}
                          className="py-2 px-3.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="images/ klasöründeki kaydı silinmiş veya kullanılmayan eski afiş dosyalarını temizler"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          {cleaningImages ? 'Taranıyor & Temizleniyor...' : 'Öksüz Görselleri Temizle'}
                        </button>

                        <button
                          id="disconnect-dir-btn"
                          onClick={onDisconnectFolder}
                          className="py-2 px-3.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Klasör Bağlantısını Kes
                        </button>
                      </>
                    ) : (
                      <button
                        id="connect-dir-btn"
                        onClick={handleConnect}
                        disabled={connecting}
                        className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                      >
                        <FolderSync className="w-4 h-4" />
                        {connecting ? 'Bağlanıyor...' : 'Klasör Seç & Bağla'}
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. SEPARATE BOX: DEDICATED BACKUP & RESTORE CENTER */}
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-sm font-bold text-slate-100">
                        Yedekleme & Geri Yükleme Merkezi
                      </h4>
                    </div>
                  </div>

                  {/* Hidden Global Inputs for Restore */}
                  <input
                    type="file"
                    ref={zipFileInputRef}
                    onChange={handleUploadZip}
                    accept=".zip"
                    className="hidden"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleUploadJson}
                    accept=".json"
                    className="hidden"
                  />

                  {/* 1. Klasör İçi Yedekleme (Backup Klasörü) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                      <FolderArchive className="w-3.5 h-3.5 text-blue-400" />
                      <span>Sistem Yedekleme (<code className="text-blue-300 font-mono text-[11px]">Backup/</code>)</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Action 1: Tam Sistem Yedeği Oluştur */}
                      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between space-y-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-300">
                            <HardDrive className="w-4 h-4 text-blue-400" />
                            <span>Tam Sistem Yedeği Oluştur</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            <code className="text-blue-300">Backup/</code> içerisine tüm kütüphane zip'ini ve kategorilerin bağımsız Tier List yedeklerini içeren tek ana paketi kaydeder.
                          </p>
                        </div>

                        {dirHandle ? (
                          <button
                            id="take-full-backup-btn"
                            onClick={handleTakeFullBackup}
                            disabled={takingFullBackup}
                            className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                          >
                            <HardDrive className="w-3.5 h-3.5" />
                            {takingFullBackup ? 'Yedek Oluşturuluyor...' : '📦 Tam Sistem Yedeği Oluştur'}
                          </button>
                        ) : (
                          <button
                            onClick={handleConnect}
                            className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <FolderSync className="w-3.5 h-3.5" />
                            Önce Klasör Bağlayın
                          </button>
                        )}
                      </div>

                      {/* Action 2: Geçmiş Yedekler Listesi & Geri Yükleme */}
                      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between space-y-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                            <History className="w-4 h-4 text-emerald-400" />
                            <span>Geçmiş Yedekten Geri Yükle</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            <code className="text-emerald-300">Backup/</code> klasöründeki geçmiş tarihli yedeklerinizi görüntüleyin ve dilediğiniz güne geri dönün.
                          </p>
                        </div>

                        {dirHandle ? (
                          <button
                            id="open-backups-modal-btn"
                            onClick={handleOpenBackupsModal}
                            disabled={loadingBackups}
                            className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                            {loadingBackups ? 'Yedekler Aranıyor...' : 'Geçmiş Yedekler Listesi ▾'}
                          </button>
                        ) : (
                          <button
                            onClick={handleConnect}
                            className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <FolderSync className="w-3.5 h-3.5" />
                            Önce Klasör Bağlayın
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2. Dışa / İçe Aktarma */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                      <Download className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Dışa Aktar & İçe Aktar</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Action 3: ZIP İndir */}
                      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between space-y-2">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <FileArchive className="w-3.5 h-3.5 text-blue-400" />
                            <span>ZIP Paketi İndir (.zip)</span>
                          </span>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Tüm kütüphaneyi, görselleri ve Tier List verilerini tek bir ZIP paketi olarak bilgisayara indirir.
                          </p>
                        </div>
                        <button
                          id="export-zip-btn"
                          onClick={handleExportZip}
                          disabled={exportingZip}
                          className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-400" />
                          {exportingZip ? 'Paketleniyor...' : 'ZIP İndir (.zip)'}
                        </button>
                      </div>

                      {/* Action 4: Dışarıdan ZIP Yükle */}
                      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between space-y-2">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Dışarıdan ZIP Yükle (.zip)</span>
                          </span>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Başka cihazdan veya diskten getirdiğiniz ZIP yedek paketini seçip uygulamaya yükler.
                          </p>
                        </div>
                        <button
                          id="upload-zip-direct-btn"
                          onClick={() => zipFileInputRef.current?.click()}
                          disabled={importingZip}
                          className="w-full py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-emerald-400" />
                          {importingZip ? 'Yükleniyor...' : 'ZIP Dosyası Seç & Yükle'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Advanced Settings Toggle */}
                <div className="pt-2 border-t border-white/10">
                  <label className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      id="advanced-storage-toggle"
                      checked={showAdvancedStorage}
                      onChange={(e) => setShowAdvancedStorage(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-black/40 text-blue-500 focus:ring-blue-400/40"
                    />
                    <span className="font-semibold text-slate-200">Gelişmiş Seçenekleri Göster</span>
                  </label>
                </div>

                {/* Advanced Section: JSON, Mobile HTML Export & Reset */}
                {showAdvancedStorage && (
                  <div className="space-y-4 pt-1 transition-all">
                    {/* JSON Arşiv & İçe Aktarma */}
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-blue-400" />
                        <h4 className="text-sm font-semibold text-slate-100">
                          JSON Veri İşlemleri (İndir & İçe Aktar)
                        </h4>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Arşivinizi ham <code className="text-blue-300 font-mono">.json</code> formatında dışa aktarabilir veya dışarıdan hazırladığınız JSON listelerini (<code className="text-amber-300 font-mono">oyunlar.json</code>, <code className="text-amber-300 font-mono">anime.json</code> vb.) mevcut kütüphanenize doğrudan ekleyebilirsiniz.
                      </p>
                      <div className="flex items-center gap-2.5 flex-wrap pt-1">
                        <button
                          id="download-json-advanced-btn"
                          type="button"
                          onClick={() => downloadJsonFile(appData)}
                          className="py-2 px-3.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          JSON Arşivi İndir (.json)
                        </button>
                        <button
                          id="upload-json-advanced-btn"
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="py-2 px-3.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          JSON Yükle / İçe Aktar (.json)
                        </button>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-sm font-semibold text-slate-100">
                          Mobil / Telefon Görünümü HTML Çıktısı
                        </h4>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Tüm arşivinizi, afişlerin gömülü olduğu tek bir bağımsız <code className="text-emerald-300">arsiv_mobil.html</code> dosyası olarak indirebilir, telefonunuza atıp internetsiz açabilirsiniz.
                      </p>
                      <button
                        id="download-phone-html-btn"
                        onClick={() => downloadPhoneHtml(appData)}
                        className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        arsiv_mobil.html İndir
                      </button>
                    </div>

                    {/* Reset All Archive */}
                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-3">
                      <h4 className="text-sm font-semibold text-red-300 flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-red-400" />
                        Tüm Arşivi Sıfırla / Temizle
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Tüm yapımları, eklenen afişleri ve geçmiş kayıtları tamamen temizler; uygulamayı boş başlangıç durumuna getirir.
                      </p>
                      <button
                        id="reset-all-data-btn"
                        onClick={() => {
                          setDialogOptions({
                            type: 'confirm',
                            title: 'Tüm Arşivi Sıfırla',
                            message:
                              'DİKKAT: Tüm yapımlar ve kayıtlı veriler kalıcı olarak silinecek ve arşiv tamamen sıfırlanacaktır. Bu işlem geri alınamaz. Devam etmek istediğinize emin misiniz?',
                            isDestructive: true,
                            confirmText: 'Her Şeyi Sıfırla',
                            onConfirm: () => {
                              onReplaceAllData({
                                ...appData,
                                items: [],
                                lastUpdated: new Date().toISOString(),
                              });
                              setDialogOptions({
                                type: 'alert',
                                title: 'Arşiv Sıfırlandı',
                                message: 'Arşiv başarıyla sıfırlandı.',
                              });
                            },
                          });
                        }}
                        className="py-2 px-4 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Tüm Arşivi Sıfırla / Temizle
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backups List Modal */}
      {isBackupsModalOpen && (
        <div
          id="folder-backups-modal-overlay"
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-150"
          onClick={() => !restoringBackup && setIsBackupsModalOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-[#13161f] border border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 px-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Geçmiş Yedekler (Backup Listesi)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Bağlı klasörünüzdeki <code className="text-emerald-300 font-mono">Backup/</code> dizininde bulunan tüm kayıtlı yedekler
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBackupsModalOpen(false)}
                disabled={restoringBackup}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
              {loadingBackups ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-2.5 text-slate-400">
                  <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">Backup klasörü taranıyor...</span>
                </div>
              ) : folderBackups.length === 0 ? (
                <div className="py-10 px-4 text-center rounded-xl bg-black/30 border border-white/10 space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-full bg-white/5 flex items-center justify-center text-slate-400">
                    <FolderArchive className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-slate-200">
                      Henüz Kayıtlı Yedek Bulunamadı
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Bağlı klasörünüzde henüz bir yedek bulunmuyor. Dilerseniz hemen yeni bir tam yedek alabilirsiniz.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsBackupsModalOpen(false);
                      await handleTakeFullBackup();
                    }}
                    className="py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    Şimdi İlk Yedeği Al
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-400 font-medium px-1 flex items-center justify-between">
                    <span>Bulunan Yedekler ({folderBackups.length})</span>
                    <span className="text-[10px] text-slate-500">Yeniden eskiye sıralı</span>
                  </div>

                  {folderBackups.map((backup, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 hover:border-emerald-500/40 flex items-center justify-between gap-3 transition-all group"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-xs font-bold text-slate-100 truncate">
                            {backup.dateFormatted}
                          </span>
                          {idx === 0 && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              En Son Yedek
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono truncate">
                          <span className="text-slate-500">📁 {backup.folderName}/</span>
                          <span className="text-blue-300 truncate">{backup.zipFileName}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRestoreBackup(backup)}
                        disabled={restoringBackup}
                        className="py-2 px-3.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Geri Yükle
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-5 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Geri yükleme yapıldığında tüm kütüphane ve Tier List'ler seçilen tarihe döner.
              </span>
              <button
                type="button"
                onClick={() => setIsBackupsModalOpen(false)}
                disabled={restoringBackup}
                className="py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global In-App Dialog Component */}
      <CustomDialog options={dialogOptions} onClose={() => setDialogOptions(null)} />
    </>
  );
};
