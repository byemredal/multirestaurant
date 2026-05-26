'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { apiBaseUrl } from '@/lib/http/tenant-http';

export type AddressSuggestion = {
  id: string;
  label: string;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

type AddressAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  /** ISO-2 country code from the active CountryPack — narrows results upstream. */
  countryCode?: string;
  placeholder?: string;
  /** Wired into the visible <label htmlFor>. */
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Address search input backed by the server-side /geo/suggest proxy.
 *
 * - 350ms debounce keeps the upstream out of the typing path.
 * - Aborts the previous request when a new keystroke arrives.
 * - The dropdown is a real `combobox`/`listbox` so screen-readers and the
 *   keyboard work; ↑/↓ navigates, Enter selects, Escape closes.
 * - Selecting a suggestion writes its `label` back through `onChange` and
 *   reports the parsed parts (city / postalCode / lat / lon) via `onSelect`.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  countryCode,
  placeholder,
  id,
  invalid,
  disabled,
  className,
}: AddressAutocompleteProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listboxId = `${fieldId}-listbox`;
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selectionLockRef = useRef<string | null>(null);

  const trimmed = useMemo(() => value.trim(), [value]);

  useEffect(() => {
    if (selectionLockRef.current === trimmed) {
      // User just chose a suggestion — don't immediately re-query the same
      // string and re-open the list under their cursor.
      return;
    }
    selectionLockRef.current = null;

    if (trimmed.length < 3) {
      setSuggestions([]);
      setError(null);
      setLoading(false);
      return;
    }

    const handle = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ q: trimmed });
      if (countryCode) {
        params.set('country', countryCode);
      }

      fetch(`${apiBaseUrl}/geo/suggest?${params.toString()}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            let message = `tenant_geo_suggest_failed_${response.status}`;
            try {
              const payload = await response.json();
              if (typeof payload?.message === 'string') {
                message = payload.message;
              }
            } catch {
              /* keep status fallback */
            }
            throw new Error(message);
          }
          return response.json() as Promise<{ results: AddressSuggestion[] }>;
        })
        .then((payload) => {
          if (controller.signal.aborted) return;
          setSuggestions(payload.results ?? []);
          setOpen(true);
          setActiveIndex((payload.results ?? []).length > 0 ? 0 : -1);
        })
        .catch((suggestError) => {
          if (controller.signal.aborted) return;
          const message =
            suggestError instanceof Error
              ? suggestError.message
              : 'Adres aramada bir sorun oluştu.';
          setSuggestions([]);
          setError(
            message.startsWith('tenant_geo_suggest_failed_')
              ? 'Adres arama servisi şu an cevap vermiyor.'
              : message,
          );
          setOpen(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 350);

    return () => {
      window.clearTimeout(handle);
    };
  }, [trimmed, countryCode]);

  // Close on outside click so the dropdown doesn't trap users.
  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const commitSelection = useCallback(
    (suggestion: AddressSuggestion) => {
      selectionLockRef.current = suggestion.label.trim();
      onChange(suggestion.label);
      onSelect?.(suggestion);
      setOpen(false);
      setSuggestions([]);
      setActiveIndex(-1);
    },
    [onChange, onSelect],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!open || suggestions.length === 0) {
        if (event.key === 'ArrowDown' && suggestions.length > 0) {
          event.preventDefault();
          setOpen(true);
          setActiveIndex(0);
        }
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      } else if (event.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          event.preventDefault();
          commitSelection(suggestions[activeIndex]!);
        }
      } else if (event.key === 'Escape') {
        setOpen(false);
      }
    },
    [activeIndex, commitSelection, open, suggestions],
  );

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ''}`}>
      <input
        id={fieldId}
        role="combobox"
        type="text"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listboxId}
        aria-activedescendant={
          activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
        }
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={`h-12 w-full rounded-2xl border px-4 text-[15px] outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-ink-50 ${
          invalid ? 'border-danger-200 bg-danger-50/40 text-danger-900' : 'border-ink-200 bg-white text-ink-900'
        }`}
      />

      {loading ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 inline-flex h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-ink-300 border-t-transparent"
        />
      ) : null}

      {open && (suggestions.length > 0 || error) ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-y-auto rounded-2xl border border-ink-100 bg-white py-1 shadow-pop"
        >
          {error ? (
            <li className="px-4 py-2.5 text-[13px] text-danger-700" role="option" aria-selected="false">
              {error}
            </li>
          ) : null}
          {!error
            ? suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.id}
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    commitSelection(suggestion);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`cursor-pointer px-4 py-2.5 text-[13.5px] leading-snug ${
                    index === activeIndex ? 'bg-primary-50 text-primary-900' : 'text-ink-800'
                  }`}
                >
                  <div className="font-medium">{suggestion.label}</div>
                  {suggestion.postalCode || suggestion.city ? (
                    <div className="text-[12px] text-ink-500">
                      {[suggestion.postalCode, suggestion.city].filter(Boolean).join(' · ')}
                    </div>
                  ) : null}
                </li>
              ))
            : null}
        </ul>
      ) : null}
    </div>
  );
}
