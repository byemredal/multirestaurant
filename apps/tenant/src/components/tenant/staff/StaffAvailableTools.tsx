import Link from 'next/link';

/**
 * Honest "available tools" list. Each entry is either ready or explicitly
 * marked as coming soon — we never advertise tools the staff cannot
 * actually use yet (menu, store-settings, full order workspace are all
 * still tenant-only at the routing layer).
 */
type Tool = {
  title: string;
  description: string;
  status: 'available' | 'coming_soon';
  href?: string;
  cta?: string;
};

const TOOLS: Tool[] = [
  {
    title: 'Sipariş takip ekranı',
    description:
      'Atanmış mağazalarınıza ait operasyonel siparişleri görüntüleyin (durum güncelleme yakında).',
    status: 'available',
    href: '/staff/orders',
    cta: 'Siparişleri aç',
  },
  {
    title: 'Mutfak / kasa modu',
    description:
      'Rol bazlı operasyonel görünüm; mutfak için hazırlama listesi, kasa için POS.',
    status: 'coming_soon',
  },
  {
    title: 'Menü ve fiyatlandırma',
    description: 'Menü düzenleme yalnızca tenant yöneticileri için açıktır.',
    status: 'coming_soon',
  },
];

export function StaffAvailableTools() {
  return (
    <section className="rounded-[18px] border border-slate-100 bg-white p-5 sm:p-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
        Kullanabileceğiniz araçlar
      </div>
      <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
        Personel çalışma alanı
      </h2>
      <p className="mt-1 text-[12.5px] leading-5 text-slate-500">
        Hesabınız aktif — operasyonel araçlar yakında bu ekrandan açılacak.
      </p>

      <ul className="mt-4 space-y-2">
        {TOOLS.map((tool) => (
          <li
            key={tool.title}
            className="rounded-[12px] border border-slate-100 bg-slate-50/60 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-slate-800">
                {tool.title}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] ${
                  tool.status === 'available'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tool.status === 'available' ? 'Açık' : 'Yakında'}
              </span>
            </div>
            <p className="mt-1 text-[12px] leading-5 text-slate-600">{tool.description}</p>
            {tool.status === 'available' && tool.href ? (
              <div className="mt-2">
                <Link
                  href={tool.href}
                  className="inline-flex items-center gap-1.5 rounded-[10px] bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-slate-800"
                >
                  {tool.cta ?? 'Aç'}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
