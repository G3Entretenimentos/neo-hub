import { redirect } from "next/navigation";
import { createServerSupabase } from "@/utils/supabase/server";
import { signOutAction } from "@/app/actions";

import Link from "next/link";
import {
  BookOpen, Calculator, Microscope, Cpu,
  Clock, CheckCircle2, LogOut, User, ChevronRight,
  Zap, TrendingUp, Star, AlertCircle, Users
} from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const areas = [
  { id: "humanas",    label: "Humanas",    icon: BookOpen,    color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40" },
  { id: "exatas",     label: "Exatas",     icon: Calculator,  color: "text-blue-400",  bg: "bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40" },
  { id: "biologica",  label: "Biológicas", icon: Microscope,  color: "text-green-400", bg: "bg-green-500/10 border-green-500/20 hover:border-green-500/40" },
  { id: "tecnologia", label: "Tecnologia", icon: Cpu,         color: "text-purple-400",bg: "bg-purple-500/10 border-purple-500/20 hover:border-purple-500/40" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    aberta:       { label: "Aberta",       cls: "badge badge-aberta",    icon: <Zap className="w-3 h-3" /> },
    em_andamento: { label: "Em andamento", cls: "badge badge-andamento", icon: <Clock className="w-3 h-3" /> },
    entregue:     { label: "Entregue",     cls: "badge badge-entregue",  icon: <CheckCircle2 className="w-3 h-3" /> },
    concluida:    { label: "Concluída",    cls: "badge badge-concluida", icon: <CheckCircle2 className="w-3 h-3" /> },
  };
  const s = map[status] ?? { label: status, cls: "badge", icon: null };
  return <span className={s.cls}>{s.icon}{s.label}</span>;
}

function CardMissao({ missao, mostrarBotaoAceitar = false }: { missao: any; mostrarBotaoAceitar?: boolean }) {
  return (
    <div className="neo-card neo-card-blue p-5 md:p-6">
      <Link href={`/missao/${missao.id}`} className="block">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <StatusBadge status={missao.status} />
              {missao.categoria && (
                <span className="badge bg-white/5 border border-white/10 text-white/50">
                  {missao.categoria}
                </span>
              )}
              {missao.prazo && (
                <span className="flex items-center gap-1 text-white/40 text-xs">
                  <Clock className="w-3 h-3" />
                  {new Date(missao.prazo).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
            <h3 className="font-bold text-base mb-1 truncate">{missao.titulo}</h3>
            <p className="text-white/50 text-sm line-clamp-2">{missao.descricao}</p>
          </div>
          {missao.orcamento && (
            <div className="text-green-400 font-bold text-lg shrink-0">
              R$ {Number(missao.orcamento).toLocaleString("pt-BR")}
            </div>
          )}
        </div>
      </Link>

      <div className="flex justify-end pt-4 border-t border-white/5">
        {mostrarBotaoAceitar ? (
          <Link
            href={`/missao/${missao.id}`}
            className="neo-btn-primary text-sm py-2 px-5"
          >
            <ChevronRight className="w-4 h-4" /> Ver e Propor
          </Link>
        ) : (
          <Link
            href={`/missao/${missao.id}`}
            className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition font-medium"
          >
            Ver detalhes <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function PainelOrientador({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;

  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login?next=/painel-orientador");

  const { data: profile } = await supabase
    .from("profiles")
    .select("area, nome")
    .eq("id", user.id)
    .single();

  const { data: missoesDisponiveis } = await supabase
    .from("missoes")
    .select("*")
    .eq("status", "aberta")
    .eq("area", profile?.area ?? "")
    .order("created_at", { ascending: false });

  const { data: minhasMissoes } = await supabase
    .from("missoes")
    .select("*")
    .eq("status", "em_andamento")
    .eq("orientador_id", user.id)
    .order("created_at", { ascending: false });

  const { data: concluidas } = await supabase
    .from("missoes")
    .select("id")
    .eq("status", "concluida")
    .eq("orientador_id", user.id);

  const displayName = profile?.nome || user.email?.split("@")[0] || "Orientador";

  return (
    <main className="neo-bg-panel text-white">
      {/* ─── HEADER ──────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/5 neo-glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-black">N</div>
            <span className="font-black tracking-wider text-sm">NEO <span className="text-blue-400 italic">HUB</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/perfil" className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition">
              <User className="w-4 h-4" />
              <span className="hidden md:block">{displayName}</span>
            </Link>
            <form action={signOutAction}>
              <button className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 transition">
                <LogOut className="w-4 h-4" />
                <span className="hidden md:block">Sair</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* ─── GREETING ──────────────────────── */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-1">
            Olá, {displayName.split(" ")[0]} 👋
          </h1>
          <p className="text-white/45 text-sm">Painel do orientador — gerencie suas missões e área de atuação.</p>
        </div>

        {/* Alertas */}
        {sp?.ok && (
          <div className="mb-6 rounded-xl border border-green-500/25 bg-green-500/8 px-5 py-3.5 text-green-200 flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Missão aceita com sucesso.
          </div>
        )}
        {sp?.error && (
          <div className="mb-6 rounded-xl border border-red-500/25 bg-red-500/8 px-5 py-3.5 text-red-200 flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {decodeURIComponent(sp.error)}
          </div>
        )}

        {/* ─── STATS ─────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Em andamento",  value: minhasMissoes?.length ?? 0, color: "text-yellow-400", icon: Clock },
            { label: "Disponíveis",   value: missoesDisponiveis?.length ?? 0, color: "text-blue-400", icon: Zap },
            { label: "Concluídas",    value: concluidas?.length ?? 0, color: "text-green-400", icon: Star },
          ].map((stat) => (
            <div key={stat.label} className="neo-card p-4 md:p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/50 text-xs font-medium">{stat.label}</span>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className={`text-2xl md:text-3xl font-black ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* ─── ÁREA ──────────────────────────── */}
        <div className="mb-8">
          <h2 className="font-bold text-lg mb-1">Área de Atuação</h2>
          <p className="text-white/45 text-xs mb-4">Selecione sua área para receber missões compatíveis.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {areas.map((area) => (
              <Link
                key={area.id}
                href={`/painel-orientador/area?id=${area.id}`}
                className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] flex items-center gap-3 ${area.bg} ${
                  profile?.area === area.id ? "ring-1 ring-blue-500/40" : ""
                }`}
              >
                <div className="shrink-0 w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center">
                  <area.icon className={`w-4 h-4 ${area.color}`} />
                </div>
                <div>
                  <div className="font-semibold text-sm">{area.label}</div>
                  {profile?.area === area.id && (
                    <div className="text-[10px] text-blue-300 flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Selecionada
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ─── MINHAS MISSÕES ────────────────── */}
        <div className="mb-8">
          <h2 className="font-bold text-xl mb-1">Missões em Andamento</h2>
          <p className="text-white/45 text-sm mb-5">Missões que você aceitou e está conduzindo.</p>

          {!minhasMissoes || minhasMissoes.length === 0 ? (
            <div className="neo-card p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-white/20" />
              </div>
              <h3 className="font-bold mb-1">Nenhuma missão em andamento</h3>
              <p className="text-white/40 text-sm">Aceite uma missão abaixo para começar.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {(minhasMissoes as any[]).map((m) => <CardMissao key={m.id} missao={m} />)}
            </div>
          )}
        </div>

        {/* ─── MISSÕES DISPONÍVEIS ───────────── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-xl mb-1">Missões Disponíveis</h2>
              <p className="text-white/45 text-sm">
                {profile?.area
                  ? `Missões abertas em ${profile.area}.`
                  : "Selecione uma área acima para ver missões compatíveis."}
              </p>
            </div>
            {missoesDisponiveis && missoesDisponiveis.length > 0 && (
              <span className="badge badge-aberta">
                <Users className="w-3 h-3" />{missoesDisponiveis.length} disponíveis
              </span>
            )}
          </div>

          {!profile?.area ? (
            <div className="neo-card border border-yellow-500/20 bg-yellow-500/5 p-10 text-center">
              <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
              <h3 className="font-bold mb-1">Selecione sua área primeiro</h3>
              <p className="text-white/40 text-sm">Escolha uma área acima para ver as missões compatíveis.</p>
            </div>
          ) : !missoesDisponiveis || missoesDisponiveis.length === 0 ? (
            <div className="neo-card p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-white/20" />
              </div>
              <h3 className="font-bold mb-1">Nenhuma missão aberta</h3>
              <p className="text-white/40 text-sm">Quando alunos criarem pedidos nessa área, aparecerão aqui.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {(missoesDisponiveis as any[]).map((m) => (
                <CardMissao key={m.id} missao={m} mostrarBotaoAceitar />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}