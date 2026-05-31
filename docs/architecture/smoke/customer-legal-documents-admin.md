# Smoke Checklist — Müşteri Yasal Metinleri (Admin)

Feature: MR-CUSTOMER-LEGAL-ADMIN-POLISH-01
Screen: Admin → System → **Müşteri Yasal Metinleri** (`/system/customer-legal-documents`)

Manuel browser smoke (READY bir kurulumda, admin hesabıyla):

1. **Admin login** → panele gir.
2. Sol menü **System > "Müşteri Yasal Metinleri"** açılıyor mu? (Partner Başvuru Uyumu ile
   karışmıyor; açıklama "checkout sırasında gördüğü ve kabul ettiği yasal metinleri yönetir"
   diyor.)
3. **Aktif country/locale** doğru mu? Üst filtrede "Ülke: TR" (kurulum ülkesi) chip'i ve
   readiness kartında `(TR / tr-TR)` görünüyor mu? CH/de-CH **görünmemeli**.
4. **Eski `/legal` linki** → tarayıcıda `/legal`'a git; `/system/customer-legal-documents`'a
   redirect oluyor, boş/kırık ekran yok.
5. Readiness kartında **"Mesafeli Satış Sözleşmesi oluştur"** CTA'sına bas → Yeni Yasal Metin
   drawer'ı ilgili belge tipi + önerilen code (`tr-distance-sales-contract`) ile **ön-dolu**
   açılıyor mu?
6. **Placeholder publish denemesi:** title/body'e "taslak / lorem ipsum / TODO" gibi metin
   gir, "İlk versiyonu da yayınla" işaretli yayınla. Production'da backend
   `legal_document_placeholder_content` döndürüp UI net hata gösteriyor mu?
   ("Bu metin taslak/placeholder içerik gibi görünüyor. Üretimde yayınlanamaz…")
   (Dev/test ortamında guard pasiftir — bu adım production'da doğrulanır.)
7. **Gerçek metinle publish:** geçerli hukuki metinle tekrar yayınla → başarıyla
   oluşuyor, listede current version görünüyor.
8. Readiness kartında **"Ön Bilgilendirme Formu oluştur"** CTA → aynı akışla gerçek metinle
   yayınla.
9. **Readiness kartı yeşile** dönüyor mu? (Her iki required belge "Yayında" + placeholder
   uyarısı yok.)
10. **Checkout legal readiness:** `GET` checkout-readiness (veya web checkout) `legalReady=true`
    dönüyor mu? (placeholder içerikken `false`, gerçek metinle `true`.)
11. **Yanlış country izolasyonu:** Liste yalnızca aktif ülkenin belgelerini gösteriyor; başka
    ülke (örn. CH) belgesi listede/checkout'ta görünmüyor.
12. **Görüntüle drawer:** bir satıra tıkla → current version metadata + içerik önizleme +
    versiyon geçmişi + (varsa) placeholder uyarısı + "Checkout için zorunlu belge" rozeti.
13. **Pasifleştir/Aktifleştir** ikonu çalışıyor (hard delete yok).
14. **Empty/error states:** belge yokken empty state + "İlk yasal metni oluştur" CTA; ağ
    hatasında inline hata.

Notlar:
- Asıl placeholder güvenliği backend'dedir (publishVersion + getCheckoutLegalReadiness).
  UI'daki sarı uyarı yalnızca erken ipuçudur.
- Required checkout kodları şimdilik global (`distance_sales_contract`,
  `pre_information_form`) — ülke bazlı policy ileride.
