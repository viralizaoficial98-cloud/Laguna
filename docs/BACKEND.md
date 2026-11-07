# Backend, base de dados e segurança

## Arquitectura

```
Browser (Next.js/React — interface inalterada)
   │  GET /api/state          → dados visíveis para o perfil (projecção no servidor)
   │  POST /api/actions       → operação de negócio (pagamento, reserva, desocupação…)
   │  POST /api/files         → anexos (comprovativos, fotografias, PDFs)
   │  /api/auth/*  /api/users/*  /api/import/*
   ▼
Route handlers Next.js (Node.js)
   ├─ src/server/auth.ts        sessões, Argon2id, bloqueio por tentativas, tokens
   ├─ src/server/actions.ts     execução transaccional das operações
   ├─ src/domain/engine.ts      regras de negócio + permissões (mesmo código no cliente e no servidor)
   ├─ src/server/state.ts       leitura/escrita por diferença + restrições de exclusividade
   ├─ src/server/projection.ts  o que cada perfil pode ver
   ├─ src/server/users.ts       Gestão de Utilizadores
   ├─ src/server/files.ts       armazenamento de anexos fora da pasta pública
   └─ src/server/importer.ts    importação idempotente (frontend / navegador)
   ▼
MySQL 8 / MariaDB 10.x (Prisma 7 + adaptador mariadb)
```

### Como uma operação é gravada

1. O browser executa a operação localmente (resposta imediata, mesmas regras) e envia-a para `POST /api/actions`.
2. O servidor valida a sessão, a origem do pedido (CSRF) e os argumentos (zod).
3. Abre uma transacção, obtém o **trinco de escrita** (`SELECT … FOR UPDATE` em `app_meta`), carrega o estado,
   executa a operação com a **sessão autenticada** (as permissões são verificadas aqui) e grava apenas as diferenças.
4. As restrições da base de dados garantem a integridade mesmo em pedidos simultâneos:
   - `quotas (apartmentId, period)` único — sem quotas duplicadas;
   - `reservation_slots (hallId, date)` chave primária — **uma reserva activa por salão e data**;
   - `pending_payment_slots (quotaId)` — um comprovativo em validação por quota;
   - `active_moveouts (residentId)` — um processo de desocupação activo por morador;
   - `circulars (year, sequence)`, `move_outs.reference`, `payments.receiptNumber`, `users.email` únicos;
   - tipologias `ENUM('T2','Duplex')` — T3/T4 são recusadas pela própria base de dados.
5. Conflitos transitórios (deadlock) são repetidos automaticamente; recusas devolvem a mensagem de negócio
   (ex.: “Este comprovativo já foi aprovado por Nelson Rodrigues em …”) e o estado actual para o browser se repor.
6. A versão dos dados é incrementada; os outros dispositivos actualizam-se em ≤ 15 s (e ao voltar ao separador).

Todas as operações (aceites e recusadas) ficam em `action_log`; as de negócio também em `audit_entries`.

## Tabelas

| Área | Tabelas |
|---|---|
| Sistema | `app_meta`, `condo_settings`, `_prisma_migrations` |
| Utilizadores | `users`, `auth_sessions`, `auth_tokens`, `login_attempts`, `user_audit_log` |
| Ficheiros | `stored_files` |
| Cadastro | `apartments`, `residents`, `occupancies` |
| Financeiro | `quotas`, `payments`, `pending_payment_slots`, `charges`, `expenses` |
| Reservas | `halls`, `reservations`, `reservation_slots` |
| Desocupação | `move_outs`, `active_moveouts` |
| Comunicação | `circulars`, `notices`, `documents`, `notifications` |
| Portaria | `visits`, `visit_checks`, `access_logs` |
| Operações | `occurrences`, `elevators`, `ops_tasks` |
| Auditoria / migração | `audit_entries`, `action_log`, `import_runs` |
| Titulares (proprietários/inquilinos) | `parties`, `fraction_holders`, `active_holder_slots` |
| Fornecedores e despesas | `suppliers` (+ colunas novas em `expenses`: fornecedor, NIF, factura, IVA, retenção, líquido, rubrica, estado, pagamentos, origem) |
| Declarações e assinatura | `declaration_types`, `declarations`, `signatures` |
| Orçamento | `budgets`, `budget_lines`, `budget_executions`, `revenues` |

Montantes: `DECIMAL(14,2)`. Datas: `DATE`; instantes: `DATETIME(3)` em UTC. Históricos, convidados, listas de verificação
e metadados de anexos: JSON em `LONGTEXT` (compatível com MySQL e MariaDB). Esquema: `prisma/schema.prisma`;
migrações versionadas em `prisma/migrations/` (aplicadas com `prisma migrate deploy`, nunca `reset`/`--force-reset`).

## Segurança

- Palavras-passe: **Argon2id** (19 MiB, 2 iterações). Nunca guardadas nem registadas em texto simples.
- Sessões: token aleatório de 256 bits em cookie `httpOnly`, `SameSite=Lax`, `Secure` em HTTPS; na base de dados
  apenas o SHA-256. Expiração: 12 h; inactividade: 2 h. Logout apaga a sessão no servidor.
- Bloqueio: 5 tentativas falhadas → conta bloqueada 15 min; limite de 30 falhas por IP em 15 min.
- Activação e redefinição: tokens de utilização única (SHA-256 na base de dados), com prazo (activação 72 h;
  redefinição 2 h, ou 24 h quando gerada pela gestão). Ao redefinir, as sessões abertas são terminadas.
- As contas iniciais **não têm palavra-passe**: são activadas por ligação (`npm run users:activation-link`).
- Permissões verificadas no servidor em todas as operações; o servidor só envia a cada perfil os dados que pode ver.
- CSRF: pedidos de escrita de outra origem são recusados.
- Anexos: só PDF/JPG/PNG/WEBP (assinatura do ficheiro verificada), máx. 5 MB, guardados em `STORAGE_DIR` e servidos
  por `/api/files/:id` apenas a quem tem permissão (autor, gestão; morador: PDFs publicados e documentos visíveis).
- Gestão de Utilizadores: Nelson gere contas de Gestor Operacional, Morador e Portaria; não pode criar, alterar ou
  bloquear contas de administração ou do Gestor Financeiro, nem elevar o próprio perfil. José tem acesso total.
  O histórico (`user_audit_log`) regista quem, conta, operação, data, estado anterior e novo — sem palavras-passe nem tokens.

## Gestão administrativa e financeira (Nelson Rodrigues — centro de gestão)

Migração `20261107000000_gestao_completa` (apenas adiciona tabelas, colunas e índices — não altera nem apaga dados).

- **Permissões** (`src/config/permissions.ts`, verificadas no servidor): o Gestor Operacional gere fracções, proprietários,
  inquilinos, moradores, quotas, pagamentos (incluindo presenciais e validação), recibos, receitas, despesas, fornecedores,
  orçamento, reservas, desocupações, declarações, assinatura, importação Excel e consulta a auditoria. Continua sem poder
  criar/alterar contas de administração ou do Gestor Financeiro, alterar/eliminar a auditoria ou contornar a autenticação.
- **Proprietários e inquilinos** (`src/server/mgmt/holders.ts`): pessoas/entidades em `parties`; associação à fracção em
  `fraction_holders` com histórico (início, fim, motivo, autor). `active_holder_slots` garante na base de dados um único
  proprietário e um único inquilino activos por fracção. Fracção sem inquilino → sem registo (nada fictício).
- **Pagamento presencial** (`registerPayment`): canal `presencial`, comprovativo opcional (PDF/JPG/PNG) associado à
  fracção/quota/morador, pagamento parcial sem exceder o valor em dívida, chave única `payments.clientKey` contra duplo
  clique/reenvio, recibo após validação.
- **Despesas**: estados Pendente/Aprovada/Paga/Parcialmente paga/Anulada; pagamentos parciais; anulação com motivo
  (nunca apaga registos com pagamentos); detecção de factura duplicada por fornecedor/NIF; histórico de alterações.
- **Declarações** (`src/server/mgmt/declarations.ts`): Solicitada → Em análise → A aguardar assinatura → Emitida
  (ou Rejeitada/Cancelada; revogação posterior com motivo). Requisitos verificados no servidor (residência activa,
  titularidade com confirmação documental, ausência de dívida). PDF gerado no servidor com número único, código QR e
  código de verificação (`/verificar?codigo=` mostra apenas iniciais do titular), SHA-256 guardado.
- **Assinatura** (`src/server/mgmt/signature.ts`): imagem PNG guardada em `STORAGE_DIR` (categoria `signature`) e
  servida apenas ao próprio titular; aplicada só após confirmação expressa em cada documento; registo de quem, quando e
  que documento. Não é uma assinatura digital qualificada — a interface `SignatureProvider` permite integrar um
  fornecedor certificado no futuro.
- **Orçamento** (`src/server/mgmt/budget.ts`): orçamento anual por rubricas (receita/despesa/fundo), valores mensais,
  execução do ficheiro por trimestre (`budget_executions`) e execução do sistema (quotas, receitas, despesas). Para cada
  trimestre prevalece a execução do ficheiro quando existe; os movimentos do sistema contam apenas nos trimestres sem
  dados do ficheiro (sobreposições assinaladas). Totais calculados só a partir das rubricas finais (sem dupla contagem).
- **Importação Excel** (`src/server/mgmt/excel-import.ts`, `/painel/importacao`): leitura, normalização (os valores
  originais ficam em `source`/`sourceRaw`), conciliação, duplicados, pré-visualização, decisões explícitas para
  conflitos, cópia de segurança JSON comprimida (`BACKUP_DIR`) antes de gravar, relatório em `import_runs`.
  Idempotente; nunca elimina nem substitui registos sem decisão.

## Migração dos dados

- `npm run db:import` — pré-visualização dos dados actuais do frontend (`src/data/*`): novos, iguais, conflitos, rejeitados.
- `npm run db:import -- --apply` — insere apenas os registos novos (idempotente; nunca apaga).
- `npm run db:import -- --file=exportacao.json [--apply]` — usa uma exportação do navegador.
- `/painel/importacao` (Administrador) — lê o armazenamento local do navegador das versões anteriores, mostra a
  pré-visualização e o relatório de conflitos, e só importa após confirmação. Conflitos só são substituídos se forem
  seleccionados. Anexos sem conteúdo ficam apenas com o nome (nada é inventado).
- `npm run db:verify` — compara a base de dados com a fonte e verifica a estrutura oficial e a integridade financeira.

Os registos iniciais vêm do cadastro de demonstração existente no frontend (100 apartamentos, 92 moradores, quotas,
pagamentos, etc.). Devem ser validados e substituídos pelos dados reais à medida que forem confirmados.

## Testes

| Comando | Âmbito |
|---|---|
| `npm run test:unit` | regras de negócio, mapeamento domínio ↔ base de dados, projecção por perfil (sem base de dados) |
| `BASE_URL=… npm run test:api` | API contra um servidor e uma base de dados **de teste** (login, perfis, utilizadores, concorrência, ficheiros, reservas, desocupação, auditoria) |
| `BASE_URL=… XLSX_DIR=… npm run test:gestao` | gestão do Nelson: permissões, proprietários/inquilinos, pagamento presencial, despesas/fornecedores, assinatura, declarações (pedido → assinatura → verificação), importação Excel (pré-visualização, cópia de segurança, idempotência, preservação dos dados), receitas. `XLSX_DIR` (opcional) aponta para os três ficheiros Excel, que não estão no repositório |
