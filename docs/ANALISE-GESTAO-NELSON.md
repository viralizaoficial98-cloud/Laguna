# Fase 1 — Análise: gestão administrativa, financeira e operacional (Nelson Rodrigues)

## Estado actual (código e base de dados)

- Next.js 16 + Prisma 7 + MySQL/MariaDB; 34 tabelas; regras de negócio em `src/domain/engine.ts` executadas no servidor.
- Base de dados com 1.735 registos iniciais (100 apartamentos, 92 moradores de **demonstração**, 500 quotas, 430 pagamentos,
  78 despesas de demonstração, …).
- Já existe: registo de pagamento pelo Gestor Financeiro (`registerPayment`, aprovado de imediato), validação de comprovativos,
  recibos PDF, contas correntes, despesas simples (data, categoria, descrição, valor), Gestão de Utilizadores, importação de
  dados do navegador, auditoria (`audit_entries`, `action_log`, `user_audit_log`).
- Não existe: proprietários/inquilinos separados do morador, fornecedores, IVA/retenções, orçamento, receitas manuais,
  declarações, assinatura, importação de Excel, auditoria consultável.

## Ficheiros Excel (lidos integralmente)

### Fracções_Proprietarios e Inquilinos.xlsx — 1 folha, 100 linhas (Fracção | Nome | Nome Fiscal)
- Correcção do cliente: **Nome = proprietário**, **Nome Fiscal = inquilino**.
- 100 fracções únicas no formato `BB-NNN` (01-101 … 10-502) — coincidem com os 100 apartamentos existentes.
- 68 proprietários distintos (ex.: Fauchil, S.A.R.L — 9 fracções; Consus Imobiliária — 9; Paulino Jerónimo — 6) e 73 inquilinos distintos.
- 16 fracções com Nome Fiscal igual ao Nome (proprietário ocupante) → **sem inquilino** (campo vazio, nada é inventado).
- 18 valores com espaços ou quebras de linha (ex.: "Fauchil, S.A.R.L ", "Ethan e Haniel\n") → normalizados, original preservado.
- Grafias diferentes da mesma entidade (ex.: "Prefangol, Lda" / "Prefangol,Lda"; "Robert Hudson,Lda" / "Robert Hudson, Lda";
  "GRUPO AUTOSTAR, S.A" / "Grupo Autostar, SA") → unificadas pela forma normalizada.
- Possíveis duplicados a **validar** (não fundidos automaticamente): "Fernando Tavares" / "FERNANDO TAVARES-CONSULTORIA(SU),Lda",
  "Maria do Carmo" / "Maria do Carmo Bastos Corte Real Bernardo", "Patrimóvel" / "Patrimóvel - Consultoria e Gestão Imobiliária, Lda",
  "Ethan e Haniel" / "Hethan e Haniel,Lda", "José Saraiva" / "José Manuel Saraiva Augusto".
- Conflito com a base de dados: os 92 moradores e os nomes de proprietário existentes são de demonstração e diferem do ficheiro.
  **Decisão explícita por fracção**: actualizar o proprietário do cadastro; substituir o ocupante (o anterior fica inactivo, com
  histórico). Contas de utilizador associadas (ex.: Manuel Muenho, 06-201) nunca são substituídas automaticamente.

### Mapa de gastos Setembro 2026.xlsx — 3 folhas (cabeçalho, tabela de 24 lançamentos, assinatura)
- Valores em texto ("1 080 000,00 Kz", "- Kz") → convertidos para DECIMAL; o texto original é guardado.
- Totais do ficheiro reconciliam exactamente: Valor 5.118.358,53 · IVA 167.485,71 · Retenção 215.175,61 · Líquido 5.070.668,63;
  em todas as linhas Valor + IVA − Retenção = Líquido.
- 15 fornecedores; NIF "S/N" em 5 linhas (Estado/AGT, pessoas) → NIF vazio, identificados pelo nome.
- Possível duplicado a validar: linhas 4 e 5 (Auto Beloul, mesma data e valor, referências FR ATB2026/791 e /792).
- Duas facturas de manutenção de elevador de 1.080.000 Kz (FA.2026/141 de Agosto e FA.2026/164) — referências diferentes, não duplicadas.
- Linha 20 tem como beneficiário "Nelson Rodrigues" (compra de materiais) — importada como está.
- Sem rubrica orçamental no ficheiro → rubrica **sugerida** por palavras-chave, a confirmar na pré-visualização.

### 02 Execução Orçamental - Ano 2026.xlsx — 1 folha (rubricas, valor ano/mês, execução por trimestre, saldo)
- Orçamento de 156.660.000 Kz (receitas = despesas correntes); valores mensais = anual ÷ 12.
- Receitas executadas: T1 35.780.956 · T2 36.871.978 · T3 37.140.000 · T4 0 (total 109.792.934).
- Despesas: todas as rubricas de despesa têm execução **0** no ficheiro (a execução real de despesas virá do sistema).
- Divergências a reportar (o sistema não altera os valores de origem):
  1. "Serviços de interesse comum" e "Recolha de lixo" mostram "por executar" = 0 em vez de 66.200.000 e 2.000.000 (fórmula do ficheiro).
  2. "Recuperação de rendas vencidas": orçamento 0,000001 (≈ 0) mas 1.000.000 executados → acima do orçamento.
  3. Fundo comum de reserva: os 14.400.000 estão incluídos nas quotas (10 %) e repetidos em "Constituição de fundos financeiros";
     o ficheiro não os deduz ao saldo. O sistema mostra-os uma única vez (subtotais calculados só a partir das rubricas-folha).
  4. Artefactos de vírgula flutuante (156660000,000001; 1,0e-06) → arredondados a 2 casas, valor original guardado.
  5. Colunas auxiliares (ÁGUA, ELECT, MAN S, PESS, …) e "DISPONIBILIDADES EM CAIXA E BANCOS" (−11.981.511 inicial;
     23.799.445 / 60.671.423 / 97.811.423 / 97.811.423) → guardadas como informação de origem, não como rubricas.

## Plano técnico

1. **Permissões** — matriz central (`src/config/permissions.ts`) com o Gestor Operacional com acesso de gestão completo
   (excepto contas de administração/financeiro); validação no servidor em todas as operações; auditoria inalterável.
2. **Modelo de dados (migração incremental, não destrutiva)** — `parties`, `fraction_holders` (proprietário/inquilino com
   histórico, um activo por papel), `suppliers`, colunas novas em `expenses` (fornecedor, NIF, factura, IVA, retenção, líquido,
   rubrica, centro de custo, estado, pagamentos, anexos, histórico, origem) e `payments` (canal, chave anti-duplicação),
   `budgets`, `budget_lines`, `budget_executions`, `revenues`, `declaration_types`, `declarations`, `signatures`.
3. **Serviços/API** — fracções (ficha completa), titulares, pagamento presencial (comprovativo facultativo, parcial, sem duplicação),
   despesas/fornecedores, orçamento e execução (previsto/realizado/desvios, separando orçamento, histórico do ficheiro e
   movimentos do sistema), receitas, declarações (pedido → análise → assinatura → PDF com QR → disponível ao morador),
   assinatura privada, auditoria, importação Excel (pré-visualização, decisões, cópia de segurança, relatório).
4. **Frontend** — menus do Nelson reorganizados; fichas e tabelas com filtros; dashboard alargado; "Solicitar Declaração" no morador.
5. **Testes** — permissões, importação, declarações, pagamentos presenciais, integridade financeira, persistência, 5 perfis.
