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

## 5. Importação inicial dos dados

```bash
npm run db:import                         # PRÉ-VISUALIZAÇÃO — não grava nada; relatório em backups/
npm run db:import -- --apply              # insere os registos novos (pode repetir: não duplica)
npm run db:verify                         # contagens, 100 apartamentos, 80 T2 + 20 Duplex, integridade financeira
```

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
5. Se algum computador tiver dados das versões anteriores (guardados no navegador), José abre
   **Importação de dados** nesse navegador, pré-visualiza, revê os conflitos e confirma.

## Cópias de segurança regulares

- Base de dados: `npm run db:backup` (agendar diariamente; guardar fora do servidor).
- Anexos: copiar a pasta `STORAGE_DIR` (ex.: `tar czf laguna-storage-$(date +%F).tgz /home/UTILIZADOR/laguna-storage`).

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
