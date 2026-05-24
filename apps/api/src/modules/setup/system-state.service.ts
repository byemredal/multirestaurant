import { ConflictException, Injectable } from '@nestjs/common';
import { INITIALIZING_STALE_MS, SystemState } from './setup.constants';
import { SystemStateStore } from './system-state.store';

@Injectable()
export class SystemStateService {
  constructor(private readonly systemStateStore: SystemStateStore) {}

  /** Current platform bootstrap state — drives both the API and the wizard. */
  async getState(): Promise<{ state: SystemState }> {
    const row = await this.systemStateStore.get();
    return { state: row.state };
  }

  async isReady(): Promise<boolean> {
    const row = await this.systemStateStore.get();
    return row.state === SystemState.READY;
  }

  /**
   * Claims the INITIALIZING state for this request. Throws if the platform is
   * already READY or another initialization is in progress.
   */
  async beginInitialization(): Promise<void> {
    const row = await this.systemStateStore.get();
    if (row.state === SystemState.READY) {
      throw new ConflictException('Platform has already been initialized.');
    }

    const staleBefore = new Date(
      Date.now() - INITIALIZING_STALE_MS,
    ).toISOString();

    const claimed = await this.systemStateStore.claimInitializing(staleBefore);
    if (!claimed) {
      throw new ConflictException('Initialization is already in progress.');
    }
  }

  /** Promotes the system to READY after a successful bootstrap. */
  async completeInitialization(): Promise<void> {
    await this.systemStateStore.markReady();
  }

  /** Safe fallback: returns to UNINITIALIZED so a failed setup can be retried. */
  async failInitialization(): Promise<void> {
    await this.systemStateStore.resetToUninitialized();
  }
}
