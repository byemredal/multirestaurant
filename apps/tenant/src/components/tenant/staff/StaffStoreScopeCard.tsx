/**
 * Surfaces the staff's active store scope honestly. Lists the store IDs
 * the staff is currently bound to, with a helpful disclaimer when the
 * scope is empty (which usually means the gate already bounced them,
 * but covers any drift between the staff /me snapshot and live state).
 */
export function StaffStoreScopeCard({ storeScope }: { storeScope: string[] }) {
  return (
    <section className="rounded-[18px] border border-slate-100 bg-white p-5 sm:p-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
        Yetkili olduğunuz mağazalar
      </div>
      <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
        {storeScope.length} mağaza
      </h2>
      {storeScope.length === 0 ? (
        <p className="mt-3 rounded-[10px] bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          Şu anda atanmış aktif mağazanız yok. Yöneticinize başvurun.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {storeScope.map((storeId) => (
            <li
              key={storeId}
              className="rounded-[10px] border border-slate-100 bg-slate-50 px-3 py-1.5 font-mono text-[11.5px] text-slate-700"
            >
              {storeId}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11.5px] leading-5 text-slate-500">
        Mağaza isimleri bir sonraki sürümde gösterilecek. Yöneticiniz mağaza atamalarınızı
        değiştirebilir — değişiklikler bir sonraki sayfa yenilemesinden itibaren geçerlidir.
      </p>
    </section>
  );
}
