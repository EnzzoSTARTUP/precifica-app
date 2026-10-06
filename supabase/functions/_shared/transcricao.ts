// Transcrição de áudio em português via OpenAI (gpt-4o-transcribe).

export const AUDIO_MAX_BYTES = 10 * 1024 * 1024;
const TIPOS_OK = ["audio/webm", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "video/webm", "video/mp4"];

export function validarAudio(arquivo: File): string | null {
  if (arquivo.size === 0) return "Áudio vazio.";
  if (arquivo.size > AUDIO_MAX_BYTES) return "Áudio muito grande (máximo 10 MB, uns 90 segundos).";
  const tipo = (arquivo.type || "").split(";")[0].trim().toLowerCase();
  if (tipo && !TIPOS_OK.includes(tipo)) return `Formato de áudio não suportado (${tipo}).`;
  return null;
}

export async function transcrever(arquivo: File): Promise<{ texto: string; ms: number }> {
  const chave = Deno.env.get("OPENAI_API_KEY");
  if (!chave) throw new Error("OPENAI_API_KEY ausente");
  const inicio = Date.now();
  const form = new FormData();
  // nome com extensão ajuda o serviço a detectar o container
  const ext = (arquivo.type || "").includes("webm") ? "webm" : (arquivo.type || "").includes("mp4") || (arquivo.type || "").includes("m4a") ? "m4a" : (arquivo.type || "").includes("wav") ? "wav" : (arquivo.type || "").includes("ogg") ? "ogg" : "mp3";
  form.append("file", arquivo, `audio.${ext}`);
  form.append("model", Deno.env.get("OPENAI_TRANSCRIBE_MODEL") || "gpt-4o-transcribe");
  form.append("language", "pt");
  form.append("response_format", "json");
  form.append("prompt", "Receita de restaurante em português do Brasil: nome do prato, ingredientes e quantidades (gramas, mililitros, colheres, xícaras, unidades).");

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}` },
    body: form,
  });
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    throw new Error(`Transcrição falhou (${resp.status}): ${corpo.slice(0, 300)}`);
  }
  const dados = await resp.json();
  return { texto: String(dados.text || "").trim(), ms: Date.now() - inicio };
}
