-- =============================================================================
-- Migration: 20260528000001_init_v3
-- SPO — Sistema Pimenta Ousada | Database Agent | 2026-05-28
-- Schema versão: 2.3
-- =============================================================================
--
-- Migration consolidada — substitui todas as migrations anteriores.
-- Cria o banco completo na versão 2.3:
--   - 9 tabelas com colunas snake_case (correspondendo aos @map do schema.prisma)
--   - Timestamps como TEXT ISO 8601 (fix do bug epoch ms do Prisma 5+SQLite — DT-007)
--   - cost_cents em products (PROD-007)
--   - CHECK constraints para integridade de negócio
--   - Trigger enforce_non_negative_stock
--   - 7 triggers AFTER UPDATE para manter updated_at em ISO 8601
--
-- Nota: as migrations anteriores (20260522000001_init, 20260522000002_...) criavam
-- colunas camelCase (ex: "isActive") incompatíveis com os @map do schema v2.1+.
-- Esta migration cria o esquema correto desde o início.
-- =============================================================================

-- =============================================================================
-- TABELAS
-- =============================================================================

CREATE TABLE "categories" (
    "id"         TEXT    NOT NULL PRIMARY KEY,
    "name"       TEXT    NOT NULL,
    "is_active"  BOOLEAN NOT NULL DEFAULT true,
    "created_at" TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at" TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "products" (
    "id"          TEXT    NOT NULL PRIMARY KEY,
    "name"        TEXT    NOT NULL,
    "category_id" TEXT    NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "cost_cents"  INTEGER,           -- preço de custo para cálculo de margem (PROD-007)
    "is_active"   BOOLEAN NOT NULL DEFAULT true,
    "deleted_at"  TEXT,              -- null = ativo (soft delete)
    "created_at"  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at"  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT "products_category_id_fkey"
        FOREIGN KEY ("category_id") REFERENCES "categories" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "product_variations" (
    "id"             TEXT    NOT NULL PRIMARY KEY,
    "product_id"     TEXT    NOT NULL,
    "sku"            TEXT    NOT NULL,
    "size"           TEXT    NOT NULL,  -- DT-008: pode ser "" para produtos sem variação de tamanho
    "color"          TEXT    NOT NULL,  -- DT-008: pode ser "" para produtos sem variação de cor
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "min_stock"      INTEGER NOT NULL DEFAULT 2,
    "is_active"      BOOLEAN NOT NULL DEFAULT true,
    "created_at"     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at"     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT "product_variations_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "stock_entries" (
    "id"             TEXT    NOT NULL PRIMARY KEY,
    "variation_id"   TEXT    NOT NULL,
    "quantity"       INTEGER NOT NULL,
    "unit_cost_cents" INTEGER,
    "notes"          TEXT,
    "received_at"    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "created_at"     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at"     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT "stock_entries_variation_id_fkey"
        FOREIGN KEY ("variation_id") REFERENCES "product_variations" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "card_machines" (
    "id"               TEXT    NOT NULL PRIMARY KEY,
    "name"             TEXT    NOT NULL,
    "fee_basis_points" INTEGER NOT NULL,
    "is_active"        BOOLEAN NOT NULL DEFAULT true,
    "created_at"       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at"       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "settings" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "pin_hash"   TEXT,
    "shop_name"  TEXT NOT NULL DEFAULT 'Pimenta Ousada',
    "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "sales" (
    "id"              TEXT    NOT NULL PRIMARY KEY,
    "status"          TEXT    NOT NULL DEFAULT 'ACTIVE',
    "payment_method"  TEXT    NOT NULL,
    "subtotal_cents"  INTEGER NOT NULL,
    "discount_cents"  INTEGER NOT NULL DEFAULT 0,
    "total_cents"     INTEGER NOT NULL,
    "card_machine_id" TEXT,
    "fee_cents"       INTEGER,
    "notes"           TEXT,
    "cancelled_at"    TEXT,
    "cancel_reason"   TEXT,
    "created_at"      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    "updated_at"      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT "sales_card_machine_id_fkey"
        FOREIGN KEY ("card_machine_id") REFERENCES "card_machines" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    -- total deve ser exatamente subtotal menos desconto
    CHECK ("total_cents" = "subtotal_cents" - "discount_cents"),
    -- pagamento por cartão exige maquininha cadastrada
    CHECK (
        ("payment_method" NOT IN ('DEBIT', 'CREDIT'))
        OR ("card_machine_id" IS NOT NULL)
    )
);

CREATE TABLE "sale_items" (
    "id"              TEXT    NOT NULL PRIMARY KEY,
    "sale_id"         TEXT    NOT NULL,
    "variation_id"    TEXT    NOT NULL,
    "quantity"        INTEGER NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "subtotal_cents"  INTEGER NOT NULL,
    "created_at"      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    -- sem updated_at: imutável após criação (RN-004.3)
    CONSTRAINT "sale_items_sale_id_fkey"
        FOREIGN KEY ("sale_id") REFERENCES "sales" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sale_items_variation_id_fkey"
        FOREIGN KEY ("variation_id") REFERENCES "product_variations" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "stock_movements" (
    "id"             TEXT    NOT NULL PRIMARY KEY,
    "variation_id"   TEXT    NOT NULL,
    "sale_id"        TEXT,
    "stock_entry_id" TEXT,
    "type"           TEXT    NOT NULL,
    "quantity"       INTEGER NOT NULL,
    "balance_after"  INTEGER NOT NULL,
    "notes"          TEXT,
    "created_at"     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    -- sem updated_at: imutável após criação
    CONSTRAINT "stock_movements_variation_id_fkey"
        FOREIGN KEY ("variation_id") REFERENCES "product_variations" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_sale_id_fkey"
        FOREIGN KEY ("sale_id") REFERENCES "sales" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_stock_entry_id_fkey"
        FOREIGN KEY ("stock_entry_id") REFERENCES "stock_entries" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- =============================================================================
-- ÍNDICES ÚNICOS
-- =============================================================================

CREATE UNIQUE INDEX "categories_name_key"
    ON "categories"("name");

CREATE UNIQUE INDEX "product_variations_sku_key"
    ON "product_variations"("sku");

CREATE UNIQUE INDEX "product_variations_product_id_size_color_key"
    ON "product_variations"("product_id", "size", "color");

CREATE UNIQUE INDEX "stock_movements_stock_entry_id_key"
    ON "stock_movements"("stock_entry_id");

-- =============================================================================
-- ÍNDICES DE PERFORMANCE (FK e colunas frequentemente filtradas)
-- =============================================================================

CREATE INDEX "products_category_id_idx"       ON "products"("category_id");
CREATE INDEX "products_is_active_idx"         ON "products"("is_active");
CREATE INDEX "products_deleted_at_idx"        ON "products"("deleted_at");

CREATE INDEX "product_variations_product_id_idx"    ON "product_variations"("product_id");
CREATE INDEX "product_variations_sku_idx"           ON "product_variations"("sku");
CREATE INDEX "product_variations_is_active_idx"     ON "product_variations"("is_active");
CREATE INDEX "product_variations_stock_quantity_idx" ON "product_variations"("stock_quantity");

CREATE INDEX "stock_entries_variation_id_idx" ON "stock_entries"("variation_id");
CREATE INDEX "stock_entries_received_at_idx"  ON "stock_entries"("received_at");

CREATE INDEX "card_machines_is_active_idx"    ON "card_machines"("is_active");

CREATE INDEX "sales_status_idx"               ON "sales"("status");
CREATE INDEX "sales_created_at_idx"           ON "sales"("created_at");
CREATE INDEX "sales_payment_method_idx"       ON "sales"("payment_method");
CREATE INDEX "sales_card_machine_id_idx"      ON "sales"("card_machine_id");

CREATE INDEX "sale_items_sale_id_idx"         ON "sale_items"("sale_id");
CREATE INDEX "sale_items_variation_id_idx"    ON "sale_items"("variation_id");

CREATE INDEX "stock_movements_variation_id_idx" ON "stock_movements"("variation_id");
CREATE INDEX "stock_movements_sale_id_idx"      ON "stock_movements"("sale_id");
CREATE INDEX "stock_movements_type_idx"         ON "stock_movements"("type");
CREATE INDEX "stock_movements_created_at_idx"   ON "stock_movements"("created_at");

-- =============================================================================
-- TRIGGER — Estoque não negativo (linha de defesa final no banco)
-- A camada de aplicação deve validar ANTES de chegar aqui.
-- =============================================================================

CREATE TRIGGER enforce_non_negative_stock
BEFORE UPDATE ON "product_variations"
FOR EACH ROW
WHEN NEW."stock_quantity" < 0
BEGIN
  SELECT RAISE(ABORT, 'Estoque não pode ser negativo');
END;

-- =============================================================================
-- TRIGGERS — Manutenção de updated_at em ISO 8601
-- Necessários porque String no schema Prisma não aciona @updatedAt automático.
-- Tabelas imutáveis (sale_items, stock_movements) não têm updated_at → sem trigger.
-- =============================================================================

CREATE TRIGGER trg_categories_updated_at
AFTER UPDATE ON "categories"
FOR EACH ROW
BEGIN
  UPDATE "categories"
    SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE "id" = NEW."id";
END;

CREATE TRIGGER trg_products_updated_at
AFTER UPDATE ON "products"
FOR EACH ROW
BEGIN
  UPDATE "products"
    SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE "id" = NEW."id";
END;

CREATE TRIGGER trg_product_variations_updated_at
AFTER UPDATE ON "product_variations"
FOR EACH ROW
BEGIN
  UPDATE "product_variations"
    SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE "id" = NEW."id";
END;

CREATE TRIGGER trg_stock_entries_updated_at
AFTER UPDATE ON "stock_entries"
FOR EACH ROW
BEGIN
  UPDATE "stock_entries"
    SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE "id" = NEW."id";
END;

CREATE TRIGGER trg_card_machines_updated_at
AFTER UPDATE ON "card_machines"
FOR EACH ROW
BEGIN
  UPDATE "card_machines"
    SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE "id" = NEW."id";
END;

CREATE TRIGGER trg_settings_updated_at
AFTER UPDATE ON "settings"
FOR EACH ROW
BEGIN
  UPDATE "settings"
    SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE "id" = NEW."id";
END;

CREATE TRIGGER trg_sales_updated_at
AFTER UPDATE ON "sales"
FOR EACH ROW
BEGIN
  UPDATE "sales"
    SET "updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE "id" = NEW."id";
END;
