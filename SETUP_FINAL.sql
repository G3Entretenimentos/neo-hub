-- =====================================================
-- NEO HUB — SETUP FINAL (execute no Supabase SQL Editor)
-- Seguro para rodar múltiplas vezes (idempotente)
-- =====================================================

-- ─── 1. Coluna nome em profiles ───────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nome text;

-- ─── 2. Tabela: mensagens (chat em tempo real) ────
CREATE TABLE IF NOT EXISTS mensagens (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  missao_id  uuid REFERENCES missoes(id) ON DELETE CASCADE NOT NULL,
  autor_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conteudo   text NOT NULL CHECK (char_length(conteudo) > 0),
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mensagens_missao_created
  ON mensagens (missao_id, created_at ASC);

ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "participantes_podem_ler_mensagens" ON mensagens;
CREATE POLICY "participantes_podem_ler_mensagens"
  ON mensagens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM missoes m
      WHERE m.id = mensagens.missao_id
        AND (m.aluno_id = auth.uid() OR m.orientador_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "participantes_podem_inserir_mensagens" ON mensagens;
CREATE POLICY "participantes_podem_inserir_mensagens"
  ON mensagens FOR INSERT
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM missoes m
      WHERE m.id = missao_id
        AND (m.aluno_id = auth.uid() OR m.orientador_id = auth.uid())
    )
  );

-- Habilitar Realtime na tabela mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE mensagens;

-- ─── 3. Tabela: avaliacoes (sistema de estrelas) ──
CREATE TABLE IF NOT EXISTS avaliacoes (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  missao_id      uuid REFERENCES missoes(id) ON DELETE CASCADE UNIQUE NOT NULL,
  aluno_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  orientador_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nota           smallint NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario     text,
  created_at     timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aluno_cria_avaliacao" ON avaliacoes;
CREATE POLICY "aluno_cria_avaliacao"
  ON avaliacoes FOR INSERT
  WITH CHECK (aluno_id = auth.uid());

DROP POLICY IF EXISTS "todos_leem_avaliacoes" ON avaliacoes;
CREATE POLICY "todos_leem_avaliacoes"
  ON avaliacoes FOR SELECT
  USING (true);

-- ─── 4. View: média de avaliação por orientador ───
CREATE OR REPLACE VIEW orientador_stats AS
SELECT
  orientador_id,
  COUNT(*)::int          AS total_avaliacoes,
  ROUND(AVG(nota), 1)    AS nota_media,
  COUNT(CASE WHEN nota = 5 THEN 1 END)::int AS cinco_estrelas
FROM avaliacoes
GROUP BY orientador_id;

-- ─── 5. Tabela: propostas (orientador → aluno) ────
CREATE TABLE IF NOT EXISTS propostas (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  missao_id      uuid REFERENCES missoes(id) ON DELETE CASCADE NOT NULL,
  orientador_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  valor          decimal(10,2),
  prazo_dias     int,
  mensagem       text,
  status         text DEFAULT 'pendente' CHECK (status IN ('pendente','aceita','recusada')),
  created_at     timestamptz DEFAULT now() NOT NULL,
  UNIQUE (missao_id, orientador_id)
);

CREATE INDEX IF NOT EXISTS idx_propostas_missao ON propostas (missao_id);
CREATE INDEX IF NOT EXISTS idx_propostas_orientador ON propostas (orientador_id);

ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;

-- Orientador pode criar proposta para missão aberta
DROP POLICY IF EXISTS "orientador_cria_proposta" ON propostas;
CREATE POLICY "orientador_cria_proposta"
  ON propostas FOR INSERT
  WITH CHECK (
    orientador_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM missoes m
      WHERE m.id = missao_id AND m.status = 'aberta'
    )
  );

-- Orientador pode ler suas próprias propostas
-- Aluno pode ler propostas da sua missão
DROP POLICY IF EXISTS "participantes_leem_propostas" ON propostas;
CREATE POLICY "participantes_leem_propostas"
  ON propostas FOR SELECT
  USING (
    orientador_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM missoes m
      WHERE m.id = missao_id AND m.aluno_id = auth.uid()
    )
  );

-- Aluno pode atualizar status da proposta (aceitar/recusar)
DROP POLICY IF EXISTS "aluno_atualiza_proposta" ON propostas;
CREATE POLICY "aluno_atualiza_proposta"
  ON propostas FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM missoes m
      WHERE m.id = missao_id AND m.aluno_id = auth.uid()
    )
  )
  WITH CHECK (status IN ('aceita', 'recusada'));

-- =====================================================
-- PRONTO! Todas as tabelas criadas com RLS configurado.
-- =====================================================
