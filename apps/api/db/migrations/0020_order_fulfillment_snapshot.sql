-- 0020 — Order fulfillment snapshot (RC-2 / Faz D)
--
-- Müşterinin sipariş anındaki teslimat adresini, telefonunu ve kurye notunu
-- "Order" satırının kendisinde dondurarak saklar. Amaç: müşteri profili veya
-- adres defteri sonradan değişse / silinse bile geçmiş sipariş verisi
-- (rapor, anlaşmazlık, iade) bozulmadan kalır.
--
-- Geriye dönük backfill yapılmaz; eski siparişler bu kolonlarda NULL kalır.
-- UI null kontrolü ile kart gizleme yapar — placeholder/mock yazılmaz.

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "deliveryAddressSnapshotJson" JSONB,
  ADD COLUMN IF NOT EXISTS "customerPhoneSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "courierNotes" TEXT;
