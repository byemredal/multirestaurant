'use client';

export default function TenantGlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            fontFamily: 'system-ui, sans-serif',
            background: '#f7f8f9',
            color: '#1f242b',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Bir şeyler ters gitti</h1>
          <p style={{ fontSize: '14px', color: '#6b7380' }}>
            Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '8px',
              height: '44px',
              padding: '0 24px',
              borderRadius: '9999px',
              border: 'none',
              background: '#24A94A',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Yeniden dene
          </button>
        </div>
      </body>
    </html>
  );
}
