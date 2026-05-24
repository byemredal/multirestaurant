'use client';

/**
 * Reusable customer location input.
 *
 * Postal-code + address search with an autocomplete-ready architecture. It
 * depends only on the `LocationSearchProvider` seam — swap the provider to use
 * Swisstopo / Google Places / Mapbox / Nominatim with no changes here.
 */

import { useEffect, useId, useRef, useState } from 'react';

import {
  defaultLocationProvider,
  isSwissPostalCode,
  postalCodeSuggestion,
  type LocationSearchProvider,
} from '@/lib/discovery/location-provider';
import type { LocationSuggestion } from '@/lib/discovery/discovery-types';

interface LocationInputProps {
  onSelect: (suggestion: LocationSuggestion) => void;
  provider?: LocationSearchProvider;
  placeholder?: string;
  autoFocus?: boolean;
  /** Disable the field while a selection is being processed. */
  busy?: boolean;
}

const SEARCH_DEBOUNCE_MS = 250;

export default function LocationInput({
  onSelect,
  provider = defaultLocationProvider,
  placeholder = 'Posta kodu veya adres — örn. 6300 Zug',
  autoFocus = false,
  busy = false,
}: LocationInputProps) {
  const inputId = useId();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Debounced provider search.
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const results = await provider.search(trimmed, controller.signal);
        setSuggestions(results);
        setActiveIndex(results.length > 0 ? 0 : -1);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          // A bare postal code still lets the visitor proceed offline.
          setSuggestions(
            isSwissPostalCode(trimmed) ? [postalCodeSuggestion(trimmed)] : [],
          );
        }
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, provider]);

  const choose = (suggestion: LocationSuggestion) => {
    setQuery(suggestion.label);
    setOpen(false);
    setSuggestions([]);
    onSelect(suggestion);
  };

  const showDropdown = open && query.trim().length > 0;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) {
      if (event.key === 'Enter' && isSwissPostalCode(query)) {
        event.preventDefault();
        choose(postalCodeSuggestion(query.trim()));
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = suggestions[activeIndex >= 0 ? activeIndex : 0];
      if (target) choose(target);
    } else if (event.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative">
      <label htmlFor={inputId} className="sr-only">
        Teslimat konumu
      </label>
      <div
        className={`flex items-center overflow-hidden rounded-2xl bg-white pr-1.5 shadow-card ring-1 transition ${
          open ? 'ring-2 ring-primary/30' : 'ring-ink-200'
        }`}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center text-ink-500">
          <PinIcon />
        </span>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          autoFocus={autoFocus}
          disabled={busy}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          className="h-12 flex-1 bg-transparent pr-2 text-[15px] text-ink-900 outline-none placeholder:text-ink-400 disabled:opacity-60"
        />
        {(loading || busy) && (
          <span
            aria-hidden
            className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-200 border-t-primary"
          />
        )}
      </div>

      {showDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-pop"
        >
          {loading && suggestions.length === 0 ? (
            <p className="px-5 py-4 text-[14px] text-ink-500">Aranıyor…</p>
          ) : suggestions.length === 0 ? (
            <p className="px-5 py-4 text-[14px] text-ink-500">
              Eşleşen konum yok. Posta kodunu deneyebilirsin.
            </p>
          ) : (
            <ul className="max-h-[300px] overflow-y-auto py-1.5">
              {suggestions.map((suggestion, index) => {
                const active = index === activeIndex;
                return (
                  <li key={suggestion.id} role="presentation">
                    <button
                      id={`${listboxId}-${index}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(suggestion)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                        active ? 'bg-primary-50' : 'hover:bg-ink-50'
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                        <PinIcon />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-ink-900">
                          {suggestion.label}
                        </span>
                        <span className="block truncate text-[12.5px] text-ink-500">
                          {suggestion.secondaryLabel}
                        </span>
                      </span>
                      <span className="text-[12px] font-semibold text-primary-700">
                        Seç →
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-6-4.35-6-10a6 6 0 1 1 12 0c0 5.65-6 10-6 10Z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  );
}
