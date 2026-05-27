import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantOnboardingService } from './tenant-onboarding.service';

describe('TenantOnboardingService public document upload security', () => {
  function buildService() {
    return new TenantOnboardingService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  const validFile = {
    originalname: 'license.pdf',
    mimetype: 'application/pdf',
    size: 8,
    buffer: Buffer.from('document'),
  };

  it('does not persist an upload when the state token is invalid', async () => {
    const service = buildService();
    jest
      .spyOn(service as any, 'resolveApplicationFromStateToken')
      .mockRejectedValue(new ForbiddenException('Invalid state token.'));
    const persist = jest.spyOn(service as any, 'persistPublicDocumentUpload');

    await expect(
      service.uploadDocumentFileByStateToken('invalid', validFile, { type: 'identity_document' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(persist).not.toHaveBeenCalled();
  });

  it('rejects unsupported file types before persisting data', async () => {
    const service = buildService();
    jest
      .spyOn(service as any, 'resolveApplicationFromStateToken')
      .mockResolvedValue({ tenantAccountId: 'tenant-1' });
    jest.spyOn(service as any, 'ensureEditableApplication').mockResolvedValue({});
    const persist = jest.spyOn(service as any, 'persistPublicDocumentUpload');

    await expect(
      service.uploadDocumentFileByStateToken(
        'token',
        { ...validFile, originalname: 'payload.exe', mimetype: 'application/octet-stream' },
        { type: 'identity_document' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(persist).not.toHaveBeenCalled();
  });

  it('persists and registers a valid document after token validation', async () => {
    const service = buildService();
    jest
      .spyOn(service as any, 'resolveApplicationFromStateToken')
      .mockResolvedValue({ tenantAccountId: 'tenant-1' });
    jest.spyOn(service as any, 'ensureEditableApplication').mockResolvedValue({});
    const persist = jest.spyOn(service as any, 'persistPublicDocumentUpload').mockResolvedValue({
      originalname: validFile.originalname,
      mimetype: validFile.mimetype,
      size: validFile.size,
      path: 'private/path/license.pdf',
    });
    jest.spyOn(service, 'uploadDocumentFromFile').mockResolvedValue({ id: 'document-1' } as any);
    jest.spyOn(service, 'getWorkspace').mockResolvedValue({} as any);

    await expect(
      service.uploadDocumentFileByStateToken('token', validFile, { type: 'identity_document' }),
    ).resolves.toEqual({ document: { id: 'document-1' }, workspace: {} });
    expect(persist).toHaveBeenCalledWith('tenant-1', validFile);
  });
});
