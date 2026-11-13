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
>
> O frontend (`index.html`, `convite.html`, `convite.js` e CSS) **ainda exibe os dados antigos** e será atualizado em uma etapa posterior.

## Estrutura do projeto

- `index.html`, `splash.css`, `splash.js` — splash screen.
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

Rotas:

- `GET /api/health`
- `GET /api/convite/:token`
- `POST /api/convite/:token/rsvp`

## Situação atual

- ✅ Backend implementado e testado (22 testes automatizados).
- ✅ Migração preparada e idempotente, **ainda não executada** no Neon.
- ⏳ 92 convidados e tokens ainda não cadastrados.
- ⏳ Frontend ainda não consome a API e ainda contém data/local antigos.
- ⏳ Deploy no Render/Netlify pendente.
