-- =============================================================================
-- Migration: 20260522000001_init_v2
-- SPO — Sistema Pimenta Ousada | Database Agent — MVP-004 | 2026-05-22
-- =============================================================================
-- Schema limpo pós-alinhamento com cliente.
-- Mudanças em relação ao init original:
--   REMOVIDO:  tabelas users, suppliers
--   REMOVIDO:  colunas supplier_id (products, stock_entries), user_id (sales)
--   ADICIONADO: tabelas card_machines, settings
--   ADICIONADO: colunas subtotal_cents, discount_cents, card_machine_id, fee_cents (sales)
--   ATUALIZADO: PaymentMethod DEBIT_CARD→DEBIT, CREDIT_CARD→CREDIT
--   INCLUÍDO:  trigger enforce_non_negative_stock (era migration separada)
-- =============================================================================
-- Reversível: NÃO — migration inicial (não há estado anterior para reverter)
-- Risco: BAIXO — schema novo em banco vazio
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- =============================================================================
-- TABELAS
-- =============================================================================

-- categories — classificações de produto (Blusa, Calça, Vestido, etc.)
CREATE TABLE IF NOT EXISTS "categories" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "name"       TEXT NOT NULL,
    "is_active"  INTEGER NOT NULL DEFAULT 1 CHECK ("is_active" IN (0, 1)),
    "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT "categories_name_unique" UNIQUE ("name")
);

-- products — produto-base (ex: "Blusa Floral")
-- Sem supplier_id — fornecedores removidos do MVP.
CREATE TABLE IF NOT EXISTS "products" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "name"        TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL CHECK ("price_cents" >= 0),
    "is_active"   INTEGER NOT NULL DEFAULT 1 CHECK ("is_active" IN (0, 1)),
    "deleted_at"  TEXT,
    "created_at"  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at"  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT "products_category_fk" FOREIGN KEY ("category_id")
        REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- product_variations — cada combinação (tamanho + cor) de um produto
CREATE TABLE IF NOT EXISTS "product_variations" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "product_id"     TEXT NOT NULL,
    "sku"            TEXT NOT NULL,
    "size"           TEXT NOT NULL,
    "color"          TEXT NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0 CHECK ("stock_quantity" >= 0),
    "min_stock"      INTEGER NOT NULL DEFAULT 2 CHECK ("min_stock" >= 0),
    "is_active"      INTEGER NOT NULL DEFAULT 1 CHECK ("is_active" IN (0, 1)),
    "created_at"     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at"     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT "product_variations_sku_unique"    UNIQUE ("sku"),
    CONSTRAINT "product_variations_combo_unique"  UNIQUE ("product_id", "size", "color"),
    CONSTRAINT "product_variations_product_fk"    FOREIGN KEY ("product_id")
        REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- stock_entries — recebimentos de mercadoria (sem fornecedor — removido do MVP)
CREATE TABLE IF NOT EXISTS "stock_entries" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "variation_id"    TEXT NOT NULL,
    "quantity"        INTEGER NOT NULL CHECK ("quantity" > 0),
    "unit_cost_cents" INTEGER CHECK ("unit_cost_cents" >= 0),
    "notes"           TEXT,
    "received_at"     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "created_at"      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at"      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT "stock_entries_variation_fk" FOREIGN KEY ("variation_id")
        REFERENCES "product_variations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- card_machines — maquininhas de cartão (RN-010)
-- Taxa em basis points: 199 = 1,99% — evita Float para percentuais.
CREATE TABLE IF NOT EXISTS "card_machines" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "name"             TEXT NOT NULL,
    "fee_basis_points" INTEGER NOT NULL CHECK ("fee_basis_points" >= 0),
    "is_active"        INTEGER NOT NULL DEFAULT 1 CHECK ("is_active" IN (0, 1)),
    "created_at"       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at"       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- settings — configurações globais (singleton — 1 único registro)
-- PIN bcrypt protege relatórios e configurações (RN-007).
CREATE TABLE IF NOT EXISTS "settings" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "pin_hash"   TEXT,
    "shop_name"  TEXT NOT NULL DEFAULT 'Pimenta Ousada',
    "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- sales — cabeçalho de venda
-- subtotal_cents = soma dos itens SEM desconto
-- discount_cents = desconto aplicado (0 = sem desconto)
-- total_cents    = subtotal_cents - discount_cents  (calculado na API)
-- fee_cents      = taxa estimada da maquininha (apenas informativo — RN-004.10)
CREATE TABLE IF NOT EXISTS "sales" (
    "id"              TEXT NOT NULL PRIMARY KEY,
    "status"          TEXT NOT NULL DEFAULT 'ACTIVE'
                          CHECK ("status" IN ('ACTIVE', 'CANCELLED')),
    "payment_method"  TEXT NOT NULL
                          CHECK ("payment_method" IN ('CASH', 'PIX', 'DEBIT', 'CREDIT')),
    "subtotal_cents"  INTEGER NOT NULL CHECK ("subtotal_cents" >= 0),
    "discount_cents"  INTEGER NOT NULL DEFAULT 0 CHECK ("discount_cents" >= 0),
    "total_cents"     INTEGER NOT NULL CHECK ("total_cents" >= 0),
    "card_machine_id" TEXT,
    "fee_cents"       INTEGER CHECK ("fee_cents" >= 0),
    "notes"           TEXT,
    "cancelled_at"    TEXT,
    "cancel_reason"   TEXT,
    "created_at"      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at"      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT "sales_card_machine_fk" FOREIGN KEY ("card_machine_id")
        REFERENCES "card_machines" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    -- Regra: pagamento em cartão requer maquininha; dinheiro/pix não
    CONSTRAINT "sales_card_machine_required"
        CHECK (
            ("payment_method" IN ('DEBIT', 'CREDIT') AND "card_machine_id" IS NOT NULL)
            OR
            ("payment_method" IN ('CASH', 'PIX'))
        ),
    -- Regra: total = subtotal - desconto
    CONSTRAINT "sales_total_check"
        CHECK ("total_cents" = "subtotal_cents" - "discount_cents")
);

-- sale_items — linhas da venda (snapshot imutável de preço)
CREATE TABLE IF NOT EXISTS "sale_items" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "sale_id"          TEXT NOT NULL,
    "variation_id"     TEXT NOT NULL,
    "quantity"         INTEGER NOT NULL CHECK ("quantity" > 0),
    "unit_price_cents" INTEGER NOT NULL CHECK ("unit_price_cents" >= 0),
    "subtotal_cents"   INTEGER NOT NULL CHECK ("subtotal_cents" >= 0),
    "created_at"       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT "sale_items_sale_fk"      FOREIGN KEY ("sale_id")
        REFERENCES "sales" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sale_items_variation_fk" FOREIGN KEY ("variation_id")
        REFERENCES "product_variations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    -- Garante que subtotal = quantidade × preço unitário
    CONSTRAINT "sale_items_subtotal_check"
        CHECK ("subtotal_cents" = "quantity" * "unit_price_cents")
);

-- stock_movements — log imutável de toda movimentação de estoque
CREATE TABLE IF NOT EXISTS "stock_movements" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "variation_id"   TEXT NOT NULL,
    "sale_id"        TEXT,
    "stock_entry_id" TEXT UNIQUE,
    "type"           TEXT NOT NULL
                         CHECK ("type" IN ('ENTRY', 'SALE', 'CANCELLATION', 'LOSS', 'ADJUSTMENT')),
    "quantity"       INTEGER NOT NULL, -- positivo = entrada | negativo = saída
    "balance_after"  INTEGER NOT NULL CHECK ("balance_after" >= 0),
    "notes"          TEXT,
    "created_at"     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT "stock_movements_variation_fk"   FOREIGN KEY ("variation_id")
        REFERENCES "product_variations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_sale_fk"        FOREIGN KEY ("sale_id")
        REFERENCES "sales" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_entry_fk"       FOREIGN KEY ("stock_entry_id")
        REFERENCES "stock_entries" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- =============================================================================
-- ÍNDICES
-- Todos os foreign keys indexados explicitamente (SQLite não cria automaticamente).
-- =============================================================================

-- products
CREATE INDEX IF NOT EXISTS "idx_products_category_id" ON "products" ("category_id");
CREATE INDEX IF NOT EXISTS "idx_products_is_active"   ON "products" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_products_deleted_at"  ON "products" ("deleted_at");

-- product_variations
CREATE INDEX IF NOT EXISTS "idx_variations_product_id"     ON "product_variations" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_variations_sku"            ON "product_variations" ("sku");
CREATE INDEX IF NOT EXISTS "idx_variations_is_active"      ON "product_variations" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_variations_stock_quantity" ON "product_variations" ("stock_quantity");

-- stock_entries
CREATE INDEX IF NOT EXISTS "idx_entries_variation_id" ON "stock_entries" ("variation_id");
CREATE INDEX IF NOT EXISTS "idx_entries_received_at"  ON "stock_entries" ("received_at");

-- card_machines
CREATE INDEX IF NOT EXISTS "idx_card_machines_is_active" ON "card_machines" ("is_active");

-- sales
CREATE INDEX IF NOT EXISTS "idx_sales_status"          ON "sales" ("status");
CREATE INDEX IF NOT EXISTS "idx_sales_created_at"      ON "sales" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_sales_payment_method"  ON "sales" ("payment_method");
CREATE INDEX IF NOT EXISTS "idx_sales_card_machine_id" ON "sales" ("card_machine_id");

-- sale_items
CREATE INDEX IF NOT EXISTS "idx_sale_items_sale_id"      ON "sale_items" ("sale_id");
CREATE INDEX IF NOT EXISTS "idx_sale_items_variation_id" ON "sale_items" ("variation_id");

-- stock_movements
CREATE INDEX IF NOT EXISTS "idx_movements_variation_id"   ON "stock_movements" ("variation_id");
CREATE INDEX IF NOT EXISTS "idx_movements_sale_id"        ON "stock_movements" ("sale_id");
CREATE INDEX IF NOT EXISTS "idx_movements_stock_entry_id" ON "stock_movements" ("stock_entry_id");
CREATE INDEX IF NOT EXISTS "idx_movements_type"           ON "stock_movements" ("type");
CREATE INDEX IF NOT EXISTS "idx_movements_created_at"     ON "stock_movements" ("created_at");

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Impede que stock_quantity fique negativo no nível do banco (linha de defesa final).
-- A validação primária ocorre na API (camada de aplicação).
-- Nota: o CHECK constraint na coluna já barra UPDATE, mas este trigger dá mensagem explícita.
CREATE TRIGGER IF NOT EXISTS enforce_non_negative_stock
BEFORE UPDATE OF "stock_quantity" ON "product_variations"
FOR EACH ROW
WHEN NEW."stock_quantity" < 0
BEGIN
    SELECT RAISE(ABORT, 'Estoque não pode ser negativo');
END;

-- updated_at automático para tabelas com esse campo
CREATE TRIGGER IF NOT EXISTS "trg_categories_updated_at"
AFTER UPDATE ON "categories" FOR EACH ROW
BEGIN UPDATE "categories" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = OLD."id"; END;

CREATE TRIGGER IF NOT EXISTS "trg_products_updated_at"
AFTER UPDATE ON "products" FOR EACH ROW
BEGIN UPDATE "products" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = OLD."id"; END;

CREATE TRIGGER IF NOT EXISTS "trg_product_variations_updated_at"
AFTER UPDATE ON "product_variations" FOR EACH ROW
BEGIN UPDATE "product_variations" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = OLD."id"; END;

CREATE TRIGGER IF NOT EXISTS "trg_stock_entries_updated_at"
AFTER UPDATE ON "stock_entries" FOR EACH ROW
BEGIN UPDATE "stock_entries" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = OLD."id"; END;

CREATE TRIGGER IF NOT EXISTS "trg_card_machines_updated_at"
AFTER UPDATE ON "card_machines" FOR EACH ROW
BEGIN UPDATE "card_machines" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = OLD."id"; END;

CREATE TRIGGER IF NOT EXISTS "trg_settings_updated_at"
AFTER UPDATE ON "settings" FOR EACH ROW
BEGIN UPDATE "settings" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = OLD."id"; END;

CREATE TRIGGER IF NOT EXISTS "trg_sales_updated_at"
AFTER UPDATE ON "sales" FOR EACH ROW
BEGIN UPDATE "sales" SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE "id" = OLD."id"; END;
