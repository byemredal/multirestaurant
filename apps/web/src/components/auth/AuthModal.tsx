'use client';

import AuthSurface from '@/components/auth/AuthSurface';
import type { AuthMode, SocialProvider } from '@/lib/auth-client';
import { Modal } from '@lieferzonen/ui';

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12" />
      <path d="M18 6l-12 12" />
    </svg>
  );
}

type Props = {
  initialMode?: AuthMode;
  onClose: () => void;
  onSubmit: (input: {
    mode: AuthMode;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  onSocialAuth: (provider: SocialProvider, mode: AuthMode) => Promise<void>;
};

export default function AuthModal({
  initialMode = 'login',
  onClose,
  onSubmit,
  onSocialAuth,
}: Props) {
  return (
    <Modal open={true} onClose={onClose} title="Hesabınıza giriş yapın veya yeni bir hesap oluşturun" description="Devam etmek için lütfen giriş yapın veya kayıt olun.">
      <AuthSurface
        initialMode={initialMode}
        onSocialAuth={onSocialAuth}
        onSubmit={onSubmit}
        onSuccess={onClose}
        variant="modal"
      />
    </Modal>
  );
}
