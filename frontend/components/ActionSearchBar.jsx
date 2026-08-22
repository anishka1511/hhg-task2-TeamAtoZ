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
  placeholder = 'Type, speak, or pick a suggested prompt',
  inlineControl = null,
}) {
  const [selectedLang, setSelectedLang] = useState('en');
  const [detectedLang, setDetectedLang] = useState(null);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [dropdownRect, setDropdownRect] = useState(null);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const rootRef = useRef(null);
  const portalRef = useRef(null);
  const inputRef = useRef(null);
  const prevDetectedRef = useRef(null);
  const pendingCloseRef = useRef(null);

  const activeLang = selectedLang;
  const isEmpty = !value.trim();

  const suggestions = useMemo(
    () => getPromptsForLang(activeLang, ''),
    [activeLang],
  );

  const showDropdown = open && !disabled && suggestions.length > 0;

  const syncDropdownRect = useCallback(() => {
    const rect = measureDropdownRect(inputRef.current);
    if (rect) setDropdownRect(rect);
    return rect;
  }, []);

  const closeDropdown = useCallback(() => {
    setOpen(false);
  }, []);

  const cancelPendingClose = useCallback(() => {
    if (pendingCloseRef.current !== null) {
      cancelAnimationFrame(pendingCloseRef.current);
      pendingCloseRef.current = null;
    }
  }, []);

  const scheduleCloseDropdown = useCallback(() => {
    cancelPendingClose();
    pendingCloseRef.current = requestAnimationFrame(() => {
      pendingCloseRef.current = null;
      closeDropdown();
    });
  }, [cancelPendingClose, closeDropdown]);

  const openDropdown = useCallback(() => {
    if (disabled || value.trim()) return;
    cancelPendingClose();
    syncDropdownRect();
    setOpen(true);
  }, [disabled, value, syncDropdownRect, cancelPendingClose]);

  const openPromptsDropdown = useCallback(() => {
    if (disabled) return;
    cancelPendingClose();
    syncDropdownRect();
    setOpen(true);
  }, [disabled, syncDropdownRect, cancelPendingClose]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const syncLayout = () => setIsMobileLayout(mq.matches);
    syncLayout();
    mq.addEventListener('change', syncLayout);
    return () => mq.removeEventListener('change', syncLayout);
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
    setHighlightIndex(0);
  }, [suggestions, activeLang]);

  useLayoutEffect(() => {
    if (!showDropdown || !isMobileLayout) return undefined;

    syncDropdownRect();
    window.addEventListener('resize', syncDropdownRect);
    window.addEventListener('scroll', syncDropdownRect, true);
    return () => {
      window.removeEventListener('resize', syncDropdownRect);
      window.removeEventListener('scroll', syncDropdownRect, true);
    };
  }, [showDropdown, isMobileLayout, selectedLang, suggestions.length, syncDropdownRect]);

  useEffect(() => {
    if (!showDropdown || !isMobileLayout) return;
    const el = portalRef.current?.querySelector('.beach-action-suggestion.is-highlighted');
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, showDropdown, isMobileLayout]);

  useEffect(() => {
    function onDocPointerDown(e) {
      const target = e.target;
      if (portalRef.current?.contains(target)) return;
      closeDropdown();
    }
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
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
    openPromptsDropdown();
    inputRef.current?.focus({ preventScroll: true });
  }

  function handleInputChange(next) {
    onChange(next);
    if (next.trim()) {
      closeDropdown();
    }
  }

  const portalRect = showDropdown && isMobileLayout
    ? dropdownRect ?? measureDropdownRect(inputRef.current)
    : null;

  const listMaxHeight = portalRect?.maxListHeight ?? MAX_LIST_HEIGHT;

  const dropdownPanel =
    showDropdown ? (
      <div
        ref={portalRef}
        id="beach-action-suggestions"
        className={`beach-action-dropdown is-open ${isMobileLayout ? 'beach-action-dropdown-portal' : 'beach-action-dropdown-inline'}`}
        role="listbox"
        style={
          isMobileLayout && portalRect
            ? {
                position: 'fixed',
                top: portalRect.top,
                left: portalRect.left,
                width: portalRect.width,
                zIndex: 9999,
              }
            : undefined
        }
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="beach-action-dropdown-head">
          <span>Suggested prompts</span>
          <span className="beach-action-dropdown-lang">{activeLang.toUpperCase()}</span>
        </div>
        <ul
          className="beach-action-dropdown-list"
          style={{ maxHeight: listMaxHeight }}
        >
          {suggestions.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={highlightIndex === index}
                className={`beach-action-suggestion ${highlightIndex === index ? 'is-highlighted' : ''} ${item.isRefusal ? 'is-refusal' : ''}`}
                onMouseEnter={() => setHighlightIndex(index)}
                onPointerDown={(e) => e.preventDefault()}
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

  const showPortalDropdown = Boolean(isMobileLayout && portalRect && dropdownPanel);

  return (
    <div className="beach-action-search" ref={rootRef}>
      <div
        className="beach-action-search-toolbar"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="beach-action-search-toolbar-label beach-action-prompts-trigger"
          onPointerDown={(e) => {
            e.stopPropagation();
            openPromptsDropdown();
          }}
          disabled={disabled}
          aria-expanded={showDropdown}
          aria-controls="beach-action-suggestions"
        >
          Prompts
        </button>
        <div className="beach-action-search-langs" role="tablist" aria-label="Prompt language">
          {PROMPT_LANGS.map((lang) => (
            <button
              key={lang.id}
              type="button"
              role="tab"
              aria-selected={selectedLang === lang.id}
              className={`beach-action-lang-tab ${selectedLang === lang.id ? 'active' : ''}`}
              disabled={disabled}
              onPointerDown={(e) => e.stopPropagation()}
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

      <div className="beach-action-search-form">
        <form
          onSubmit={handleSubmit}
          className="beach-search-row"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="beach-action-input-wrap">
            {isEmpty && isMobileLayout && (
              <div className="beach-input-marquee" aria-hidden="true">
                <div className="beach-input-marquee-track">
                  <span className="beach-input-marquee-text">{placeholder}</span>
                  <span className="beach-input-marquee-text">{placeholder}</span>
                </div>
              </div>
            )}
            <input
              ref={inputRef}
              className={`beach-query-input beach-action-input ${isEmpty && isMobileLayout ? 'is-empty' : ''}`}
              value={value}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                if (isEmpty) openDropdown();
              }}
              onPointerDown={() => {
                cancelPendingClose();
                if (isEmpty) openDropdown();
              }}
              onKeyDown={handleKeyDown}
              placeholder={isMobileLayout ? '' : placeholder}
              aria-label={placeholder}
              disabled={disabled}
              role="combobox"
              aria-expanded={showDropdown}
              aria-controls="beach-action-suggestions"
              aria-autocomplete="list"
              autoComplete="off"
            />
          </div>

          {inlineControl ? (
            <div className="beach-search-inline-voice">{inlineControl}</div>
          ) : null}

          <button
            type="submit"
            className="beach-drop-beat-btn beach-action-ask-btn"
            disabled={disabled || !value.trim()}
          >
            {disabled ? '…' : 'ASK'}
          </button>
        </form>

        {!isMobileLayout && dropdownPanel}
      </div>

      {typeof document !== 'undefined' && showPortalDropdown
        ? createPortal(dropdownPanel, document.body)
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
