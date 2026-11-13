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
>
> O frontend (`convite.html`, `convite.js` e demais arquivos) **ainda contém os dados antigos** e deverá ser atualizado em uma etapa posterior. Nesta etapa o frontend não foi alterado.

## Regras do RSVP

- **92 convidados individuais**.
- **Sem acompanhantes**, sem telefone e sem cadastro público.
- Cada convidado recebe um **link exclusivo** com token aleatório.
- Estados possíveis: `pendente`, `confirmado`, `recusado`.
- O convidado pode **alterar a resposta** quantas vezes quiser usando o mesmo link.

## Estrutura

```text
backend/
├── index.js                         # bootstrap do servidor
├── db.js                            # pool PostgreSQL existente
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
│   └── migrate.js                   # executor controlado de migrações
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
| `DATABASE_URL` | String de conexão PostgreSQL. Obrigatória. |
| `PORT` | Porta HTTP. Padrão: `3000`. |
| `FRONTEND_URL` | Origem(n) liberada(s) no CORS. Várias origens separadas por vírgula. Em produção é obrigatória. |
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

**Nenhuma migração foi executada no Neon durante esta implementação.** A execução exige confirmação explícita:

```bash
npm run migrate -- --confirm
```

Sem `--confirm`, o script não conecta nem altera nada. O executor usa transação por arquivo e advisory lock para evitar execução concorrente.

> Antes de aplicar em produção, faça backup/verifique o banco alvo. O comando imprime apenas host e nome do banco, nunca a credencial.

> O arquivo legado `criar-tabelas.js` foi mantido, mas o caminho oficial de evolução do schema é `npm run migrate`.

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

## Pendências (fora desta etapa)

1. Aplicar a migração no banco de forma controlada.
2. Cadastrar os **92 convidados** e gerar os tokens/links definitivos.
3. Atualizar o frontend com os dados oficiais (Villa Jardim, 20/03/2027, 22h00) e trocar o endpoint do Apps Script pela API.
4. Configurar deploy no Render e no Netlify (`FRONTEND_URL`, `DATABASE_URL`, `PORT`).
5. Definir política de expiração/prazo de RSVP, se desejado.
