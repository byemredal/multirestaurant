import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--bg)',
      }}
    >
      <div
        className="admin-card"
        style={{ maxWidth: 440, padding: '32px 28px', textAlign: 'center' }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--accent-hover)',
          }}
        >
          404
        </p>
        <h1
          style={{
            margin: '10px 0 6px',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
          }}
        >
          Sayfa bulunamadı
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            lineHeight: 1.6,
            color: 'var(--muted)',
          }}
        >
          Aradığınız admin sayfası taşınmış ya da hiç var olmamış olabilir.
        </p>
        <Link
          href="/"
          className="admin-button admin-button--primary"
          style={{ marginTop: 22 }}
        >
          Panele dön
        </Link>
      </div>
    </div>
  );
}
