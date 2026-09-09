import React, { useState } from 'react';
import {
  FabPositions,
  FabPositionProfile,
  DEFAULT_FAB_POSITIONS,
  DEFAULT_FAB_PROFILES,
  areFabPositionsEqual,
  normalizeFabPositions,
} from '../types';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  RotateCcw,
  Sparkles,
  Smartphone,
  Trash2,
  Bookmark,
  Pencil,
  BarChart3,
  History,
  Plus,
  AlertCircle,
} from 'lucide-react';

export const SYSTEM_PRESETS: {
  id: string;
  name: string;
  positions: FabPositions;
}[] = [];

interface FabPositionEditOverlayProps {
  isOpen: boolean;
  positions: FabPositions;
  onChangeCoord: (id: keyof FabPositions, axis: 'bottom' | 'side', value: number) => void;
  selectedFab: keyof FabPositions | null;
  onSelectFab: (id: keyof FabPositions | null) => void;
  onApplyPreset: (newPositions: FabPositions) => void;
  onSave: () => void;
  onCancel: () => void;
  profiles: FabPositionProfile[];
  onSaveProfile: (name: string) => void;
  onRenameProfile: (id: string, newName: string) => void;
  onDeleteProfile: (id: string) => void;
}

export const FabPositionEditOverlay: React.FC<FabPositionEditOverlayProps> = ({
  isOpen,
  positions,
  onChangeCoord,
  selectedFab,
  onSelectFab,
  onApplyPreset,
  onSave,
  onCancel,
  profiles,
  onSaveProfile,
  onRenameProfile,
  onDeleteProfile,
}) => {
  const [profileNameInput, setProfileNameInput] = useState('');
  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfileName, setEditingProfileName] = useState('');

  if (!isOpen) return null;

  const currentFabKey = selectedFab;
  const curPos = currentFabKey
    ? positions[currentFabKey] || DEFAULT_FAB_POSITIONS[currentFabKey]
    : null;

  const handleAdjust = (axis: 'bottom' | 'side', delta: number) => {
    if (!selectedFab) return;
    const targetKey = selectedFab;
    // For addItem: since it is anchored to the right edge (style.right = curPos.side):
    // Pressing Left (delta = -4) should move it to the left (inwards / away from right edge), so right distance increases (+4).
    // Pressing Right (delta = +4) should move it to the right (towards right edge), so right distance decreases (-4).
    const effectiveDelta = targetKey === 'addItem' && axis === 'side' ? -delta : delta;
    const currentVal = positions[targetKey]?.[axis] ?? DEFAULT_FAB_POSITIONS[targetKey][axis];
    const nextVal = Math.max(0, Math.min(240, currentVal + effectiveDelta));
    onChangeCoord(targetKey, axis, nextVal);
  };

  const handleSlider = (axis: 'bottom' | 'side', val: number) => {
    if (!selectedFab) return;
    const targetKey = selectedFab;
    onChangeCoord(targetKey, axis, Math.max(0, Math.min(240, val)));
  };

  const effectiveProfiles = profiles && profiles.length > 0 ? profiles : DEFAULT_FAB_PROFILES;

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = profileNameInput.trim();
    if (!trimmed) return;
    const currentPositions = normalizeFabPositions(positions);
    const isDuplicate = effectiveProfiles.some((p) => areFabPositionsEqual(p.positions, currentPositions));
    if (isDuplicate) {
      setProfileErrorMsg('Bu koordinatlara sahip bir preset zaten mevcut');
      setTimeout(() => setProfileErrorMsg(null), 3500);
      return;
    }
    onSaveProfile(trimmed);
    setProfileNameInput('');
    setSaveSuccessMsg(`"${trimmed}" preseti kaydedildi`);
    setTimeout(() => setSaveSuccessMsg(null), 2500);
  };

  const handleStartRename = (profile: FabPositionProfile) => {
    setEditingProfileId(profile.id);
    setEditingProfileName(profile.name);
  };

  const handleConfirmRename = (id: string) => {
    const trimmed = editingProfileName.trim();
    if (trimmed) {
      onRenameProfile(id, trimmed);
    }
    setEditingProfileId(null);
    setEditingProfileName('');
  };

  const getFabMeta = (id: keyof FabPositions) => {
    switch (id) {
      case 'statistics':
        return {
          name: 'İstatistik',
          icon: <BarChart3 className="w-3.5 h-3.5 text-blue-400" />,
          colorText: 'text-blue-400',
        };
      case 'recentActivity':
        return {
          name: 'Son Aktivite',
          icon: <History className="w-3.5 h-3.5 text-purple-400" />,
          colorText: 'text-purple-400',
        };
      case 'addItem':
        return {
          name: 'Yeni Kart Ekle',
          icon: <Plus className="w-3.5 h-3.5 text-emerald-400" />,
          colorText: 'text-emerald-400',
        };
    }
  };

  const activeMeta = currentFabKey ? getFabMeta(currentFabKey) : null;

  return (
    <>
      {/* 1. Backdrop overlay - translucent, clicks outside deselect active button */}
      <div
        id="fab-edit-backdrop-overlay"
        onClick={() => onSelectFab(null)}
        className="fixed inset-0 z-45 bg-black/50 backdrop-blur-[2px] transition-all animate-in fade-in duration-200"
      />

      {/* 2. Top floating control header */}
      <div
        id="fab-edit-top-header"
        className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-60 w-[95%] max-w-2xl bg-[#12141a]/95 border border-blue-500/40 backdrop-blur-xl px-3.5 sm:px-5 py-3 rounded-2xl shadow-2xl shadow-black/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-white animate-in slide-in-from-top-4 duration-200"
      >
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div>
            <div className="font-bold text-xs sm:text-sm text-slate-100">
              FAB Konum Düzenleme
            </div>
            <p className="text-[11px] text-slate-400 hidden xs:block">
              Ayarlamak istediğiniz butona dokunun, yön tuşlarıyla veya kaydırıcıyla konumlandırın
            </p>
          </div>

          {/* Quick preset trigger */}
          <button
            type="button"
            id="fab-presets-toggle-btn"
            onClick={() => setShowPresetsMenu((prev) => !prev)}
            className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 font-medium flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Smartphone className="w-3 h-3 text-blue-400" />
            <span>Presetler</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>İptal</span>
          </button>

          <button
            type="button"
            onClick={onSave}
            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 border border-blue-400/40 transition-all flex items-center gap-1.5 cursor-pointer hover:scale-102 active:scale-98"
          >
            <Check className="w-4 h-4" />
            <span>Kaydet & Çık</span>
          </button>
        </div>
      </div>

      {/* Presets dropdown modal / popover */}
      {showPresetsMenu && (
        <div
          id="fab-presets-dropdown-modal"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-65 w-[94%] max-w-lg bg-[#141722]/98 border border-white/20 backdrop-blur-2xl rounded-2xl p-4 shadow-2xl shadow-black space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-2 font-bold text-xs text-white">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Konum Presetleri</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPresetsMenu(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Unified Profile & Preset Cards */}
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
            {effectiveProfiles.map((p) => {
              const isCurrent = areFabPositionsEqual(positions, p.positions);
              const isEditingThis = editingProfileId === p.id;
              const normP = normalizeFabPositions(p.positions);

              return (
                <div
                  key={p.id}
                  className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                    isCurrent
                      ? 'bg-blue-600/15 border-blue-500/50 ring-1 ring-blue-500/30'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    {isEditingThis ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingProfileName}
                          onChange={(e) => setEditingProfileName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmRename(p.id);
                            if (e.key === 'Escape') setEditingProfileId(null);
                          }}
                          autoFocus
                          className="px-2 py-0.5 rounded bg-black/60 border border-blue-400 text-xs text-white focus:outline-none w-36"
                        />
                        <button
                          type="button"
                          onClick={() => handleConfirmRename(p.id)}
                          className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProfileId(null)}
                          className="p-1 text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-200 truncate">
                          {p.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-300 font-bold">
                            Aktif
                          </span>
                        )}
                      </div>
                    )}

                    {/* Coordinates with icons */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-300 font-mono">
                      <span className="flex items-center gap-1" title="İstatistik Konumu">
                        <BarChart3 className="w-3 h-3 text-blue-400" />
                        <span>{normP.statistics.bottom}x{normP.statistics.side}px</span>
                      </span>
                      <span className="flex items-center gap-1" title="Son Aktivite Konumu">
                        <History className="w-3 h-3 text-purple-400" />
                        <span>{normP.recentActivity.bottom}x{normP.recentActivity.side}px</span>
                      </span>
                      <span className="flex items-center gap-1" title="Yeni Kart Ekle Konumu">
                        <Plus className="w-3 h-3 text-emerald-400" />
                        <span>{normP.addItem.bottom}x{normP.addItem.side}px</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onApplyPreset(p.positions);
                        // Do not close presets menu, let user test multiple presets
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white'
                      }`}
                    >
                      Uygula
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartRename(p)}
                      title="Yeniden Adlandır"
                      className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProfile(p.id)}
                      title="Profili Sil"
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick save current position as new preset */}
          <form onSubmit={handleCreateProfile} className="pt-2 border-t border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={profileNameInput}
              onChange={(e) => setProfileNameInput(e.target.value)}
              placeholder="Şu anki konumu adlandırıp kaydet..."
              className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!profileNameInput.trim()}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Kaydet</span>
            </button>
          </form>

          {profileErrorMsg && (
            <div className="text-[11px] text-rose-400 text-center font-medium flex items-center justify-center gap-1 p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{profileErrorMsg}</span>
            </div>
          )}

          {saveSuccessMsg && (
            <div className="text-[11px] text-emerald-400 text-center font-medium">
              {saveSuccessMsg}
            </div>
          )}
        </div>
      )}

      {/* 3. Floating Adjustment Widget for Selected Button (D-Pad + Sliders) - Only when selectedFab is not null */}
      {selectedFab && curPos && activeMeta && (
        <div
          id="fab-active-control-bubble"
          className="fixed z-60 bg-[#12151e]/98 border border-blue-500/50 backdrop-blur-2xl p-3.5 rounded-2xl shadow-2xl shadow-black max-w-[310px] w-[92vw] sm:w-[300px] animate-in fade-in zoom-in-95 duration-150 text-white space-y-3"
          style={{
            bottom: Math.max(16, Math.min(window.innerHeight - 260, curPos.bottom + 68)),
            left: selectedFab === 'addItem' ? 'auto' : Math.max(12, curPos.side - 10) + 'px',
            right: selectedFab === 'addItem' ? Math.max(12, curPos.side - 10) + 'px' : 'auto',
          }}
        >
          {/* Header: Name + Badges + Reset + Close */}
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              {activeMeta.icon}
              <span className="text-xs font-bold text-slate-100">
                {activeMeta.name}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30" title="Dikey (Y) Mesafe">
                D: {curPos.bottom}px
              </span>
              <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30" title="Yatay (X) Mesafe">
                Y: {curPos.side}px
              </span>
              <button
                type="button"
                onClick={() => {
                  const def = DEFAULT_FAB_POSITIONS[selectedFab];
                  onChangeCoord(selectedFab, 'bottom', def.bottom);
                  onChangeCoord(selectedFab, 'side', def.side);
                }}
                title="Varsayılan Konuma Sıfırla"
                className="p-1 text-slate-400 hover:text-amber-300 rounded cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onSelectFab(null)}
                title="Seçimi Kaldır"
                className="p-1 text-slate-400 hover:text-white rounded cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 4-Way D-Pad Directional Controller */}
          <div className="flex items-center justify-center pt-0.5">
            <div className="relative w-28 h-28 flex items-center justify-center bg-black/40 border border-white/10 rounded-2xl p-1">
              {/* Up Button (Dikey +4px) */}
              <button
                type="button"
                onClick={() => handleAdjust('bottom', +4)}
                title="Yukarı Taşı (+4px Dikey)"
                className="absolute top-1.5 left-1/2 -translate-x-1/2 w-8 h-8 rounded-lg bg-white/10 hover:bg-blue-600 active:scale-95 text-slate-200 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10 shadow"
              >
                <ArrowUp className="w-4 h-4" />
              </button>

              {/* Down Button (Dikey -4px) */}
              <button
                type="button"
                onClick={() => handleAdjust('bottom', -4)}
                title="Aşağı Taşı (-4px Dikey)"
                className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-8 rounded-lg bg-white/10 hover:bg-blue-600 active:scale-95 text-slate-200 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10 shadow"
              >
                <ArrowDown className="w-4 h-4" />
              </button>

              {/* Left Button (Yatay -4px) */}
              <button
                type="button"
                onClick={() => handleAdjust('side', -4)}
                title="Sola Taşı"
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/10 hover:bg-blue-600 active:scale-95 text-slate-200 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10 shadow"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* Right Button (Yatay +4px) */}
              <button
                type="button"
                onClick={() => handleAdjust('side', +4)}
                title="Sağa Taşı"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/10 hover:bg-blue-600 active:scale-95 text-slate-200 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/10 shadow"
              >
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Center indicator */}
              <div className="w-5 h-5 rounded-md bg-blue-500/20 border border-blue-400/40 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              </div>
            </div>
          </div>

          {/* Precision Sliders: Dikey (Y) and Yatay (X) */}
          <div className="space-y-2 pt-1 border-t border-white/10">
            {/* Dikey Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-blue-300">Dikey (Alt Boşluk):</span>
                <span className="font-mono text-xs font-bold text-white">{curPos.bottom}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                step={2}
                value={curPos.bottom}
                onChange={(e) => handleSlider('bottom', Number(e.target.value))}
                className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Yatay Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-purple-300">Yatay (Kenar Boşluğu):</span>
                <span className="font-mono text-xs font-bold text-white">{curPos.side}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={200}
                step={2}
                value={curPos.side}
                onChange={(e) => handleSlider('side', Number(e.target.value))}
                className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
