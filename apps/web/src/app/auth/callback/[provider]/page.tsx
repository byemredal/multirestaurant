import { notFound } from 'next/navigation';
import AuthCallbackPage from '@/components/auth/AuthCallbackPage';

export default async function SocialAuthCallbackPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = await params;

  if (provider !== 'google' && provider !== 'facebook') {
    notFound();
  }

  return <AuthCallbackPage provider={provider} />;
}
