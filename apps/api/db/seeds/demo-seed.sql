-- ============================================================
-- Demo / Dev Seed â€” Lieferzonen
-- Creates demo stores visible in the Zug (6300â€“6340) area.
-- Safe to run multiple times (uses INSERT ... ON CONFLICT DO NOTHING).
-- ============================================================

-- CHF is the marketplace's primary currency — seeded by migration 0018.
-- Kept here idempotently so demo databases are consistent if seeded directly.
INSERT INTO "Currency" ("code", "displayName", "symbol", "numericCode", "decimalDigits", "sortOrder")
VALUES ('CHF', 'Swiss Franc', 'CHF', '756', 2, 5)
ON CONFLICT ("code") DO NOTHING;

-- Demo tenant account (owner of all demo stores)
INSERT INTO "TenantAccount" (
  "id", "email", "passwordHash", "firstName", "lastName",
  "phoneNumber", "companyName", "companyAddress",
  "tenantType", "deliveryModel", "verificationStatus", "onboardingStatus",
  "isActive", "isVerified", "createdAt", "updatedAt"
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'demo@lieferzonen.dev',
  '$2b$10$7QGelyrRGOAvjQwUUPRVKO3tR8jISlcrPa81bI1vUN23lvsCwDomO',
  'Demo', 'Tenant',
  '+41 41 000 00 00',
  'Demo Stores GmbH',
  'Bahnhofstrasse 1, 6300 Zug',
  'store', 'platform',
  'approved', 'completed',
  TRUE, TRUE,
  NOW(), NOW()
) ON CONFLICT ("id") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";

-- ============================================================
-- STORE 1: Zug Kitchen (Pizza / Italian)
-- ============================================================
INSERT INTO "Store" (
  "id", "ownerTenantId", "name", "slug", "category", "description",
  "imageUrl", "status", "onboardingStatus", "isActive",
  "addressLine1", "city", "postalCode", "country",
  "latitude", "longitude", "phoneNumber",
  "createdAt", "updatedAt"
) VALUES (
  'b0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  'Zug Kitchen',
  'zug-kitchen',
  'Pizza & Pasta',
  'Zug''un kalbinde taze hamur ve Ä°talyan lezzetleri. Her gÃ¼n taze hazÄ±rlanÄ±r.',
  NULL,
  'active',
  'ready_for_store_setup',
  TRUE,
  'Kirchenstrasse 12', 'Zug', '6300', 'CH',
  47.1661, 8.5163, '+41 41 711 00 01',
  NOW(), NOW()
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StoreDeliveryZone" (
  "id", "storeId", "name", "postalCodes",
  "minimumOrderAmount", "deliveryFee", "estimatedDeliveryMinutes",
  "createdAt", "updatedAt"
) VALUES (
  'd0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000001',
  'Zug Merkez Teslimat BÃ¶lgesi',
  '["6300","6301","6302","6303","6304","6305","6310","6312","6313","6314","6315","6316","6317","6318","6319","6320","6330","6331","6332","6333","6340","6341","6343"]',
  12.00, 2.90, 28,
  NOW(), NOW()
) ON CONFLICT ("id") DO NOTHING;

-- Menu categories for Zug Kitchen
INSERT INTO "MenuCategory" (
  "id", "storeId", "name", "description", "sortOrder", "isActive",
  "createdAt", "updatedAt"
) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Pizzalar', 'Odun fÄ±rÄ±nÄ±nda piÅŸirilmiÅŸ Ä°talyan pizzalarÄ±', 1, TRUE, NOW(), NOW()),
  ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'Pastalar', 'El yapÄ±mÄ± taze makarnalar', 2, TRUE, NOW(), NOW()),
  ('e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001',
   'TatlÄ±lar', 'Ä°talyan ev tatlÄ±larÄ±', 3, TRUE, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- Menu items for Zug Kitchen
INSERT INTO "MenuItem" (
  "id", "storeId", "categoryId", "name", "description",
  "basePrice", "currencyId", "isActive", "availabilityType", "sortOrder",
  "createdAt", "updatedAt"
) VALUES
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001',
   'Margherita', 'San Marzano domates, mozzarella di bufala, fesleÄŸen',
   14.50, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 1, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001',
   'Quattro Stagioni', 'Mantar, enginar, siyah zeytin, jambon, mozzarella',
   17.50, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 2, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000001',
   'Diavola', 'AcÄ± salam, domates, mozzarella, pul biber',
   16.00, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 3, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000002',
   'Spaghetti Carbonara', 'Guanciale, yumurta, Pecorino Romano, karabiber',
   18.00, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 1, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000002',
   'Tagliatelle RagÃ¹', 'Ev yapÄ±mÄ± tagliatelle, dana kÄ±ymalÄ± ragÃ¹, Parmigiano',
   19.50, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 2, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000003',
   'TiramisÃ¹', 'Klasik Ä°talyan tiramisÃ¹, ev yapÄ±mÄ±',
   7.50, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 1, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001',
   'e0000000-0000-4000-8000-000000000003',
   'Panna Cotta', 'VanilyalÄ± panna cotta, Ã§ilek sosu',
   6.50, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 2, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- ============================================================
-- STORE 2: Sushi Zug (Japanese)
-- ============================================================
INSERT INTO "Store" (
  "id", "ownerTenantId", "name", "slug", "category", "description",
  "imageUrl", "status", "onboardingStatus", "isActive",
  "addressLine1", "city", "postalCode", "country",
  "latitude", "longitude", "phoneNumber",
  "createdAt", "updatedAt"
) VALUES (
  'b0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001',
  'Sushi Zug',
  'sushi-zug',
  'Sushi & Japon',
  'Japonya''nÄ±n en taze lezzetleri Zug''a geliyor. GÃ¼nlÃ¼k taze balÄ±k ve malzemeler.',
  NULL,
  'active',
  'ready_for_store_setup',
  TRUE,
  'Hauptplatz 5', 'Zug', '6300', 'CH',
  47.1671, 8.5155, '+41 41 711 00 02',
  NOW() - INTERVAL '10 days', NOW()
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StoreDeliveryZone" (
  "id", "storeId", "name", "postalCodes",
  "minimumOrderAmount", "deliveryFee", "estimatedDeliveryMinutes",
  "createdAt", "updatedAt"
) VALUES (
  'd0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000002',
  'Sushi Zug Teslimat BÃ¶lgesi',
  '["6300","6301","6302","6303","6304","6310","6312","6313","6314","6315","6316","6317","6318","6319","6320"]',
  25.00, 0.00, 35,
  NOW(), NOW()
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MenuCategory" (
  "id", "storeId", "name", "description", "sortOrder", "isActive",
  "createdAt", "updatedAt"
) VALUES
  ('e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000002',
   'Nigiri & Sashimi', 'Taze balÄ±k, pirinÃ§ Ã¼zerinde', 1, TRUE, NOW(), NOW()),
  ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002',
   'Maki & Rolls', 'Klasik ve Ã¶zel rolls', 2, TRUE, NOW(), NOW()),
  ('e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000002',
   'Setler', 'Ã‡eÅŸitli kombinasyon tabaklarÄ±', 3, TRUE, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MenuItem" (
  "id", "storeId", "categoryId", "name", "description",
  "basePrice", "currencyId", "isActive", "availabilityType", "sortOrder",
  "createdAt", "updatedAt"
) VALUES
  ('f0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000004',
   'Somon Nigiri (2 adet)', 'Taze Atlantik somonu Ã¼zerinde shari pirinci',
   7.80, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 1, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000004',
   'Ton BalÄ±ÄŸÄ± Sashimi (5 dilim)', 'Akami ton balÄ±ÄŸÄ±, wasabi, zencefil',
   14.50, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 2, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000005',
   'California Roll (8 adet)', 'YengeÃ§, avokado, salatalÄ±k, uÃ§balÄ±ÄŸÄ± yumurtasÄ±',
   12.50, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 1, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000005',
   'Dragon Roll (8 adet)', 'Somon, avokado, sari sebze, sos',
   16.80, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 2, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000005',
   'Spicy Tuna Roll (8 adet)', 'Ton balÄ±ÄŸÄ±, avokado, sriracha mayo',
   15.00, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 3, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000006',
   'Sashimi Seti (12 dilim)', 'Somon, ton balÄ±ÄŸÄ± ve balÄ±k tÃ¼rlerinden seÃ§ki',
   28.00, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 1, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000014', 'b0000000-0000-4000-8000-000000000002',
   'e0000000-0000-4000-8000-000000000006',
   'Maki Seti (24 adet)', 'California, Somon Avokado, Spicy Tuna',
   32.00, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 2, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- ============================================================
-- STORE 3: Burger & Mehr (Burgers)
-- ============================================================
INSERT INTO "Store" (
  "id", "ownerTenantId", "name", "slug", "category", "description",
  "imageUrl", "status", "onboardingStatus", "isActive",
  "addressLine1", "city", "postalCode", "country",
  "latitude", "longitude", "phoneNumber",
  "createdAt", "updatedAt"
) VALUES (
  'b0000000-0000-4000-8000-000000000003',
  'a0000000-0000-4000-8000-000000000001',
  'Burger & Mehr',
  'burger-und-mehr',
  'Burger & Grill',
  'GÃ¼nlÃ¼k Ã¶ÄŸÃ¼tÃ¼lmÃ¼ÅŸ et, taze malzemeler. Zug''un en iyi burgerleri.',
  NULL,
  'active',
  'ready_for_store_setup',
  TRUE,
  'Seeuferstrasse 22', 'Zug', '6300', 'CH',
  47.1652, 8.5171, '+41 41 711 00 03',
  NOW() - INTERVAL '5 days', NOW()
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "StoreDeliveryZone" (
  "id", "storeId", "name", "postalCodes",
  "minimumOrderAmount", "deliveryFee", "estimatedDeliveryMinutes",
  "createdAt", "updatedAt"
) VALUES (
  'd0000000-0000-4000-8000-000000000003',
  'b0000000-0000-4000-8000-000000000003',
  'Burger & Mehr GeniÅŸ BÃ¶lge',
  '["6300","6301","6302","6303","6304","6305","6310","6312","6313","6314","6315","6316","6317","6318","6319","6320","6330","6331","6332","6333","6340","6341","6343","6345"]',
  15.00, 3.50, 25,
  NOW(), NOW()
) ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MenuCategory" (
  "id", "storeId", "name", "description", "sortOrder", "isActive",
  "createdAt", "updatedAt"
) VALUES
  ('e0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000003',
   'Burgerler', 'GÃ¼nlÃ¼k Ã¶ÄŸÃ¼tÃ¼lmÃ¼ÅŸ dana eti', 1, TRUE, NOW(), NOW()),
  ('e0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000003',
   'Yan SipariÅŸler', 'Patates kÄ±zartmasÄ± ve garnitÃ¼rler', 2, TRUE, NOW(), NOW()),
  ('e0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000003',
   'Ä°Ã§ecekler', 'SoÄŸuk iÃ§ecekler ve milkshakeler', 3, TRUE, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "MenuItem" (
  "id", "storeId", "categoryId", "name", "description",
  "basePrice", "currencyId", "isActive", "availabilityType", "sortOrder",
  "createdAt", "updatedAt"
) VALUES
  ('f0000000-0000-4000-8000-000000000015', 'b0000000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000007',
   'Classic Burger', 'Dana kÄ±yma, marul, domates, turÅŸu, Ã¶zel sos, brioche ekmek',
   15.50, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 1, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000016', 'b0000000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000007',
   'Cheeseburger Deluxe', 'Ã‡ift patty, cheddar, karamelize soÄŸan, baharatlÄ± sos',
   18.50, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 2, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000017', 'b0000000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000007',
   'Mushroom Swiss Burger', 'Dana kÄ±yma, Ä°sviÃ§re peyniri, sote mantar, roka',
   17.00, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 3, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000018', 'b0000000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000007',
   'Veggie Burger', 'Pancar ve mercimek pattisi, avokado, domates, humus',
   16.00, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 4, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000019', 'b0000000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000008',
   'Patates KÄ±zartmasÄ±', 'Ã‡Ä±tÄ±r Bintje patates, maldon tuz',
   5.50, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 1, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000020', 'b0000000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000008',
   'Sweet Potato Fries', 'TatlÄ± patates kÄ±zartmasÄ±, acÄ± mayo',
   6.50, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 2, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000021', 'b0000000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000009',
   'Limonata', 'Taze sÄ±kÄ±lmÄ±ÅŸ limon, nane, ÅŸurup',
   4.50, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 1, NOW(), NOW()),
  ('f0000000-0000-4000-8000-000000000022', 'b0000000-0000-4000-8000-000000000003',
   'e0000000-0000-4000-8000-000000000009',
   'Ã‡ikolatalÄ± Milkshake', 'El yapÄ±mÄ± dondurma, taze sÃ¼t, Ã§ikolata',
   7.50, (SELECT "id" FROM "Currency" WHERE "code" = 'CHF'), TRUE, 'always', 2, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- ============================================================
-- Commerce config for the demo stores
-- (ordering policy, service types, payment methods)
-- ============================================================
INSERT INTO "StoreOrderingPolicy" ("storeId", "minOrderAmount", "acceptsDelivery", "acceptsPickup", "currencyCode")
VALUES
  ('b0000000-0000-4000-8000-000000000001', 0, TRUE, TRUE, 'CHF'),
  ('b0000000-0000-4000-8000-000000000002', 0, TRUE, TRUE, 'CHF'),
  ('b0000000-0000-4000-8000-000000000003', 0, TRUE, TRUE, 'CHF')
ON CONFLICT ("storeId") DO NOTHING;

INSERT INTO "StoreServiceType" ("storeId", "serviceTypeId", "isActive", "sortOrder")
SELECT "r"."id", "s"."id", TRUE, "s"."sortOrder"
FROM (VALUES
  ('b0000000-0000-4000-8000-000000000001'::uuid),
  ('b0000000-0000-4000-8000-000000000002'::uuid),
  ('b0000000-0000-4000-8000-000000000003'::uuid)
) AS "r"("id")
CROSS JOIN "ServiceType" "s"
WHERE "s"."code" IN ('delivery', 'pickup')
ON CONFLICT ("storeId", "serviceTypeId") DO NOTHING;

INSERT INTO "StorePaymentMethod" ("storeId", "paymentMethodId", "isActive", "sortOrder")
SELECT "r"."id", "p"."id", TRUE, "p"."sortOrder"
FROM (VALUES
  ('b0000000-0000-4000-8000-000000000001'::uuid),
  ('b0000000-0000-4000-8000-000000000002'::uuid),
  ('b0000000-0000-4000-8000-000000000003'::uuid)
) AS "r"("id")
CROSS JOIN "PaymentMethod" "p"
WHERE "p"."code" IN ('cash', 'online_card')
ON CONFLICT ("storeId", "paymentMethodId") DO NOTHING;




-- ============================================================================
-- Lieferzonen — Geliştirme amaçlı sabit test hesapları
-- ============================================================================
--
-- 3 hesap (customer, tenant, admin) — hepsi aynı e-posta ve şifreyle.
--   E-posta : eemrdal23@gmail.com
--   Şifre   : Admin123!
--
-- passwordHash, bcryptjs (cost 10) ile "Admin123!" değeri için üretildi.
-- Hash, projedeki PasswordService (apps/api/src/common/security/password.service.ts)
-- ile birebir uyumludur — compare("Admin123!", <hash>) → true.
--
-- Bu dosya idempotenttir: yeniden çalıştırıldığında yalnızca passwordHash ve
-- timestamp alanlarını günceller, var olan satırları çoğaltmaz.
-- ÜRETİME ÇALIŞTIRMAYIN — sadece geliştirme/test veritabanı içindir.
-- ============================================================================

BEGIN;

-- ── Customer ────────────────────────────────────────────────────────────────
INSERT INTO "CustomerAccount" (
  "id", "email", "firstName", "lastName", "passwordHash",
  "loginPreference", "phoneNumber", "birthDate",
  "isActive", "isVerified", "lastLoginAt",
  "createdAt", "updatedAt"
) VALUES (
  '11111111-1111-4111-8111-111111111111',
  'eemrdal23@gmail.com',
  'Emre',
  'Dal',
  '$2b$10$Y4jC0SxksP5nK1X5BE/pV.PY3jFEVD10iVdZ63qXb4LAj8AFuyNfi',
  FALSE,
  '+905555555555',
  NULL,
  TRUE,
  TRUE,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "isActive"     = TRUE,
  "isVerified"   = TRUE,
  "updatedAt"    = NOW();

-- ── Tenant ─────────────────────────────────────────────────────────────────
INSERT INTO "TenantAccount" (
  "id", "email", "passwordHash",
  "firstName", "lastName", "phoneNumber",
  "companyName", "companyAddress",
  "tenantType", "deliveryModel",
  "verificationStatus", "onboardingStatus",
  "isActive", "isVerified", "lastLoginAt",
  "createdAt", "updatedAt"
) VALUES (
  '22222222-2222-4222-8222-222222222222',
  'eemrdal23@gmail.com',
  '$2b$10$Y4jC0SxksP5nK1X5BE/pV.PY3jFEVD10iVdZ63qXb4LAj8AFuyNfi',
  'Emre',
  'Dal',
  '+905555555555',
  'Lieferzonen Test Restoran',
  'Bağdat Cd. No:1, Kadıköy / İstanbul',
  'food_service',
  'platform_fleet',
  'verified',
  'active',
  TRUE,
  TRUE,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "passwordHash"       = EXCLUDED."passwordHash",
  "verificationStatus" = 'verified',
  "onboardingStatus"   = 'active',
  "isActive"           = TRUE,
  "isVerified"         = TRUE,
  "updatedAt"          = NOW();

-- ── Admin ───────────────────────────────────────────────────────────────────
INSERT INTO "AdminAccount" (
  "id", "email", "passwordHash",
  "firstName", "lastName", "role",
  "isActive", "lastLoginAt",
  "createdAt", "updatedAt"
) VALUES (
  '33333333-3333-4333-8333-333333333333',
  'eemrdal23@gmail.com',
  '$2b$10$Y4jC0SxksP5nK1X5BE/pV.PY3jFEVD10iVdZ63qXb4LAj8AFuyNfi',
  'Emre',
  'Dal',
  'super_admin',
  TRUE,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "role"         = 'super_admin',
  "isActive"     = TRUE,
  "updatedAt"    = NOW();

COMMIT;

-- ── Çalıştırma örneği ──────────────────────────────────────────────────────
-- psql "$DATABASE_URL" -f seed_accounts.sql
-- ya da:
-- psql -U postgres -d lieferzonen -f seed_accounts.sql
