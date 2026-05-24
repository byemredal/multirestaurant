'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  flagTenantStoreReview,
  listTenantStoreReviews,
  replyTenantStoreReview,
  type TenantReview,
  type TenantReviewSummary,
} from '@/lib/tenant-client';
import type { StoredTenantSession } from '@/lib/storage/tenant-session';

type Props = {
  session: StoredTenantSession;
  storeId: string | null;
};

export function TenantReviewsPanel({ session, storeId }: Props) {
  const [reviews, setReviews] = useState<TenantReview[]>([]);
  const [summary, setSummary] = useState<TenantReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listTenantStoreReviews(session, storeId);
      setReviews(result.reviews);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yorumlar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [storeId, session]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const ratingBars = useMemo(() => {
    if (!summary) return [] as Array<{ rating: number; count: number; pct: number }>;
    const total = summary.totalReviews || 1;
    return [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: summary.ratingDistribution[rating as 1 | 2 | 3 | 4 | 5] ?? 0,
      pct:
        ((summary.ratingDistribution[rating as 1 | 2 | 3 | 4 | 5] ?? 0) / total) *
        100,
    }));
  }, [summary]);

  const submitReply = async (review: TenantReview) => {
    if (!storeId) return;
    const body = (replyDraft[review.id] ?? review.tenantReplyBody ?? '').trim();
    if (!body) return;
    setBusyId(review.id);
    try {
      const result = await replyTenantStoreReview(
        session,
        storeId,
        review.id,
        body,
      );
      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, ...result.review } : r)),
      );
      setReplyDraft((prev) => ({ ...prev, [review.id]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cevap kaydedilemedi.');
    } finally {
      setBusyId(null);
    }
  };

  const flag = async (review: TenantReview) => {
    if (!storeId) return;
    const reason = window.prompt(
      'Bu yorum için bildirim sebebi (opsiyonel):',
      review.flaggedReason ?? '',
    );
    if (reason === null) return;
    setBusyId(review.id);
    try {
      await flagTenantStoreReview(session, storeId, review.id, reason || undefined);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yorum bildirilemedi.');
    } finally {
      setBusyId(null);
    }
  };

  if (!storeId) {
    return (
      <div className="rounded-[20px] border border-[#ece2d2] bg-white p-6 text-center text-[13.5px] text-[#78716c] shadow-sm">
        Yorumları görüntülemek için bir restoran seçin.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[20px] border border-[#ece2d2] bg-white p-5 shadow-[0_8px_24px_rgba(28,25,23,0.04)] lg:p-6">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-bold text-[#1c1917]">Yorum Özeti</h3>
            <p className="mt-0.5 text-[12.5px] text-[#78716c]">
              Ortalama puan, dağılım ve müşteri yorumları. Tamamlanmış siparişler
              dışında yorum yapılamaz.
            </p>
          </div>
        </header>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 animate-pulse rounded bg-[#f5f4ee]" />
            ))}
          </div>
        ) : summary && summary.totalReviews > 0 ? (
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[32px] font-bold leading-none text-[#1c1917]">
                {summary.averageRating?.toFixed(1) ?? '—'}
              </span>
              <span className="mt-1 text-[12px] text-[#78716c]">
                {summary.totalReviews} yorum
              </span>
            </div>
            <div className="flex-1 min-w-[220px] space-y-1.5">
              {ratingBars.map((bar) => (
                <div key={bar.rating} className="flex items-center gap-2 text-[12px] text-[#52525b]">
                  <span className="w-6 font-semibold">{bar.rating}★</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#f4f4f5]">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-[#f5a623]"
                      style={{ width: `${bar.pct.toFixed(1)}%` }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums">{bar.count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[13.5px] text-[#78716c]">Henüz yorum yok.</p>
        )}
      </section>

      {error && (
        <p className="rounded-[12px] bg-rose-50 px-3 py-2 text-[12.5px] font-medium text-rose-700">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {loading ? null : reviews.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-[#ece2d2] bg-white p-6 text-center text-[13.5px] text-[#78716c]">
            Henüz görüntülenecek yorum yok.
          </div>
        ) : (
          reviews.map((review) => {
            const dateStr = new Date(review.createdAt).toLocaleDateString('tr-TR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            return (
              <article
                key={review.id}
                className={`rounded-[18px] border bg-white p-5 shadow-sm transition ${
                  review.status === 'flagged'
                    ? 'border-amber-200 bg-amber-50/60'
                    : 'border-[#ece2d2]'
                }`}
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f4ee] text-[13px] font-bold text-[#52525b]">
                      {review.authorDisplayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13.5px] font-semibold text-[#1c1917]">
                        {review.authorDisplayName}
                      </span>
                      <span className="text-[11.5px] text-[#a8a29e]">{dateStr}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div aria-label={`Puan: ${review.rating}`}>
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <span
                          key={idx}
                          className={`mr-0.5 inline-block text-[13px] ${idx < review.rating ? 'text-[#f5a623]' : 'text-[#e4e4e7]'}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    {review.status === 'flagged' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-amber-700">
                        Bildirildi
                      </span>
                    )}
                  </div>
                </header>
                {review.title ? (
                  <p className="mt-3 text-[14px] font-semibold text-[#1c1917]">
                    {review.title}
                  </p>
                ) : null}
                {review.body ? (
                  <p className="mt-2 text-[13.5px] leading-6 text-[#52525b]">
                    {review.body}
                  </p>
                ) : null}

                {review.tenantReplyBody ? (
                  <div className="mt-4 rounded-[14px] border border-[#e4e4e7] bg-[#fbfaf6] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#1c1917] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
                        Resmi cevap
                      </span>
                      {review.tenantReplyAt && (
                        <span className="text-[11px] text-[#a8a29e]">
                          {new Date(review.tenantReplyAt).toLocaleDateString('tr-TR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-[#3f3f46]">
                      {review.tenantReplyBody}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 space-y-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#a8a29e]">
                    {review.tenantReplyBody ? 'Cevabı düzenle' : 'Resmi cevap yaz'}
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Müşterinize teşekkür edin veya açıklama yapın."
                    value={replyDraft[review.id] ?? review.tenantReplyBody ?? ''}
                    onChange={(event) =>
                      setReplyDraft((prev) => ({ ...prev, [review.id]: event.target.value }))
                    }
                    className="w-full rounded-[12px] border border-[#e4e4e7] bg-white p-3 text-[13.5px] leading-6 text-[#1c1917] outline-none focus:border-[#1c1917]"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => submitReply(review)}
                      disabled={busyId === review.id}
                      className="rounded-full bg-[#1c1917] px-4 py-1.5 text-[12px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyId === review.id ? 'Kaydediliyor…' : 'Cevabı yayınla'}
                    </button>
                    {review.status !== 'flagged' && (
                      <button
                        type="button"
                        onClick={() => flag(review)}
                        disabled={busyId === review.id}
                        className="rounded-full border border-[#e4e4e7] px-4 py-1.5 text-[12px] font-semibold text-[#71717a] transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50"
                      >
                        Bildir
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
