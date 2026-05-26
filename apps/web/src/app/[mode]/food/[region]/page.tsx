import type { Metadata } from 'next';

import HomeExperience from '@/components/home/HomeExperience';
import { fetchPlatformBranding } from '@/lib/branding/fetch-platform-branding';
import {
  findRegionBySlug,
  normalizeFulfillmentMode,
} from '@/lib/home-discovery';

type RegionParams = { mode: string; region: string };

/** Region-aware, share/search-friendly metadata for discovery pages. */
export async function generateMetadata({
  params,
}: {
  params: RegionParams;
}): Promise<Metadata> {
  const mode = normalizeFulfillmentMode(params.mode);
  const modeLabel = mode === 'collection' ? 'Gel-Al' : 'Teslimat';
  const region = findRegionBySlug(params.region);
  const branding = await fetchPlatformBranding();
  const platformName = branding?.platformName?.trim();
  const brandSuffix = platformName ? ` | ${platformName}` : '';

  if (!region) {
    return {
      title: `Restoran Keşfi${brandSuffix}`,
      description: 'Bölgene teslimat yapan restoranları keşfet.',
      robots: { index: false, follow: true },
    };
  }

  const place =
    region.name !== region.postalCode
      ? `${region.postalCode} ${region.name}`
      : region.postalCode;
  const title = `${place} ${modeLabel} — Restoranlar${brandSuffix}`;
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
