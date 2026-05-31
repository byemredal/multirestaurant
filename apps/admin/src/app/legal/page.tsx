import { redirect } from 'next/navigation';

/**
 * Legacy `/legal` route. The customer legal documents screen now lives under
 * System > "Müşteri Yasal Metinleri". Redirect so old links never land on a
 * dead/duplicate screen (MR-CUSTOMER-LEGAL-ADMIN-POLISH-01).
 */
export default function LegacyLegalRedirect() {
  redirect('/system/customer-legal-documents');
}
