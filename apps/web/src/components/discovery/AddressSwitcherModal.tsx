'use client';

/**
 * Address switcher — the single address-switching surface, opened from the
 * header's location control. Selecting a location navigates to its canonical
 * discovery URL; `DiscoveryProvider` then resolves it. The modal never holds
 * address state of its own.
 */

import { useRouter } from 'next/navigation';

import LocationInput from './LocationInput';
import { useAddressContext } from '@/lib/discovery/discovery-context';
import {
  buildDiscoveryPath,
  type FulfillmentMode,
} from '@/lib/home-discovery';
import type { LocationSuggestion } from '@/lib/discovery/discovery-types';

interface AddressSwitcherModalProps {
  open: boolean;
  mode: FulfillmentMode;
  onClose: () => void;
}

export default function AddressSwitcherModal({
  open,
  mode,
  onClose,
}: AddressSwitcherModalProps) {
  const router = useRouter();
  const { savedAddresses, isAuthenticated, location } = useAddressContext();

  if (!open) return null;

  const navigate = (postalCode: string, city: string | null) => {
    onClose();
    router.push(buildDiscoveryPath(mode, postalCode, city));
  };

  const handleSuggestion = (suggestion: LocationSuggestion) => {
    navigate(suggestion.postalCode, suggestion.city || null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 px-4 pb-4 sm:items-center sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-label="Teslimat adresini değiştir"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[520px] overflow-hidden rounded-3xl bg-white shadow-pop"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-6">
          <h3 className="text-[18px] font-bold text-ink-900">
            Teslimat konumu
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-500 transition hover:bg-ink-100"
          >
            <XIcon />
          </button>
        </div>

        <div className="px-6 pt-4">
          <LocationInput
            onSelect={handleSuggestion}
            autoFocus
            placeholder="Posta kodu veya adres ara"
          />
        </div>

        {isAuthenticated && savedAddresses.length > 0 && (
          <div className="mt-4 border-t border-ink-100 px-3 pb-4 pt-3">
            <p className="px-3 pb-1 text-[12px] font-semibold uppercase tracking-wider text-ink-400">
              Kayıtlı adreslerim
            </p>
            <ul className="max-h-[230px] overflow-y-auto">
              {savedAddresses.map((address) => {
                const active = location?.savedAddressId === address.id;
                return (
                  <li key={address.id}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(address.postalCode, address.city || null)
                      }
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                        active ? 'bg-primary-50' : 'hover:bg-ink-50'
                      }`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-700">
                        <HomeIcon />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[14px] font-semibold text-ink-900">
                            {address.label ?? address.city}
                          </span>
                          {address.isDefault && (
                            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-500">
                              Varsayılan
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[12.5px] text-ink-500">
                          {address.formattedAddress}
                        </span>
                      </span>
                      {active && (
                        <span className="text-[12px] font-semibold text-primary-700">
                          Seçili
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {isAuthenticated && savedAddresses.length === 0 && (
          <p className="border-t border-ink-100 px-6 py-4 text-[13px] text-ink-500">
            Henüz kayıtlı adresin yok. Sipariş verirken adresini
            kaydedebilirsin.
          </p>
        )}

        {!isAuthenticated && (
          <p className="px-6 pb-6 pt-3 text-[12.5px] text-ink-400">
            Konumun bu tarayıcıda saklanır. Giriş yaparsan adreslerini
            hesabına kaydedebilirsin.
          </p>
        )}
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function HomeIcon() {
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
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
