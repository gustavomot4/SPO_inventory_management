# Schema Design — SPO (Sistema Pimenta Ousada)

> **Agente:** Database Agent
> **Histórico de tasks:** DOC-012 → MVP-004 → DT-004 → DT-005
> **Versão atual do schema:** 2.2
> **Última atualização:** 2026-05-27

---

## Histórico de versões

| Versão | Task | Data | O que mudou |
|---|---|---|---|
| 1.0 | DOC-012 | 2026-05-22 | Schema inicial: User, Supplier, enums, sem @map |
| 2.0 | MVP-004 | 2026-05-27 | Removidos User/Supplier/UserRole. Adicionados CardMachine, Settings. Sale ganhou subtotalCents, discountCents, cardMachineId, feeCents |
| 2.1 | DT-004 | 2026-05-27 | @map adicionado em todos os campos camelCase para gerar colunas snake_case no SQLite |
| 2.2 | DT-005 | 2026-05-27 | Enums convertidos para String — Prisma 5.x com provider=sqlite não suporta declarações enum |
| 2.3 | DT-007 + PROD-007 | 2026-05-28 | DateTime→String/dbgenerated (fix bug epoch ms P2023). costCents Int? adicionado em Product. DT-008: size/color documentados como opcionais na API |
| 2.4 | DT-010 | 2026-05-29 | Settings: +address?, +phone? (COM-006). CardMachineInstallment: nova tabela para taxas de parcelamento (MAQU-003/VEND-007). Sale: +installments (default 1), +installmentFeeBasisPoints? (VEND-007) |

---

## 1. Visão geral das entidades

```
Category ──── Product (N:1) ─── ProductVariation (1:N)
                                     │    │      │
                               SaleItem  │  StockEntry
                                      StockMovement

CardMachine ──── Sale (N:1) ─── SaleItem
                    │
                 StockMovement

Settings (singleton)
```

| Model | Papel |
|---|---|
| `Category` | Classificação dos produtos (Blusa, Calça, etc.) |
| `Product` | Produto-base (ex: "Blusa Floral") |
| `ProductVariation` | Uma combinação tamanho+cor de um produto — unidade de controle de estoque |
| `StockEntry` | Registro de recebimento de mercadoria |
| `CardMachine` | Maquininha de cartão cadastrada (com taxa em basis points) |
| `Settings` | Configurações globais da loja — singleton (1 registro) |
| `Sale` | Cabeçalho de uma venda (data, pagamento, subtotal, desconto, total) |
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
| `Sale.subtotalCents` | Int | soma dos itens SEM desconto |
| `Sale.discountCents` | Int | desconto total (0 = sem desconto) |
| `Sale.totalCents` | Int | `subtotalCents - discountCents` |
| `Sale.feeCents` | Int? | taxa da maquininha estimada — informativo |
| `StockEntry.unitCostCents` | Int? | R$ 30,00 → `3000` (opcional) |
| `CardMachine.feeBasisPoints` | Int | taxa em basis points: 199 = 1,99% |

**Justificativa:** Float/Double em ponto flutuante acumula erros de arredondamento que em contexto financeiro causam inconsistências. `0.1 + 0.2 = 0.30000000000000004` em ponto flutuante. Usar Int em centavos elimina esse problema por completo. Formatação para R$ é responsabilidade do frontend.

**Basis points para taxas de maquininha:** `feeBasisPoints` armazena a taxa como Int (ex: 199 = 1,99%), evitando Float para percentuais. Conversão: `feeBasisPoints / 10000` para obter a taxa decimal.

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

`subtotalCents` também é armazenado (não computado via join) pelo mesmo motivo de integridade.

---

### 2.4 Soft delete em Product

**Decisão:** Produtos inativados usam `deletedAt DateTime?` (null = ativo) em vez de exclusão real.

**Justificativa:** Regra RN-001.4 — produtos inativados não são excluídos. O histórico de vendas referencia `variationId`, que referencia `productId`. Excluir o produto quebraria a integridade referencial com `SaleItem` e `StockMovement`. Com soft delete, o histórico permanece intacto.

**Filtro padrão para consultas ativas:** `WHERE deleted_at IS NULL AND is_active = true`

**Nota:** O campo `isActive` coexiste com `deletedAt` com semânticas distintas:
- `deletedAt` não-null = produto removido permanentemente da operação (soft delete)
- `isActive = false` = produto temporariamente desativado (pode ser reativado)

---

### 2.5 StockMovement como audit log imutável

**Decisão:** Todo evento que altera `ProductVariation.stockQuantity` gera obrigatoriamente um registro em `StockMovement`. Esse modelo é imutável (sem `updatedAt`).

**Tipos de movimento (campo `type: String`):**

| Valor | quantity | Disparado por |
|---|---|---|
| `'ENTRY'` | positivo | Criação de `StockEntry` |
| `'SALE'` | negativo | Finalização de `Sale` |
| `'CANCELLATION'` | positivo | Cancelamento de `Sale` |
| `'LOSS'` | negativo | Registro manual de perda |
| `'ADJUSTMENT'` | positivo ou negativo | Ajuste manual de inventário |

**Campo `balanceAfter`:** Armazena o valor de `stockQuantity` após o movimento. Permite reconstruir o histórico completo de estoque de qualquer variação em qualquer ponto no tempo.

**Regra para o Backend Agent:** A sequência de operações ao finalizar uma venda deve ser atômica (transação Prisma):
1. Verificar `stockQuantity >= quantity` para cada item
2. Decrementar `stockQuantity` em `ProductVariation`
3. Criar `SaleItem`
4. Criar `StockMovement` com `type = 'SALE'`, `quantity = -quantity`, `balanceAfter = novoSaldo`
5. Verificar alertas de estoque baixo

---

### 2.6 Timestamps como String/dbgenerated (DT-007)

**Decisão:** Todos os campos de timestamp (`createdAt`, `updatedAt`, `receivedAt`, `deletedAt`, `cancelledAt`) são declarados como `String` no schema Prisma, não como `DateTime`.

**Problema:** O Prisma 5 com `provider = "sqlite"` serializa campos `DateTime` como **epoch em milissegundos** (ex: `1779569639530`) ao invés de ISO 8601. Ao ler esses valores de volta, o Prisma lança:
```
P2023: Inconsistent column data: Conversion failed: 'Could not convert value "1779569639530"'
```
Esse bug se manifesta na primeira operação de UPDATE em qualquer tabela.

**Fix:**
- Campos `createdAt`/`updatedAt`/`receivedAt` → `String @default(dbgenerated("(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))"))`
- Campos nullable (`deletedAt`, `cancelledAt`) → `String?` sem default, gerenciados pela aplicação como string ISO 8601
- `@updatedAt` é removido (não funciona com `String`) — o campo `updated_at` é mantido atualizado pelos triggers SQL da migration `20260528000001_add_cost_cents_and_triggers`

**Formato:** Todos os timestamps são strings ISO 8601 com timezone UTC, ex: `"2026-05-28T14:23:11.000Z"`.

**Para o Backend Agent:** Ao comparar ou ordenar timestamps, usar comparação léxica de strings — funciona corretamente com ISO 8601 em formato `YYYY-MM-DDTHH:MM:SS.sssZ`. Para converter para objeto Date em TypeScript: `new Date(record.createdAt)`.

---

### 2.7 costCents em Product (PROD-007)

**Decisão:** `Product.costCents Int? @map("cost_cents")` — preço de custo da peça em centavos. Campo opcional.

**Finalidade:** Calcular margem de lucro nos relatórios: `margem = priceCents - costCents` por unidade. Percentual de margem: `(priceCents - costCents) / priceCents * 100`.

**Opcional (`Int?`):** Não bloqueia o cadastro de produtos sem custo informado. `null` = custo não cadastrado para este produto. Relatórios de margem excluem produtos com `costCents = null` ou exibem "N/A".

**Para o Frontend Agent:** Exibir `costCents` como campo opcional no formulário de produto (label "Preço de Custo"). Exibir margem em tempo real enquanto o usuário preenche os dois campos.

---

### 2.8 size e color opcionais nas variações (DT-008)

**Decisão de negócio aprovada pelo Tech Lead:** Os campos `size` (tamanho) e `color` (cor) deixam de ser obrigatórios na validação da API. A loja vende acessórios e itens de "tamanho único" que não têm variação relevante de tamanho ou cor.

**Implementação no banco:** Nenhuma alteração necessária. `size` e `color` são `String` (não nullable) no schema e `TEXT NOT NULL` no SQLite. A string vazia `""` é um valor TEXT válido.

**Constraint `@@unique([productId, size, color])`** permanece inalterada — a combinação `(productId, "", "")` é única e válida, representando "sem variação".

**Para o Backend Agent:** Na API de criação/edição de variações, `size` e `color` devem aceitar string vazia `""`. Se o formulário enviar `null` ou `undefined`, converter para `""` antes de persistir.

---

### 2.9 Settings — endereço e telefone (DT-010 / COM-006)

**Decisão:** Adicionados `address String?` e `phone String?` ao model `Settings`.

**Finalidade:** Exibição na comanda térmica customizável. A dona da loja pode preencher o endereço e telefone na tela de configurações, e esses dados aparecem no cabeçalho da comanda impressa.

**Opcionais:** Se `null`, a comanda simplesmente omite as linhas de endereço/telefone — compatível com o comportamento já implementado pelo Frontend Agent em `vendas/[id]/page.tsx`.

---

### 2.10 CardMachineInstallment — taxas de parcelamento (DT-010 / MAQU-003 / VEND-007)

**Decisão:** Novo model `CardMachineInstallment` com relação N:1 para `CardMachine`.

**Motivação:** Maquininhas de cartão cobram taxas diferentes dependendo do número de parcelas. O campo `feeBasisPoints` em `CardMachine` representa a taxa à vista (1×) e permanece como fallback. Para 2x, 3x... 12x, as taxas ficam em registros de `CardMachineInstallment`.

**Constraint `@@unique([cardMachineId, installments])`:** garante uma única taxa por faixa de parcelamento por maquininha.

**Para o Backend Agent:** Ao finalizar uma venda parcelada no crédito:
1. Buscar `CardMachineInstallment` onde `cardMachineId = X` e `installments = N` e `isActive = true`
2. Se existir: usar `feeBasisPoints` desse registro para calcular `feeCents`; gravar em `Sale.installmentFeeBasisPoints`
3. Se não existir: usar `CardMachine.feeBasisPoints` como fallback (taxa à vista aplicada a todas as parcelas)
4. Gravar `Sale.installments = N`

---

### 2.11 Sale — campos de parcelamento (DT-010 / VEND-007)

**Decisão:** Adicionados `installments Int @default(1)` e `installmentFeeBasisPoints Int?` ao model `Sale`.

| Campo | Tipo | Descrição |
|---|---|---|
| `installments` | `Int` default 1 | Número de parcelas. 1 = à vista. Vendas existentes assumem 1. |
| `installmentFeeBasisPoints` | `Int?` | Taxa em basis points usada no cálculo de `feeCents`. null = à vista ou sem maquininha. |

**Imutabilidade:** Como `SaleItem.unitPriceCents`, esses campos são gravados no momento da venda e nunca atualizados — preservam o snapshot da taxa aplicada.

---

### 2.12 Campos de enum → String (DT-005)

**Decisão:** Todos os campos que seriam enum no Prisma são declarados como `String`. Os valores válidos são documentados em comentário no schema.

**Justificativa:** O Prisma 5.x com `provider = "sqlite"` **não suporta** declarações `enum`. Ao tentar rodar `prisma generate` ou `prisma db push` com enums, o erro P1012 é lançado:
```
Error validating: You defined the enum `SaleStatus`. But the current connector does not support enums.
```

**Validação:** A validação dos valores ocorre na camada de aplicação (API Routes), não no banco. O banco armazena os valores como TEXT.

| Campo | Valores válidos |
|---|---|
| `Sale.status` | `'ACTIVE'` \| `'CANCELLED'` |
| `Sale.paymentMethod` | `'CASH'` \| `'PIX'` \| `'DEBIT'` \| `'CREDIT'` |
| `StockMovement.type` | `'ENTRY'` \| `'SALE'` \| `'CANCELLATION'` \| `'LOSS'` \| `'ADJUSTMENT'` |

**Nota de migração para PostgreSQL:** Ao migrar para `provider = "postgresql"`, esses campos `String` podem ser convertidos para `enum` real do Prisma sem impacto nos dados, apenas alterando o tipo no schema e rodando uma nova migration.

---

### 2.7 Relação StockEntry ↔ StockMovement (1:1)

**Decisão:** Cada `StockEntry` gera exatamente um `StockMovement` do tipo `ENTRY`. A relação é modelada com `stockEntryId @unique` em `StockMovement`.

**Justificativa:** Permite rastrear a origem de cada incremento de estoque com todos os detalhes do recebimento enquanto mantém o log de movimentos unificado em `StockMovement`.

---

### 2.8 CardMachine — maquininhas de cartão (MVP-004)

**Decisão:** Maquininhas de cartão são entidades cadastradas (`CardMachine`) com nome e taxa em basis points. Uma `Sale` com `paymentMethod = 'DEBIT'` ou `'CREDIT'` deve ter `cardMachineId` não-null.

**Justificativa:** A dona precisa saber quanto perde por transação por maquininha para fins gerenciais. Diferente de acoplar a taxa ao método de pagamento, o cadastro de maquininha permite múltiplas maquininhas com taxas diferentes.

**CHECK constraint na migração:**
```sql
CHECK (
  (payment_method NOT IN ('DEBIT', 'CREDIT')) OR (card_machine_id IS NOT NULL)
)
```

---

### 2.9 Settings — singleton de configurações (MVP-004)

**Decisão:** Um único registro na tabela `settings` armazena configurações globais: nome da loja e hash do PIN.

**Justificativa:** PIN protege relatórios e tela de configurações (RN-007). `pinHash` armazena o hash bcrypt — nunca o PIN em texto claro.

**Regra para o Backend Agent:** Ao inicializar o sistema, verificar se existe registro em `settings`. Se não existir, criar com valores padrão (`shopName = "Pimenta Ousada"`, `pinHash = null`). Isso é responsabilidade do script de seed (DT-003 / MVP-005).

---

### 2.10 IDs via cuid()

**Decisão:** Todos os IDs são `String @id @default(cuid())`.

**Justificativa:** cuid gera identificadores únicos, ordenáveis por tempo, sem colisão em ambiente local. Não expõe sequências numéricas incrementais. Compatível com SQLite e PostgreSQL sem alteração.

---

### 2.11 @map e @@map — convenção de nomes (DT-004)

**Decisão:** Todos os campos camelCase têm `@map("snake_case")`. Todos os models têm `@@map("snake_case_plural")`.

**Justificativa:** O Prisma usa camelCase em TypeScript por convenção, mas SQL usa snake_case. Sem `@map`, o Prisma criaria colunas com nomes camelCase no SQLite (`categoryId`, `isActive`, etc.), quebrando a convenção SQL e dificultando queries raw. Com `@map`, o Prisma gera e espera colunas snake_case no banco enquanto o código TypeScript continua usando camelCase.

**Exemplo:**
```prisma
isActive Boolean @default(true) @map("is_active")
// TypeScript: variation.isActive
// SQL:        is_active = 1
```

---

## 3. Índices criados e suas justificativas

Prisma + SQLite **não cria índices em foreign keys automaticamente**. Todos os índices abaixo foram declarados explicitamente via `@@index`.

| Índice | Tabela | Coluna(s) | Query que serve |
|---|---|---|---|
| `idx_products_category` | products | category_id | Filtro de produtos por categoria |
| `idx_products_is_active` | products | is_active | Filtro de produtos ativos |
| `idx_products_deleted_at` | products | deleted_at | Filtro de produtos não deletados |
| `idx_variations_product` | product_variations | product_id | Listar variações de um produto |
| `idx_variations_sku` | product_variations | sku | Busca por SKU |
| `idx_variations_is_active` | product_variations | is_active | Filtro de variações ativas |
| `idx_variations_stock` | product_variations | stock_quantity | Query de alertas de estoque baixo |
| `idx_entries_variation` | stock_entries | variation_id | Histórico de entradas por variação |
| `idx_entries_received_at` | stock_entries | received_at | Filtro por período |
| `idx_card_machines_active` | card_machines | is_active | Listar maquininhas ativas |
| `idx_sales_status` | sales | status | Filtro de vendas ativas/canceladas |
| `idx_sales_created_at` | sales | created_at | Relatórios por período (hoje/semana/mês) |
| `idx_sales_payment` | sales | payment_method | Análise por forma de pagamento |
| `idx_sales_card_machine` | sales | card_machine_id | Vendas por maquininha |
| `idx_sale_items_sale` | sale_items | sale_id | Itens de uma venda |
| `idx_sale_items_variation` | sale_items | variation_id | Produtos mais vendidos |
| `idx_movements_variation` | stock_movements | variation_id | Histórico de movimentos por variação |
| `idx_movements_sale` | stock_movements | sale_id | Movimentos de uma venda |
| `idx_movements_type` | stock_movements | type | Filtro por tipo de movimento |
| `idx_movements_created_at` | stock_movements | created_at | Relatórios por período |

---

## 4. Restrições de integridade (raw SQL na migration)

O Prisma não suporta `CHECK` constraints nativamente. As restrições abaixo estão incluídas na migration SQL e aplicadas no banco de dados.

### 4.1 Estoque não negativo (trigger)

```sql
CREATE TRIGGER enforce_non_negative_stock
BEFORE UPDATE ON product_variations
FOR EACH ROW
WHEN NEW.stock_quantity < 0
BEGIN
  SELECT RAISE(ABORT, 'Estoque não pode ser negativo');
END;
```

**Nota para o Backend Agent:** Além do trigger, a validação deve ocorrer na camada de aplicação (API Route) ANTES de tentar a transação, com mensagem clara para o usuário. O trigger é a linha de defesa final no banco.

### 4.2 Total = Subtotal − Desconto (CHECK)

```sql
CHECK (total_cents = subtotal_cents - discount_cents)
```

### 4.3 Maquininha obrigatória para cartão (CHECK)

```sql
CHECK (
  (payment_method NOT IN ('DEBIT', 'CREDIT'))
  OR (card_machine_id IS NOT NULL)
)
```

### 4.4 Triggers de `updated_at`

O SQLite não tem `ON UPDATE CURRENT_TIMESTAMP`. A migration inclui 7 triggers `trg_*_updated_at` para manter o campo atualizado automaticamente em todas as tabelas que o possuem.

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
  const subtotalCents = items.reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0);
  const sale = await tx.sale.create({
    data: {
      paymentMethod: 'CASH', // 'CASH' | 'PIX' | 'DEBIT' | 'CREDIT'
      subtotalCents,
      discountCents: discount,
      totalCents: subtotalCents - discount,
      cardMachineId: cardMachineId ?? null,
      feeCents: feeCents ?? null,
    },
  });

  // 3. Para cada item: criar SaleItem, decrementar estoque, criar StockMovement
  for (const item of items) {
    await tx.saleItem.create({
      data: {
        saleId: sale.id,
        variationId: item.variationId,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents, // snapshot do preço
        subtotalCents: item.quantity * item.unitPriceCents,
      },
    });

    const updated = await tx.productVariation.update({
      where: { id: item.variationId },
      data: { stockQuantity: { decrement: item.quantity } },
    });

    await tx.stockMovement.create({
      data: {
        variationId: item.variationId,
        saleId: sale.id,
        type: 'SALE',
        quantity: -item.quantity,
        balanceAfter: updated.stockQuantity,
      },
    });
  }
});
```

### Cancelar venda (transação atômica)

```typescript
await prisma.$transaction(async (tx) => {
  const sale = await tx.sale.findUniqueOrThrow({
    where: { id: saleId },
    include: { items: true },
  });
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
        variationId: item.variationId,
        saleId: sale.id,
        type: 'CANCELLATION',
        quantity: item.quantity, // positivo — retorno ao estoque
        balanceAfter: updated.stockQuantity,
      },
    });
  }
});
```

### Query de alerta de estoque baixo

```typescript
// Forma correta com raw query (Prisma não suporta comparação entre dois campos do mesmo registro via where padrão)
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

## 7. Pontos em aberto para próximas fases

| Ponto | Impacto | Quando resolver |
|---|---|---|
| OPEN-009: cartão parcelado | Se necessário, adicionar `installments Int?` e `installmentValueCents Int?` em `Sale` | Sprint de vendas |
| OPEN-012: cadastro de clientes | Novo model `Customer` com relação 1:N com `Sale` | v1.1 |
| OPEN-013: acessórios além de roupas | `size` pode ser `null` ou ter valor livre para acessórios | Sprint de produtos |
| DT-003: seed do Settings singleton | Criar registro inicial de settings com `shopName` e `pinHash = null` | MVP-005 |
| Enum → real no PostgreSQL | Ao migrar para Postgres, os campos String de enum podem virar enum real | v2 cloud |

---

## 8. O que o Backend Agent precisa saber

1. **Toda operação de estoque é transacional** — nunca alterar `stockQuantity` sem criar o `StockMovement` correspondente na mesma transação
2. **Preços chegam do frontend em Real (string ou float)** — converter para centavos (Int) ANTES de persistir
3. **`SaleItem` é imutável** — criar, nunca atualizar
4. **`StockMovement` é imutável** — criar, nunca atualizar nem deletar
5. **Soft delete de produtos** — filtrar sempre com `deletedAt: null` nas queries de operação
6. **Query de alertas** — usar raw query (ver seção 6) pois Prisma não suporta comparação entre dois campos do mesmo registro via `where` padrão
7. **Campos de enum são String** — validar os valores na API antes de persistir; o banco aceita qualquer string
8. **`Settings` é singleton** — verificar existência antes de criar; nunca criar mais de um registro

## 9. O que o Frontend Agent precisa saber

1. **Exibir preços:** dividir valor Int por 100 e formatar com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`
2. **Enviar preços para API:** enviar como centavos (Int) — contrato definido com Backend Agent
3. **Taxa de maquininha:** `feeBasisPoints / 10000` para taxa decimal; `feeBasisPoints / 100` para percentual (ex: 199 / 100 = "1,99%")
4. **Status de estoque por variação:**
   - `stockQuantity > minStock` → ✅ OK
   - `stockQuantity > 0 && stockQuantity <= minStock` → ⚠️ Alerta
   - `stockQuantity === 0` → 🚫 Zerado
5. **Campo `paymentMethod`:** exibir labels em português (ex: `CASH` → "Dinheiro", `PIX` → "Pix", `DEBIT` → "Débito", `CREDIT` → "Crédito")
6. **NUNCA modificar `prisma/schema.prisma` ou `db/schema.prisma`** — esses arquivos são responsabilidade exclusiva do Database Agent

---

## 10. Aviso para todos os agentes — proteção do schema

> ⚠️ **Os arquivos `prisma/schema.prisma` e `db/schema.prisma` são de responsabilidade EXCLUSIVA do Database Agent.**
>
> Em 2026-05-27, o Frontend Agent reverteu ambos os arquivos para a versão DOC-012 (v1.0), desfazendo o trabalho das tasks MVP-004 e DT-004. Isso causou falha no `npx prisma generate` com erros de enum não suportado (P1012).
>
> **Nenhum outro agente deve modificar esses arquivos.** Se precisar de alterações no schema, comunicar ao Database Agent via z_next_task.md para que a mudança seja feita corretamente com migration correspondente.
