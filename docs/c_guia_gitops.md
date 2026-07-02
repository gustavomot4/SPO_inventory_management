# Guia completo do GitOps — SPO (Sistema Pimenta Ousada)

> Para quem nunca ouviu falar de GitOps. Explica **o que é**, **para que serve**, **como foi montado
> neste sistema** e, principalmente, **como você usa no dia a dia** (incluindo como commitar tudo).
> Documentos irmãos: `d_runbook.md` (referência rápida de operação), `e_teste_gitops_e2e.md` (checklist de
> teste), `b_plano/c_plano_gitops_atualizacoes.md` e ADR-005 (na pasta de documentação).

---

## 1. O que é GitOps (em linguagem simples)

**GitOps** é uma forma de **entregar atualizações** em que o **Git (o GitHub) é a "fonte da verdade"**:
você descreve no repositório **qual versão deve estar rodando**, e cada máquina **se ajusta sozinha**
para bater com o que está escrito lá.

Uma analogia: imagine um **termostato**. Você não liga e desliga o aquecedor na mão o tempo todo —
você só **define a temperatura desejada** (ex.: 22°C) e o termostato trabalha sozinho para chegar lá.
No GitOps:

- A "temperatura desejada" = **um arquivo no GitHub** dizendo "a versão correta é a v1.1.1".
- O "termostato" = um programa em cada máquina (o **`spo-updater`**) que lê esse arquivo e faz a
  máquina chegar nessa versão (baixa, sobe, confere). Esse processo de "se ajustar sozinho ao que está
  declarado" chama-se **reconciliação**.

A palavra-chave é **declarativo**: você **declara o estado desejado** (a versão), e o sistema se vira
para alcançá-lo — em vez de você ir de máquina em máquina executando comandos manualmente.

---

## 2. Para que serve (por que usamos aqui)

Antes, atualizar a loja significava: ir até o computador, dar `git pull`, **reconstruir o sistema na
máquina** (`docker compose up --build`) — lento, frágil e sem saber ao certo qual versão estava lá.

Com o GitOps, cada loja:

- **Recebe novas versões sozinha**, sem visita técnica.
- Roda uma **versão rastreável** (você sabe exatamente qual está em cada máquina).
- Faz **backup do banco antes de toda atualização**.
- **Volta sozinha para a versão anterior (rollback)** se a atualização der problema.
- **Não quebra sem internet** — se não houver rede, ela simplesmente continua na versão atual.

Ou seja: você publica uma vez, **todas as lojas se atualizam sozinhas e com segurança**.

---

## 3. As peças do sistema (o mapa)

| Peça | O que é | Onde vive |
|---|---|---|
| **Repositório** | O código-fonte e os arquivos de configuração. A fonte da verdade. | `github.com/gustavomot4/SPO_inventory_management` |
| **GitHub Actions (CI)** | Robôs que rodam automaticamente: constroem a imagem e publicam. | `.github/workflows/release.yml` e `promote.yml` |
| **Imagem Docker** | O sistema inteiro "empacotado" e congelado numa versão. | `ghcr.io/gustavomot4/spo:vX.Y.Z` |
| **GHCR** | O "depósito" de imagens do GitHub (GitHub Container Registry). | `ghcr.io` |
| **Manifestos** | Arquivos que dizem **qual versão deve rodar**. | `deploy/edge.json`, `deploy/stable.json` |
| **`spo-updater.ps1`** | O agente que roda em cada máquina e reconcilia a versão. | `deploy/spo-updater.ps1` |
| **`/api/health`** | Endereço que responde se o sistema está de pé e em qual versão. | `http://localhost:3000/api/health` |
| **`.env` (`SPO_VERSION`)** | Anota qual versão **esta máquina** está rodando. | `.env` (ao lado do `docker-compose.yml`) |
| **`iniciar.bat`** | Abre o sistema **e** dispara a verificação de atualização. | raiz do projeto |
| **Tarefa Agendada** | Faz o updater rodar todo dia às 18h30. | Windows (criada pelo `iniciar.bat` na 1ª vez) |
| **`backups/`** | Cópias do banco (antes de cada update e diárias às 17h50). | pasta `backups/` |

> **Imagem x Container:** a **imagem** é o "molde" congelado do sistema numa versão. O **container** é
> a imagem **em execução**. Atualizar = baixar uma imagem nova e trocar o container em execução por ela.

---

## 4. Os dois canais: `edge` e `stable`

Existe um **portão de segurança** entre "acabei de publicar" e "as lojas receberam". Por isso há **dois
canais**, que são só dois arquivos de manifesto:

- **`edge.json` (canal de testes):** atualizado **automaticamente** a cada versão publicada. Serve para
  você validar numa **máquina de teste** antes de mandar para as lojas.
- **`stable.json` (canal das lojas):** só muda quando **você decide promover** (um clique no GitHub).
  É o que as máquinas das lojas seguem.

Cada máquina escolhe o canal por um arquivo opcional `deploy/channel`:
- sem o arquivo (padrão) → segue **stable**;
- arquivo com a palavra `edge` → segue **edge** (use só em máquina de teste).

---

## 5. Versão (SemVer): o número `vX.Y.Z`

As versões seguem o padrão **`vMAIOR.MENOR.CORREÇÃO`** (ex.: `v1.1.1`):

- **CORREÇÃO** (`v1.1.0 → v1.1.1`): correção de bug, ajuste pequeno.
- **MENOR** (`v1.1.0 → v1.2.0`): funcionalidade nova, compatível com o que já existe.
- **MAIOR** (`v1.0.0 → v2.0.0`): mudança grande / incompatível.

> ⚠️ A versão da **imagem** vem do **nome da tag** (ex.: a tag `v1.1.1` gera a imagem `:v1.1.1`), **não**
> do `package.json`. Mantemos o `package.json` no mesmo número só por organização — quem manda é a tag.

---

## 6. Como funciona, do começo ao fim

```
   VOCÊ (desenvolvedor)                    GITHUB (nuvem)                 MÁQUINA DA LOJA
   ───────────────────                     ──────────────                 ───────────────
   1. edita o código
   2. git commit + push  ───────────────▶  main (código-fonte)
                                              │  (nada é entregue ainda)
   3. git tag vX.Y.Z + push da tag ───────▶  Actions: release.yml
                                              ├─ typecheck
                                              ├─ build da imagem
                                              ├─ push p/ ghcr.io/.../spo:vX.Y.Z
                                              └─ atualiza edge.json  (canal de testes)
   4. valida no canal edge  ◀───── pull da imagem ────────────────────  máquina de TESTE
   5. Actions: "Promote to stable" ──────▶  atualiza stable.json (canal das lojas)
                                                                          │
                                              no boot (iniciar.bat) e às 18h30:
                                              ┌───────────────────────────┴──────────┐
                                              │ spo-updater lê stable.json            │
                                              │  versão nova? → BACKUP do banco       │
                                              │   → docker compose pull               │
                                              │   → docker compose up -d              │
                                              │   → confere /api/health (até 120s)    │
                                              │   ✔ ok  → grava a nova versão no .env  │
                                              │   X falha → ROLLBACK p/ versão anterior │
                                              └────────────────────────────────────────┘
   sem internet em qualquer ponto → o updater desiste em ~5s e a loja segue na versão atual
```

**Resumo de cada etapa:**

1–2. **Commit/push** levam o código para o GitHub. **Isso sozinho não atualiza loja nenhuma.**
3. **A tag** é o gatilho do *deploy*: o robô do GitHub constrói a imagem, publica no GHCR e marca a versão no **edge**.
4. Você **testa no edge** (numa máquina de teste).
5. **Promover** copia a versão validada do edge para o **stable** — e aí as lojas pegam sozinhas.

---

## 7. Como você usa no dia a dia (passo a passo)

Aqui está a parte prática. São **dois processos diferentes** — você não faz os dois toda hora:

### 7.1 Trabalho normal (salvar código) — faça à vontade

Isso **não entrega nada para as lojas**, só guarda seu trabalho no GitHub:

```bash
git add -A                       # seleciona TODAS as mudanças
git commit -m "descrição da mudança"
git pull --rebase origin main    # (veja a nota abaixo) traz o que o robô commitou e põe o seu por cima
git push origin main
```

> **Por que o `git pull --rebase` antes do push?** Os robôs do GitHub (Actions) **commitam sozinhos** no
> `main` (eles atualizam o `edge.json`/`stable.json`). Então, com frequência, o GitHub tem commits que
> você não tem ainda. Se você tentar `git push` direto, ele recusa com *"Updates were rejected (fetch
> first)"*. O `git pull --rebase origin main` baixa esses commits do robô e **reaplica os seus por cima**,
> sem bagunçar o histórico. Depois o `git push` funciona.

> **`git add -A` pega tudo?** Sim — adiciona arquivos novos, modificados e apagados. Sempre confira antes
> com `git status` (lista o que mudou) e, se quiser ver as diferenças, `git diff`.

### 7.2 Lançar uma versão para as lojas — só quando estiver pronto

Você pode dar vários commits ao longo da semana e, no fim, lançar **uma** versão juntando tudo:

```bash
# 1. (opcional, organização) suba o número no package.json, ex.: 1.1.1 -> 1.1.2
#    e comite junto com o resto:
git add -A
git commit -m "release v1.1.2"
git pull --rebase origin main
git push origin main

# 2. crie e empurre a TAG  ← ISTO dispara o build da imagem (canal edge)
git tag v1.1.2
git push origin v1.1.2
```

Acompanhe em **GitHub → Actions** o workflow **"Release (build + publish edge)"** ficar verde. Quando
terminar, o `edge.json` estará na `v1.1.2`.

### 7.3 Testar no edge e promover

```bash
# Numa MÁQUINA DE TESTE (nunca a loja), aponte para o canal edge:
#   crie o arquivo deploy/channel com a palavra: edge
# e rode o updater para puxar a versão de teste:
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\spo-updater.ps1 -Mode manual
```

Confirmou que está tudo certo? Promova para as lojas:

```
GitHub → Actions → "Promote to stable" → version: v1.1.2 → Run
```

Pronto: o `stable.json` vira `v1.1.2` e **todas as lojas se atualizam sozinhas** no próximo boot (quando
abrem pelo `iniciar.bat`) ou na janela das 18h30.

### 7.4 O que cada comando faz (resumo)

| Comando | O que faz | Entrega para a loja? |
|---|---|---|
| `git add` / `commit` | Salva as mudanças no histórico local | Não |
| `git push origin main` | Envia o **código-fonte** para o GitHub | Não |
| `git tag vX.Y.Z` + `git push origin vX.Y.Z` | **Constrói e publica a imagem** (canal edge) | Não (só no edge) |
| **"Promote to stable"** (no GitHub) | Libera a versão para as **lojas** | **Sim** |

A grande mudança em relação ao "antigamente": **as lojas não rodam mais `git`**. Você nunca mais precisa
mexer no PC da loja — é só `tag` + `promote`, e o `spo-updater` faz o resto.

---

## 8. A rede de segurança (backup e rollback)

Toda atualização, **antes de trocar a imagem**, faz um **backup do banco** em
`backups/spo_preupdate_<versão>_<data>.db` (além do backup diário automático das 17h50).

Depois de subir a versão nova, o updater confere o `/api/health` por até **120 segundos**:

- **Subiu e respondeu OK** → grava a nova versão no `.env`. Fim.
- **Não respondeu / deu erro** → **rollback automático**: volta para a imagem anterior. Se a versão era
  marcada como **`breaking`** (mudança incompatível de banco), ele também **restaura o backup** do banco
  feito antes da atualização.

Resultado: uma versão ruim **não derruba a loja** — ela volta sozinha para a última versão boa.

> **Migrations de banco (avançado):** ao mexer na estrutura do banco, siga **expand/contract** — primeiro
> só **adicione** (uma versão consegue ler o banco da anterior), e só **remova** numa versão seguinte.
> Quando uma mudança for realmente incompatível, marque `breaking: true` na hora de promover.

---

## 9. Como conferir se está funcionando

- **Qual versão está rodando agora:** `curl http://localhost:3000/api/health` → `{"ok":true,"version":"vX.Y.Z"}`.
- **O que o updater decidiu (auditoria):** o arquivo `deploy/updates.log` registra **toda** decisão
  (atualizou, convergiu, falhou, fez rollback, estava offline...).
- **Qual versão a máquina está fixada:** a linha `SPO_VERSION="..."` no `.env`.
- **Qual versão as lojas devem rodar:** `deploy/stable.json`.
- Passo a passo completo de validação (incluindo teste de rollback): `docs/e_teste_gitops_e2e.md`.

Frases típicas no `updates.log` e o que querem dizer:

| Mensagem | Significado |
|---|---|
| `Convergido em vX.Y.Z` | A máquina já está na versão certa. Nada a fazer. (Normal.) |
| `Atualizacao disponivel: A -> B` | Achou versão nova; vai atualizar. |
| `Backup pre-update (...)` | Fez o backup do banco antes de mexer. |
| `ATUALIZADO com sucesso para vX.Y.Z` | Deu tudo certo. |
| `Health da versao X FALHOU - executando rollback` | A versão nova não subiu; voltando para a anterior. |
| `Rollback concluido - sistema operando em Y` | Voltou em segurança para a versão anterior. |
| `Sem acesso ao manifesto (offline?)` | Sem internet; manteve a versão atual (sem quebrar). |

---

## 10. Erros comuns (e o que fazer)

- **`git push` recusado: "Updates were rejected (fetch first)"** → o robô commitou no `main` antes de
  você. Rode `git pull --rebase origin main` e depois `git push origin main`. (Seção 7.1.)
- **`fatal: tag 'vX.Y.Z' already exists`** → essa versão já foi usada. Use o próximo número (ex.: `v1.1.2`).
- **Updater diz `Convergido` e não atualiza** → não há versão mais nova **no canal dessa máquina**. Se
  você publicou no edge mas a máquina segue o stable, é esperado: promova para o stable (ou ponha a
  máquina no canal edge para testar).
- **`spo-updater.ps1 : não é reconhecido...`** → no PowerShell, rode com o caminho:
  `powershell -NoProfile -ExecutionPolicy Bypass -File deploy\spo-updater.ps1 -Mode manual`.
- **`compose pull falhou (registry inacessivel?)`** → sem internet no momento, ou o package no GHCR não
  está público. O package **precisa ser público** (uma vez só), em GitHub → Packages → `spo` →
  *Package settings* → *Change visibility* → Public.

---

## 11. Glossário rápido

- **GitOps:** entregar software usando o Git como fonte da verdade; as máquinas se ajustam sozinhas ao que está declarado.
- **Declarativo / reconciliação:** você declara o estado desejado (a versão); o agente faz a máquina chegar nele.
- **CI (Integração Contínua):** robôs que rodam no GitHub (Actions) para testar/construir/publicar automaticamente.
- **Imagem:** o sistema empacotado e congelado numa versão. **Container:** a imagem em execução.
- **GHCR:** GitHub Container Registry — o depósito onde as imagens ficam (`ghcr.io`).
- **Tag (Git):** uma "etiqueta" que marca um ponto do histórico com um nome de versão (`vX.Y.Z`); aqui, **é o gatilho do build**.
- **Digest:** a "impressão digital" (`sha256:...`) de uma imagem específica — garante que é exatamente aquela.
- **Manifesto:** arquivo (`edge.json`/`stable.json`) que declara qual versão deve rodar.
- **Canal:** trilho de entrega — `edge` (teste) ou `stable` (lojas).
- **Rollback:** voltar automaticamente para a versão anterior quando a nova falha.
- **SemVer:** padrão de numeração `vMAIOR.MENOR.CORREÇÃO`.

---

## 12. Em uma frase

Você **commita** o código (não entrega nada), **cria uma tag** (constrói a imagem da versão), **promove**
(libera para as lojas) — e cada loja, sozinha e com backup + rollback, se atualiza para a versão que o
GitHub declara. Você nunca mais toca no computador da loja.
