import type { IconName } from '@/lib/icons';

export type AdminNotification = {
  id: string;
  title: string;
  meta: string;
  icon: IconName;
  read: boolean;
  href: string;
};

export const mockNotifications: AdminNotification[] = [
  {
    id: 'n1',
    title: 'Ödeme sağlayıcısı gecikmesi eşiğin üstünde',
    meta: 'Stripe · 4 dk önce',
    icon: 'alert',
    read: false,
    href: '/alerts',
  },
  {
    id: 'n2',
    title: 'İnceleme bekleyen 3 tenant başvurusu',
    meta: 'Onboarding kuyruğu · 22 dk önce',
    icon: 'inbox',
    read: false,
    href: '/tenant-applications',
  },
  {
    id: 'n3',
    title: 'Haftalık ödeme partisi onaya hazır',
    meta: 'Finans · 1 s önce',
    icon: 'payout',
    read: false,
    href: '/finance/payouts',
  },
  {
    id: 'n4',
    title: 'Webhook uç noktası tekrar çalışıyor',
    meta: 'order.updated · 3 s önce',
    icon: 'webhook',
    read: true,
    href: '/platform/api-webhooks',
  },
  {
    id: 'n5',
    title: '"Pasta Mancini" mağazası çevrimdışı oldu',
    meta: 'Servis durumu · 5 s önce',
    icon: 'store',
    read: true,
    href: '/service-availability',
  },
];
