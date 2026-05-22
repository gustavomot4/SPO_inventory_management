-- =============================================================================
-- Migration: 20260522000001_init
-- SPO — Sistema Pimenta Ousada | Database Agent — DOC-012
-- =============================================================================
-- Criação de todas as tabelas do schema inicial.
-- Enums do Prisma são armazenados como TEXT no SQLite.
-- =============================================================================

-- CreateTable: users
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: categories
CREATE TABLE "categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: suppliers
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: products
CREATE TABLE "products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "supplierId" TEXT,
    "priceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable: product_variations
CREATE TABLE "product_variations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "product_variations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable: stock_entries
CREATE TABLE "stock_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variationId" TEXT NOT NULL,
    "supplierId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitCostCents" INTEGER,
    "notes" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "stock_entries_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "product_variations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_entries_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable: sales
CREATE TABLE "sales" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "paymentMethod" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "notes" TEXT,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable: sale_items
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "saleId" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sale_items_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "product_variations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable: stock_movements
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variationId" TEXT NOT NULL,
    "saleId" TEXT,
    "stockEntryId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "product_variations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_stockEntryId_fkey" FOREIGN KEY ("stockEntryId") REFERENCES "stock_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex: users
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex: categories
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex: products
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");
CREATE INDEX "products_supplierId_idx" ON "products"("supplierId");
CREATE INDEX "products_isActive_idx" ON "products"("isActive");
CREATE INDEX "products_deletedAt_idx" ON "products"("deletedAt");

-- CreateIndex: product_variations
CREATE UNIQUE INDEX "product_variations_sku_key" ON "product_variations"("sku");
CREATE UNIQUE INDEX "product_variations_productId_size_color_key" ON "product_variations"("productId", "size", "color");
CREATE INDEX "product_variations_productId_idx" ON "product_variations"("productId");
CREATE INDEX "product_variations_sku_idx" ON "product_variations"("sku");
CREATE INDEX "product_variations_isActive_idx" ON "product_variations"("isActive");
CREATE INDEX "product_variations_stockQuantity_idx" ON "product_variations"("stockQuantity");

-- CreateIndex: stock_entries
CREATE INDEX "stock_entries_variationId_idx" ON "stock_entries"("variationId");
CREATE INDEX "stock_entries_supplierId_idx" ON "stock_entries"("supplierId");
CREATE INDEX "stock_entries_receivedAt_idx" ON "stock_entries"("receivedAt");

-- CreateIndex: sales
CREATE INDEX "sales_userId_idx" ON "sales"("userId");
CREATE INDEX "sales_status_idx" ON "sales"("status");
CREATE INDEX "sales_createdAt_idx" ON "sales"("createdAt");
CREATE INDEX "sales_paymentMethod_idx" ON "sales"("paymentMethod");

-- CreateIndex: sale_items
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");
CREATE INDEX "sale_items_variationId_idx" ON "sale_items"("variationId");

-- CreateIndex: stock_movements
CREATE UNIQUE INDEX "stock_movements_stockEntryId_key" ON "stock_movements"("stockEntryId");
CREATE INDEX "stock_movements_variationId_idx" ON "stock_movements"("variationId");
CREATE INDEX "stock_movements_saleId_idx" ON "stock_movements"("saleId");
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type");
CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");
