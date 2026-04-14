import { redirect } from "next/navigation";
import { createServerSupabase } from "@/utils/supabase/server";
import Link from "next/link";
import { User, Mail, BookOpen, ChevronRight, ArrowLeft, Pencil, Star } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const areaLabels: Record<string, string> = {
  humanas: "Humanas",
  exatas: "Exatas",
  biologica: "Biológicas",
  tecnologia: "Tecnologia",
};

export default async function PerfilPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, role, area")
    .eq("id", user.id)
    .single();

  const { data: missoes } = await supabase
    .from("missoes")
    .select("id, status")
    .or(`aluno_id.eq.${user.id},orientador_id.eq.${user.id}`);

  const abertas    = (missoes ?? []).filter((m: any) => m.status === "aberta").length;
  const andamento  = (missoes ?? []).filter((m: any) => m.status === "em_andamento").length;
  const concluidas = (missoes ?? []).filter((m: any) => m.status === "concluida").length;
  const total      = (missoes ?? []).length;

  const isOrientador = profile?.role === "orientador";
  const painelLink = isOrientador ? "/painel-orientador" : "/painel";
  const displayName = profile?.nome || user.email?.split("@")[0] || "Usuário";

  // Nota média (só orientadores)
  let notaMedia: number | null = null;
  let totalAvaliacoes = 0;
  if (isOrientador) {
    const { data: stats } = await supabase
      .from("avaliacoes")
      .select("nota")
      .eq("orientador_id", user.id);
    if (stats && stats.length > 0) {
      totalAvaliacoes = stats.length;
      notaMedia = stats.reduce((acc: number, a: any) => acc + a.nota, 0) / stats.length;
    }
  }

  return (
    <main className="neo-bg-panel text-white">
      <header className="sticky top-0 z-40 border-b border-white/5 neo-glass">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-black">N</div>
            <span className="font-black tracking-wider text-sm">NEO <span className="text-blue-400 italic">HUB</span></span>
          </Link>
          <Link href={painelLink} className="flex items-center gap-1.5 text-white/50 hover:text-white transition text-sm">
            <ArrowLeft className="w-4 h-4" /> Painel
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Avatar + Info */}
        <div className="neo-card p-8 mb-6 flex items-center gap-6 flex-wrap">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-2xl font-black shadow-xl shadow-blue-600/20 shrink-0">
            {displayName[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-black mb-1">{displayName}</h1>
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <Mail className="w-3.5 h-3.5" />
              {user.email}
            </div>
            {profile?.role && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`badge ${profile.role === "orientador" ? "badge-andamento" : "badge-aberta"}`}>
                  {profile.role === "orientador" ? "Orientador" : "Aluno"}
                </span>
                {isOrientador && notaMedia !== null && (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${i < Math.round(notaMedia!) ? "text-yellow-400 fill-yellow-400" : "text-white/20"}`}
                      />
                    ))}
                    <span className="text-white/50 text-xs ml-1">{notaMedia.toFixed(1)} ({totalAvaliacoes})</span>
                  </div>
                )}
                {isOrientador && notaMedia === null && (
                  <span className="text-white/30 text-xs">Sem avaliações ainda</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total",        value: total,      color: "text-white" },
            { label: "Em andamento", value: andamento,  color: "text-yellow-400" },
            { label: "Concluídas",   value: concluidas, color: "text-green-400" },
            { label: "Abertas",      value: abertas,    color: "text-blue-400" },
          ].map((s) => (
            <div key={s.label} className="neo-card p-4 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-white/40 text-xs mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Detalhes */}
        <div className="neo-card p-6 mb-6">
          <h2 className="font-bold text-lg mb-5">Informações da conta</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-3 text-white/60">
                <User className="w-4 h-4" />
                <span className="text-sm">Nome</span>
              </div>
              <span className="font-medium text-sm">{profile?.nome || <span className="text-white/30 italic">Não informado</span>}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-3 text-white/60">
                <Mail className="w-4 h-4" />
                <span className="text-sm">Email</span>
              </div>
              <span className="font-medium text-sm">{user.email}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-3 text-white/60">
                <BookOpen className="w-4 h-4" />
                <span className="text-sm">Área</span>
              </div>
              <span className="font-medium text-sm">
                {profile?.area ? areaLabels[profile.area] || profile.area : (
                  <span className="text-white/30 italic">Não selecionada</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 text-white/60">
                <Pencil className="w-4 h-4" />
                <span className="text-sm">Perfil</span>
              </div>
              <span className="badge badge-aberta">{isOrientador ? "Orientador" : "Aluno"}</span>
            </div>
          </div>
        </div>

        {/* Links rápidos */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Link href={painelLink} className="neo-card neo-card-blue p-5 flex items-center justify-between group">
            <span className="font-semibold text-sm">Ir para o painel</span>
            <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </Link>
          {!isOrientador && (
            <Link href="/lancar-missao" className="neo-card border border-blue-500/25 bg-blue-500/8 p-5 flex items-center justify-between group">
              <span className="font-semibold text-sm">Nova missão</span>
              <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
