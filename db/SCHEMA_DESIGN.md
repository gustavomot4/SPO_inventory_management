# Schema Design — SPO (Sistema Pimenta Ousada)

> **Agente:** Database Agent | **Task:** DOC-012 | **Data:** 2026-05-22
> **Arquivo de referência:** `schema.prisma` (mesma pasta)

---

## 1. Visão geral das entidades

```
User
 └── Sale (1:N) ─────────────────────────────┐
                                              │
Category ──── Product (N:1) ─── ProductVariation (1:N)
                │                    │    │      │
             Supplier (N:1)     SaleItem  │  StockEntry ── Supplier
                                      StockMovement
```

| Model | Papel |
|---|---|
| `User` | Autenticação e perfil de acesso (Admin / Operator) |
| `Category` | Classificação dos produtos (Blusa, Calça, etc.) |
| `Supplier` | Fornecedores de mercadoria |
| `Product` | Produto-base (ex: "Blusa Floral") |
| `ProductVariation` | Uma combinação tamanho+cor de um produto — unidade de controle de estoque |
| `StockEntry` | Registro de recebimento de mercadoria |
| `Sale` | Cabeçalho de uma venda (data, pagamento, total, status) |
| `SaleItem` | Linha de uma venda (produto, quantidade, preço snapshot) |
| `StockMovement` | Log imutável de toda movimentação de estoque |

---

## 2. Decisões de design — com justificativas

### 2.1 Preços em centavos (Int), nunca Float

**Decisão:** Todos os campos monetários usam `Int` representando centavos (1/100 da unidade monetária).

| Campo | Tipo | Exemplo |
|---|---|---|
| `Product.priceCents` | Int | R$ 59,90 → `5990` |
| `SaleItem.unitPriceCents` | Int | R$ 59,90 → `5990` |
| `SaleItem.subtotalCents` | Int | `5990 × 2 = 11980` |
| `Sale.totalCents` | Int | R$ 239,70 → `23970` |
| `StockEntry.unitCostCents` | Int? | R$ 30,00 → `3000` (opcional) |

**Justificativa:** Float/Double em ponto flutuante acumula erros de arredondamento que em contexto financeiro causam inconsistências. `0.1 + 0.2 = 0.30000000000000004` em ponto flutuante. Usar Int em centavos elimina esse problema por completo. Formatação para R$ é responsabilidade do frontend.

**Regra para o Backend Agent:** Ao receber valor do frontend (ex: `"59.90"`), multiplicar por 100 e arredondar para Int antes de persistir. Ao exibir, dividir por 100 e formatar com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.

---

### 2.2 ProductVariation como unidade de estoque

**Decisão:** Cada combinação única de `(productId, size, color)` é um registro independente de `ProductVariation`, com seu próprio `stockQuantity` e `minStock`.

**Justificativa:** Regra de negócio RN-001.3 confirma que variações diferentes são registros de estoque distintos. "Blusa Floral / P / Rosa" e "Blusa Floral / M / Azul" são duas unidades de controle independentes. Constraint `@@unique([productId, size, color])` garante que não haja duplicatas.

**Implicação para o Backend Agent:** Ao registrar uma venda ou entrada de estoque, sempre operar sobre o `variationId` específico, nunca sobre o `productId` genérico.

---

### 2.3 Snapshot de preço no SaleItem

**Decisão:** `SaleItem.unitPriceCents` captura o preço no momento da venda e nunca é atualizado após a criação do registro.

**Justificativa:** Regra RN-004.3 — alterações futuras de preço no cadastro do produto não podem retroativamente alterar o valor de vendas passadas. O histórico de vendas deve refletir exatamente o que foi cobrado.

**Implementação:** O Backend Agent deve copiar `Product.priceCents` para `SaleItem.unitPriceCents` no momento da finalização da venda. Nunca usar uma join para calcular o valor histórico — ele já está gravado.

`subtotalCents` também é armazenado (não computado via join) pelo mesmo motivo de integridade. Se houver um bug que altere `unitPriceCents`, o `subtotalCents` histórico ainda preserva o valor correto da transação.

---

### 2.4 Soft delete em Product

**Decisão:** Produtos inativados usam `deletedAt DateTime?` (null = ativo) em vez de exclusão real.

**Justificativa:** Regra RN-001.4 — produtos inativados não são excluídos. O histórico de vendas referencia `variationId`, que referencia `productId`. Excluir o produto quebraria a integridade referencial com `SaleItem` e `StockMovement`. Com soft delete, o histórico permanece intacto.

**Filtro padrão para consultas ativas:** `WHERE deleted_at IS NULL AND is_active = true`

**Nota:** O campo `isActive` coexiste com `deletedAt` com semânticas distintas:
- `deletedAt` não-null = produto removido permanentemente da operação (soft delete)
- `isActive = false` = produto temporariamente desativado (pode ser reativado)

Para o MVP, `isActive = false` com `deletedAt = null` é o estado "inativo mas recuperável".

---

### 2.5 StockMovement como audit log imutável

**Decisão:** Todo evento que altera `ProductVariation.stockQuantity` gera obrigatoriamente um registro em `StockMovement`. Esse modelo é imutável (sem `updatedAt`).

**Tipos de movimento:**

| MovementType | quantity | Disparado por |
|---|---|---|
| `ENTRY` | positivo | Criação de `StockEntry` |
| `SALE` | negativo | Finalização de `Sale` |
| `CANCELLATION` | positivo | Cancelamento de `Sale` |
| `LOSS` | negativo | Registro manual de perda |
| `ADJUSTMENT` | positivo ou negativo | Ajuste manual de inventário |

**Campo `balanceAfter`:** Armazena o valor de `stockQuantity` após o movimento. Permite reconstruir o histórico completo de estoque de qualquer variação em qualquer ponto no tempo, mesmo que a quantidade atual seja alterada posteriormente.

**Regra para o Backend Agent:** A sequência de operações ao finalizar uma venda deve ser atômica (transação Prisma):
1. Verificar `stockQuantity >= quantity` para cada item
2. Decrementar `stockQuantity` em `ProductVariation`
3. Criar `SaleItem`
4. Criar `StockMovement` com `type = SALE`, `quantity = -quantity`, `balanceAfter = novoSaldo`
5. Verificar alertas de estoque baixo

---

### 2.6 Relação StockEntry ↔ StockMovement (1:1)

**Decisão:** Cada `StockEntry` gera exatamente um `StockMovement` do tipo `ENTRY`. A relação é modelada com `stockEntryId @unique` em `StockMovement`.

**Justificativa:** Permite rastrear a origem de cada incremento de estoque com todos os detalhes do recebimento (fornecedor, custo, data real) enquanto mantém o log de movimentos unificado em `StockMovement`.

---

### 2.7 IDs via cuid()

**Decisão:** Todos os IDs são `String @id @default(cuid())`.

**Justificativa:** cuid gera identificadores únicos, ordenáveis por tempo, sem colisão em ambiente local. Não expõe sequências numéricas incrementais (que revelariam volume de dados). Compatível com SQLite e PostgreSQL sem alteração.

---

### 2.8 username vs email para autenticação

**Decisão:** `User` usa `username` (não email) como identificador de login.

**Justificativa:** A dona da loja e eventuais vendedoras usam o sistema internamente. Email como login adiciona complexidade desnecessária (validação de formato, recuperação via email, etc.). Um `username` simples (ex: "dona", "maria") é mais apropriado para o perfil de usuário. O campo `email` pode ser adicionado em v1.x se necessário para recuperação de senha.

---

## 3. Índices criados e suas justificativas

Prisma + SQLite **não cria índices em foreign keys automaticamente**. Todos os índices abaixo foram declarados explicitamente via `@@index`.

| Índice | Tabela | Coluna(s) | Query que serve |
|---|---|---|---|
| `idx_products_category` | products | categoryId | Filtro de produtos por categoria |
| `idx_products_supplier` | products | supplierId | Listagem de produtos por fornecedor |
| `idx_products_is_active` | products | isActive | Filtro de produtos ativos |
| `idx_products_deleted_at` | products | deletedAt | Filtro de produtos não deletados |
| `idx_variations_product` | product_variations | productId | Listar variações de um produto |
| `idx_variations_sku` | product_variations | sku | Busca por SKU |
| `idx_variations_is_active` | product_variations | isActive | Filtro de variações ativas |
| `idx_variations_stock` | product_variations | stockQuantity | Query de alertas de estoque baixo |
| `idx_entries_variation` | stock_entries | variationId | Histórico de entradas por variação |
| `idx_entries_supplier` | stock_entries | supplierId | Entradas por fornecedor |
| `idx_entries_received_at` | stock_entries | receivedAt | Filtro por período |
| `idx_sales_user` | sales | userId | Vendas por usuário |
| `idx_sales_status` | sales | status | Filtro de vendas ativas/canceladas |
| `idx_sales_created_at` | sales | createdAt | Relatórios por período (hoje/semana/mês) |
| `idx_sales_payment` | sales | paymentMethod | Análise por forma de pagamento |
| `idx_sale_items_sale` | sale_items | saleId | Itens de uma venda |
| `idx_sale_items_variation` | sale_items | variationId | Produtos mais vendidos |
| `idx_movements_variation` | stock_movements | variationId | Histórico de movimentos por variação |
| `idx_movements_sale` | stock_movements | saleId | Movimentos de uma venda |
| `idx_movements_type` | stock_movements | type | Filtro por tipo de movimento |
| `idx_movements_created_at` | stock_movements | createdAt | Relatórios por período |

---

## 4. Restrições pós-migração (raw SQL obrigatório)

O Prisma não suporta `CHECK` constraints nativamente. Após rodar `prisma migrate dev`, executar o seguinte via migração raw SQL ou script de seed:

```sql
-- Garante que o estoque nunca fique negativo no nível do banco
-- Executar como migration raw SQL após a migration inicial do Prisma

-- No SQLite, recriar a tabela para adicionar CHECK (alternativa para MVP):
-- Ou usar PRAGMA check_constraints com trigger:

CREATE TRIGGER enforce_non_negative_stock
BEFORE UPDATE ON product_variations
FOR EACH ROW
WHEN NEW.stock_quantity < 0
BEGIN
  SELECT RAISE(ABORT, 'Estoque não pode ser negativo');
END;
```

**Nota para o Backend Agent:** Além do trigger, a validação deve ocorrer na camada de aplicação (API Route) ANTES de tentar a transação, com mensagem clara para o usuário. O trigger é a linha de defesa final no banco.

---

## 5. Configuração do ambiente (.env)

```bash
# .env (desenvolvimento local — SQLite)
DATABASE_URL="file:./dev.db"

# .env.production (local — arquivo em pasta separada do código)
DATABASE_URL="file:/dados/spo.db"

# .env (futuro — PostgreSQL v2)
# DATABASE_URL="postgresql://user:password@localhost:5432/spo"
```

O arquivo `.db` de produção NUNCA deve ficar dentro da pasta do projeto (para não ser sobrescrito num `git pull`). O DevOps Agent deve configurar o caminho correto no script de inicialização.

---

## 6. Fluxo de operações — guia para o Backend Agent

### Finalizar venda (transação atômica)

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Verificar estoque para cada item
  for (const item of items) {
    const variation = await tx.productVariation.findUniqueOrThrow({
      where: { id: item.variationId },
    });
    if (variation.stockQuantity < item.quantity) {
      throw new Error(`Estoque insuficiente: ${variation.sku}`);
    }
  }

  // 2. Criar a venda
  const sale = await tx.sale.create({ data: { ... } });

  // 3. Para cada item: criar SaleItem, decrementar estoque, criar StockMovement
  for (const item of items) {
    await tx.saleItem.create({ data: {
      saleId: sale.id,
      variationId: item.variationId,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents, // snapshot do preço
      subtotalCents: item.quantity * item.unitPriceCents,
    }});

    const updated = await tx.productVariation.update({
      where: { id: item.variationId },
      data: { stockQuantity: { decrement: item.quantity } },
    });

    await tx.stockMovement.create({ data: {
      variationId: item.variationId,
      saleId: sale.id,
      type: 'SALE',
      quantity: -item.quantity,
      balanceAfter: updated.stockQuantity,
    }});
  }
});
```

### Cancelar venda (transação atômica)

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Buscar a venda e validar que está ACTIVE
  const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId }, include: { items: true } });
  if (sale.status !== 'ACTIVE') throw new Error('Venda já cancelada');

  // 2. Marcar como cancelada
  await tx.sale.update({
    where: { id: saleId },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
  });

  // 3. Reverter estoque de cada item
  for (const item of sale.items) {
    const updated = await tx.productVariation.update({
      where: { id: item.variationId },
      data: { stockQuantity: { increment: item.quantity } },
    });

    await tx.stockMovement.create({ data: {
      variationId: item.variationId,
      saleId: sale.id,
      type: 'CANCELLATION',
      quantity: item.quantity, // positivo — retorno ao estoque
      balanceAfter: updated.stockQuantity,
    }});
  }
});
```

### Query de alerta de estoque baixo

```typescript
// Variações em alerta: stockQuantity <= minStock
const alertas = await prisma.productVariation.findMany({
  where: {
    isActive: true,
    stockQuantity: { lte: prisma.productVariation.fields.minStock }, // não funciona assim
  },
});

// Forma correta com raw query (SQLite):
const alertas = await prisma.$queryRaw`
  SELECT pv.*, p.name as product_name
  FROM product_variations pv
  JOIN products p ON p.id = pv.product_id
  WHERE pv.is_active = 1
    AND p.deleted_at IS NULL
    AND pv.stock_quantity <= pv.min_stock
  ORDER BY pv.stock_quantity ASC
`;
```

---

## 7. Pontos em aberto deixados para próximas fases

| Ponto | Impacto | Quando resolver |
|---|---|---|
| OPEN-004: formas de pagamento confirmadas | `PaymentMethod` enum pode precisar de ajuste | Antes de MVP-004 |
| OPEN-009: cartão parcelado | Se necessário, adicionar `installments Int?` e `installmentValueCents Int?` em `Sale` | Sprint de vendas |
| OPEN-012: cadastro de clientes | Novo model `Customer` com relação 1:N com `Sale` | v1.1 |
| OPEN-013: acessórios além de roupas | `size` pode ser `null` ou ter valor livre para acessórios | Sprint de produtos |
| Tabela de tamanhos (SA-011) | Validar se PP/P/M/G/GG/XGG é correto ou se a loja usa numeração | Sprint de produtos |

---

## 8. O que o Backend Agent precisa saber

1. **Toda operação de estoque é transacional** — nunca alterar `stockQuantity` sem criar o `StockMovement` correspondente na mesma transação
2. **Preços chegam do frontend em Real (string ou float)** — converter para centavos (Int) ANTES de persistir
3. **`SaleItem` é imutável** — criar, nunca atualizar
4. **`StockMovement` é imutável** — criar, nunca atualizar nem deletar
5. **Soft delete de produtos** — filtrar sempre com `deletedAt: null` nas queries de operação
6. **Query de alertas** — usar raw query (ver seção 6) pois Prisma não suporta comparação entre dois campos do mesmo registro via `where` padrão

## 9. O que o Frontend Agent precisa saber

1. **Exibir preços:** dividir valor Int por 100 e formatar com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
2. **Enviar preços para API:** enviar como centavos (Int) ou como string decimal e deixar o backend converter — definir contrato claro com Backend Agent
3. **Status de estoque por variação:**
   - `stockQuantity > minStock` → ✅ OK
   - `stockQuantity > 0 && stockQuantity <= minStock` → ⚠️ Alerta
   - `stockQuantity === 0` → 🚫 Zerado
4. **Campo `paymentMethod`:** exibir labels em português (ex: `CASH` → "Dinheiro", `PIX` → "Pix")
