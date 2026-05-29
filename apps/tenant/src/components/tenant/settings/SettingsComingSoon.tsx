export default function SettingsComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-[18px] border border-dashed border-[#ece2d2] bg-[#fbfaf7] p-8 text-center">
      <span className="inline-flex rounded-full bg-[#f0e9dc] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#a8a29e]">
        Yakında
      </span>
      <h3 className="mt-3 text-[15px] font-bold text-[#1c1917]">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-[13px] leading-6 text-[#78716c]">{description}</p>
    </section>
  );
}
