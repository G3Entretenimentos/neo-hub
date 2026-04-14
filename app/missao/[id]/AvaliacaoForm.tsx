'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Star, Send, Loader2 } from 'lucide-react'

export default function AvaliacaoForm({
  missaoId,
  orientadorId,
  alunoId,
}: {
  missaoId: string
  orientadorId: string
  alunoId: string
}) {
  const [nota, setNota] = useState(0)
  const [hover, setHover] = useState(0)
  const [comentario, setComentario] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (nota === 0) { setErro('Selecione uma nota.'); return }
    setLoading(true)
    setErro('')

    const { error } = await supabase.from('avaliacoes').insert({
      missao_id: missaoId,
      orientador_id: orientadorId,
      aluno_id: alunoId,
      nota,
      comentario: comentario.trim() || null,
    })

    if (error) {
      setErro('Erro ao enviar avaliação. Tente novamente.')
      setLoading(false)
      return
    }

    router.push(`/missao/${missaoId}?ok=avaliado`)
    router.refresh()
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      {/* Estrelas */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setNota(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className={`w-7 h-7 transition-colors ${
                i <= (hover || nota)
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-white/20'
              }`}
            />
          </button>
        ))}
      </div>

      {nota > 0 && (
        <p className="text-xs text-yellow-300/80">
          {['', 'Ruim', 'Regular', 'Bom', 'Muito bom', 'Excelente!'][nota]}
        </p>
      )}

      <textarea
        value={comentario}
        onChange={e => setComentario(e.target.value)}
        placeholder="Deixe um comentário (opcional)..."
        rows={2}
        className="neo-input text-xs resize-none"
      />

      {erro && <p className="text-red-400 text-xs">{erro}</p>}

      <button
        type="submit"
        disabled={loading || nota === 0}
        className="neo-btn-primary w-full justify-center py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'rgb(161 98 7)' }}
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
          : <><Send className="w-4 h-4" /> Enviar avaliação</>
        }
      </button>
    </form>
  )
}
