'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  PROMPT_LANGS,
  detectScriptLang,
  getPromptsForLang,
} from '../data/demoPrompts';

const DROPDOWN_HEAD_HEIGHT = 44;
const VIEWPORT_PAD = 16;
const DROPDOWN_GAP = 8;
const MAX_LIST_HEIGHT = 260;

function measureDropdownRect(inputEl) {
  if (!inputEl || typeof window === 'undefined') return null;
  const rect = inputEl.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
  const available = spaceBelow - DROPDOWN_HEAD_HEIGHT - DROPDOWN_GAP;
  const maxListHeight = Math.max(100, Math.min(MAX_LIST_HEIGHT, available));

  return {
    top: rect.bottom + DROPDOWN_GAP,
    left: rect.left,
    width: Math.max(rect.width, 280),
    maxListHeight,
  };
}

export default function ActionSearchBar({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Ask a question, or tap the voice grid to speak…',
}) {
  const [selectedLang, setSelectedLang] = useState('en');
  const [detectedLang, setDetectedLang] = useState(null);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [dropdownRect, setDropdownRect] = useState(null);
  const rootRef = useRef(null);
  const portalRef = useRef(null);
  const inputRef = useRef(null);
  const prevDetectedRef = useRef(null);

  const activeLang = selectedLang;
  const isEmpty = !value.trim();

  const suggestions = useMemo(
    () => getPromptsForLang(activeLang, ''),
    [activeLang],
  );

  const showDropdown = open && !disabled && isEmpty && suggestions.length > 0;

  const syncDropdownRect = useCallback(() => {
    const rect = measureDropdownRect(inputRef.current);
    if (rect) setDropdownRect(rect);
    return rect;
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled || value.trim()) return;
    syncDropdownRect();
    setOpen(true);
  }, [disabled, value, syncDropdownRect]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const detected = detectScriptLang(value);
    setDetectedLang(detected);
    // Only auto-switch tabs when the user types a new script, not on manual tab clicks.
    if (detected && detected !== prevDetectedRef.current) {
      setSelectedLang(detected);
    }
    prevDetectedRef.current = detected;
  }, [value]);

  useEffect(() => {
    if (!isEmpty) closeDropdown();
  }, [isEmpty, closeDropdown]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [suggestions, activeLang]);

  useLayoutEffect(() => {
    if (!showDropdown) return undefined;

    syncDropdownRect();
    window.addEventListener('resize', syncDropdownRect);
    window.addEventListener('scroll', syncDropdownRect, true);
    return () => {
      window.removeEventListener('resize', syncDropdownRect);
      window.removeEventListener('scroll', syncDropdownRect, true);
    };
  }, [showDropdown, selectedLang, suggestions.length, syncDropdownRect]);

  useEffect(() => {
    if (!showDropdown) return;
    const el = portalRef.current?.querySelector('.beach-action-suggestion.is-highlighted');
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, showDropdown]);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (rootRef.current?.contains(e.target)) return;
      if (portalRef.current?.contains(e.target)) return;
      closeDropdown();
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [closeDropdown]);

  function selectSuggestion(item) {
    onChange(item.question);
    closeDropdown();
    onSubmit(item.question);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const q = value.trim();
    if (!q || disabled) return;
    closeDropdown();
    onSubmit(q);
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(e);
      return;
    }

    if (!isEmpty) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      openDropdown();
      setHighlightIndex((i) => Math.min(i + 1, Math.max(suggestions.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      openDropdown();
      setHighlightIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Escape') {
      closeDropdown();
      return;
    }
    if (e.key === 'Enter' && open && suggestions.length > 0) {
      const picked = suggestions[highlightIndex];
      if (picked && document.activeElement === inputRef.current) {
        e.preventDefault();
        selectSuggestion(picked);
      }
    }
  }

  function pickLang(langId) {
    setSelectedLang(langId);
    if (!value.trim()) {
      openDropdown();
    }
    inputRef.current?.focus({ preventScroll: true });
  }

  function handleInputChange(next) {
    onChange(next);
    if (next.trim()) {
      closeDropdown();
    }
  }

  const rect = showDropdown
    ? dropdownRect ?? measureDropdownRect(inputRef.current)
    : null;

  const dropdown =
    showDropdown && rect ? (
      <div
        ref={portalRef}
        id="beach-action-suggestions"
        className="beach-action-dropdown is-open beach-action-dropdown-portal"
        role="listbox"
        style={{
          position: 'fixed',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          zIndex: 9999,
        }}
      >
        <div className="beach-action-dropdown-head">
          <span>Suggested prompts</span>
          <span className="beach-action-dropdown-lang">{activeLang.toUpperCase()}</span>
        </div>
        <ul
          className="beach-action-dropdown-list"
          style={{ maxHeight: rect.maxListHeight }}
        >
          {suggestions.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={highlightIndex === index}
                className={`beach-action-suggestion ${highlightIndex === index ? 'is-highlighted' : ''} ${item.isRefusal ? 'is-refusal' : ''}`}
                onMouseEnter={() => setHighlightIndex(index)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(item)}
              >
                <span className="beach-action-suggestion-title">{item.title}</span>
                <span className="beach-action-suggestion-question">{item.question}</span>
                <span className="beach-action-suggestion-hint">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="beach-action-search" ref={rootRef}>
      <div className="beach-action-search-toolbar">
        <span className="beach-action-search-toolbar-label">Prompts</span>
        <div className="beach-action-search-langs" role="tablist" aria-label="Prompt language">
          {PROMPT_LANGS.map((lang) => (
            <button
              key={lang.id}
              type="button"
              role="tab"
              aria-selected={selectedLang === lang.id}
              className={`beach-action-lang-tab ${selectedLang === lang.id ? 'active' : ''}`}
              disabled={disabled}
              onClick={() => pickLang(lang.id)}
            >
              {lang.label}
            </button>
          ))}
        </div>
        {detectedLang && detectedLang !== selectedLang && (
          <span className="beach-action-detect-chip">
            Detected: {detectedLang.toUpperCase()}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="beach-search-row beach-action-search-form">
        <div className="beach-action-input-wrap">
          <input
            ref={inputRef}
            className="beach-query-input beach-action-input"
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (isEmpty) openDropdown();
            }}
            onMouseDown={() => {
              if (isEmpty) openDropdown();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="beach-action-suggestions"
            aria-autocomplete="list"
            autoComplete="off"
          />
        </div>

        <button
          type="submit"
          className="beach-drop-beat-btn"
          disabled={disabled || !value.trim()}
        >
          {disabled ? '…' : 'ASK'}
        </button>
      </form>

      {typeof document !== 'undefined' && dropdown
        ? createPortal(dropdown, document.body)
        : null}

      <div className="beach-action-shortcuts" aria-hidden="true">
        {isEmpty ? (
          <>
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              browse prompts
            </span>
            <span>
              <kbd>Enter</kbd>
              pick
            </span>
          </>
        ) : (
          <span>
            <kbd>Ctrl</kbd>+<kbd>Enter</kbd>
            ask
          </span>
        )}
      </div>
    </div>
  );
}
