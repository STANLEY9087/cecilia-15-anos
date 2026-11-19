# Projeto Cecília — 15 Anos

Convite digital com RSVP individual.

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
- `convite.html`, `convite.css`, `convite.js` — convite e seção de RSVP.
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
npm run seed -- --confirm      # cadastra os convidados oficiais e gera os links
```

- `migrate` usa `DIRECT_URL` (conexão direta) e cai para `DATABASE_URL` se ela não existir.
- `seed` só insere se a tabela `public.convidados` estiver vazia, respeitando o teto de 100 convidados.
- Os links gerados ficam em `backend/saida-links-convidados.csv`, que contém tokens e **é ignorado pelo Git**.

Rotas:

- `GET /api/health`
- `GET /api/convite/:token`
- `POST /api/convite/:token/rsvp`

## Convite e RSVP

- Cada convidado recebe um link individual: `convite.html?token=...`.
- O token é lido do `window.location.search` e usado na API REST.
- A URL da API fica em `API_BASE_URL` no topo de `convite.js` (`http://localhost:3000` em desenvolvimento).

## Situação atual

- ✅ Backend implementado e testado (22 testes automatizados).
- ✅ Migração aplicada no Neon.
- ✅ 91 convidados cadastrados com IDs de 1 a 91 (teto de 100 → 9 vagas livres).
- ✅ Frontend integrado à API REST, com links individuais por token.
- ⏳ Deploy no Render/Netlify pendente: configurar `API_BASE_URL` em `convite.js`, `DATABASE_URL`/`DIRECT_URL` e `FRONTEND_URL` no backend.
