# Projeto Cecília — 15 Anos

Convite digital com RSVP por **convite / família**.

## Dados oficiais do evento

| Item | Valor |
|---|---|
| Data | **20 de março de 2027** (20/03/2027) |
| Horário | **22h00** |
| Local | **Villa Jardim** |
| Referência do local | https://www.instagram.com/villajardimdiv?srtk=czJlMmlwM2p0NTRq |

> Estes dados são os definitivos. Informações antigas (Rotary Clube, 19/09/2026, outros horários) devem ser desconsideradas.

## Estrutura do projeto

- `index.html`, `splash.css`, `splash.js` — splash screen (repassa o `?token=` para o convite).
- `convite.html`, `convite.css`, `convite.js` — convite e seção de RSVP por família.
- `Imagens/`, `video/` — mídias do convite.
- `backend/` — API RSVP em Node.js + Express 5 + PostgreSQL (Neon).

## Backend

A documentação completa está em [`backend/README.md`](backend/README.md).

Resumo:

```bash
cd backend
npm install
npm run dev      # desenvolvimento
npm test         # testes isolados, sem acessar o Neon
npm start        # produção
```

Banco de dados (sempre com confirmação explícita):

```bash
npm run migrate -- --confirm   # aplica as migrações pendentes
npm run seed -- --confirm      # cadastra os 39 convites e gera os links
```

- `migrate` usa `DIRECT_URL` (conexão direta) e cai para `DATABASE_URL` se ela não existir.
- `seed` só insere se `public.convites` e `public.convidados` estiverem vazias, respeitando o teto de 100 pessoas.
- Os links gerados ficam em `backend/saida-links-convidados.csv`, que contém tokens e **é ignorado pelo Git**.

Rotas:

- `GET /api/health`
- `GET /api/convite/:token`
- `POST /api/convite/:token/rsvp`
- `PATCH /api/convite/:token/membros/:membroId`
- `POST /api/convite/:token/membros`

## Convite e RSVP

- Cada convite/família recebe um link exclusivo: `convite.html?token=...` (ou `/?token=...`).
- O token é lido do `window.location.search` (`?token=` ou `?t=`) e usado na API REST.
- O responsável confirma ou recusa a família; cada familiar pode ser confirmado ou removido individualmente.
- Convites confirmados podem adicionar convidados extras enquanto houver vagas no teto de 100.
- A URL da API fica em `API_BASE_URL` no topo de `convite.js` (`http://localhost:3000` em desenvolvimento).

## Situação atual

- ✅ Backend refatorado para 39 convites / 91 pessoas (9 vagas livres no teto de 100).
- ✅ Migração `002_convites_familia.sql` criada e idempotente.
- ✅ API com consulta por família, RSVP do responsável, familiares individuais e convidados extras.
- ✅ Frontend integrado, com identidade visual dourada/azul-marinho.
- ✅ 33 testes automatizados (100% de aprovação, sem acessar o banco real).
- ⏳ Deploy no Render/Netlify pendente: configurar `API_BASE_URL` em `convite.js`, `DATABASE_URL`/`DIRECT_URL` e `FRONTEND_URL` no backend.
