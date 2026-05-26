import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsStore } from './platform-settings.store';

export type GeoProviderId = 'locationiq' | 'none';

export interface GeoProviderConfig {
  provider: GeoProviderId;
  /** True when a real API key is configured in the server environment. */
  apiKeyConfigured: boolean;
  /** True when admin can use this provider (configured AND not "none"). */
  active: boolean;
}

const SETTING_KEY = 'geo.provider';

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);
  private cached: GeoProviderConfig | null = null;

  constructor(private readonly store: PlatformSettingsStore) {}

  /**
   * Resolve the currently active geo provider. Admin-stored selection wins;
   * if nothing is stored the default is `locationiq` (only one wired today).
   * Whether the provider can actually be CALLED depends on the API key —
   * `apiKeyConfigured` exposes that fact without leaking the key value.
   */
  async getActiveProvider(): Promise<GeoProviderConfig> {
    if (this.cached) {
      return this.cached;
    }
    const row = await this.store.get(SETTING_KEY);
    const stored = (row?.valueJson?.provider as GeoProviderId | undefined) ?? 'locationiq';
    const provider: GeoProviderId =
      stored === 'locationiq' || stored === 'none' ? stored : 'locationiq';
    const apiKeyConfigured = this.resolveApiKey(provider) !== null;
    const config: GeoProviderConfig = {
      provider,
      apiKeyConfigured,
      active: provider !== 'none' && apiKeyConfigured,
    };
    this.cached = config;
    return config;
  }

  /**
   * Persist an admin-chosen provider. API keys still come from the server
   * environment — the DB only stores which provider to USE, never the secret.
   */
  async setActiveProvider(provider: GeoProviderId): Promise<GeoProviderConfig> {
    await this.store.set(
      SETTING_KEY,
      { provider },
      { description: 'Active geo provider selected by an admin.' },
    );
    this.invalidate();
    return this.getActiveProvider();
  }

  invalidate(): void {
    this.cached = null;
  }

  /**
   * Resolve the server-side API key for a given provider, or `null` when
   * unset. Centralized so the controller path never reads env directly and
   * a future move to a secrets store touches only this method.
   */
  resolveApiKey(provider: GeoProviderId): string | null {
    if (provider === 'locationiq') {
      const value = process.env.LOCATIONIQ_API_KEY?.trim();
      return value ? value : null;
    }
    return null;
  }
}
