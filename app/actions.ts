"use server";

import { redirect } from "next/navigation";
import { createClient } from "../utils/supabase/server";

type FormData = { get(key: string): FormDataEntryValue | null };

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.user) redirect("/login?error=Email%20ou%20senha%20invalidos");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  redirect(profile?.role === "orientador" ? "/painel-orientador" : "/painel");
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "aluno");
  const nome = String(formData.get("nome") ?? "").trim();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) redirect("/cadastro?error=Falha%20ao%20criar%20conta");

  const userId = data.user?.id;
  if (userId) {
    await supabase.from("profiles").upsert(
      { id: userId, role, nome: nome || null },
      { onConflict: "id", ignoreDuplicates: false }
    );
  }

  redirect("/login");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function criarMissaoAction(formData: FormData) {
  const titulo = String(formData.get("titulo") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const prazo = String(formData.get("prazo") ?? "").trim();
  const orcamento = formData.get("orcamento");

  if (!titulo) redirect("/lancar-missao?error=Informe%20um%20titulo");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  if (!userId) redirect("/login?error=Faça%20login%20novamente");

  const { data: profile } = await supabase
    .from("profiles")
    .select("area")
    .eq("id", userId)
    .single();

  const { error } = await supabase.from("missoes").insert({
    titulo,
    descricao: descricao || null,
    categoria: categoria || null,
    prazo: prazo || null,
    orcamento: orcamento ? Number(orcamento) : null,
    aluno_id: userId,
    area: profile?.area || null,
    status: "aberta",
  });

  if (error) redirect("/lancar-missao?error=Falha%20ao%20criar%20missao");
  redirect("/painel?ok=1");
}

export async function aceitarMissaoAction(formData: FormData) {
  const missaoId = String(formData.get("missao_id") ?? "").trim();

  if (!missaoId) redirect("/painel-orientador?error=Missao%20invalida");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const orientadorId = auth?.user?.id;

  if (!orientadorId) redirect("/login?error=Faça%20login%20novamente");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, area")
    .eq("id", orientadorId)
    .single();

  if (!profile || profile.role !== "orientador") {
    redirect("/painel-orientador?error=Acesso%20negado");
  }

  const { data: missao } = await supabase
    .from("missoes")
    .select("id, status, area")
    .eq("id", missaoId)
    .single();

  if (!missao) {
    redirect("/painel-orientador?error=Missao%20nao%20encontrada");
  }

  if (missao.status !== "aberta") {
    redirect("/painel-orientador?error=Missao%20indisponivel");
  }

  if (profile.area && missao.area && profile.area !== missao.area) {
    redirect("/painel-orientador?error=Area%20incompativel");
  }

  const { error } = await supabase
    .from("missoes")
    .update({
      status: "em_andamento",
      orientador_id: orientadorId,
    })
    .eq("id", missaoId)
    .eq("status", "aberta");

  if (error) {
    redirect("/painel-orientador?error=Falha%20ao%20aceitar%20missao");
  }

  redirect("/painel-orientador?ok=1");
}

export async function marcarMissaoEntregueAction(formData: FormData) {
  const missaoId = String(formData.get("missao_id") ?? "").trim();

  if (!missaoId) redirect("/painel-orientador?error=Missao%20invalida");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  if (!userId) redirect("/login?error=Faça%20login%20novamente");

  const { data: missao } = await supabase
    .from("missoes")
    .select("id, status, orientador_id")
    .eq("id", missaoId)
    .single();

  if (!missao) {
    redirect("/painel-orientador?error=Missao%20nao%20encontrada");
  }

  if (missao.orientador_id !== userId) {
    redirect("/painel-orientador?error=Acesso%20negado");
  }

  if (missao.status !== "em_andamento") {
    redirect(`/missao/${missaoId}?error=Status%20invalido`);
  }

  const { error } = await supabase
    .from("missoes")
    .update({ status: "entregue" })
    .eq("id", missaoId)
    .eq("orientador_id", userId)
    .eq("status", "em_andamento");

  if (error) {
    redirect(`/missao/${missaoId}?error=Falha%20ao%20marcar%20como%20entregue`);
  }

  redirect(`/missao/${missaoId}?ok=entregue`);
}

export async function concluirMissaoAction(formData: FormData) {
  const missaoId = String(formData.get("missao_id") ?? "").trim();

  if (!missaoId) redirect("/painel-orientador?error=Missao%20invalida");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id;

  if (!userId) redirect("/login?error=Faça%20login%20novamente");

  const { data: missao } = await supabase
    .from("missoes")
    .select("id, status, orientador_id")
    .eq("id", missaoId)
    .single();

  if (!missao) {
    redirect("/painel-orientador?error=Missao%20nao%20encontrada");
  }

  if (missao.orientador_id !== userId) {
    redirect("/painel-orientador?error=Acesso%20negado");
  }

  if (missao.status !== "entregue") {
    redirect(`/missao/${missaoId}?error=Status%20invalido%20para%20conclusao`);
  }

  const { error } = await supabase
    .from("missoes")
    .update({ status: "concluida" })
    .eq("id", missaoId)
    .eq("orientador_id", userId)
    .eq("status", "entregue");

  if (error) {
    redirect(`/missao/${missaoId}?error=Falha%20ao%20concluir%20missao`);
  }

  redirect(`/missao/${missaoId}?ok=concluida`);
}

export async function enviarPropostaAction(formData: FormData) {
  const missaoId = String(formData.get("missao_id") ?? "").trim();
  const valor = formData.get("valor");
  const prazoDias = formData.get("prazo_dias");
  const mensagem = String(formData.get("mensagem") ?? "").trim();

  if (!missaoId) redirect("/painel-orientador?error=Missao%20invalida");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const orientadorId = auth?.user?.id;

  if (!orientadorId) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", orientadorId)
    .single();

  if (profile?.role !== "orientador") {
    redirect("/painel?error=Acesso%20negado");
  }

  // Verifica se a missão ainda está aberta
  const { data: missao } = await supabase
    .from("missoes")
    .select("id, status")
    .eq("id", missaoId)
    .single();

  if (!missao || missao.status !== "aberta") {
    redirect(`/missao/${missaoId}?error=Missao%20nao%20esta%20aberta`);
  }

  const { error } = await supabase.from("propostas").upsert(
    {
      missao_id: missaoId,
      orientador_id: orientadorId,
      valor: valor ? Number(valor) : null,
      prazo_dias: prazoDias ? Number(prazoDias) : null,
      mensagem: mensagem || null,
      status: "pendente",
    },
    { onConflict: "missao_id,orientador_id" }
  );

  if (error) {
    redirect(`/missao/${missaoId}?error=Falha%20ao%20enviar%20proposta`);
  }

  redirect(`/missao/${missaoId}?ok=proposta_enviada`);
}

export async function responderPropostaAction(formData: FormData) {
  const propostaId = String(formData.get("proposta_id") ?? "").trim();
  const missaoId = String(formData.get("missao_id") ?? "").trim();
  const resposta = String(formData.get("resposta") ?? "").trim(); // "aceita" | "recusada"

  if (!propostaId || !missaoId || !["aceita", "recusada"].includes(resposta)) {
    redirect("/painel?error=Dados%20invalidos");
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const alunoId = auth?.user?.id;

  if (!alunoId) redirect("/login");

  // Valida que o aluno é dono da missão
  const { data: missao } = await supabase
    .from("missoes")
    .select("id, status, aluno_id")
    .eq("id", missaoId)
    .single();

  if (!missao || missao.aluno_id !== alunoId || missao.status !== "aberta") {
    redirect(`/missao/${missaoId}?error=Acao%20nao%20permitida`);
  }

  // Busca a proposta para pegar o orientador_id
  const { data: proposta } = await supabase
    .from("propostas")
    .select("id, orientador_id")
    .eq("id", propostaId)
    .eq("missao_id", missaoId)
    .single();

  if (!proposta) {
    redirect(`/missao/${missaoId}?error=Proposta%20nao%20encontrada`);
  }

  // Atualiza status da proposta
  await supabase
    .from("propostas")
    .update({ status: resposta })
    .eq("id", propostaId);

  // Se aceitar: inicia a missão com esse orientador e recusa as demais
  if (resposta === "aceita") {
    await supabase
      .from("missoes")
      .update({ status: "em_andamento", orientador_id: proposta.orientador_id })
      .eq("id", missaoId)
      .eq("status", "aberta");

    // Recusa as outras propostas abertas da mesma missão
    await supabase
      .from("propostas")
      .update({ status: "recusada" })
      .eq("missao_id", missaoId)
      .neq("id", propostaId)
      .eq("status", "pendente");

    redirect(`/missao/${missaoId}?ok=proposta_aceita`);
  }

  redirect(`/missao/${missaoId}?ok=proposta_recusada`);
}