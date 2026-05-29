/**
 * Route-transition fallback for the discovery page. Shown instantly while the
 * region route resolves so a slow restaurant lookup never leaves the user on a
 * blank screen. Mirrors the RestaurantList loading skeleton.
 */
export default function RegionLoading() {
  return (
    <main className="min-h-screen bg-white text-ink-900">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-200 border-t-primary" />
          <p className="text-[15px] font-semibold text-ink-700">
            Restoranlar aranıyor…
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="h-[290px] animate-pulse rounded-3xl bg-ink-100"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
