import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { Public } from '../../common/security/decorators/public.decorator';
import { InstallationProfileService } from './installation-profile.service';

/**
 * Public + admin read endpoints for the active CountryPack / InstallationProfile.
 *
 * `GET /platform/pack` returns the client-safe pack subset and is callable
 * pre-login by the storefront and tenant apps. `GET /platform/profile`
 * returns the full server view (incl. packVersion drift signal) and is
 * gated to admins.
 */
@Controller('platform')
@ApiTags('platform')
export class PlatformController {
  constructor(
    private readonly installationProfileService: InstallationProfileService,
  ) {}

  @Get('pack')
  @Public()
  @ApiOperation({
    summary: 'Return the client-safe CountryPack snapshot for this installation.',
  })
  @ApiOkResponse({
    description:
      'Returns the client-safe pack (locale, currency, tax label/rate, ' +
      'postal/IBAN regex, phone country prefix). Returns 404 when setup ' +
      'has not run yet.',
  })
  @ApiNotFoundResponse({ description: 'Installation has not been initialized.' })
  async getPack() {
    const pack = await this.installationProfileService.findClientPack();
    if (!pack) {
      // Pre-setup: surface a structured "not initialized" response so the
      // setup wizard can branch on it without parsing error text. The 404
      // matches the existing `/setup/status` pre-init convention.
      return { initialized: false, pack: null };
    }
    return { initialized: true, pack };
  }

  @Get('profile')
  @AuthTypes('admin')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Return the full InstallationProfile (admin-only).',
    description:
      'Includes the DB-pinned packVersion, the code-shipped packVersion, ' +
      'and a `packVersionMatches` signal so operators can detect drift.',
  })
  @ApiOkResponse({ description: 'Returns the active installation profile.' })
  async getProfile() {
    const profile = await this.installationProfileService.getActive();
    // The full `pack` object is server-only metadata; expose just what the
    // operator dashboard needs without leaking provider keys / regex.
    return {
      countryCode: profile.countryCode,
      locale: profile.locale,
      currencyCode: profile.currencyCode,
      timezone: profile.timezone,
      packVersion: profile.packVersion,
      codePackVersion: profile.codePackVersion,
      packVersionMatches: profile.packVersionMatches,
      initializedAt: profile.initializedAt,
      initializedByAdminId: profile.initializedByAdminId,
      onboardingRequiredDocuments: [...profile.pack.onboarding.requiredDocuments],
      legalDocumentDefaults: profile.pack.legalDocuments.map((doc) => ({
        typeCode: doc.typeCode,
        versionLabel: doc.versionLabel,
        locale: doc.locale,
        placeholderTitle: doc.placeholderTitle,
      })),
    };
  }
}
