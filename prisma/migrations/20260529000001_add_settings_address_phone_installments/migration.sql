-- =============================================================================
-- Migration: 20260529000001_add_settings_address_phone_installments
-- SPO — Sistema Pimenta Ousada | DT-010 | 2026-05-29
-- =============================================================================
--
-- 1. Settings: adicionar address e phone para comanda customizável (COM-006)
-- 2. CardMachineInstallment: nova tabela de taxas por parcelamento (MAQU-003/VEND-007)
-- 3. Sale: adicionar installments e installment_fee_basis_points (VEND-007)
-- =============================================================================

-- =============================================================================
-- 1. Settings — endereço e telefone da loja para a comanda
-- =============================================================================

ALTER TABLE "settings" ADD COLUMN "address" TEXT;
ALTER TABLE "settings" ADD COLUMN "phone" TEXT;

-- =============================================================================
-- 2. CardMachineInstallment — taxas por número de parcelas
--    Cada registro = uma faixa de parcelamento (2x, 3x... 12x) de uma maquininha.
--    A taxa à vista (1×) continua em card_machines.fee_basis_points.
-- =============================================================================

CREATE TABLE "card_machine_installments" (
  "id"               TEXT    NOT NULL PRIMARY KEY,
  "card_machine_id"  TEXT    NOT NULL,
  "installments"     INTEGER NOT NULL,
  "fee_basis_points" INTEGER NOT NULL,
  "is_active"        INTEGER NOT NULL DEFAULT 1,
  "created_at"       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at"       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "card_machine_installments_card_machine_id_fkey"
    FOREIGN KEY ("card_machine_id") REFERENCES "card_machines" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "card_machine_installments_card_machine_id_installments_key"
    UNIQUE ("card_machine_id", "installments")
);

CREATE INDEX "card_machine_installments_card_machine_id_idx"
  ON "card_machine_installments"("card_machine_id");

CREATE INDEX "card_machine_installments_is_active_idx"
  ON "card_machine_installments"("is_active");

CREATE TRIGGER IF NOT EXISTS trg_card_machine_installments_updated_at
AFTER UPDATE ON "card_machine_installments"
FOR EACH ROW
BEGIN
  UPDATE "card_machine_installments"
    SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE "id" = NEW."id";
END;

-- =============================================================================
-- 3. Sale — campos de parcelamento
--    installments DEFAULT 1 garante que todas as vendas existentes ficam como à vista.
--    installment_fee_basis_points nullable — null para vendas à vista ou sem maquininha.
-- =============================================================================

ALTER TABLE "sales" ADD COLUMN "installments" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "sales" ADD COLUMN "installment_fee_basis_points" INTEGER;
