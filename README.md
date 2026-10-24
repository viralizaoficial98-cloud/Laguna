# Portal Residencial Laguna

Portal institucional e plataforma de gestão do condomínio **Residencial Laguna** (Talatona, Luanda, Angola).

> Aplicação **full stack**: Next.js (interface e API), MySQL/MariaDB (Prisma), autenticação real com Argon2id,
> permissões verificadas no servidor e dados partilhados entre utilizadores e dispositivos.
> Arquitectura e segurança: [docs/BACKEND.md](docs/BACKEND.md) · Publicação: [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md)

## Tecnologias

Next.js 16 (App Router + route handlers) · React 19 · TypeScript · Prisma 7 (MySQL/MariaDB) · Argon2id · Tailwind CSS 4 ·
Framer Motion · Recharts · React Hook Form · Zod · Zustand · Lucide · Sonner · jsPDF

## Executar (desenvolvimento)

```bash
cp .env.example .env          # DATABASE_URL de uma base de dados de desenvolvimento
npm install                   # gera também o cliente Prisma
npm run db:migrate            # cria as tabelas (prisma migrate deploy)
npm run db:import -- --apply  # importa os dados actuais do frontend (idempotente)
npm run db:seed-users         # cria as 5 contas (sem palavra-passe)
npm run users:activation-link -- jose.leiria@residenciallaguna.ao   # ligação para definir a palavra-passe
npm run dev                   # http://localhost:3000
```

Verificações: `npm run lint` · `npm run build` · `npm run test:unit` · `BASE_URL=http://localhost:3000 npm run test:api`
(apenas contra uma base de dados de teste) · `npm run db:verify`.

## Contas (cinco perfis)

| Nome | Email | Perfil |
|---|---|---|
| José Leiria | jose.leiria@residenciallaguna.ao | Administrador do Condomínio |
| Nelson Rodrigues | nelson.rodrigues@residenciallaguna.ao | Gestor Operacional |
| Saraiva | saraiva@residenciallaguna.ao | Gestor Financeiro do Condomínio |
| Manuel Muenho | manuel.muenho@residenciallaguna.ao | Morador (Bloco 06 · 201) |
| Portaria Laguna | portaria@residenciallaguna.ao | Portaria |

Não existem palavras-passe pré-definidas: cada conta é activada por uma ligação de utilização única. A recuperação de
palavra-passe está em `/recuperar`; a alteração, em *Meu perfil*. Novas contas são criadas na **Gestão de Utilizadores**
(José: todas; Nelson: contas operacionais, de moradores e de portaria).

### Experiências por perfil

- **José Leiria** — dashboard executivo (16 KPIs com selecção de período), dashboard financeiro (filtros ano/trimestre/bloco,
  5 gráficos), supervisão operacional (elevadores, ocorrências, serviços, equipas) e relatórios PDF financeiro e operacional.
- **Nelson Rodrigues** — dashboard operacional (12 KPIs), Elevadores, Ocorrências, Limpeza, Jardinagem, Manutenção
  (plano, calendário, execução, fiscalização) e relatórios PDF diário/semanal/mensal/manutenção/ocorrências/fiscalização.
- **Saraiva** — dashboard financeiro (16 KPIs, 8 gráficos, filtros ano/trimestre/bloco/tipologia), validação/rejeição de comprovativos,
  registo de pagamentos com recibo PDF, conta corrente e extracto PDF, dívidas por apartamento, despesas, validação de pagamentos de
  reservas, verificação financeira da desocupação e relatórios financeiros PDF.
- **Manuel Muenho** — quotas trimestrais por tipologia (pagamento total ou parcial, comprovativo, recibo), reservas de salões,
  Solicitação de Desocupação do Imóvel, visitas, ocorrências próprias, estado dos elevadores.
- **Portaria** — visitantes autorizados, confirmação de entradas/saídas, consulta de eventos em salões e de saídas autorizadas.

Os dashboards de José e Nelson usam a **mesma fonte de dados** (`src/hooks/use-operations.ts`, `src/hooks/use-finance.ts`):
por exemplo, uma avaria registada por Nelson cria a ocorrência e aparece nos alertas de José; a intervenção resolve-a.
Os custos de manutenção concluída entram nas despesas do dashboard financeiro.

## Estrutura

```
src/
  app/
    (site)/          Portal público: início, sobre, infraestruturas, apartamentos, galeria, comunicados, contactos
    login/ (auth)/   Login, recuperação, activação e redefinição de palavra-passe
    painel/          Área privada (dashboards e módulos por perfil, Gestão de Utilizadores, Importação de dados)
    api/             Backend: auth, state, actions, files, users, import, health
  components/
    ui/              Componentes base reutilizáveis (botões, tabelas, modais, formulários…)
    site/            Componentes do portal público (header, hero, galeria/lightbox…)
    app/             Shell do painel, dashboards e widgets
    charts/          Gráficos (Recharts) com paleta validada
  config/            site.ts (dados institucionais), navigation.ts (menus e permissões por perfil)
  data/              Cadastro e dados iniciais (fonte da importação inicial para a base de dados)
  domain/            Motor de domínio (regras de negócio, partilhado cliente/servidor)
  server/            Backend (Prisma, autenticação, transacções, ficheiros, utilizadores, importação)
  services/          Serviços do cliente (portal público e autenticação)
  store/             Estado no cliente sincronizado com a API (Zustand)
  hooks/ lib/ types/
public/images/
  laguna/fachadas | lazer | areas-exteriores   Fotografias reais optimizadas (WebP)
  brand/                                        Logótipo (cor e branco)
```

## Regras de funcionamento

- **Administrador oficial:** José Leiria (`src/config/site.ts → administrator`) — assina as circulares e aparece nos documentos gerados.
- **Tipologias:** exclusivamente **T2** e **Duplex** (3 quartos, sala e varanda). 10 blocos · 100 apartamentos · 80 T2 + 20 Duplex.
  Distribuição provisória configurável: 8 T2 + 2 Duplex por bloco (Duplex = fracções 501 e 502) — a confirmar pela Administração.
- **Quotas trimestrais por tipologia:** T2 = 300 000 Kz · Duplex = 600 000 Kz (4 quotas/ano), configuráveis em *Quotas trimestrais*.
  Receita teórica 36 000 000 Kz/trimestre · 144 000 000 Kz/ano. Uma quota por fracção e trimestre (sem duplicações); pagamentos parciais
  quando autorizados. Estados: Pendente, Em Validação, Parcialmente pago, Pago e Em atraso.
- **Validação de comprovativos:** o morador submete (Em Validação) → Nelson **ou** Saraiva aprova/rejeita (uma única decisão;
  decisões duplicadas ou contraditórias são recusadas). Auditoria: quem, quando, observações, valor validado, comprovativo e recibo.
- **Reservas de salões:** 50 000 Kz por reserva e prazo do bloqueio provisório (48 h) configuráveis pela Administração; um salão por
  data (calendários independentes por salão), lista de espera, expiração automática, validação do pagamento pelo Gestor Financeiro.
- **Desocupação:** processo DES-AAAA-NNN com extracto automático da conta corrente, verificação financeira (Saraiva) e operacional
  (Nelson), encargos apenas com fundamentação e validação administrativa, autorização única e PDF "Declaração de Regularização e
  Autorização Administrativa de Saída" — bloqueada enquanto existirem dívidas confirmadas ou pagamentos por validar. Não há
  impedimento físico de saída; a conclusão liberta a fracção e preserva o histórico do antigo morador.
- **Blocos e apartamentos:** Blocos 01 a 10, fracções 101–502 por bloco como **cadastro provisório** (marcado "Provisório"), com tipologia T2/Duplex
  provisória. O Administrador pode adicionar, renumerar, corrigir a tipologia, desactivar e associar moradores.
- **Visitas:** o Morador regista visitas individuais e em grupo (eventos com lista de convidados). A Portaria apenas consulta e confirma
  entrada/saída de cada pessoa; o histórico fica registado e a autorização original não é alterada. A Portaria não tem o menu Ocorrências.
- **Comunicados:** o Administrador cria, anexa PDF, pré-visualiza, publica, edita e retira de publicação; os moradores visualizam e descarregam.
- **Circulares:** modelo oficial (logótipo, "Administração", "CIRCULAR N.º 05/ADMLR/2026", assunto centrado, lista por bloco,
  "Luanda, aos …", "O Administrador / José Leiria", espaço para assinatura e carimbo). Numeração sequencial anual sem duplicações,
  destinatários por bloco/apartamento, PDF A4 gerado no browser (`src/lib/circular-pdf.ts`). Não reproduz assinaturas nem carimbos.
- **Operações (demo):** o inventário de elevadores (1 por bloco), equipas, actividades e despesas são fictícios e
  configuráveis — `src/data/operations.ts`.
- **Permissões por operação:** `src/config/permissions.ts`. As acções do estado (`src/store/demo-store.ts`) verificam o perfil e lançam
  `PermissionError`; as rotas são protegidas em `src/config/navigation.ts`.

> Os dados de negócio estão na base de dados MySQL e são partilhados entre utilizadores e dispositivos (actualização
> automática em ≤ 15 s). O armazenamento local do navegador já não é usado para dados de negócio; os dados que versões
> anteriores deixaram num navegador podem ser migrados em **Importação de dados** (Administrador).

## Regras de conteúdo

- Só os campos com `confirmed: true` em `src/config/site.ts` e `src/data/public-content.ts` são apresentados
  como factos. Telefones, emails, número de blocos/apartamentos, áreas e preços aparecem como **"Por confirmar"**.
- Comunicados públicos estão marcados como **conteúdo de teste**.
- Todos os dados da área privada são fictícios e estão identificados como demonstração.
- A fotografia `lazer/piscina-e-deck.webp` tem marca de água de terceiros (Angocasa) — substituir pelo original ou confirmar direitos.

## Estrutura do backend

- `prisma/schema.prisma` + `prisma/migrations/` — esquema MySQL/MariaDB e migrações versionadas.
- `src/domain/engine.ts` — regras de negócio e permissões (executadas no servidor com a sessão autenticada).
- `src/server/*` — base de dados, autenticação, operações transaccionais, projecção por perfil, ficheiros, utilizadores, importação.
- `src/app/api/*` — route handlers (`auth`, `state`, `actions`, `files`, `users`, `import`, `health`).
- `scripts/*` — importação, contas iniciais, ligações de activação, verificação e cópia de segurança.
- `tests/*` — testes unitários e de integração da API.
