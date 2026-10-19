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

## Login demonstrativo

| Perfil | Email | Palavra-passe |
|---|---|---|
| Administrador Geral | admin@laguna.demo | DemoLaguna2026 |
| Administrador | administrador@laguna.demo | DemoLaguna2026 |
| Financeiro | financeiro@laguna.demo | DemoLaguna2026 |
| Porteiro | porteiro@laguna.demo | DemoLaguna2026 |
| Morador | morador@laguna.demo | DemoLaguna2026 |

Credenciais exclusivas para demonstração — **não utilizar em produção**. A sessão e os dados ficam no
`localStorage`; o menu de perfil tem a opção **"Repor dados de demonstração"**.

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
- **Quotas trimestrais:** 1.º (Jan–Mar), 2.º (Abr–Jun), 3.º (Jul–Set) e 4.º (Out–Dez) trimestres. Valor em vigor 300 000 Kz por fracção,
  editável em *Quotas trimestrais* (com o dia limite). Estados: Pendente, Em análise, Pago e Em atraso.
- **Blocos e apartamentos:** Blocos 01 a 10, fracções 101–502 por bloco como **cadastro provisório** (marcado "Provisório"), com tipologia
  "Por definir" até validação. Tipologias possíveis: **T2, T3 e T4** (sem T1). O Administrador pode adicionar, renumerar, corrigir a
  tipologia, desactivar e associar moradores.
- **Visitas:** o Morador regista visitas individuais e em grupo (eventos com lista de convidados). A Portaria apenas consulta e confirma
  entrada/saída de cada pessoa; o histórico fica registado e a autorização original não é alterada. A Portaria não tem o menu Ocorrências.
- **Comunicados:** o Administrador cria, anexa PDF, pré-visualiza, publica, edita e retira de publicação; os moradores visualizam e descarregam.
- **Circulares:** modelo oficial (logótipo, "Administração", "CIRCULAR N.º 05/ADMLR/2026", assunto centrado, lista por bloco,
  "Luanda, aos …", "O Administrador / José Leiria", espaço para assinatura e carimbo). Numeração sequencial anual sem duplicações,
  destinatários por bloco/apartamento, PDF A4 gerado no browser (`src/lib/circular-pdf.ts`). Não reproduz assinaturas nem carimbos.
- **Permissões por operação:** `src/config/permissions.ts`. As acções do estado (`src/store/demo-store.ts`) verificam o perfil e lançam
  `PermissionError`; as rotas são protegidas em `src/config/navigation.ts`.

> **Importante:** nesta fase os dados ficam no `localStorage` de cada browser. Uma visita registada pelo morador só aparece na Portaria
> no mesmo browser. A comunicação real entre Morador, Portaria e Administração exige a base de dados e autenticação da Fase 2.

## Regras de conteúdo

- Só os campos com `confirmed: true` em `src/config/site.ts` e `src/data/public-content.ts` são apresentados
  como factos. Telefones, emails, número de blocos/apartamentos, áreas e preços aparecem como **"Por confirmar"**.
- Comunicados públicos estão marcados como **conteúdo de teste**.
- Todos os dados da área privada são fictícios e estão identificados como demonstração.
- A fotografia `lazer/piscina-e-deck.webp` tem marca de água de terceiros (Angocasa) — substituir pelo original ou confirmar direitos.

## Preparação para a Fase 2 (MySQL + Prisma)

- `src/types/index.ts` espelha o futuro esquema (Apartment, Resident, Quota trimestral, Payment, Circular, Visit, VisitCheck, InternalNotice com PDF…).
- A matriz `src/config/permissions.ts` deve ser replicada no servidor (as verificações no browser não substituem a validação no backend).
- `src/services/*` expõe funções assíncronas — substituir a implementação por chamadas à API.
- `src/store/demo-store.ts` concentra as mutações (criar/editar/aprovar); cada acção corresponde a um endpoint futuro.
- `src/services/auth.service.ts` → substituir por autenticação real com sessões no servidor e palavras-passe com hash.
- Uploads de comprovativos são hoje pré-visualizados localmente (`FileReader`) — passar a upload para armazenamento seguro.
- Permissões por perfil em `src/config/navigation.ts` (`roles`) — replicar a verificação no servidor.
