-- =========================================================
-- Migração 001 — Estrutura definitiva da tabela convidados
--
-- Idempotente e não destrutiva:
--   * cria a tabela apenas se ela não existir;
--   * preserva dados e a constraint de status existentes;
--   * converte datas para TIMESTAMPTZ sem recriar a tabela;
--   * garante a atualização automática de atualizado_em.
--
-- Execute somente de forma controlada:
--   npm run migrate -- --confirm
-- =========================================================

CREATE TABLE IF NOT EXISTS public.convidados (
    id             SERIAL PRIMARY KEY,
    nome           VARCHAR(150) NOT NULL,
    token          VARCHAR(128) UNIQUE NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'confirmado', 'recusado')),
    respondido_em  TIMESTAMPTZ,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A tabela já existia com VARCHAR(64); amplia sem afetar os dados.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'convidados'
           AND column_name = 'token'
           AND character_maximum_length < 128
    ) THEN
        ALTER TABLE public.convidados
            ALTER COLUMN token TYPE VARCHAR(128);
    END IF;
END
$$;

-- Converte apenas as colunas que ainda estão sem timezone.
-- Valores gravados anteriormente pelo banco (CURRENT_TIMESTAMP) estavam
-- em UTC, por isso o USING AT TIME ZONE 'UTC'.
DO $$
DECLARE
    coluna text;
BEGIN
    FOREACH coluna IN ARRAY ARRAY['respondido_em', 'criado_em', 'atualizado_em']
    LOOP
        IF EXISTS (
            SELECT 1
              FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'convidados'
               AND column_name = coluna
               AND data_type = 'timestamp without time zone'
        ) THEN
            EXECUTE format(
                'ALTER TABLE public.convidados
                     ALTER COLUMN %I TYPE TIMESTAMPTZ
                     USING %I AT TIME ZONE ''UTC''',
                coluna,
                coluna
            );
        END IF;
    END LOOP;
END
$$;

-- Preenche eventuais nulos antes de reforçar os defaults/restrições.
UPDATE public.convidados SET criado_em = NOW() WHERE criado_em IS NULL;
UPDATE public.convidados SET atualizado_em = NOW() WHERE atualizado_em IS NULL;

ALTER TABLE public.convidados ALTER COLUMN status SET DEFAULT 'pendente';
ALTER TABLE public.convidados ALTER COLUMN criado_em SET DEFAULT NOW();
ALTER TABLE public.convidados ALTER COLUMN atualizado_em SET DEFAULT NOW();
ALTER TABLE public.convidados ALTER COLUMN criado_em SET NOT NULL;
ALTER TABLE public.convidados ALTER COLUMN atualizado_em SET NOT NULL;

-- Atualização automática de atualizado_em.
CREATE OR REPLACE FUNCTION public.definir_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.atualizado_em := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_convidados_atualizado_em ON public.convidados;

CREATE TRIGGER trg_convidados_atualizado_em
BEFORE UPDATE ON public.convidados
FOR EACH ROW
EXECUTE FUNCTION public.definir_atualizado_em();
