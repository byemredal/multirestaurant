import {
  containsPlaceholderLegalContent,
  placeholderLegalGuardEnforced,
} from './legal-placeholder.util';

describe('legal-placeholder.util', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  describe('containsPlaceholderLegalContent', () => {
    it('detects strong placeholder/draft signals across fields', () => {
      expect(containsPlaceholderLegalContent('Mesafeli Satış Sözleşmesi (taslak)')).toBe(true);
      expect(containsPlaceholderLegalContent(null, 'Lorem ipsum dolor sit amet')).toBe(true);
      expect(containsPlaceholderLegalContent('Title', 'üretime geçmeden önce doğrulayın')).toBe(true);
      expect(containsPlaceholderLegalContent('placeholder-v1')).toBe(true);
      expect(containsPlaceholderLegalContent('TODO: replace before launch')).toBe(true);
    });

    it('passes clean production-style legal text', () => {
      expect(
        containsPlaceholderLegalContent(
          'Mesafeli Satış Sözleşmesi',
          'İşbu sözleşme, satıcı ile alıcı arasında akdedilmiştir.',
          '1.0',
        ),
      ).toBe(false);
    });

    it('ignores null/empty fields', () => {
      expect(containsPlaceholderLegalContent(null, undefined, '')).toBe(false);
    });
  });

  describe('placeholderLegalGuardEnforced', () => {
    it('enforces in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ALLOW_PLACEHOLDER_LEGAL_CONTENT;
      expect(placeholderLegalGuardEnforced()).toBe(true);
    });

    it('does not enforce outside production', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOW_PLACEHOLDER_LEGAL_CONTENT;
      expect(placeholderLegalGuardEnforced()).toBe(false);
    });

    it('is bypassed by ALLOW_PLACEHOLDER_LEGAL_CONTENT=true even in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOW_PLACEHOLDER_LEGAL_CONTENT = 'true';
      expect(placeholderLegalGuardEnforced()).toBe(false);
    });
  });
});
