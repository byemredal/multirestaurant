'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAdminLanguage } from '@/lib/i18n/AdminLanguageProvider';
import { loginAdmin } from '@/lib/admin-api/admin-auth-client';
import { readAdminSession, writeAdminSession } from '@/lib/storage/admin-session';
import { adminAppName } from '@/lib/config';
import logoUrl from '@lieferzonen/assets/logo.svg';
import Image from 'next/image';

export default function AdminLoginPage() {
  const router = useRouter();
  const { t } = useAdminLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guest-only: an already-signed-in admin must never see the login screen.
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (readAdminSession()) {
      router.replace('/');
      return;
    }
    setSessionChecked(true);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    try {
      setLoading(true);
      setError(null);
      const session = await loginAdmin(email, password);
      writeAdminSession(session);
      router.replace('/');
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === 'admin_api_unreachable') {
          setError(t('admin.login.error.api', 'Admin API şu an erişilemiyor.'));
        } else if (err.message === 'admin_login_failed_401') {
          setError(t('admin.login.error.credentials', 'E-posta veya şifre hatalı.'));
        } else {
          setError(t('admin.login.error.generic', 'Giriş şu an tamamlanamıyor.'));
        }
      } else {
        setError(t('admin.login.error.generic', 'Giriş şu an tamamlanamıyor.'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Until the session check resolves, render nothing so the login form is
  // never briefly shown to an already-authenticated admin.
  if (!sessionChecked) {
    return null;
  }

  return (
    <div className="admin-login-page">
      <div className="admin-login-shell">
        {/* ── Left: form panel ──────────────────────────────── */}
        <section className="admin-login-form-panel">
          <header className="admin-login-topbar">
            <Image src={logoUrl} alt={`${adminAppName} logo`} width={120} height={36} />
            <span className="admin-login-topbar__hint">
              {t('admin.login.helper', 'Yalnızca operasyon ekibi')}
            </span>
          </header>

          <form className="admin-login-card" onSubmit={handleSubmit} noValidate>
            <span className="admin-login-card__eyebrow">Admin</span>
            <h1 className="admin-login-card__title">
              {t('admin.login.title', 'Admin Girişi')}
            </h1>
            <p className="admin-login-card__subtitle">
              {t(
                'admin.login.description',
                'Lieferzonen operasyon paneline yetkili hesabınızla giriş yapın.',
              )}
            </p>

            <div className="admin-login-form">
              <div className="admin-field">
                <label className="admin-field__label" htmlFor="admin-email">
                  {t('admin.login.email', 'E-posta')}
                </label>
                <input
                  id="admin-email"
                  className="admin-input admin-login-input"
                  placeholder="admin@lieferzonen.com"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="admin-field">
                <div className="admin-login-field-row">
                  <label className="admin-field__label" htmlFor="admin-password">
                    {t('admin.login.password', 'Şifre')}
                  </label>
                  <button
                    type="button"
                    className="admin-login-link"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword
                      ? t('admin.login.password.hide', 'Gizle')
                      : t('admin.login.password.show', 'Göster')}
                  </button>
                </div>
                <input
                  id="admin-password"
                  className="admin-input admin-login-input"
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {error ? (
              <div role="alert" className="admin-login-error">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              className="admin-button admin-button--primary admin-login-submit"
              disabled={loading}
            >
              {loading
                ? t('admin.login.submitting', 'Giriş yapılıyor…')
                : t('admin.login.submit', 'Giriş yap')}
            </button>

            <footer className="admin-login-footer">
              <span>{t('admin.login.support', 'Erişim sorunu mu?')}</span>
              <span className="admin-login-footer__links">
                <a href="mailto:ops@lieferzonen.com">Destek</a>
                <a href="/legal">Şartlar</a>
              </span>
            </footer>
          </form>
        </section>

        {/* ── Right: showcase panel ─────────────────────────── */}
        <aside className="admin-login-aside" aria-hidden="true">
          <div className="admin-login-aside__tile">
            {/* Free-license imagery (Unsplash) — operasyon/dashboard sahnesi */}
            <img
              className="admin-login-aside__photo"
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80"
              alt=""
              loading="eager"
            />
            <span className="admin-login-aside__tint" />
            <span className="admin-login-aside__glow-a" />
            <span className="admin-login-aside__glow-b" />

            <div className="admin-login-aside__copy">
              <p className="admin-login-aside__eyebrow">Operations console</p>
              <h2 className="admin-login-aside__title">
                Tüm tenant ve sipariş operasyonu tek panelde.
              </h2>
              <p className="admin-login-aside__lead">
                Onay akışı, belge denetimi ve operasyon metrikleri — gerçek zamanlı, denetlenebilir.
              </p>
            </div>
          </div>

          <span className="admin-login-aside__pill">Canlı operasyon</span>

          <div className="admin-login-aside__metric">
            <p className="admin-login-aside__metric-label">Bugün</p>
            <p className="admin-login-aside__metric-value">142 başvuru</p>
            <div className="admin-login-aside__metric-bars">
              <span style={{ height: '32%' }} />
              <span style={{ height: '48%' }} />
              <span style={{ height: '22%' }} />
              <span style={{ height: '58%' }} />
              <span style={{ height: '38%' }} />
              <span style={{ height: '72%' }} className="is-peak" />
              <span style={{ height: '50%' }} />
            </div>
            <p className="admin-login-aside__metric-meta">
              Bekleyen incelemeler <strong>+12</strong>
            </p>
          </div>

          <div className="admin-login-aside__row">
            <div className="admin-login-aside__row-head">
              <span className="admin-login-aside__row-id">
                <span className="admin-login-aside__row-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
                    <path d="M14 3v5h5" />
                  </svg>
                </span>
                <span>
                  Başvuru #PA-2841
                  <span className="admin-login-aside__row-meta" style={{ display: 'block' }}>
                    Margherita Pizza · İstanbul
                  </span>
                </span>
              </span>
              <span className="admin-login-aside__row-badge">İnceleme</span>
            </div>
            <div className="admin-login-aside__row-progress" />
            <p className="admin-login-aside__row-meta">Belgeler 4/6 tamamlandı</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
