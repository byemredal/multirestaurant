import { AuthService } from './auth.service';

describe('AuthService loyalty and social auth foundation', () => {
  it('returns store-backed rewards and stamp cards', async () => {
    const accountsStore = {
      findById: jest.fn().mockResolvedValue({
        id: 'customer-1',
        email: 'customer@example.com',
      }),
    };
    const loyaltyStore = {
      getRewardsSummary: jest.fn().mockResolvedValue({
        available: true,
        pointsBalance: 24,
        history: [],
        message: 'ok',
      }),
      listStampCards: jest.fn().mockResolvedValue({
        available: true,
        cards: [],
        message: 'ok',
      }),
    };
    const service = new AuthService(
      accountsStore as any,
      loyaltyStore as any,
      {} as any,
      {} as any,
      {} as any,
      { get: jest.fn().mockReturnValue(undefined) } as any,
    );

    await expect(service.getRewards('customer-1')).resolves.toEqual(
      expect.objectContaining({
        available: true,
        pointsBalance: 24,
      }),
    );
    await expect(service.getStampCards('customer-1')).resolves.toEqual(
      expect.objectContaining({
        available: true,
      }),
    );
  });

  it('builds a google social authorization URL when provider env is configured', () => {
    const service = new AuthService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {
        get: jest.fn((key) => {
          if (key === 'AUTH_OAUTH_GOOGLE_CLIENT_ID') {
            return 'google-client-id';
          }

          if (key === 'AUTH_OAUTH_GOOGLE_REDIRECT_URI') {
            return 'http://localhost:3000/auth/callback/google';
          }

          return undefined;
        }),
      } as any,
    );

    const result = service.getSocialAuthorizationUrl('google', 'login', '/delivery/food/baar-6319');
    expect(result.authorizationUrl).toContain('accounts.google.com');
    expect(result.authorizationUrl).toContain('client_id=google-client-id');
    expect(result.authorizationUrl).toContain(encodeURIComponent('http://localhost:3000/auth/callback/google'));
  });

  it('completes social auth by linking an existing email account', async () => {
    const accountsStore = {
      findSocialAccount: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue({
        id: 'customer-9',
        email: 'social@example.com',
        firstName: 'Social',
        lastName: 'User',
        loginPreference: true,
        isActive: true,
      }),
      create: jest.fn(),
      linkSocialAccount: jest.fn().mockResolvedValue(undefined),
      touchLastLogin: jest.fn().mockResolvedValue({
        id: 'customer-9',
        email: 'social@example.com',
        firstName: 'Social',
        lastName: 'User',
        phoneNumber: undefined,
        birthDate: null,
        loginPreference: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: null,
        createdAt: new Date('2026-04-13T08:00:00.000Z'),
        updatedAt: new Date('2026-04-13T08:00:00.000Z'),
      }),
    };
    const sessionTokenService = {
      issueSession: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    };
    const service = new AuthService(
      accountsStore as any,
      {} as any,
      {} as any,
      sessionTokenService as any,
      { logLoginSuccess: jest.fn() } as any,
      {
        get: jest.fn((key) => {
          if (key === 'AUTH_OAUTH_GOOGLE_CLIENT_ID') return 'google-client-id';
          if (key === 'AUTH_OAUTH_GOOGLE_CLIENT_SECRET') return 'google-client-secret';
          if (key === 'AUTH_OAUTH_GOOGLE_REDIRECT_URI') return 'http://localhost:3000/auth/callback/google';
          return undefined;
        }),
      } as any,
    );

    const state = Buffer.from(
      JSON.stringify({
        provider: 'google',
        mode: 'login',
        returnTo: '/delivery/food/baar-6319',
        issuedAt: new Date().toISOString(),
      }),
    ).toString('base64url');

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'provider-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-user-1',
          email: 'social@example.com',
          given_name: 'Social',
          family_name: 'User',
        }),
      });

    const result = await service.completeSocialAuthorization('google', {
      code: 'provider-code',
      state,
    });

    expect(accountsStore.linkSocialAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        customerAccountId: 'customer-9',
        provider: 'google',
        providerAccountId: 'google-user-1',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        returnTo: '/delivery/food/baar-6319',
      }),
    );
  });
});
