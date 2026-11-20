-- =========================================================
-- Migração 002 — RSVP por Convite / Família
--
-- Idempotente:
--   * cria as tabelas apenas se não existirem;
--   * preserva os dados do modelo antigo (um convidado por linha)
--     em public.convidados_legado;
--   * cria índices de apoio sem duplicá-los.
--
-- Execute somente de forma controlada:
--   npm run migrate -- --confirm
-- =========================================================

CREATE TABLE IF NOT EXISTS public.convites (
    id                SERIAL PRIMARY KEY,
    titulo            VARCHAR(150) NOT NULL,
    responsavel_nome  VARCHAR(150) NOT NULL,
    token             VARCHAR(128) NOT NULL UNIQUE,
    status            VARCHAR(20) NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente', 'confirmado', 'recusado')),
    respondido_em     TIMESTAMPTZ,
    criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- O modelo antigo (um token por pessoa) não possui convite_id.
-- Preserva os dados em uma tabela de legado e recria o modelo novo.
-- A cópia evita conflito de nomes de constraints/sequences da tabela antiga
-- (convidados_pkey, convidados_token_key, convidados_id_seq etc.).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'convidados'
    ) AND NOT EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'convidados'
           AND column_name = 'convite_id'
    ) THEN
        CREATE TABLE IF NOT EXISTS public.convidados_legado AS
            SELECT * FROM public.convidados;

        DROP TABLE public.convidados;
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.convidados (
    id              SERIAL PRIMARY KEY,
    convite_id      INTEGER NOT NULL
                    REFERENCES public.convites(id) ON DELETE CASCADE,
    nome            VARCHAR(150) NOT NULL,
    eh_responsavel  BOOLEAN NOT NULL DEFAULT FALSE,
    eh_extra        BOOLEAN NOT NULL DEFAULT FALSE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('pendente', 'confirmado', 'recusado')),
    respondido_em   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_convidados_convite_id
    ON public.convidados (convite_id);

CREATE INDEX IF NOT EXISTS idx_convidados_status
    ON public.convidados (status);

-- Garante no máximo um responsável por convite.
CREATE UNIQUE INDEX IF NOT EXISTS idx_convidados_um_responsavel
    ON public.convidados (convite_id)
    WHERE eh_responsavel = TRUE;
