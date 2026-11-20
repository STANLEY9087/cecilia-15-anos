# Backend — Convite Cecília 15 Anos

API RSVP em **Node.js + Express 5 + PostgreSQL (Neon)**, organizada por
**convite / família**.

## Dados oficiais do evento

| Item | Valor |
|---|---|
| Data | **20 de março de 2027** (20/03/2027) |
| Horário | **22h00** |
| Local | **Villa Jardim** |
| Referência do local | https://www.instagram.com/villajardimdiv?srtk=czJlMmlwM2p0NTRq |

> ⚠️ Informações antigas (Rotary Clube, 19/09/2026, outros horários) **não devem ser usadas**.

## Regras do RSVP

- **Teto máximo de 100 pessoas**; os convites oficiais somam **91 pessoas** (9 vagas livres).
- **39 convites** agrupam as 91 pessoas. Cada convite tem um **responsável** e seus **familiares**.
- Cada convite recebe um **link exclusivo** com token aleatório (`crypto.randomBytes(32)` em base64url).
- Estados possíveis: `pendente`, `confirmado`, `recusado`.
- O responsável pode alterar a resposta do convite quantas vezes quiser usando o mesmo link.
- Ao recusar o convite, todos os familiares são marcados como `recusado`.
- Familiares podem ser confirmados/removidos individualmente.
- Um convite confirmado pode adicionar convidados extras enquanto houver vagas no teto de 100.

## Estrutura

```text
backend/
├── index.js                         # bootstrap do servidor
├── db.js                            # pool PostgreSQL existente
├── data/
│   └── convidados-oficiais.json     # 39 convites (91 pessoas)
├── src/
│   ├── app.js                       # fábrica do app Express
│   ├── middleware/
│   │   ├── naoEncontrado.js         # 404 padronizado
│   │   └── tratarErros.js           # tratamento centralizado de erros
│   ├── rotas/
│   │   ├── health.js                # GET /api/health
│   │   └── convite.js               # rotas do convite/família
│   ├── servicos/
│   │   └── convidados.js            # SQL parametrizado + transações
│   ├── utils/
│   │   ├── httpError.js             # erro HTTP controlado
│   │   └── token.js                 # geração/validação de token
│   └── validacoes/
│       └── convite.js               # validação de token, status e nome
├── migrations/
│   ├── 001_convidados_timestamptz.sql
│   └── 002_convites_familia.sql
├── scripts/
│   ├── migrate.js                   # executor controlado de migrações
│   └── seed-convidados.js           # cadastro controlado dos convites
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
| `FRONTEND_URL` | Origem(n) liberada(s) no CORS. Também é a base dos links gerados no CSV. Várias origens separadas por vírgula. Em produção é obrigatória. |
| `SITE_URL` | Fallback da base dos links caso `FRONTEND_URL` não esteja definida. |
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

Retorna o convite, seus familiares e as vagas restantes na festa.

```json
{
  "ok": true,
  "data": {
    "id": 4,
    "titulo": "Dani & família",
    "responsavel_nome": "Dani",
    "status": "pendente",
    "respondido_em": null,
    "membros": [
      { "id": 16, "nome": "Gustavo", "status": "pendente", "eh_extra": false }
    ],
    "vagas_disponiveis": 9
  }
}
```

- `membros`: todos os `convidados` do convite com `eh_responsavel = false`
  (o responsável **não** aparece nessa lista).
- `vagas_disponiveis`: `100 - COUNT(*)` de `convidados` com `status != 'recusado'`.
- `404`: token inexistente ou malformado.

### `POST /api/convite/:token/rsvp`

Aceita **somente**:

```json
{ "status": "confirmado" }
```

ou

```json
{ "status": "recusado" }
```

Atualiza o convite e o responsável (`eh_responsavel = true`). Se o status for
`recusado`, **todos os familiares também são marcados como `recusado`**.
Retorna o convite atualizado com seus membros.

- `200`: resposta registrada
- `400`: JSON inválido, campo extra ou status inválido
- `404`: token inexistente
- `413`: corpo acima do limite

### `PATCH /api/convite/:token/membros/:membroId`

Confirma ou remove um familiar individualmente.

```json
{ "status": "confirmado" }
```

- `200`: familiar atualizado; retorna o convite completo
- `400`: status ou identificador inválido
- `404`: token inexistente ou familiar que não pertence ao convite (`MEMBRO_NAO_ENCONTRADO`)

### `POST /api/convite/:token/membros`

Adiciona um convidado extra ao convite.

```json
{ "nome": "Maria" }
```

Regras:

- o convite precisa estar `confirmado`;
- o total de convidados ativos no banco (`status != 'recusado'`) deve ser menor que 100;
- o novo registro é criado com `eh_responsavel = false`, `eh_extra = true` e `status = 'confirmado'`.

- `201`: convidado criado (retorna `id`, `nome`, `status`, `eh_extra`)
- `400`: nome vazio, longo demais, tipo inválido ou campo extra
- `404`: token inexistente
- `409`: `CONVITE_NAO_CONFIRMADO` ou `LIMITE_ATINGIDO`

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

Códigos de erro: `TOKEN_NAO_ENCONTRADO`, `MEMBRO_NAO_ENCONTRADO`,
`MEMBRO_INVALIDO`, `STATUS_INVALIDO`, `NOME_INVALIDO`, `DADOS_INVALIDOS`,
`CONVITE_NAO_CONFIRMADO`, `LIMITE_ATINGIDO`, `JSON_INVALIDO`,
`CORPO_MUITO_GRANDE`, `ROTA_NAO_ENCONTRADA`, `BANCO_INDISPONIVEL`,
`MUITAS_REQUISICOES`, `ERRO_INTERNO`.

## Migrações do banco

As migrações são **idempotentes** e registradas em `schema_migrations`.

A migração `002_convites_familia.sql`:

- cria `public.convites` (título, responsável, token único, status, `respondido_em`);
- adapta `public.convidados` para o novo modelo (`convite_id`, `eh_responsavel`, `eh_extra`);
- preserva os dados do modelo antigo em `public.convidados_legado`;
- cria índices de apoio, incluindo no máximo um responsável por convite.

Execução (sempre com confirmação explícita):

```bash
npm run migrate -- --confirm
```

Sem `--confirm`, o script não conecta nem altera nada. O executor aplica os
arquivos `NNN_*.sql` em ordem, um por transação, com advisory lock. A conexão
prioriza `DIRECT_URL` (recomendada para DDL) e usa `DATABASE_URL` como fallback;
o log informa apenas host e nome do banco, nunca a credencial.

> Antes de aplicar em produção, faça backup/verifique o banco alvo.

## Cadastro dos convites (seed)

Os 39 convites oficiais ficam em `data/convidados-oficiais.json`, no formato:

```json
{
  "titulo": "Flávia & família",
  "responsavel": "Flávia",
  "membros": ["Cecília", "André", "Ana", "Stanley", "Benício"]
}
```

O responsável **não** é repetido em `membros`; a soma é sempre
`1 + membros.length`.

```bash
npm run seed -- --confirm
```

Garantias do script:

- exige `--confirm`; sem ele, nada é executado;
- valida todos os convites antes de conectar;
- **não insere nada** se `public.convites` ou `public.convidados` já tiverem registros;
- abre transação, insere os convites, o responsável e os familiares, e faz `COMMIT` (ou `ROLLBACK` em erro);
- respeita o teto de 100 pessoas;
- usa `DIRECT_URL` e cai para `DATABASE_URL` se necessário.

Após o `COMMIT`, gera localmente `saida-links-convidados.csv` (UTF-8 com BOM,
separador `;`, colunas `id;titulo;responsavel;qtd_pessoas;status;link`). O link
é montado como `${FRONTEND_URL}/?token=...` (com fallback para `SITE_URL`).

> O CSV contém tokens válidos e **é ignorado pelo Git** (`saida-links-convidados.*`). Guarde-o localmente e não o compartilhe.

## Testes

```bash
npm test
```

- Usa `node:test` + Supertest.
- O pool do PostgreSQL é **substituído por um fake em memória**.
- Os testes **não abrem conexão com o Neon** e não alteram dados de produção.

Cobertura atual:

- integridade dos dados oficiais (39 convites / 91 pessoas);
- health check (sucesso e falha do banco);
- consulta do convite com familiares e vagas disponíveis;
- token válido, inválido e malformado;
- confirmação/recusa do responsável e efeito em toda a família;
- confirmação/remoção individual de familiar;
- bloqueio de familiar de outro convite;
- adição de convidado extra;
- bloqueio de convidado extra com convite pendente e ao atingir 100 pessoas;
- validações de status, nome, campos extras e JSON inválido;
- timestamps (`respondido_em`);
- SQL parametrizado;
- CORS (origem permitida, negada e preflight);
- geração e formato dos tokens.

## Segurança

- Tokens gerados com `crypto.randomBytes(32)` em **base64url** (43 caracteres), nunca IDs sequenciais.
- Consultas SQL sempre parametrizadas.
- Tokens não são registrados em logs; erros registram apenas o padrão da rota.
- CORS restrito a `FRONTEND_URL` e com suporte a `GET`, `POST` e `PATCH`.
- `helmet` e `express-rate-limit` habilitados.
- Corpo JSON limitado a 10 KB.
- Adição de convidados extras serializada por advisory lock para respeitar o teto de 100.
- Credenciais somente em variáveis de ambiente.
- Links/tokens gerados localmente ficam fora do controle de versão.

## Pendências (deploy)

1. Configurar `FRONTEND_URL` no backend (origem do site no Netlify) e `DATABASE_URL`/`DIRECT_URL` no Render.
2. Trocar `API_BASE_URL` em `convite.js` pela URL real do backend.
3. Definir política de expiração/prazo de RSVP, se desejado.
