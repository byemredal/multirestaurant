import type { ReactNode, SVGProps } from 'react';

function FlagFrame({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        width: 28,
        height: 20,
        overflow: 'hidden',
        borderRadius: 4,
        border: '1px solid rgb(0 0 0 / 0.1)',
        boxShadow: '0 1px 2px rgb(15 23 42 / 0.12)',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

export function GermanyFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 28 20" {...props}>
      <rect width="28" height="20" fill="#FFCE00" />
      <rect width="28" height="13.333" y="0" fill="#DD0000" />
      <rect width="28" height="6.667" y="0" fill="#000000" />
    </svg>
  );
}

export function UkFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 28 20" {...props}>
      <rect width="28" height="20" fill="#012169" />
      <path d="M0 0 28 20M28 0 0 20" stroke="#FFF" strokeWidth="4" />
      <path d="M0 0 28 20M28 0 0 20" stroke="#C8102E" strokeWidth="2" />
      <path d="M14 0v20M0 10h28" stroke="#FFF" strokeWidth="6" />
      <path d="M14 0v20M0 10h28" stroke="#C8102E" strokeWidth="4" />
    </svg>
  );
}

export function FranceFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 28 20" {...props}>
      <rect width="28" height="20" fill="#ED2939" />
      <rect width="18.667" height="20" x="0" fill="#FFF" />
      <rect width="9.333" height="20" x="0" fill="#002395" />
    </svg>
  );
}

export function ItalyFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 28 20" {...props}>
      <rect width="28" height="20" fill="#CE2B37" />
      <rect width="18.667" height="20" x="0" fill="#FFF" />
      <rect width="9.333" height="20" x="0" fill="#009246" />
    </svg>
  );
}

export function TurkeyFlag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 28 20" {...props}>
      <rect width="28" height="20" fill="#E30A17" />
      <circle cx="11" cy="10" r="5" fill="#FFF" />
      <circle cx="12.3" cy="10" r="4" fill="#E30A17" />
      <path d="m17.4 10 3.2-1.1-2 2.8v-3.4l2 2.8Z" fill="#FFF" />
    </svg>
  );
}

export function LocaleFlag({ code }: { code: 'DE' | 'EN' | 'FR' | 'IT' | 'TR' }) {
  const common = { style: { width: '100%', height: '100%', display: 'block' } };

  return (
    <FlagFrame>
      {code === 'DE' ? <GermanyFlag {...common} /> : null}
      {code === 'EN' ? <UkFlag {...common} /> : null}
      {code === 'FR' ? <FranceFlag {...common} /> : null}
      {code === 'IT' ? <ItalyFlag {...common} /> : null}
      {code === 'TR' ? <TurkeyFlag {...common} /> : null}
    </FlagFrame>
  );
}
