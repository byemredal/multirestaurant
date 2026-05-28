// packages/assets/index.ts
// Asset'ler dosya yolu üzerinden tüketilir, ör:
//   import logoUrl from '@lieferzonen/assets/logo.svg';
//
// `defaultLogoDataUrl`, `logo.svg` dosyasının url-encoded data URL
// karşılığıdır. packages/ui gibi kendi bundler'ı olmayan paketler bu
// string'i `<img src=...>` olarak doğrudan kullanabilir; dosya-yolu importu
// (`import x from '@lieferzonen/assets/logo.svg'`) orada çalışmaz.
//
// Logo fallback zinciri (tüm görünür tüketicilerde aynıdır):
//   PlatformSetup.logoUrl → defaultLogoDataUrl (logo.svg) → platformName text.
// logoUrl yüklenmediği sürece her tüketici logo.svg'yi görür; siyah text badge
// yalnızca her iki image de yüklenemezse son çare olarak görünür.
export const defaultLogoDataUrl =
  "data:image/svg+xml;utf8,%3Csvg%20version%3D%221.1%22%20id%3D%22Layer_1%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20x%3D%220px%22%20y%3D%220px%22%20width%3D%221754px%22%20height%3D%22351.75px%22%20viewBox%3D%2298.5%20376.5%201754%20351.75%22%20enable-background%3D%22new%2098.5%20376.5%201754%20351.75%22%20xml%3Aspace%3D%22preserve%22%3E%20%3Cg%3E%20%3Cpath%20fill%3D%22%2324A94A%22%20d%3D%22M316.814%2C612.112c0%2C25.31-20.519%2C45.824-45.825%2C45.824c-25.308%2C0-45.825-20.516-45.825-45.824%20c0-25.308%2C20.517-45.823%2C45.825-45.823l157.714-0.04c0%2C0-1.848-92.208-43.809-128.697C342.934%2C401.064%2C284%2C395.599%2C284%2C395.599%20v71.553c-15-5.786-30.19-8.978-46.664-8.978c-69.098%2C0-125.143%2C56.016-125.143%2C125.114c0%2C69.097%2C56%2C125.112%2C125.098%2C125.112%20c69.099%2C0%2C105.852-51.824%2C86.665-96.157c-1.541-3.561-0.562-2.771-3.03-3.602C316.767%2C607.245%2C316.814%2C612.104%2C316.814%2C612.112z%20M348.564%2C460.437c23.93%2C0%2C43.33%2C19.4%2C43.33%2C43.33c0%2C23.931-19.399%2C43.33-43.33%2C43.33c-23.932%2C0-43.33-19.398-43.33-43.33%20C305.235%2C479.836%2C324.633%2C460.437%2C348.564%2C460.437z%22%2F%3E%20%3Cpath%20fill%3D%22%23343B40%22%20d%3D%22M374.271%2C493.241c-1.052-2.502-2.465-4.814-4.176-6.871c-1.174-1.455-2.499-2.781-3.942-3.966%20c-4.634-3.662-10.485-5.851-16.851-5.851c-15.027%2C0-27.212%2C12.185-27.212%2C27.212c0%2C6.467%2C2.26%2C12.402%2C6.027%2C17.071%20c4.991%2C5.998%2C12.51%2C9.817%2C20.923%2C9.817c15.03%2C0%2C27.212-12.186%2C27.212-27.213C376.252%2C499.833%2C375.547%2C496.391%2C374.271%2C493.241z%22%2F%3E%20%3C%2Fg%3E%20%3Ctext%20transform%3D%22matrix%281%200%200%201%20467.6924%20619.1602%29%22%20fill%3D%22%23343B40%22%20font-family%3D%22%27Quicksand-SemiBold%27%22%20font-size%3D%22233.2002%22%3ELIEFER%3C%2Ftext%3E%20%3Ctext%20transform%3D%22matrix%281%200%200%201%201215.0918%20619.1602%29%22%20fill%3D%22%2324A94A%22%20font-family%3D%22%27Quicksand-SemiBold%27%22%20font-size%3D%22233.2002%22%3EZONE%3C%2Ftext%3E%20%3C%2Fsvg%3E";
