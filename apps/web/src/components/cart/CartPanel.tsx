'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart/cart-context';

function Icon({
  children,
  className = 'h-5 w-5',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const XIcon = () => (
  <Icon>
    <path d="M18 6L6 18M6 6l12 12" />
  </Icon>
);
const PlusIcon = () => (
  <Icon className="h-3.5 w-3.5">
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
const MinusIcon = () => (
  <Icon className="h-3.5 w-3.5">
    <path d="M5 12h14" />
  </Icon>
);
const ArrowRightIcon = () => (
  <Icon className="h-4 w-4">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </Icon>
);

export default function CartPanel() {
  const {
    cart,
    totalItems,
    subtotal,
    updateQty,
    clearCart,
    closeCart,
    openCart,
    setServiceType,
    isSyncing,
    error,
  } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cart.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart.isOpen, closeCart]);

  useEffect(() => {
    if (cart.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [cart.isOpen]);

  const currency = cart.currency || 'CHF';

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] transition-opacity duration-300 ${
          cart.isOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
        onClick={closeCart}
      />

      {/* Sticky bottom bar — visible on mobile when cart has items but panel closed */}
      {totalItems > 0 && !cart.isOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#e4e4e7] bg-white p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] sm:hidden">
          <button
            onClick={openCart}
            type="button"
            className="flex w-full items-center justify-between rounded-[14px] bg-[#084799] px-5 py-3.5 text-white"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[13px] font-bold">
              {totalItems}
            </span>
            <span className="text-[15px] font-semibold">Sepeti Görüntüle</span>
            <span className="text-[15px] font-semibold">
              {subtotal.toFixed(2)} {currency}
            </span>
          </button>
        </div>
      )}

      {/* Drawer panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Sepetim"
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-in-out sm:w-[420px] ${
          cart.isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f4f4f5] px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-bold text-[#18181b]">Sepetim</h2>
              {isSyncing && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#084799] border-t-transparent" />
              )}
            </div>
            {cart.storeName ? (
              <p className="mt-0.5 text-[13px] text-[#71717a]">
                {cart.storeName}
              </p>
            ) : null}
          </div>
          <button
            onClick={closeCart}
            aria-label="Sepeti kapat"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#71717a] transition hover:bg-[#f4f4f5] hover:text-[#18181b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#084799] focus-visible:ring-offset-2"
          >
            <XIcon />
          </button>
        </div>

        {/* Service-type tabs */}
        {cart.items.length > 0 ? (
          <div className="border-b border-[#f4f4f5] px-5 py-3">
            <div
              role="tablist"
              aria-label="Sipariş türü"
              className="inline-flex w-full rounded-[12px] bg-[#f4f4f5] p-1 text-[13px] font-semibold"
            >
              <button
                role="tab"
                aria-selected={cart.serviceType === 'delivery'}
                aria-busy={isSyncing}
                disabled={isSyncing}
                onClick={() => setServiceType('delivery')}
                className={`flex-1 rounded-[10px] px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  cart.serviceType === 'delivery'
                    ? 'bg-white text-[#084799] shadow-sm'
                    : 'text-[#71717a] hover:text-[#18181b]'
                }`}
              >
                Teslimat
              </button>
              <button
                role="tab"
                aria-selected={cart.serviceType === 'pickup'}
                aria-busy={isSyncing}
                disabled={isSyncing}
                onClick={() => setServiceType('pickup')}
                className={`flex-1 rounded-[10px] px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  cart.serviceType === 'pickup'
                    ? 'bg-white text-[#084799] shadow-sm'
                    : 'text-[#71717a] hover:text-[#18181b]'
                }`}
              >
                Gel Al
              </button>
            </div>
          </div>
        ) : null}

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-3 rounded-[12px] bg-red-50 px-4 py-3 text-[13px] text-red-600">
              {error}
            </div>
          )}
          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f4f4f5] text-[#a1a1aa]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                  <path d="M3 6h18" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <p className="text-[16px] font-semibold text-[#18181b]">
                Sepetiniz boş
              </p>
              <p className="mt-1 text-[14px] text-[#71717a]">
                Menüden ürün ekleyerek başlayın
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.items.map((item) => (
                <div
                  key={item.menuItemId}
                  className="flex items-center gap-3 rounded-[14px] bg-[#fafafa] p-3"
                >
                  <div className="flex h-[48px] w-[48px] flex-shrink-0 items-center justify-center rounded-[10px] bg-[#f0f0f0] text-[18px] font-bold text-[#c4c4c4]">
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[#18181b]">
                      {item.name}
                    </p>
                    <p className="text-[13px] text-[#71717a]">
                      {Number(item.price).toFixed(2)} {currency}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        updateQty(item.menuItemId, item.quantity - 1)
                      }
                      disabled={isSyncing}
                      aria-label="Azalt"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e4e7] text-[#18181b] transition hover:bg-[#f4f4f5] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <MinusIcon />
                    </button>
                    <span className="min-w-[24px] text-center text-[14px] font-bold text-[#18181b]">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQty(item.menuItemId, item.quantity + 1)
                      }
                      disabled={isSyncing}
                      aria-label="Artır"
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e4e4e7] text-[#18181b] transition hover:bg-[#f4f4f5] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <PlusIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — checkout */}
        {cart.items.length > 0 && (
          <div className="border-t border-[#f4f4f5] px-5 py-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[14px] text-[#71717a]">Ara toplam</span>
              <span className="text-[17px] font-bold text-[#18181b]">
                {subtotal.toFixed(2)} {currency}
              </span>
            </div>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#084799] px-6 py-4 text-[15px] font-semibold text-white transition hover:bg-[#063d85] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#084799] focus-visible:ring-offset-2"
            >
              Ödemeye Geç
              <ArrowRightIcon />
            </Link>
            <button
              onClick={clearCart}
              type="button"
              className="mt-3 w-full py-1.5 text-[13px] text-[#a1a1aa] transition hover:text-[#ef4444]"
            >
              Sepeti Temizle
            </button>
          </div>
        )}
      </div>
    </>
  );
}
