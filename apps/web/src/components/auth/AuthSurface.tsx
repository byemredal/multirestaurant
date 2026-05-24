'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { AuthMode, SocialProvider } from '@/lib/auth-client';
import { Button, Input } from '@lieferzonen/ui';

type Props = {
  initialMode?: AuthMode;
  variant?: 'modal' | 'page';
  title?: string;
  description?: string;
  submitLabel?: string;
  onSubmit: (input: {
    mode: AuthMode;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  onSocialAuth: (provider: SocialProvider, mode: AuthMode) => Promise<void>;
  onSuccess?: () => void;
  onModeChange?: (mode: AuthMode) => void;
};

function Icon({
  children,
  className = 'h-5 w-5',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      {children}
    </svg>
  );
}

function GoogleIcon() {
  return (
    <Icon>
      <path d="M21.8 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.8 3.1-4.4 3.1-7.4Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.6c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.8-5.6-4.1H3.1v2.7A10 10 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.4 13.8a6 6 0 0 1 0-3.7V7.4H3.1a10 10 0 0 0 0 9l3.3-2.6Z" fill="#FBBC04" />
      <path d="M12 6c1.5 0 2.9.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 12 2 10 10 0 0 0 3.1 7.4l3.3 2.7C7.2 7.8 9.4 6 12 6Z" fill="#EA4335" />
    </Icon>
  );
}

function FacebookIcon() {
  return (
    <Icon>
      <path d="M13.5 21v-7.8H16l.4-3h-2.9V8.3c0-.9.2-1.5 1.5-1.5h1.6V4.1c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.2v2H8v3h2.2V21h3.3Z" fill="#1877F2" />
    </Icon>
  );
}

function ProviderButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      className="flex w-full items-center justify-center gap-3 rounded-[18px] border border-[#d9e2ec] bg-white px-4 py-3 text-[15px] font-semibold text-[#16202a] transition hover:border-[#084799] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function AuthSurface({
  initialMode = 'login',
  variant = 'modal',
  title,
  description,
  submitLabel,
  onSubmit,
  onSocialAuth,
  onSuccess,
  onModeChange,
}: Props) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = useMemo(() => {
    if (mode === 'signup') {
      return {
        title: title ?? 'Hesabınızı oluşturun',
        description: description ?? 'Adresinizi kaydedin, siparişlerinizi takip edin ve gelecekteki ödüllerin kilidini açın.',
        submitLabel: submitLabel ?? 'Hesap oluştur',
      };
    }

    return {
      title: title ?? 'Giriş yap',
      description: description ?? 'Siparişlerinize erişin, destek alın, ödüllerinizi ve kaydedilen mağaza ayarlarını görün.',
      submitLabel: submitLabel ?? 'Giriş yap',
    };
  }, [description, mode, submitLabel, title]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    onModeChange?.(nextMode);
  };

  const routeFooter = mode === 'login'
    ? {
        prompt: "Hesabınız yok mu?",
        href: '/signup',
        label: 'Kayıt olun',
      }
    : {
        prompt: 'Zaten bir hesabınız var mı?',
        href: '/login',
        label: 'Giriş yap',
      };

  return (
    <div className={variant === 'page' ? 'mx-auto w-full max-w-[560px] rounded-[32px] border border-[#e4eaf1] bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)]' : ''}>
      <div className="rounded-[26px] bg-[linear-gradient(180deg,#f5f9fd_0%,#ffffff_100%)] p-1">
        <div className="inline-flex rounded-full bg-[#eef4fb] p-1">
          <Button
            className={`rounded-full px-5 py-2.5 text-[14px] font-semibold transition ${mode === 'login' ? 'bg-[#084799] text-white shadow-[0_8px_18px_rgba(8,71,153,0.2)]' : 'text-[#51606f]'}`}
            onClick={() => switchMode('login')}
            type="button"
            variant={mode === 'login' ? 'primary' : 'soft'}
            rounded='full'
          >
            Giriş Yap
          </Button>
          <Button
            className={`rounded-full px-5 py-2.5 text-[14px] font-semibold transition ${mode === 'signup' ? 'bg-[#084799] text-white shadow-[0_8px_18px_rgba(8,71,153,0.2)]' : 'text-[#51606f]'}`}
            onClick={() => switchMode('signup')}
            type="button"
            variant={mode === 'signup' ? 'primary' : 'soft'}
            rounded='full'
          >
            Kaydol
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <h1 className="text-[30px] font-bold leading-tight text-[#16202a]">{copy.title}</h1>
        <p className="mt-3 max-w-[420px] text-[15px] leading-7 text-[#5d6670]">{copy.description}</p>
      </div>

      <div className="mt-6 grid gap-3">
        <ProviderButton
          disabled={loading}
          icon={<GoogleIcon />}
          label={`Google ile ${mode === 'login' ? 'Devam et' : 'Kayıt ol'}`}
          onClick={async () => {
            try {
              setLoading(true);
              setError(null);
              await onSocialAuth('google', mode);
            } catch {
              setError('Google sign-in is not available right now.');
            } finally {
              setLoading(false);
            }
          }}
        />
        <ProviderButton
          disabled={loading}
          icon={<FacebookIcon />}
          label={`Facebook ile ${mode === 'login' ? 'Devam et' : 'Kayıt ol'}`}
          onClick={async () => {
            try {
              setLoading(true);
              setError(null);
              await onSocialAuth('facebook', mode);
            } catch {
              setError('Facebook sign-in is not available right now.');
            } finally {
              setLoading(false);
            }
          }}
        />
      </div>

      <div className="my-6 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8a97a4]">
        <span className="h-px flex-1 bg-[#e2e8f0]" />
        <span>Ya da E-posta</span>
        <span className="h-px flex-1 bg-[#e2e8f0]" />
      </div>

      <div className="grid gap-3">
        {mode === 'signup' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="First name"
              value={firstName}
            />
            <Input
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Last name"
              value={lastName}
            />
          </div>
        ) : null}
        <Input
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="E-posta adresi"
          value={email}
        />
        <Input
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Şifre"
          type="password"
          value={password}
        />
      </div>

      {error ? <div className="mt-4 rounded-[16px] bg-[#fff1f2] px-4 py-3 text-[14px] text-[#b42318]">{error}</div> : null}

      <Button
        disabled={loading}
        onClick={async () => {
          try {
            setLoading(true);
            setError(null);
            await onSubmit({
              mode,
              firstName,
              lastName,
              email,
              password,
            });
            onSuccess?.();
          } catch {
            setError(mode === 'login' ? 'Login failed. Please check your credentials.' : 'Sign up failed. Please review the form and try again.');
          } finally {
            setLoading(false);
          }
        }}
        type="button"
        shimmer={true}
        fullWidth
        rounded="lg"
        className='mt-4'
      >
        {loading ? 'Lütfen Bekleyin...' : copy.submitLabel}
      </Button>

      <div className="mt-5 text-[14px] text-[#5d6670]">
        <span>{routeFooter.prompt} </span>
        <Link className="font-semibold text-[#084799] underline underline-offset-4" href={routeFooter.href}>
          {routeFooter.label}
        </Link>
      </div>
    </div>
  );
}
