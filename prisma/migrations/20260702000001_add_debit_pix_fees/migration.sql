-- v2.5 (MAQU-004): taxas de DÉBITO e PIX por maquininha.
-- Migration ADITIVA (expand/contract — ADR-005): colunas opcionais, sem
-- alteração das existentes. NULL = taxa não configurada (tratada como 0%).
ALTER TABLE "card_machines" ADD COLUMN "debit_fee_basis_points" INTEGER;
ALTER TABLE "card_machines" ADD COLUMN "pix_fee_basis_points" INTEGER;
