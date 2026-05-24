import StoreMenuPage from '@/components/store/StoreMenuPage';

export default function StoreDetailPage({
  params,
}: {
  params: { storeId: string };
}) {
  return <StoreMenuPage storeId={params.storeId} />;
}
