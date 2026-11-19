# Backend — Convite Cecília 15 Anos

API RSVP em **Node.js + Express 5 + PostgreSQL (Neon)**.

## Dados oficiais do evento

Estes são os dados definitivos e substituem qualquer informação anterior:

| Item | Valor |
|---|---|
| Data | **20 de março de 2027** (20/03/2027) |
| Horário | **22h00** |
| Local | **Villa Jardim** |
| Referência do local | https://www.instagram.com/villajardimdiv?srtk=czJlMmlwM2p0NTRq |

> ⚠️ Informações antigas (Rotary Clube, 19/09/2026, outros horários) **não devem ser usadas**.

## Regras do RSVP

- **Teto máximo de 100 convidados**; a lista oficial atual tem **91 nomes** (9 vagas livres).
- **Sem acompanhantes**, sem telefone e sem cadastro público.
- Cada convidado recebe um **link exclusivo** com token aleatório.
- Estados possíveis: `pendente`, `confirmado`, `recusado`.
- O convidado pode **alterar a resposta** quantas vezes quiser usando o mesmo link.

## Estrutura

```text
backend/
├── index.js                         # bootstrap do servidor
├── db.js                            # pool PostgreSQL existente
├── data/
│   └── convidados-oficiais.json     # lista oficial (91 nomes, ordem fixa)
├── src/
│   ├── app.js                       # fábrica do app Express
│   ├── middleware/
│   │   ├── naoEncontrado.js         # 404 padronizado
│   │   └── tratarErros.js           # tratamento centralizado de erros
│   ├── rotas/
│   │   ├── health.js                # GET /api/health
│   │   └── convite.js               # GET/POST do convite
│   ├── servicos/
│   │   └── convidados.js            # SQL parametrizado
│   ├── utils/
│   │   ├── httpError.js             # erro HTTP controlado
│   │   └── token.js                 # geração/validação de token
│   └── validacoes/
│       └── convite.js               # validação de token e status
├── migrations/
│   └── 001_convidados_timestamptz.sql
├── scripts/
│   ├── migrate.js                   # executor controlado de migrações
│   └── seed-convidados.js           # cadastro controlado dos convidados
├── test/                            # testes com node:test + Supertest
├── .env.example
└── package.json
```

## Requisitos

- **Node.js >= 20** (testado com Node 24)
- PostgreSQL (Neon ou outro provedor)

## Instalação

```bash
cd backend
npm install
```

## Configuração do ambiente

Copie o exemplo e preencha os valores reais:

```bash
cp .env.example .env
```

Variáveis:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão PostgreSQL **pooled** (host com `-pooler`). Usada pela aplicação. Obrigatória. |
| `DIRECT_URL` | String de conexão **direta** (host sem `-pooler`). Usada por `migrate` e `seed`; se ausente, cai para `DATABASE_URL`. |
| `PORT` | Porta HTTP. Padrão: `3000`. |
| `FRONTEND_URL` | Origem(n) liberada(s) no CORS. Várias origens separadas por vírgula. Em produção é obrigatória. |
| `SITE_URL` | Base dos links gerados no CSV do seed. Padrão: `https://convite-cecilia.netlify.app`. |
| `NODE_ENV` | `development`, `production` ou `test`. |

> O `.env` está no `.gitignore` e **nunca deve ser commitado**. O `.env.example` contém apenas valores fictícios.

## Executar localmente

```bash
npm run dev     # reinicialização automática (node --watch)
# ou
npm start       # execução normal
```

Health check:

```bash
curl http://localhost:3000/api/health
```

## Rotas

### `GET /api/health`

Verifica o servidor e o acesso ao banco.

- `200`: servidor e banco OK
- `503`: banco indisponível

```json
{
  "ok": true,
  "data": { "status": "ok", "banco": "ok", "horario": "2027-03-20T01:00:00.000Z" }
}
```

### `GET /api/convite/:token`

Busca o convidado pelo token e retorna **somente nome e status**.

- `200`: encontrado
- `404`: token inexistente ou malformado

```json
{
  "ok": true,
  "data": { "nome": "Maria Silva", "status": "pendente" }
}
```

### `POST /api/convite/:token/rsvp`

Aceita **somente**:

```json
{ "status": "confirmado" }
```

ou

```json
{ "status": "recusado" }
```

Atualiza `status`, `respondido_em` e `atualizado_em`, permitindo alteração posterior.
Retorna o nome e o novo status.

- `200`: resposta registrada
- `400`: JSON inválido, campo extra ou status inválido
- `404`: token inexistente
- `413`: corpo acima do limite

## Formato padronizado das respostas

Sucesso:

```json
{ "ok": true, "data": { } }
```

Erro:

```json
{
  "ok": false,
  "erro": {
    "codigo": "STATUS_INVALIDO",
    "mensagem": "O status deve ser \"confirmado\" ou \"recusado\"."
  }
}
```

Códigos de erro: `TOKEN_NAO_ENCONTRADO`, `STATUS_INVALIDO`, `DADOS_INVALIDOS`, `JSON_INVALIDO`, `CORPO_MUITO_GRANDE`, `ROTA_NAO_ENCONTRADA`, `BANCO_INDISPONIVEL`, `MUITAS_REQUISICOES`, `ERRO_INTERNO`.

## Migração do banco

A migração é **idempotente e não destrutiva**:

- cria a tabela somente se ela não existir;
- preserva os dados existentes;
- converte `respondido_em`, `criado_em` e `atualizado_em` para `TIMESTAMPTZ`;
- reforça defaults e `NOT NULL` de `criado_em`/`atualizado_em`;
- cria trigger que atualiza `atualizado_em` a cada `UPDATE`;
- registra a aplicação em `schema_migrations`.

A execução exige confirmação explícita:

```bash
npm run migrate -- --confirm
```

Sem `--confirm`, o script não conecta nem altera nada. O executor usa transação por arquivo e advisory lock para evitar execução concorrente. A conexão prioriza `DIRECT_URL` (recomendada para DDL) e usa `DATABASE_URL` como fallback; o log informa qual foi usada e mostra apenas host e nome do banco, nunca a credencial.

> Antes de aplicar em produção, faça backup/verifique o banco alvo.

## Cadastro dos convidados (seed)

A lista oficial fica em `data/convidados-oficiais.json` (91 nomes, na ordem do convite, com repetições preservadas).

```bash
npm run seed -- --confirm
```

Garantias do script:

- exige `--confirm`; sem ele, nada é executado;
- valida a lista antes de conectar (mínimo 1, máximo 100 itens);
- **não insere nada** se `public.convidados` já tiver registros, informando quantos existem;
- abre transação, insere um convidado por vez com token novo de 43 caracteres e faz `COMMIT` (ou `ROLLBACK` em erro);
- usa `DIRECT_URL` e cai para `DATABASE_URL` se necessário.

Após o `COMMIT`, gera localmente `saida-links-convidados.csv` (UTF-8 com BOM, separador `;`, colunas `Numero;ID;Nome;Status;Token;Link`). A base do link é `SITE_URL` (`${SITE_URL}/convite.html?token=...`).

> O CSV contém tokens válidos e **é ignorado pelo Git** (`saida-links-convidados.*`). Guarde-o localmente e não o compartilhe.

Estado atual do banco: **91 convidados**, IDs de `1` a `91`, todos `pendente` — 9 vagas livres até o teto de 100.

## Testes

```bash
npm test
```

- Usa `node:test` + Supertest.
- O pool do PostgreSQL é **substituído por um fake em memória**.
- Os testes **não abrem conexão com o Neon** e não alteram dados de produção.

Cobertura atual:

- health check (sucesso e falha do banco);
- consulta com token válido, inválido e malformado;
- confirmação e recusa;
- alteração de confirmação → recusa e recusa → confirmação;
- status inválido, campo extra, corpo vazio e JSON inválido;
- atualização de `respondido_em`/`atualizado_em`;
- SQL parametrizado;
- CORS (origem permitida, negada e preflight);
- geração e formato dos tokens.

## Segurança

- Tokens gerados com `crypto.randomBytes(32)` em **base64url** (43 caracteres), nunca IDs sequenciais.
- Consultas SQL sempre parametrizadas.
- Tokens não são registrados em logs; erros registram apenas o padrão da rota.
- CORS restrito a `FRONTEND_URL`.
- `helmet` e `express-rate-limit` habilitados.
- Corpo JSON limitado a 10 KB.
- Credenciais somente em variáveis de ambiente.
- Links/tokens gerados localmente ficam fora do controle de versão.

## Pendências (deploy)

1. Configurar `FRONTEND_URL` no backend (origem do site no Netlify) e `DATABASE_URL`/`DIRECT_URL` no Render.
2. Trocar `API_BASE_URL` em `convite.js` pela URL real do backend.
3. Definir política de expiração/prazo de RSVP, se desejado.
