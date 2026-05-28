import { NotFoundException } from '@nestjs/common';
import { join, resolve } from 'node:path';
import { SharedFileStorageService } from './shared-file-storage.service';

describe('SharedFileStorageService.resolveLocalFilePath path safety', () => {
  const service = new SharedFileStorageService({} as any);
  const uploadsRoot = resolve(process.cwd(), 'uploads');

  it('returns the resolved path for a file stored inside the uploads root', () => {
    const stored = join(uploadsRoot, 'tenant-onboarding', 'tenant-1', '123-license.pdf');
    expect(service.resolveLocalFilePath({ publicUrl: stored })).toBe(resolve(stored));
  });

  it('rejects an empty stored path', () => {
    expect(() => service.resolveLocalFilePath({ publicUrl: '' })).toThrow(NotFoundException);
  });

  it('rejects an externally hosted (remote) URL', () => {
    expect(() =>
      service.resolveLocalFilePath({ publicUrl: 'https://cdn.example.com/license.pdf' }),
    ).toThrow(NotFoundException);
  });

  it('rejects a path that escapes the uploads root via traversal', () => {
    const traversal = join(uploadsRoot, '..', '..', 'etc', 'passwd');
    expect(() => service.resolveLocalFilePath({ publicUrl: traversal })).toThrow(NotFoundException);
  });

  it('rejects an absolute path outside the uploads root', () => {
    const outside = join(process.cwd(), 'secret.env');
    expect(() => service.resolveLocalFilePath({ publicUrl: outside })).toThrow(NotFoundException);
  });
});
