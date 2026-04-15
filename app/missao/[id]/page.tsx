import { redirect } from "next/navigation";
import Link from "next/link";
import {
  concluirMissaoAction,
  marcarMissaoEntregueAction,
  enviarPropostaAction,
  responderPropostaAction,
} from "@/app/actions";
import { createServerSupabase } from "@/utils/supabase/server";
import {
  ArrowLeft, Clock, CheckCircle2, Zap, User, Tag, Calendar,
  DollarSign, FileText, MessageSquare, ChevronRight, AlertCircle,
  BookOpen, Star, Send, ThumbsUp, ThumbsDown, Handshake
} from "lucide-react";
import AvaliacaoForm from "./AvaliacaoForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
};

function statusLabel(status: string | null) {
  if (status === "aberta") return "Aberta";
  if (status === "em_andamento") return "Em andamento";
  if (status === "entregue") return "Entregue";
  if (status === "concluida") return "Concluída";
  return status || "Sem status";
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? "";
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    aberta:       { cls: "badge badge-aberta",    icon: <Zap className="w-3 h-3" /> },
    em_andamento: { cls: "badge badge-andamento", icon: <Clock className="w-3 h-3" /> },
    entregue:     { cls: "badge badge-entregue",  icon: <CheckCircle2 className="w-3 h-3" /> },
    concluida:    { cls: "badge badge-concluida", icon: <CheckCircle2 className="w-3 h-3" /> },
  };
  const cfg = map[s] ?? { cls: "badge", icon: null };
  return <span className={cfg.cls}>{cfg.icon}{statusLabel(s)}</span>;
}

function nomeOuFallback(nome: string | null | undefined, email: string | null | undefined) {
  if (nome?.trim()) return nome.trim();
  if (email?.trim()) return email.trim();
  return "Usuário sem nome";
}

function Timeline({ status }: { status: string }) {
  const steps = [
    { key: "aberta",       label: "Aberta",       icon: Zap },
    { key: "em_andamento", label: "Em andamento", icon: Clock },
    { key: "entregue",     label: "Entregue",     icon: FileText },
    { key: "concluida",    label: "Concluída",    icon: CheckCircle2 },
  ];
  const currentIdx = steps.findIndex(s => s.key === status);

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                done
                  ? active
                    ? "bg-blue-500 border-2 border-blue-400 shadow-lg shadow-blue-500/30"
                    : "bg-blue-500/30 border border-blue-500/40"
                  : "bg-white/5 border border-white/10"
              }`}>
                <step.icon className={`w-3.5 h-3.5 ${done ? "text-white" : "text-white/25"}`} />
              </div>
              <span className={`text-[10px] mt-1.5 font-medium ${done ? "text-white/70" : "text-white/25"}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-5 ${i < currentIdx ? "bg-blue-500/40" : "bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default async function MissaoDetalhePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) redirect("/login");

  const { data: missao } = await supabase
    .from("missoes")
    .select("*")
    .eq("id", id)
    .single();

  if (!missao) redirect("/painel");

  const isAluno = missao.aluno_id === user.id;
  // Check user profile to know if they are an orientador (even if not yet assigned)
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("role, nome")
    .eq("id", user.id)
    .single();
  const isOrientadorAtribuido = missao.orientador_id === user.id;
  const isOrientador = isOrientadorAtribuido || (!isAluno && userProfile?.role === "orientador");
  if (!isAluno && !isOrientador) redirect("/painel");

  let orientadorNomeBruto: string | null = null;
  let alunoNomeBruto: string | null = null;

  if (missao.orientador_id) {
    const { data } = await supabase.from("profiles").select("nome").eq("id", missao.orientador_id).single();
    orientadorNomeBruto = data?.nome ?? null;
  }
  if (missao.aluno_id) {
    const { data } = await supabase.from("profiles").select("nome").eq("id", missao.aluno_id).single();
    alunoNomeBruto = data?.nome ?? null;
  }

  // Buscar avaliação existente
  const { data: avaliacaoExistente } = await supabase
    .from("avaliacoes")
    .select("nota, comentario")
    .eq("missao_id", id)
    .maybeSingle();

  // Buscar propostas
  type Proposta = { id: string; orientador_id: string; valor: number | null; prazo_dias: number | null; mensagem: string | null; status: string; created_at: string; orientador_nome?: string };
  let propostas: Proposta[] = [];
  let minhaPropostaJaEnviada: Proposta | null = null;

  if (missao.status === "aberta") {
    if (isAluno) {
      // Aluno vê todas as propostas pendentes
      const { data: props } = await supabase
        .from("propostas")
        .select("id, orientador_id, valor, prazo_dias, mensagem, status, created_at")
        .eq("missao_id", id)
        .order("created_at", { ascending: false });

      if (props && props.length > 0) {
        // Busca nomes dos orientadores
        const orIds = [...new Set(props.map((p: any) => p.orientador_id))];
        const { data: ors } = await supabase
          .from("profiles")
          .select("id, nome")
          .in("id", orIds);
        const orMap: Record<string, string> = Object.fromEntries(
          (ors ?? []).map((o: any) => [o.id, o.nome || "Orientador"])
        );
        propostas = (props as Proposta[]).map((p) => ({ ...p, orientador_nome: orMap[p.orientador_id] }));
      }
    } else if (isOrientador) {
      // Orientador vê só a proposta que ele mesmo enviou
      const { data: minhaProp } = await supabase
        .from("propostas")
        .select("id, orientador_id, valor, prazo_dias, mensagem, status, created_at")
        .eq("missao_id", id)
        .eq("orientador_id", user.id)
        .maybeSingle();
      if (minhaProp) minhaPropostaJaEnviada = minhaProp as Proposta;
    }
  }

  const orientadorEmail = isOrientador ? user.email ?? null : null;
  const alunoEmail = isAluno ? user.email ?? null : null;
  const alunoNome = nomeOuFallback(alunoNomeBruto, alunoEmail);
  const orientadorNome = nomeOuFallback(orientadorNomeBruto, orientadorEmail);
  const destinoVolta = isOrientador ? "/painel-orientador" : "/painel";

  return (
    <main className="neo-bg-panel text-white">
      <header className="sticky top-0 z-40 border-b border-white/5 neo-glass">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-black">N</div>
            <span className="font-black tracking-wider text-sm">NEO <span className="text-blue-400 italic">HUB</span></span>
          </Link>
          <Link href={destinoVolta} className="flex items-center gap-1.5 text-white/50 hover:text-white transition text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar ao painel
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Alerts */}
        {sp?.ok === "entregue" && (
          <div className="mb-6 rounded-xl border border-green-500/25 bg-green-500/8 px-5 py-3.5 text-green-200 flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Missão marcada como entregue.
          </div>
        )}
        {sp?.ok === "concluida" && (
          <div className="mb-6 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-5 py-3.5 text-emerald-200 flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Missão concluída com sucesso! 🎉
          </div>
        )}
        {sp?.ok === "avaliado" && (
          <div className="mb-6 rounded-xl border border-yellow-500/25 bg-yellow-500/8 px-5 py-3.5 text-yellow-200 flex items-center gap-2 text-sm">
            <Star className="w-4 h-4 shrink-0 fill-yellow-400 text-yellow-400" /> Avaliação enviada! Obrigado pelo feedback.
          </div>
        )}
        {sp?.ok === "proposta_enviada" && (
          <div className="mb-6 rounded-xl border border-blue-500/25 bg-blue-500/8 px-5 py-3.5 text-blue-200 flex items-center gap-2 text-sm">
            <Send className="w-4 h-4 shrink-0" /> Proposta enviada com sucesso! Aguarde a resposta do aluno.
          </div>
        )}
        {sp?.ok === "proposta_aceita" && (
          <div className="mb-6 rounded-xl border border-green-500/25 bg-green-500/8 px-5 py-3.5 text-green-200 flex items-center gap-2 text-sm">
            <Handshake className="w-4 h-4 shrink-0" /> Proposta aceita! A missão está agora em andamento. 🎉
          </div>
        )}
        {sp?.ok === "proposta_recusada" && (
          <div className="mb-6 rounded-xl border border-white/10 bg-white/5 px-5 py-3.5 text-white/60 flex items-center gap-2 text-sm">
            <ThumbsDown className="w-4 h-4 shrink-0" /> Proposta recusada.
          </div>
        )}
        {sp?.error && (
          <div className="mb-6 rounded-xl border border-red-500/25 bg-red-500/8 px-5 py-3.5 text-red-200 flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {decodeURIComponent(sp.error)}
          </div>
        )}

        {/* Heading */}
        <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-widest font-semibold mb-2">Detalhe da Missão</p>
            <h1 className="text-2xl md:text-3xl font-black">{missao.titulo}</h1>
          </div>
          {missao.orcamento && (
            <div className="text-green-400 font-black text-2xl shrink-0">
              R$ {Number(missao.orcamento).toLocaleString("pt-BR")}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="neo-card p-6 mb-6">
          <h3 className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-5">Progresso</h3>
          <Timeline status={missao.status} />
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Badges */}
            <div className="neo-card p-5 flex items-center gap-3 flex-wrap">
              <StatusBadge status={missao.status} />
              {missao.area && (
                <span className="badge bg-white/5 border border-white/10 text-white/50">
                  <BookOpen className="w-3 h-3" /> {missao.area}
                </span>
              )}
              {missao.categoria && (
                <span className="badge bg-white/5 border border-white/10 text-white/50">
                  <Tag className="w-3 h-3" /> {missao.categoria}
                </span>
              )}
            </div>

            {/* Descrição */}
            <div className="neo-card p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/40 font-semibold mb-3">
                <FileText className="w-3.5 h-3.5" /> Descrição
              </div>
              <p className="text-white/75 text-sm leading-relaxed whitespace-pre-wrap">
                {missao.descricao || "Sem descrição detalhada."}
              </p>
            </div>

            {/* Meta */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="neo-card p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/35 font-semibold mb-2">
                  <User className="w-3.5 h-3.5" /> Aluno
                </div>
                <div className="font-semibold text-sm">{alunoNome}</div>
              </div>
              <div className="neo-card p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/35 font-semibold mb-2">
                  <User className="w-3.5 h-3.5" /> Orientador
                </div>
                <div className="font-semibold text-sm">
                  {missao.orientador_id ? orientadorNome : (
                    <span className="text-white/35 font-normal italic">Aguardando...</span>
                  )}
                </div>
              </div>
              <div className="neo-card p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/35 font-semibold mb-2">
                  <Calendar className="w-3.5 h-3.5" /> Prazo
                </div>
                <div className="font-semibold text-sm">
                  {missao.prazo ? new Date(missao.prazo).toLocaleDateString("pt-BR") : (
                    <span className="text-white/35 font-normal italic">Não informado</span>
                  )}
                </div>
              </div>
              <div className="neo-card p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/35 font-semibold mb-2">
                  <DollarSign className="w-3.5 h-3.5" /> Orçamento
                </div>
                <div className="font-semibold text-sm">
                  {missao.orcamento
                    ? <span className="text-green-400">R$ {Number(missao.orcamento).toLocaleString("pt-BR")}</span>
                    : <span className="text-white/35 font-normal italic">Não informado</span>
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="space-y-4">
            <div className="neo-card border border-blue-500/20 bg-blue-500/5 p-5">
              <h3 className="font-bold mb-4">Ações</h3>

              {isOrientador ? (
                <div className="space-y-3">
                  <p className="text-white/50 text-xs">Você é o orientador desta missão.</p>

                  {/* Se a missão ainda está aberta, orientador pode enviar proposta */}
                  {missao.status === "aberta" && (
                    minhaPropostaJaEnviada ? (
                      <div className="rounded-xl border border-blue-500/20 bg-blue-500/8 p-4 space-y-1">
                        <p className="text-blue-300 text-xs font-semibold flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5" /> Proposta enviada
                        </p>
                        {minhaPropostaJaEnviada.valor && (
                          <p className="text-white/70 text-xs">Valor: <span className="text-green-400 font-bold">R$ {Number(minhaPropostaJaEnviada.valor).toLocaleString("pt-BR")}</span></p>
                        )}
                        {minhaPropostaJaEnviada.prazo_dias && (
                          <p className="text-white/70 text-xs">Prazo: <span className="font-semibold">{minhaPropostaJaEnviada.prazo_dias} dias</span></p>
                        )}
                        <p className="text-white/40 text-xs mt-1">Aguardando resposta do aluno...</p>
                      </div>
                    ) : (
                      <form action={enviarPropostaAction} className="space-y-3">
                        <input type="hidden" name="missao_id" value={missao.id} />
                        <p className="text-white/50 text-xs">Envie sua proposta para esta missão.</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-white/40 mb-1 block">Valor (R$)</label>
                            <input type="number" name="valor" min="0" step="0.01" placeholder="Ex: 150" className="neo-input text-sm py-2" />
                          </div>
                          <div>
                            <label className="text-xs text-white/40 mb-1 block">Prazo (dias)</label>
                            <input type="number" name="prazo_dias" min="1" placeholder="Ex: 7" className="neo-input text-sm py-2" />
                          </div>
                        </div>
                        <textarea name="mensagem" placeholder="Apresente-se e explique como você pode ajudar..." rows={3} className="neo-input text-sm resize-none" />
                        <button type="submit" className="neo-btn-primary w-full justify-center py-2.5 text-sm">
                          <Send className="w-4 h-4" /> Enviar proposta
                        </button>
                      </form>
                    )
                  )}

                  {/* Ações para missão em andamento */}
                  {missao.status === "em_andamento" && isOrientadorAtribuido ? (
                    <form action={marcarMissaoEntregueAction}>
                      <input type="hidden" name="missao_id" value={missao.id} />
                      <button className="neo-btn-primary w-full justify-center py-3 text-sm" style={{background: 'rgb(22 163 74)'}}>
                        <CheckCircle2 className="w-4 h-4" /> Marcar como entregue
                      </button>
                    </form>
                  ) : missao.status === "em_andamento" && !isOrientadorAtribuido ? (
                    <p className="text-white/40 text-xs text-center">Missão em andamento com outro orientador.</p>
                  ) : null}

                  {missao.status === "entregue" && isOrientadorAtribuido ? (
                    <form action={concluirMissaoAction}>
                      <input type="hidden" name="missao_id" value={missao.id} />
                      <button className="neo-btn-primary w-full justify-center py-3 text-sm">
                        <CheckCircle2 className="w-4 h-4" /> Concluir missão
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-white/50 text-xs">Você é o aluno desta missão.</p>
                  <div className="text-sm text-white/60 bg-white/5 rounded-xl p-3">
                    {missao.status === "concluida"
                      ? "✅ Missão concluída oficialmente."
                      : missao.status === "entregue"
                      ? "📦 O orientador marcou como entregue."
                      : missao.status === "em_andamento"
                      ? "⚡ Em andamento com o orientador."
                      : propostas.length > 0
                      ? `📬 Você tem ${propostas.length} proposta(s) — veja abaixo.`
                      : "⏳ Aguardando propostas de orientadores."}
                  </div>
                </div>
              )}
            </div>

            {/* Propostas recebidas — só aluno vê, missão aberta */}
            {isAluno && missao.status === "aberta" && propostas.length > 0 && (
              <div className="neo-card border border-indigo-500/20 bg-indigo-500/5 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Handshake className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-bold text-sm">Propostas recebidas ({propostas.length})</h3>
                </div>
                <div className="space-y-3">
                  {propostas.map((prop) => (
                    <div key={prop.id} className="rounded-xl border border-white/8 bg-white/4 p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="font-semibold text-sm">{prop.orientador_nome}</p>
                          <div className="flex gap-3 mt-1">
                            {prop.valor && (
                              <span className="text-green-400 text-xs font-bold">R$ {Number(prop.valor).toLocaleString("pt-BR")}</span>
                            )}
                            {prop.prazo_dias && (
                              <span className="text-white/50 text-xs">{prop.prazo_dias} dias</span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          prop.status === "pendente" ? "bg-yellow-500/15 text-yellow-300 border border-yellow-500/25" :
                          prop.status === "aceita"   ? "bg-green-500/15 text-green-300 border border-green-500/25" :
                          "bg-white/8 text-white/40 border border-white/10"
                        }`}>{prop.status}</span>
                      </div>
                      {prop.mensagem && (
                        <p className="text-white/55 text-xs leading-relaxed mb-3 italic">"{prop.mensagem}"</p>
                      )}
                      {prop.status === "pendente" && (
                        <div className="flex gap-2">
                          <form action={responderPropostaAction} className="flex-1">
                            <input type="hidden" name="proposta_id" value={prop.id} />
                            <input type="hidden" name="missao_id" value={missao.id} />
                            <input type="hidden" name="resposta" value="aceita" />
                            <button type="submit" className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 text-green-300 text-xs font-semibold py-2.5 hover:bg-green-500/20 transition">
                              <ThumbsUp className="w-3.5 h-3.5" /> Aceitar
                            </button>
                          </form>
                          <form action={responderPropostaAction} className="flex-1">
                            <input type="hidden" name="proposta_id" value={prop.id} />
                            <input type="hidden" name="missao_id" value={missao.id} />
                            <input type="hidden" name="resposta" value="recusada" />
                            <button type="submit" className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-white/40 text-xs font-semibold py-2.5 hover:bg-white/10 transition">
                              <ThumbsDown className="w-3.5 h-3.5" /> Recusar
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat */}
            {missao.status !== "aberta" && missao.orientador_id && (
              <Link
                href={`/missao/${missao.id}/chat`}
                className="neo-card border border-purple-500/20 bg-purple-500/5 p-5 flex items-center justify-between group hover:border-purple-500/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">Chat da missão</div>
                    <div className="text-white/45 text-xs">Converse em tempo real</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
              </Link>
            )}

            {/* Avaliação — só aluno, só concluída */}
            {isAluno && missao.status === "concluida" && missao.orientador_id && (
              <div className="neo-card border border-yellow-500/20 bg-yellow-500/5 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-yellow-400" />
                  <h3 className="font-bold text-sm">Avaliar orientador</h3>
                </div>
                {avaliacaoExistente ? (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-5 h-5 ${i < (avaliacaoExistente.nota ?? 0) ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`}
                        />
                      ))}
                    </div>
                    {avaliacaoExistente.comentario && (
                      <p className="text-white/50 text-xs italic">"{avaliacaoExistente.comentario}"</p>
                    )}
                    <p className="text-white/30 text-xs">Avaliação enviada ✓</p>
                  </div>
                ) : (
                  <AvaliacaoForm
                    missaoId={missao.id}
                    orientadorId={missao.orientador_id}
                    alunoId={user.id}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}