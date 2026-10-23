# Portal Residencial Laguna — Fase 1 (Frontend)

Portal institucional e plataforma de gestão do condomínio **Residencial Laguna** (Talatona, Luanda, Angola).

> **Fase 1 — apenas frontend.** Login de testes e dados demonstrativos guardados no browser.
> Não existe base de dados, API ou autenticação real nesta fase.

## Tecnologias

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Recharts · React Hook Form · Zod · Zustand · Lucide · Sonner

## Executar

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run build && npm start
```

## Login demonstrativo (5 perfis)

| Nome | Email (identificador de demonstração) | Perfil |
|---|---|---|
| José Leiria | jose.leiria@residenciallaguna.ao | Administrador do Condomínio |
| Nelson Rodrigues | nelson.rodrigues@residenciallaguna.ao | Gestor Operacional |
| Saraiva | saraiva@residenciallaguna.ao | Gestor Financeiro do Condomínio |
| Manuel Muenho | manuel.muenho@residenciallaguna.ao | Morador (Bloco 06 · 201) |
| Portaria Laguna | portaria@residenciallaguna.ao | Portaria |

Palavra-passe de demonstração: `DemoLaguna2026`. Os emails são apenas identificadores de acesso — não se assume a existência
de caixas de correio reais. Credenciais exclusivas da demo; não utilizar em produção.

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
    login/           Login demonstrativo
    painel/          Área privada (dashboards e módulos por perfil)
  components/
    ui/              Componentes base reutilizáveis (botões, tabelas, modais, formulários…)
    site/            Componentes do portal público (header, hero, galeria/lightbox…)
    app/             Shell do painel, dashboards e widgets
    charts/          Gráficos (Recharts) com paleta validada
  config/            site.ts (dados institucionais), navigation.ts (menus e permissões por perfil)
  data/              Dados mockados (separados da interface)
  services/          Camada de serviços (hoje local; amanhã API)
  store/             Estado demonstrativo (Zustand + localStorage)
  hooks/ lib/ types/
public/images/
  laguna/fachadas | lazer | areas-exteriores   Fotografias reais optimizadas (WebP)
  brand/                                        Logótipo (cor e branco)
```

## Regras de funcionamento (Fase 1.1)

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

> **Importante:** nesta fase os dados ficam no `localStorage` de cada browser. Um comprovativo, reserva ou pedido de desocupação
> submetido pelo morador só aparece para Nelson, Saraiva, José ou a Portaria **no mesmo browser**. A sincronização entre utilizadores e
> dispositivos, a exclusividade real das reservas, as notificações e a decisão única sobre comprovativos exigem a base de dados
> partilhada (PostgreSQL) e a autenticação da Fase 2.

## Regras de conteúdo

- Só os campos com `confirmed: true` em `src/config/site.ts` e `src/data/public-content.ts` são apresentados
  como factos. Telefones, emails, número de blocos/apartamentos, áreas e preços aparecem como **"Por confirmar"**.
- Comunicados públicos estão marcados como **conteúdo de teste**.
- Todos os dados da área privada são fictícios e estão identificados como demonstração.
- A fotografia `lazer/piscina-e-deck.webp` tem marca de água de terceiros (Angocasa) — substituir pelo original ou confirmar direitos.

## Preparação para a Fase 2 (base de dados partilhada — PostgreSQL)

- `src/types/index.ts` espelha o futuro esquema (Apartment, Resident, Occupancy, Quota, Payment, Charge, Expense, Hall, Reservation,
  MoveOut, AuditEntry, Circular, Visit, VisitCheck, InternalNotice com PDF…).
- Restrições a garantir na base de dados: `UNIQUE(apartment_id, period)` nas quotas; índice único parcial em reservas
  `(hall_id, date) WHERE status IN ('pendente_pagamento','em_validacao','confirmada')`; decisão de comprovativo por
  `UPDATE … WHERE status = 'em_analise'` (concorrência); um processo de desocupação activo por morador.
- Cálculo da conta corrente: `src/lib/account.ts` (função pura, reutilizável no servidor).
- A matriz `src/config/permissions.ts` deve ser replicada no servidor (as verificações no browser não substituem a validação no backend).
- `src/services/*` expõe funções assíncronas — substituir a implementação por chamadas à API.
- `src/store/demo-store.ts` concentra as mutações (criar/editar/aprovar); cada acção corresponde a um endpoint futuro.
- `src/services/auth.service.ts` → substituir por autenticação real com sessões no servidor e palavras-passe com hash.
- Uploads de comprovativos são hoje pré-visualizados localmente (`FileReader`) — passar a upload para armazenamento seguro.
- Permissões por perfil em `src/config/navigation.ts` (`roles`) — replicar a verificação no servidor.
