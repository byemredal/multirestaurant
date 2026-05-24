'use client';

export function FieldError({
  errors,
  name,
}: {
  errors: Record<string, string>;
  name: string;
}) {
  const msg = errors[name];
  if (!msg) return null;
  return <p className="mt-1 text-[12px] text-[#b42318]">{msg}</p>;
}
