-- ===================================================
-- NEO HUB — SQL COMPLETO
-- Execute no Supabase SQL Editor (em ordem)
-- ===================================================

-- 1) TABELA: mensagens (chat em tempo real)
-- ===================================================
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

-- Habilitar Realtime (rode separado se der erro)
ALTER PUBLICATION supabase_realtime ADD TABLE mensagens;


-- 2) TABELA: avaliacoes (sistema de estrelas)
-- ===================================================
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


-- 3) COLUNA: nome em profiles (caso não exista)
-- ===================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nome text;


-- 4) VIEW: média de avaliação por orientador
-- ===================================================
CREATE OR REPLACE VIEW orientador_stats AS
SELECT
  orientador_id,
  COUNT(*)::int          AS total_avaliacoes,
  ROUND(AVG(nota), 1)    AS nota_media,
  COUNT(CASE WHEN nota = 5 THEN 1 END)::int AS cinco_estrelas
FROM avaliacoes
GROUP BY orientador_id;
