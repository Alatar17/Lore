import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, ChevronDown, Sparkles, RotateCcw } from 'lucide-react';

interface TagInputBoxProps {
  label: string;
  placeholder?: string;
  tags: string[];
  onChange: (newTags: string[]) => void;
  availableTags: string[]; // Field-scoped isolated tags for autocomplete & dropdown
  tagCounts?: Map<string, number>; // Usage counts for each tag
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  highlightNewTags?: string[];
  highlightRemovedTags?: string[];
  onRestoreRemovedTag?: (tag: string) => void;
  hideCount?: boolean;
}

export const TagInputBox: React.FC<TagInputBoxProps> = ({
  label,
  placeholder = 'Etiket ekle...',
  tags = [],
  onChange,
  availableTags = [],
  tagCounts,
  icon,
  rightElement,
  highlightNewTags = [],
  highlightRemovedTags = [],
  onRestoreRemovedTag,
  hideCount = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Smooth scroll into view when dropdown is opened so user doesn't have to scroll manually
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (dropdownRef.current) {
          dropdownRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Filter available tags that are NOT already selected
  const unselectedTags = availableTags.filter(
    (t) => !tags.some((selected) => selected.toLowerCase() === t.toLowerCase())
  );

  // If user is typing, filter matching items; if input is empty, show all available unselected tags
  const filteredSuggestions = inputValue.trim()
    ? unselectedTags.filter((t) =>
        t.toLowerCase().includes(inputValue.trim().toLowerCase())
      )
    : unselectedTags;

  const canCreateNew =
    inputValue.trim().length > 0 &&
    !tags.some((t) => t.toLowerCase() === inputValue.trim().toLowerCase()) &&
    !availableTags.some((t) => t.toLowerCase() === inputValue.trim().toLowerCase());

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;
    if (tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;

    onChange([...tags, trimmed]);
    setInputValue('');
    inputRef.current?.focus();
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        const exactMatch = filteredSuggestions.find(
          (s) => s.toLowerCase() === inputValue.trim().toLowerCase()
        );
        addTag(exactMatch || inputValue.trim());
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-1.5 relative w-full">
      <div className="flex items-center justify-between">
        <label className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
          {icon}
          {label}
        </label>
        <div className="flex items-center gap-2">
          {tags.length > 0 && !hideCount && (
            <span className="text-[10px] text-slate-400 font-medium">
              {tags.length} seçili
            </span>
          )}
          {rightElement}
        </div>
      </div>

      {/* Box container with pills and input */}
      <div
        onClick={() => {
          inputRef.current?.focus();
          setIsOpen(true);
        }}
        className={`min-h-[38px] p-1.5 bg-black/35 border rounded-xl flex flex-wrap items-center gap-1.5 cursor-text transition-all ${
          isOpen
            ? 'border-blue-500/70 ring-1 ring-blue-500/30'
            : 'border-white/10 hover:border-white/20'
        }`}
      >
        {/* Rendered Selected Tag Chips */}
        {tags.map((tag, idx) => {
          const isNewAi = highlightNewTags.some(
            (t) => t.trim().toLowerCase() === tag.trim().toLowerCase()
          );
          return (
            <span
              key={idx}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium group transition-all ${
                isNewAi
                  ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/30 shadow-xs shadow-emerald-500/20'
                  : 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
              }`}
            >
              {isNewAi && <Sparkles className="w-2.5 h-2.5 text-emerald-400 shrink-0" />}
              <span>{tag}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(idx);
                }}
                className={`p-0.5 rounded-full transition-colors cursor-pointer ${
                  isNewAi
                    ? 'text-emerald-400/80 hover:text-white hover:bg-emerald-500/30'
                    : 'text-blue-400/70 hover:text-white hover:bg-blue-500/30'
                }`}
                title="Etiketi kaldır"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}

        {/* Removed tags that AI omitted (dashed red chip, click to restore) */}
        {highlightRemovedTags.map((tag, idx) => (
          <button
            key={`removed-${idx}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRestoreRemovedTag?.(tag);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-dashed border-rose-500/50 text-rose-300/85 text-xs font-medium line-through hover:no-underline hover:text-rose-100 hover:bg-rose-500/30 hover:border-rose-400 transition-all cursor-pointer group"
            title={`"${tag}" AI önerisinde yer almıyor. Korumak / geri eklemek için tıklayın`}
          >
            <span>{tag}</span>
            <RotateCcw className="w-2.5 h-2.5 text-rose-400 group-hover:text-rose-200 shrink-0 ml-0.5" />
          </button>
        ))}

        {/* Inline Input Field */}
        <div className="flex-1 min-w-[120px] flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : 'Yeni ekle veya seç...'}
            className="w-full bg-transparent text-slate-100 text-xs focus:outline-none placeholder-slate-500 py-1 px-1"
          />
        </div>

        {/* Dropdown Indicator Button */}
        {availableTags.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen((prev) => !prev);
              inputRef.current?.focus();
            }}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors cursor-pointer shrink-0"
            title="Tüm etiketleri göster"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                isOpen ? 'rotate-180 text-blue-400' : ''
              }`}
            />
          </button>
        )}
      </div>

      {/* Autocomplete / Eagle Style Tag Chips (Oval Pills Side-by-Side) */}
      {isOpen && (filteredSuggestions.length > 0 || canCreateNew) && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-[#151822]/98 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden p-2.5 max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header info in dropdown */}
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 pb-2 mb-2 border-b border-white/10 flex items-center justify-between">
            <span>Önerilen Etiketler</span>
            <span>{filteredSuggestions.length} mevcut</span>
          </div>

          {/* Tag Chips Flex-Wrap Container */}
          <div className="flex flex-wrap gap-1.5 items-center">
            {/* Create new tag pill if user typed something unique */}
            {canCreateNew && (
              <button
                type="button"
                onClick={() => addTag(inputValue.trim())}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/50 shadow-sm transition-all cursor-pointer group"
              >
                <Plus className="w-3 h-3 text-blue-300 group-hover:text-white" />
                <span>Ekle: "{inputValue.trim()}"</span>
                <span className="text-[9px] px-1 py-0.2 bg-black/40 rounded text-blue-300/80">Enter ↵</span>
              </button>
            )}

            {/* Existing Tag Suggestion Pills (Oval Chips with Count) */}
            {filteredSuggestions.map((suggestion) => {
              const count = tagCounts ? tagCounts.get(suggestion) : undefined;
              return (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => addTag(suggestion)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 hover:bg-blue-600 text-slate-200 hover:text-white border border-white/10 hover:border-blue-500 transition-all cursor-pointer group"
                >
                  <span>{suggestion}</span>
                  {typeof count === 'number' && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/40 text-slate-400 group-hover:text-blue-100 font-mono font-bold">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
