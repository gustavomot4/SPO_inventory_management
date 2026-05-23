# Schema Design — SPO (Sistema Pimenta Ousada)

> **Agente:** Database Agent | **Tasks:** DOC-012 → MVP-004 | **Última atualização:** 2026-05-22
> **Versão do schema:** 2.0 (pós-alinhamento com cliente)
> **Arquivo de referência:** `schema.prisma` (mesma pasta) e `../prisma/schema.prisma` (idêntico)

---

## 1. Visão geral das entidades (v2.0)

```
Category ──── Product (N:1) ─── ProductVariation (1:N)
                                    │       │        │
                               SaleItem  StockEntry  StockMovement
                                  │
                               Sale ──── CardMachine
                                │
                           StockMovement

Settings  (singleton — sem relações)
```

| Model | Tabela | Papel |
|---|---|---|
| `Category` | `categories` | Classificação dos produtos (Blusa, Calça, etc.) |
| `Product` | `products` | Produto-base (ex: "Blusa Floral") |
| `ProductVariation` | `product_variations` | Variação tamanho+cor — unidade de controle de estoque |
| `StockEntry` | `stock_entries` | Registro de recebimento de mercadoria |
| `CardMachine` | `card_machines` | Maquininhas de cartão com taxa percentual |
| `Settings` | `settings` | Configurações globais: PIN e nome da loja (singleton) |
| `Sale` | `sales` | Cabeçalho de venda (com desconto e maquininha) |
| `SaleItem` | `sale_items` | Linha de venda — snapshot imutável de preço |
| `StockMovement` | `stock_movements` | Audit log imutável de toda movimentação de estoque |

**Removidos em v2.0:** `User` (users), `Supplier` (suppliers), enum `UserRole`

---

## 2. Mudanças de escopo v1.0 → v2.0

### 2.1 User e Supplier removidos

**Decisão:** Modelos `User` e `Supplier` completamente eliminados.

**Justificativa:**
- **User removido** (RN-007 reescrito): O sistema não usa login com usuário/senha. Acesso é aberto por padrão; áreas sensíveis são protegidas por PIN numérico armazenado em `Settings`. Não há conceito de "quem registrou a venda" — qualquer pessoa no computador pode operar.
- **Supplier removido** (RN-006 eliminado): A dona não quer cadastrar fornecedores. Entradas de estoque registram apenas produto, quantidade e custo opcional — sem rastreabilidade de fornecedor.

**Impacto em outros models:**
- `Product`: campo `supplierId` e relação com Supplier removidos
- `StockEntry`: campo `supplierId` e relação com Supplier removidos
- `Sale`: campo `userId` e relação com User removidos

---

## 3. Decisões de design — com justificativas

### 3.1 Preços em centavos (Int), nunca Float

**Decisão:** Todos os campos monetários usam `Int` representando centavos.

| Campo | Tipo | Exemplo |
|---|---|---|
| `Product.priceCents` | Int | R$ 59,90 → `5990` |
| `Sale.subtotalCents` | Int | R$ 239,70 → `23970` |
| `Sale.discountCents` | Int | R$ 10,00 → `1000` |
| `Sale.totalCents` | Int | R$ 229,70 → `22970` |
| `Sale.feeCents` | Int? | taxa estimada em centavos |
| `SaleItem.unitPriceCents` | Int | snapshot do preço |
| `SaleItem.subtotalCents` | Int | `quantity × unitPriceCents` |
| `StockEntry.unitCostCents` | Int? | custo de aquisição (opcional) |

**Justificativa:** `0.1 + 0.2 = 0.30000000000000004` em ponto flutuante. Usar Int em centavos elimina erros de arredondamento em contexto financeiro. Formatação para R$ é responsabilidade do frontend.

**Regra para o Backend Agent:** Ao receber valor do frontend (ex: `"59.90"`), multiplicar por 100 e arredondar: `Math.round(parseFloat(value) * 100)`. Ao exibir: `(cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`.

---

### 3.2 ProductVariation como unidade de estoque

**Decisão:** Cada combinação `(productId, size, color)` é um registro independente com `stockQuantity` e `minStock` próprios.

**Justificativa:** RN-001.3 — "Blusa Floral / P / Rosa" e "Blusa Floral / M / Azul" são unidades de controle distintas. A constraint `@@unique([productId, size, color])` garante unicidade.

---

### 3.3 Snapshot de preço no SaleItem

**Decisão:** `SaleItem.unitPriceCents` captura o preço no momento da venda e é **imutável**.

**Justificativa:** RN-004.3 — alterações futuras de preço no produto não podem retroagir. `subtotalCents` também é armazenado explicitamente (não computado via join) pela mesma razão de integridade histórica. A constraint `CHECK (subtotal_cents = quantity * unit_price_cents)` na migration garante consistência na inserção.

---

### 3.4 Soft delete em Product

**Decisão:** Produtos inativados usam `deletedAt DateTime?` — null = ativo.

**Justificativa:** RN-001.4 — produtos inativados não podem ser excluídos (histórico de vendas via `SaleItem` referencia `variationId`). Excluir quebraria a integridade referencial.

**Filtro padrão em queries ativas:** `WHERE deleted_at IS NULL AND is_active = 1`

---

### 3.5 StockMovement como audit log imutável

**Decisão:** Todo evento que altera `stockQuantity` gera um `StockMovement`. Sem `updatedAt` — nunca atualizado.

| MovementType | quantity | Origem |
|---|---|---|
| `ENTRY` | positivo | Criação de `StockEntry` |
| `SALE` | negativo | Finalização de `Sale` |
| `CANCELLATION` | positivo | Cancelamento de `Sale` |
| `LOSS` | negativo | Perda manual |
| `ADJUSTMENT` | ±qualquer | Ajuste manual |

**Campo `balanceAfter`:** Snapshot de `stockQuantity` após o movimento. Permite reconstruir o histórico completo de qualquer variação em qualquer ponto no tempo.

---

### 3.6 Basis points para taxas de maquininha (NOVO em v2.0)

**Decisão:** `CardMachine.feeBasisPoints` usa `Int` em basis points (1 bp = 0,01%).

| Exemplo | feeBasisPoints | Taxa real |
|---|---|---|
| Cielo débito 1,50% | `150` | 1,50% |
| Stone crédito 1,99% | `199` | 1,99% |
| PagBank crédito 2,49% | `249` | 2,49% |

**Cálculo da taxa:** `feeCents = Math.round(totalCents * feeBasisPoints / 10000)`

**Justificativa:** Assim como valores monetários não devem usar Float, taxas percentuais também acumulam erro em Float. Basis points em Int eliminam esse problema. A divisão por 10.000 (não por 100) é porque: 1 bp = 1/100 de 1% = 1/10.000.

**RN-004.10:** A taxa é **apenas informativa** — não é deduzida do valor cobrado ao cliente. Existe para que a dona saiba quanto a operadora de cartão vai descontar da receita.

---

### 3.7 Sale: subtotal, desconto e total (NOVO em v2.0)

**Decisão:** `Sale` possui três campos monetários distintos:
- `subtotalCents` = soma dos `SaleItem.subtotalCents` (valor bruto SEM desconto)
- `discountCents` = desconto aplicado (0 = sem desconto) — RN-004.5
- `totalCents` = `subtotalCents - discountCents` (valor cobrado ao cliente)

**Constraint de integridade:** `CHECK (total_cents = subtotal_cents - discount_cents)` na migration SQL garante que nenhum registro inconsistente seja inserido.

**Regra para o Backend Agent:** O cálculo de `totalCents` deve sempre ser feito na API, nunca no frontend. O frontend envia `discountCents`; a API calcula e verifica o total antes de persistir.

---

### 3.8 Maquininha obrigatória para pagamentos em cartão

**Decisão:** `Sale.cardMachineId` é obrigatório quando `paymentMethod IN ('DEBIT', 'CREDIT')` e nulo quando `IN ('CASH', 'PIX')`.

**Constraint na migration:** `CHECK ((payment_method IN ('DEBIT', 'CREDIT') AND card_machine_id IS NOT NULL) OR (payment_method IN ('CASH', 'PIX')))`.

**Regra para o Backend Agent:** Validar no endpoint de criação de venda ANTES de persistir, com mensagem clara para o frontend: "Selecione a maquininha para pagamento com cartão."

---

### 3.9 Settings como singleton

**Decisão:** `Settings` tem um único registro no banco — sem FK, sem relações.

**Justificativa:** Configurações globais (PIN, nome da loja) são únicas no sistema. Um singleton é mais simples que uma tabela chave-valor genérica para o MVP.

**Implementação para o Backend Agent:** No seed inicial, criar o único registro de Settings:
```typescript
await prisma.settings.upsert({
  where: { id: 'singleton' },
  update: {},
  create: { id: 'singleton', shopName: 'Pimenta Ousada' },
})
```
Toda leitura/escrita de configurações usa `findFirst()` ou `update({ where: { id: 'singleton' } })`.

**RN-007:** `pinHash = null` significa que nenhum PIN foi configurado — áreas sensíveis ficam acessíveis. A dona deve definir o PIN na primeira configuração.

---

### 3.10 IDs via cuid()

**Decisão:** Todos os IDs são `String @id @default(cuid())`.

**Justificativa:** cuid gera IDs únicos, ordenáveis por tempo, sem colisão, URL-safe. Não expõe volume de dados como IDs sequenciais. Compatível com SQLite e PostgreSQL sem alteração de schema.

---

## 4. Índices criados e suas justificativas (21 total)

Prisma + SQLite **não cria índices em foreign keys automaticamente**. Todos declarados via `@@index` no schema Prisma e `CREATE INDEX` na migration SQL.

| Índice | Tabela | Coluna | Query que serve |
|---|---|---|---|
| `idx_products_category_id` | products | category_id | Filtro por categoria |
| `idx_products_is_active` | products | is_active | Produtos ativos |
| `idx_products_deleted_at` | products | deleted_at | Soft delete filter |
| `idx_variations_product_id` | product_variations | product_id | Variações de um produto |
| `idx_variations_sku` | product_variations | sku | Busca por SKU |
| `idx_variations_is_active` | product_variations | is_active | Variações ativas |
| `idx_variations_stock_quantity` | product_variations | stock_quantity | Alertas de estoque baixo |
| `idx_entries_variation_id` | stock_entries | variation_id | Histórico de entradas |
| `idx_entries_received_at` | stock_entries | received_at | Filtro por período |
| `idx_card_machines_is_active` | card_machines | is_active | Maquininhas ativas |
| `idx_sales_status` | sales | status | Vendas ativas/canceladas |
| `idx_sales_created_at` | sales | created_at | Relatórios por período |
| `idx_sales_payment_method` | sales | payment_method | Análise por pagamento |
| `idx_sales_card_machine_id` | sales | card_machine_id | Relatórios por maquininha |
| `idx_sale_items_sale_id` | sale_items | sale_id | Itens de uma venda |
| `idx_sale_items_variation_id` | sale_items | variation_id | Produtos mais vendidos |
| `idx_movements_variation_id` | stock_movements | variation_id | Histórico por variação |
| `idx_movements_sale_id` | stock_movements | sale_id | Movimentos de uma venda |
| `idx_movements_stock_entry_id` | stock_movements | stock_entry_id | Movimento de uma entrada |
| `idx_movements_type` | stock_movements | type | Filtro por tipo |
| `idx_movements_created_at` | stock_movements | created_at | Relatórios por período |

---

## 5. Constraints de integridade na migration SQL

O Prisma não suporta `CHECK` constraints nativamente em todos os casos. As seguintes foram adicionadas diretamente no SQL da migration `init_v2`:

| Constraint | Tabela | Regra |
|---|---|---|
| `stock_quantity >= 0` | product_variations | Estoque nunca negativo (coluna) |
| `min_stock >= 0` | product_variations | Mínimo >= 0 |
| `quantity > 0` | stock_entries | Entrada deve ter quantidade positiva |
| `unit_cost_cents >= 0` | stock_entries | Custo não pode ser negativo |
| `fee_basis_points >= 0` | card_machines | Taxa não pode ser negativa |
| `price_cents >= 0` | products | Preço não negativo |
| `subtotal_cents >= 0` | sales | Subtotal não negativo |
| `discount_cents >= 0` | sales | Desconto não negativo |
| `total_cents >= 0` | sales | Total não negativo |
| `total_cents = subtotal_cents - discount_cents` | sales | Integridade do cálculo |
| Cartão → maquininha obrigatória | sales | RN-010.2 |
| `quantity > 0` | sale_items | Quantidade positiva |
| `subtotal_cents = quantity * unit_price_cents` | sale_items | Integridade do cálculo |

---

## 6. Triggers

| Trigger | Tabela | Propósito |
|---|---|---|
| `enforce_non_negative_stock` | product_variations | Linha de defesa final: bloqueia UPDATE que tornaria stock_quantity negativo (mensagem explícita) |
| `trg_*_updated_at` (7 triggers) | todas as tabelas com updated_at | Atualização automática do timestamp |

**Nota:** O trigger `enforce_non_negative_stock` age em conjunto com o `CHECK (stock_quantity >= 0)` da coluna. A validação primária deve sempre ocorrer na API antes de tentar a transação.

---

## 7. Configuração do ambiente (.env)

```bash
# .env.local (desenvolvimento — SQLite)
DATABASE_URL="file:./prisma/dev.db"

# .env.production (produção local — fora da pasta do projeto)
DATABASE_URL="file:C:/SPO/dados/spo.db"

# .env (futuro — PostgreSQL v2/cloud)
# DATABASE_URL="postgresql://user:password@host:5432/spo"
```

**Importante para o DevOps Agent:** O arquivo `.db` de produção NUNCA deve ficar dentro da pasta do projeto (risco de sobrescrita em atualizações). Configurar o caminho absoluto no script `iniciar.bat`.

---

## 8. Fluxos de operação — guia para o Backend Agent

### Finalizar venda (transação atômica obrigatória)

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Verificar estoque para cada item
  for (const item of items) {
    const variation = await tx.productVariation.findUniqueOrThrow({ where: { id: item.variationId } });
    if (variation.stockQuantity < item.quantity) {
      throw new Error(`Estoque insuficiente: ${variation.sku}`);
    }
  }

  // 2. Calcular totais
  const subtotalCents = items.reduce((acc, i) => acc + i.quantity * i.unitPriceCents, 0);
  const totalCents = subtotalCents - discountCents;

  // 3. Criar a venda
  const sale = await tx.sale.create({
    data: {
      status: 'ACTIVE',
      paymentMethod,
      subtotalCents,
      discountCents,
      totalCents,
      cardMachineId: cardMachineId ?? null,
      feeCents: cardMachineId ? Math.round(totalCents * cardMachine.feeBasisPoints / 10000) : null,
    }
  });

  // 4. Para cada item: SaleItem + decremento + StockMovement
  for (const item of items) {
    await tx.saleItem.create({
      data: {
        saleId: sale.id, variationId: item.variationId,
        quantity: item.quantity, unitPriceCents: item.unitPriceCents,
        subtotalCents: item.quantity * item.unitPriceCents,
      }
    });
    const updated = await tx.productVariation.update({
      where: { id: item.variationId },
      data: { stockQuantity: { decrement: item.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        variationId: item.variationId, saleId: sale.id,
        type: 'SALE', quantity: -item.quantity, balanceAfter: updated.stockQuantity,
      }
    });
  }
  return sale;
});
```

### Cancelar venda (transação atômica obrigatória)

```typescript
await prisma.$transaction(async (tx) => {
  const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId }, include: { items: true } });
  if (sale.status !== 'ACTIVE') throw new Error('Venda já cancelada');

  await tx.sale.update({
    where: { id: saleId },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
  });

  for (const item of sale.items) {
    const updated = await tx.productVariation.update({
      where: { id: item.variationId },
      data: { stockQuantity: { increment: item.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        variationId: item.variationId, saleId: sale.id,
        type: 'CANCELLATION', quantity: item.quantity, balanceAfter: updated.stockQuantity,
      }
    });
  }
});
```

### Query de alerta de estoque baixo

```typescript
// Prisma não suporta comparar dois campos do mesmo registro via where padrão
// Usar raw query:
const alertas = await prisma.$queryRaw<Array<{...}>>`
  SELECT
    pv.id, pv.sku, pv.size, pv.color,
    pv.stock_quantity, pv.min_stock,
    p.name as product_name, p.id as product_id,
    CASE
      WHEN pv.stock_quantity = 0 THEN 'ZERADO'
      WHEN pv.stock_quantity <= pv.min_stock THEN 'ALERTA'
      ELSE 'OK'
    END as stock_status
  FROM product_variations pv
  JOIN products p ON p.id = pv.product_id
  WHERE pv.is_active = 1
    AND p.deleted_at IS NULL
    AND pv.stock_quantity <= pv.min_stock
  ORDER BY pv.stock_quantity ASC, p.name ASC
`;
```

### Cálculo de taxa de maquininha

```typescript
// feeCents = ROUND(totalCents * feeBasisPoints / 10000)
// Exemplo: R$ 95,00 (9500 cents) na Cielo 1,99% (199 bp)
// feeCents = Math.round(9500 * 199 / 10000) = Math.round(189.05) = 189 = R$ 1,89
const feeCents = Math.round(totalCents * cardMachine.feeBasisPoints / 10000);
```

---

## 9. O que o Frontend Agent precisa saber

1. **Exibir preços:** `(cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
2. **PaymentMethod labels:** `CASH→"Dinheiro"`, `PIX→"Pix"`, `DEBIT→"Débito"`, `CREDIT→"Crédito"`
3. **Status de estoque:** `stockQuantity = 0 → 🚫 Zerado` | `0 < stockQty <= minStock → ⚠️ Alerta` | `> minStock → ✅ OK`
4. **Desconto:** enviar como centavos Int para a API. A API calcula e valida o `totalCents`.
5. **Maquininha:** exibir seleção de maquininha APENAS quando `paymentMethod = DEBIT` ou `CREDIT`. Obrigatório — impede finalizar a venda sem selecionar.
6. **Taxa da maquininha:** exibir como informação ("Taxa estimada: R$ 1,89") — não como dedução do total.
7. **Tela de PIN:** o PIN é verificado no backend via bcrypt. O frontend envia o PIN em texto plano via HTTPS (ou HTTP local — sem HTTPS no MVP), o backend compara com o hash. NÃO armazenar o PIN no frontend.

---

## 10. Pontos em aberto para próximas fases

| Ponto | Impacto | Quando resolver |
|---|---|---|
| OPEN-004: formas de pagamento finais | Ajuste no enum `PaymentMethod` | Antes de MVP-005 |
| OPEN-009: cartão parcelado | `installments Int?` e `installmentValueCents Int?` em `Sale` | Sprint de vendas |
| OPEN-013: acessórios | `size` pode ser opcional para produtos sem tamanho | Sprint de produtos |
| SA-011: tabela de tamanhos | Validar PP/P/M/G/GG/XGG ou numeração | Sprint de produtos |
| Settings singleton: seed inicial | Backend Agent deve criar o registro singleton no seed | MVP-005 |
