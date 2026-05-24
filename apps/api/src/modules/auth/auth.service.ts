import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordService } from '../../common/security/password.service';
import { SecurityLoggerService } from '../../common/security/security-logger.service';
import { SessionTokenService } from '../../common/security/session-token.service';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { CustomerAccount } from './entities/customer-account.entity';
import { CustomerAccountsStore } from './auth.store';
import { CustomerLoyaltyStore } from './customer-loyalty.store';

type SocialProvider = 'google' | 'facebook';
type SocialAuthMode = 'login' | 'signup';
type SocialAuthProfile = {
  provider: SocialProvider;
  providerAccountId: string;
  email: string;
  firstName: string;
  lastName: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly accountsStore: CustomerAccountsStore,
    private readonly loyaltyStore: CustomerLoyaltyStore,
    private readonly passwordService: PasswordService,
    private readonly sessionTokenService: SessionTokenService,
    private readonly securityLogger: SecurityLoggerService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterCustomerDto) {
    const existing = await this.accountsStore.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Customer account already exists for this email.');
    }

    const usesPasswordLogin = dto.loginPreference !== true;
    const passwordHash =
      usesPasswordLogin && dto.password
        ? await this.passwordService.hash(dto.password)
        : null;

    const account = await this.accountsStore.create({
      email: dto.email.trim().toLowerCase(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      passwordHash,
      loginPreference: dto.loginPreference ?? false,
      phoneNumber: dto.phoneNumber,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      isActive: true,
      isVerified: false,
      lastLoginAt: null,
    });

    const tokens = await this.sessionTokenService.issueSession({
      id: account.id,
      email: account.email,
      type: 'customer',
      claims: {
        loginPreference: account.loginPreference,
      },
    });

    return {
      ...tokens,
      account: this.toPublicAccount(account),
    };
  }

  async login(dto: LoginCustomerDto, context: Record<string, unknown> = {}) {
    const account = await this.accountsStore.findByEmail(dto.email);
    if (!account || !account.isActive) {
      this.securityLogger.logLoginFailure('customer', {
        email: dto.email.trim().toLowerCase(),
        ...context,
      });
      throw new UnauthorizedException('Invalid customer credentials.');
    }

    if (account.loginPreference) {
      this.securityLogger.logLoginFailure('customer', {
        email: account.email,
        accountId: account.id,
        reason: 'passwordless_not_supported',
        ...context,
      });
      throw new UnauthorizedException(
        'This customer account is configured for passwordless login and is not active in Phase 1.',
      );
    }

    if (!account.passwordHash) {
      this.securityLogger.logLoginFailure('customer', {
        email: account.email,
        accountId: account.id,
        reason: 'missing_password_hash',
        ...context,
      });
      throw new UnauthorizedException('Password credentials are not available for this account.');
    }

    const passwordMatches = await this.passwordService.matches(
      dto.password,
      account.passwordHash,
    );

    if (!passwordMatches) {
      this.securityLogger.logLoginFailure('customer', {
        email: account.email,
        accountId: account.id,
        reason: 'invalid_password',
        ...context,
      });
      throw new UnauthorizedException('Invalid customer credentials.');
    }

    const updated = await this.accountsStore.touchLastLogin(account.id);
    const tokens = await this.sessionTokenService.issueSession({
      id: updated.id,
      email: updated.email,
      type: 'customer',
      claims: {
        loginPreference: updated.loginPreference,
      },
    });
    this.securityLogger.logLoginSuccess('customer', updated.id, {
      email: updated.email,
      ...context,
    });

    return {
      ...tokens,
      account: this.toPublicAccount(updated),
    };
  }

  async refresh(refreshToken: string, context: Record<string, unknown> = {}) {
    const payload = await this.sessionTokenService.verifyRefreshToken(
      refreshToken,
      'customer',
    );
    const account = await this.accountsStore.findById(payload.sub);

    if (!account || !account.isActive) {
      this.securityLogger.logRefreshFailure('customer', {
        subjectId: payload.sub,
        reason: 'inactive_or_missing_account',
        ...context,
      });
      throw new UnauthorizedException('Customer refresh session is no longer valid.');
    }

    const tokens = await this.sessionTokenService.rotateRefreshToken(refreshToken, {
      id: account.id,
      email: account.email,
      type: 'customer',
      claims: {
        loginPreference: account.loginPreference,
      },
    });
    this.securityLogger.logRefreshSuccess('customer', account.id, {
      email: account.email,
      ...context,
    });

    return {
      ...tokens,
      account: this.toPublicAccount(account),
    };
  }

  async logout(refreshToken: string, subjectId: string, context: Record<string, unknown> = {}) {
    const success = await this.sessionTokenService.revokeRefreshToken(refreshToken, 'customer');
    this.securityLogger.logLogout('customer', subjectId, {
      refreshRevoked: success,
      ...context,
    });

    return {
      success,
    };
  }

  async getProfile(accountId: string) {
    const account = await this.accountsStore.findById(accountId);
    if (!account) {
      throw new NotFoundException('Customer account could not be found.');
    }

    return this.toPublicAccount(account);
  }

  async validateCustomer(accountId: string): Promise<CustomerAccount | null> {
    const account = await this.accountsStore.findById(accountId);
    if (!account || !account.isActive) {
      return null;
    }

    return account;
  }

  async getRewards(accountId: string) {
    const account = await this.accountsStore.findById(accountId);
    if (!account) {
      throw new NotFoundException('Customer account could not be found.');
    }

    return this.loyaltyStore.getRewardsSummary(accountId);
  }

  async getStampCards(accountId: string) {
    const account = await this.accountsStore.findById(accountId);
    if (!account) {
      throw new NotFoundException('Customer account could not be found.');
    }

    return this.loyaltyStore.listStampCards(accountId);
  }

  async getHelp(accountId: string) {
    const account = await this.accountsStore.findById(accountId);
    if (!account) {
      throw new NotFoundException('Customer account could not be found.');
    }

    return {
      email: 'support@lieferzonen.local',
      faq: [
        {
          id: 'delivery-status',
          title: 'Where is my order?',
          description: 'Track your order status from the orders section after login.',
        },
        {
          id: 'payment-help',
          title: 'Payment and refund help',
          description: 'Use support email for payment issues or refund requests.',
        },
      ],
    };
  }

  getSocialAuthorizationUrl(
    provider: SocialProvider,
    mode: SocialAuthMode,
    returnTo?: string,
  ) {
    const providerKey = provider.toUpperCase();
    const clientId = this.configService.get<string>(
      `AUTH_OAUTH_${providerKey}_CLIENT_ID`,
    );
    const redirectUri = this.configService.get<string>(
      `AUTH_OAUTH_${providerKey}_REDIRECT_URI`,
    );

    if (!clientId || !redirectUri) {
      throw new ServiceUnavailableException(
        `${provider} social auth is not configured yet.`,
      );
    }

    const state = Buffer.from(
      JSON.stringify({
        provider,
        mode,
        returnTo: returnTo ?? '/',
        issuedAt: new Date().toISOString(),
      }),
    ).toString('base64url');

    if (provider === 'google') {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('prompt', 'select_account');
      url.searchParams.set('state', state);
      return { authorizationUrl: url.toString(), provider, mode };
    }

    if (provider === 'facebook') {
      const url = new URL('https://www.facebook.com/v19.0/dialog/oauth');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'email,public_profile');
      url.searchParams.set('state', state);
      return { authorizationUrl: url.toString(), provider, mode };
    }

    throw new BadRequestException('Unsupported social auth provider.');
  }

  async completeSocialAuthorization(
    provider: SocialProvider,
    input: {
      code?: string;
      state?: string;
      error?: string;
    },
    context: Record<string, unknown> = {},
  ) {
    if (input.error) {
      throw new BadRequestException(
        `${provider} returned an auth error: ${input.error}.`,
      );
    }

    if (!input.code || !input.state) {
      throw new BadRequestException('Social auth callback is missing code or state.');
    }

    const state = this.parseSocialAuthState(provider, input.state);
    const profile = await this.fetchSocialProfile(provider, input.code);
    const existingSocial = await this.accountsStore.findSocialAccount(
      provider,
      profile.providerAccountId,
    );

    let account = existingSocial
      ? await this.accountsStore.findById(existingSocial.customerAccountId)
      : await this.accountsStore.findByEmail(profile.email);

    if (account && !account.isActive) {
      throw new UnauthorizedException('Customer account is not active.');
    }

    if (!account) {
      account = await this.accountsStore.create({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        passwordHash: null,
        loginPreference: true,
        phoneNumber: undefined,
        birthDate: null,
        isActive: true,
        isVerified: true,
        lastLoginAt: null,
      });
    }

    await this.accountsStore.linkSocialAccount({
      customerAccountId: account.id,
      provider,
      providerAccountId: profile.providerAccountId,
      providerEmail: profile.email,
      profileFirstName: profile.firstName,
      profileLastName: profile.lastName,
    });

    const updated = await this.accountsStore.touchLastLogin(account.id);
    const tokens = await this.sessionTokenService.issueSession({
      id: updated.id,
      email: updated.email,
      type: 'customer',
      claims: {
        loginPreference: updated.loginPreference,
      },
    });

    this.securityLogger.logLoginSuccess('customer', updated.id, {
      email: updated.email,
      socialProvider: provider,
      socialMode: state.mode,
      ...context,
    });

    return {
      ...tokens,
      account: this.toPublicAccount(updated),
      returnTo: state.returnTo,
    };
  }

  private parseSocialAuthState(provider: SocialProvider, state: string) {
    try {
      const parsed = JSON.parse(
        Buffer.from(state, 'base64url').toString('utf8'),
      ) as {
        provider?: SocialProvider;
        mode?: SocialAuthMode;
        returnTo?: string;
        issuedAt?: string;
      };

      if (parsed.provider !== provider) {
        throw new Error('provider_mismatch');
      }

      const issuedAt = parsed.issuedAt ? new Date(parsed.issuedAt) : null;
      if (!issuedAt || Number.isNaN(issuedAt.getTime())) {
        throw new Error('invalid_issued_at');
      }

      if (Date.now() - issuedAt.getTime() > 15 * 60 * 1000) {
        throw new Error('state_expired');
      }

      return {
        mode: parsed.mode === 'signup' ? 'signup' : 'login',
        returnTo:
          parsed.returnTo && parsed.returnTo.startsWith('/')
            ? parsed.returnTo
            : '/',
      };
    } catch {
      throw new BadRequestException('Social auth state is invalid or expired.');
    }
  }

  private async fetchSocialProfile(
    provider: SocialProvider,
    code: string,
  ): Promise<SocialAuthProfile> {
    if (provider === 'google') {
      return this.fetchGoogleProfile(code);
    }

    if (provider === 'facebook') {
      return this.fetchFacebookProfile(code);
    }

    throw new BadRequestException('Unsupported social auth provider.');
  }

  private async fetchGoogleProfile(code: string): Promise<SocialAuthProfile> {
    const clientId = this.getRequiredProviderConfig('google', 'CLIENT_ID');
    const clientSecret = this.getRequiredProviderConfig('google', 'CLIENT_SECRET');
    const redirectUri = this.getRequiredProviderConfig('google', 'REDIRECT_URI');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new BadRequestException('Google token exchange failed.');
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!tokenPayload.access_token) {
      throw new BadRequestException('Google token response did not include an access token.');
    }

    const profileResponse = await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`,
        },
      },
    );

    if (!profileResponse.ok) {
      throw new BadRequestException('Google profile lookup failed.');
    }

    const profile = (await profileResponse.json()) as {
      sub?: string;
      email?: string;
      given_name?: string;
      family_name?: string;
      name?: string;
    };

    if (!profile.sub || !profile.email) {
      throw new BadRequestException('Google account did not provide the required identity fields.');
    }

    const [fallbackFirstName = 'Google', ...rest] = (profile.name ?? '').split(' ');
    return {
      provider: 'google',
      providerAccountId: profile.sub,
      email: profile.email.trim().toLowerCase(),
      firstName: profile.given_name?.trim() || fallbackFirstName || 'Google',
      lastName: profile.family_name?.trim() || rest.join(' ').trim() || 'Customer',
    };
  }

  private async fetchFacebookProfile(code: string): Promise<SocialAuthProfile> {
    const clientId = this.getRequiredProviderConfig('facebook', 'CLIENT_ID');
    const clientSecret = this.getRequiredProviderConfig('facebook', 'CLIENT_SECRET');
    const redirectUri = this.getRequiredProviderConfig('facebook', 'REDIRECT_URI');
    const tokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', clientId);
    tokenUrl.searchParams.set('client_secret', clientSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());
    if (!tokenResponse.ok) {
      throw new BadRequestException('Facebook token exchange failed.');
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!tokenPayload.access_token) {
      throw new BadRequestException('Facebook token response did not include an access token.');
    }

    const profileUrl = new URL('https://graph.facebook.com/me');
    profileUrl.searchParams.set('fields', 'id,first_name,last_name,email,name');
    profileUrl.searchParams.set('access_token', tokenPayload.access_token);
    const profileResponse = await fetch(profileUrl.toString());

    if (!profileResponse.ok) {
      throw new BadRequestException('Facebook profile lookup failed.');
    }

    const profile = (await profileResponse.json()) as {
      id?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      name?: string;
    };

    if (!profile.id || !profile.email) {
      throw new BadRequestException('Facebook account did not provide the required identity fields.');
    }

    const [fallbackFirstName = 'Facebook', ...rest] = (profile.name ?? '').split(' ');
    return {
      provider: 'facebook',
      providerAccountId: profile.id,
      email: profile.email.trim().toLowerCase(),
      firstName: profile.first_name?.trim() || fallbackFirstName || 'Facebook',
      lastName: profile.last_name?.trim() || rest.join(' ').trim() || 'Customer',
    };
  }

  private getRequiredProviderConfig(
    provider: SocialProvider,
    suffix: 'CLIENT_ID' | 'CLIENT_SECRET' | 'REDIRECT_URI',
  ) {
    const value = this.configService.get<string>(
      `AUTH_OAUTH_${provider.toUpperCase()}_${suffix}`,
    );

    if (!value) {
      throw new ServiceUnavailableException(
        `${provider} social auth is not configured yet.`,
      );
    }

    return value;
  }

  private toPublicAccount(account: CustomerAccount) {
    return {
      id: account.id,
      email: account.email,
      firstName: account.firstName,
      lastName: account.lastName,
      phoneNumber: account.phoneNumber,
      birthDate: account.birthDate,
      loginPreference: account.loginPreference,
      isActive: account.isActive,
      isVerified: account.isVerified,
      lastLoginAt: account.lastLoginAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
