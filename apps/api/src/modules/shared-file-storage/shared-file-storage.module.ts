import { Module } from '@nestjs/common';
import { SharedFileStorageService } from './shared-file-storage.service';
import { SharedFileStorageStore } from './shared-file-storage.store';

@Module({
  providers: [SharedFileStorageStore, SharedFileStorageService],
  exports: [SharedFileStorageStore, SharedFileStorageService],
})
export class SharedFileStorageModule {}
