import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';

interface TagInputBoxProps {
  label: string;
  placeholder?: string;
  tags: string[];
  onChange: (newTags: string[]) => void;
  availableTags: string[]; // Field-scoped isolated tags for autocomplete & dropdown
  tagCounts?: Map<string, number>; // Usage counts for each tag
  icon?: React.ReactNode;
}

export const TagInputBox: React.FC<TagInputBoxProps> = ({
  label,
  placeholder = 'Etiket ekle...',
  tags = [],
  onChange,
  availableTags = [],
  tagCounts,
  icon,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        {tags.length > 0 && (
          <span className="text-[10px] text-slate-400 font-medium">
            {tags.length} seçili
          </span>
        )}
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
        {tags.map((tag, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-medium group transition-all"
          >
            <span>{tag}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(idx);
              }}
              className="text-blue-400/70 hover:text-white hover:bg-blue-500/30 p-0.5 rounded-full transition-colors cursor-pointer"
              title="Etiketi kaldır"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
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
