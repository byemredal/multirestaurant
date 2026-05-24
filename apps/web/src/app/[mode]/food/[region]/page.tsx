import type { Metadata } from 'next';

import HomeExperience from '@/components/home/HomeExperience';
import {
  findRegionBySlug,
  normalizeFulfillmentMode,
} from '@/lib/home-discovery';

type RegionParams = { mode: string; region: string };

/** Region-aware, share/search-friendly metadata for discovery pages. */
export function generateMetadata({
  params,
}: {
  params: RegionParams;
}): Metadata {
  const mode = normalizeFulfillmentMode(params.mode);
  const modeLabel = mode === 'collection' ? 'Gel-Al' : 'Teslimat';
  const region = findRegionBySlug(params.region);

  if (!region) {
    return {
      title: 'Restoran Keşfi — Lieferzonen',
      description: 'Bölgene teslimat yapan restoranları keşfet.',
      robots: { index: false, follow: true },
    };
  }

  const place =
    region.name !== region.postalCode
      ? `${region.postalCode} ${region.name}`
      : region.postalCode;
  const title = `${place} ${modeLabel} — Restoranlar | Lieferzonen`;
  const description = `${place} bölgesine ${modeLabel.toLowerCase()} yapan restoranları keşfet. Menülere göz at, çevrimiçi sipariş ver.`;

  return {
    title,
    description,
    alternates: { canonical: `/${mode}/food/${region.slug}` },
    openGraph: { title, description, type: 'website' },
    robots: { index: true, follow: true },
  };
}

export default function RegionPage({ params }: { params: RegionParams }) {
  return (
    <HomeExperience
      initialMode={normalizeFulfillmentMode(params.mode)}
      initialRegionSlug={params.region}
    />
  );
}
