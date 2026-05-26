// packages/assets/index.ts
// Asset'ler dosya yolu üzerinden tüketilir, ör:
//   import logoUrl from '@lieferzonen/assets/logo.svg';
//
// Brand-neutral default mark: bu kullanıcıya görünen son-çare bundled
// fallback'tir. Aşağıdaki `logo.svg` ve `logo_.svg` dosyalarının ikisi de
// SVG içine "LIEFER ZONE" / glyph wordmark'ı pişirmiş olduğundan platform
// brand fallback'i olarak KULLANILAMAZ — operatör Yemekmarketi gibi farklı
// bir platform adı girdiğinde Lieferzonen wordmark'ını sızdırırlardı.
//
// `default-platform-mark.svg` (yeni) içinde hiçbir text yok; sadece
// abstract geometrik mark (rounded square + halka + nokta). Setup'tan
// logoUrl yüklenmediği sürece her tüketici bu mark'ı görür.
//
// `defaultPlatformMarkDataUrl` aynı SVG'nin url-encoded data URL
// karşılığıdır. packages/ui gibi kendi bundler'ı olmayan paketler bu
// string'i `<img src=...>` olarak doğrudan kullanabilir.
export const defaultPlatformMarkDataUrl =
  "data:image/svg+xml;utf8," +
  "%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2064%2064%27%20role%3D%27img%27%20aria-label%3D%27Platform%27%3E" +
  "%3Crect%20width%3D%2764%27%20height%3D%2764%27%20rx%3D%2714%27%20fill%3D%27%230F172A%27%2F%3E" +
  "%3Ccircle%20cx%3D%2732%27%20cy%3D%2732%27%20r%3D%2715%27%20fill%3D%27none%27%20stroke%3D%27%23FFFFFF%27%20stroke-width%3D%273%27%2F%3E" +
  "%3Ccircle%20cx%3D%2732%27%20cy%3D%2732%27%20r%3D%274.5%27%20fill%3D%27%23F97316%27%2F%3E" +
  "%3C%2Fsvg%3E";
