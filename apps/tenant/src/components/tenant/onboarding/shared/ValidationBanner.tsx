'use client';

export function ValidationBanner({ errors }: { errors: Record<string, string> }) {
  if (Object.keys(errors).length === 0) return null;
  return (
    <div className="mb-4 rounded-[8px] border border-[#fda29b] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#b42318]">
      Lütfen kırmızı ile işaretlenmiş zorunlu alanları doldurun.
    </div>
  );
}
