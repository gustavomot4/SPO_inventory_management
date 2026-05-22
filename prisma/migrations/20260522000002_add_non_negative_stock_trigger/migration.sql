-- =============================================================================
-- Migration: 20260522000002_add_non_negative_stock_trigger
-- SPO — Sistema Pimenta Ousada
-- =============================================================================
-- Cria trigger SQLite que impede estoque negativo no nível do banco de dados.
-- Esta é a linha de defesa FINAL — a camada de aplicação deve validar ANTES
-- de chegar aqui (ver SCHEMA_DESIGN.md seção 4).
--
-- O Prisma não suporta CHECK constraints nativamente no SQLite, por isso
-- usamos um TRIGGER como alternativa equivalente.
-- =============================================================================

CREATE TRIGGER enforce_non_negative_stock
BEFORE UPDATE ON product_variations
FOR EACH ROW
WHEN NEW."stockQuantity" < 0
BEGIN
  SELECT RAISE(ABORT, 'Estoque não pode ser negativo');
END;
