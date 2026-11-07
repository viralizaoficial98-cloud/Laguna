# Publicação na Hostinger VPS — guia passo a passo

> Este guia descreve os passos; **nenhum passo é executado automaticamente**. Não altera Apache, cPanel, PM2,
> DNS, Exim/Dovecot nem a configuração de email. Execute-os numa janela de manutenção.

## 0. Pré-requisitos

- Node.js 20 ou superior (`node -v`) e `npm`.
- Base de dados `laguna_residenciallaguna` e utilizador `laguna_laguna` criados no cPanel, com **todos os
  privilégios** sobre essa base (as migrações precisam de CREATE, ALTER, INDEX, REFERENCES).
- `mysqldump` disponível para as cópias de segurança.
- Uma pasta para anexos fora da pasta pública, por exemplo `/home/UTILIZADOR/laguna-storage` (permissões 750).

## 1. Variáveis de ambiente

Na pasta da aplicação, crie `.env` a partir de `.env.example` (nunca o envie para o GitHub):

```bash
cp .env.example .env
chmod 600 .env
nano .env    # DATABASE_URL com a palavra-passe do cPanel, APP_URL, STORAGE_DIR
```

## 2. Cópia de segurança (antes de qualquer alteração)

```bash
npm run db:backup                         # backups/laguna-AAAAmmdd-HHMMSS.sql.gz
tar czf ~/laguna-app-$(date +%F).tgz .next package.json   # versão actual da aplicação (para rollback)
```

## 3. Actualizar o código

```bash
git fetch origin claude/sleepy-bardeen-siagoq
git checkout claude/sleepy-bardeen-siagoq
git pull origin claude/sleepy-bardeen-siagoq
npm ci                                    # instala dependências e gera o cliente Prisma
```

## 4. Criar as tabelas (migrações não destrutivas)

```bash
npm run db:status                         # mostra as migrações pendentes
npm run db:migrate                        # prisma migrate deploy — apenas aplica as migrações em falta
```

Nunca usar `prisma migrate reset`, `prisma migrate dev` ou `prisma db push --force-reset` em produção.

Esta versão acrescenta a migração `20261107000000_gestao_completa` (fracções/titulares, fornecedores, declarações,
assinaturas, orçamento, receitas e colunas novas em `expenses`, `payments` e `stored_files`). É **aditiva**: não altera
nem apaga dados existentes. Fazer a cópia de segurança do ponto 2 antes de a aplicar. Testada em MySQL 8 e MariaDB 10.11.

## 5. Importação inicial dos dados

```bash
npm run db:import                         # PRÉ-VISUALIZAÇÃO — não grava nada; relatório em backups/
npm run db:import -- --apply              # insere os registos novos (pode repetir: não duplica)
npm run db:verify                         # contagens, 100 apartamentos, 80 T2 + 20 Duplex, integridade financeira
```

### 5.1 Importação dos ficheiros Excel do condomínio (apenas após autorização)

Fracções/proprietários/inquilinos, mapa de gastos e execução orçamental são importados **pela interface**, não por comando:

1. Fazer `npm run db:backup` (a importação cria também uma cópia JSON automática em `BACKUP_DIR`).
2. Nelson (ou José) abre **Administração → Importação Excel**, selecciona os três ficheiros e carrega em
   *Ler e pré-visualizar* — nada é gravado nesta fase.
3. Rever os separadores Fracções, Despesas e Orçamento: possíveis duplicados de nomes, conflitos com o cadastro actual
   (nomes de proprietário diferentes, ocupantes diferentes), despesas de demonstração do mesmo mês, divergências do orçamento.
   Por omissão **nenhum** dado existente é substituído; só as linhas assinaladas o são.
4. Confirmar e importar. Repetir a importação não duplica registos. O relatório fica em *Importações anteriores*.

Os ficheiros Excel contêm dados pessoais: não os colocar no repositório.

### 5.2 Assinatura do Gestor Operacional

Nelson abre **Administração → Assinatura electrónica**, carrega a imagem PNG (fundo transparente) e indica nome e cargo.
A imagem fica em `STORAGE_DIR` e só é servida ao próprio Nelson; é aplicada a cada declaração apenas quando ele confirma.

## 6. Contas iniciais e activação

```bash
npm run db:seed-users                     # cria as 5 contas, sem palavra-passe (pendentes de activação)
npm run users:activation-link -- jose.leiria@residenciallaguna.ao
```

O comando mostra uma ligação de utilização única (válida 72 h). Entregue-a a José Leiria por um canal seguro;
ao abri-la, ele define a palavra-passe. Depois, José ou Nelson geram as ligações das restantes contas na
**Gestão de Utilizadores** (botão “Redefinir Palavra-passe”). Se configurar `SMTP_*`, as ligações são enviadas por email.

## 7. Compilar e reiniciar

```bash
npm run build
```

Reinicie o processo da aplicação **da forma habitual no servidor** (por exemplo `pm2 restart <nome-da-app>`),
garantindo que o processo lê o ficheiro `.env` da pasta da aplicação. Este guia não altera a configuração do PM2.

## 8. Verificação após a publicação

1. `curl -s https://residenciallaguna.ao/api/health` → `{"ok":true,"database":"ok"}`.
2. Iniciar sessão com cada um dos cinco perfis (após activação) e confirmar menus e dashboards.
3. Abrir o portal em dois computadores: um comprovativo enviado pelo morador aparece ao Nelson e à Saraiva.
4. Reiniciar o processo e confirmar que os dados se mantêm.
5. Nelson: abrir Fracções, Pagamento presencial, Despesas, Orçamento e Declarações; um morador solicita uma declaração,
   Nelson assina-a e o morador descarrega o PDF; o código QR abre `/verificar`.
6. Se algum computador tiver dados das versões anteriores (guardados no navegador), José abre
   **Importação de dados** nesse navegador, pré-visualiza, revê os conflitos e confirma.

## Cópias de segurança regulares

- Base de dados: `npm run db:backup` (agendar diariamente; guardar fora do servidor).
- Cópias JSON automáticas das importações Excel: pasta `BACKUP_DIR` (guardar também fora do servidor).
- Anexos (comprovativos, declarações e assinatura): copiar a pasta `STORAGE_DIR` (ex.: `tar czf laguna-storage-$(date +%F).tgz /home/UTILIZADOR/laguna-storage`).

## Rollback

1. **Aplicação:** voltar ao commit anterior e recompilar:
   ```bash
   git checkout <commit-anterior>
   npm ci && npm run build
   # reiniciar o processo da forma habitual
   ```
2. **Base de dados:** as migrações apenas criam tabelas novas; a versão anterior do portal não as utiliza, pelo que
   não é necessário apagá-las. Se for preciso repor o estado anterior dos dados:
   ```bash
   gunzip -c backups/laguna-AAAAmmdd-HHMMSS.sql.gz | mysql -u laguna_laguna -p laguna_residenciallaguna
   ```
   (repor um backup substitui os dados posteriores — confirmar antes.)
3. **Anexos:** repor a cópia da pasta `STORAGE_DIR`.

## Resolução de problemas

| Sintoma | Causa provável |
|---|---|
| `/api/health` → 503 | `DATABASE_URL` errada, base de dados parada ou palavra-passe com caracteres especiais sem URL-encoding |
| Erro “Tabela app_meta sem a linha de controlo” | migrações não aplicadas — `npm run db:migrate` |
| Ligação de activação com `localhost` | `APP_URL` não definida no `.env` |
| Sessão termina logo após o login em HTTPS | proxy sem `X-Forwarded-*`/cookies — confirmar `APP_URL` com `https://` |
| “O ficheiro não está disponível no armazenamento” | `STORAGE_DIR` diferente do usado no envio, ou pasta sem permissões |
