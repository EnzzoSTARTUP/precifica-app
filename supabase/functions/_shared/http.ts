// Helpers HTTP das Edge Functions: CORS restrito, respostas JSON, IP do cliente.

const ORIGENS_PADRAO = ["https://prezosistem.netlify.app", "http://localhost:5173", "http://127.0.0.1:5173"];

export function origensPermitidas(): string[] {
  const extra = (Deno.env.get("ALLOWED_ORIGINS") || "").split(",").map((s) => s.trim()).filter(Boolean);
  return [...ORIGENS_PADRAO, ...extra];
}

export function corsHeaders(req: Request): Record<string, string> {
  const origem = req.headers.get("origin") || "";
  const ok = origensPermitidas().includes(origem) || /^https:\/\/[a-z0-9-]+--prezosistem\.netlify\.app$/.test(origem);
  return {
    "Access-Control-Allow-Origin": ok ? origem : origensPermitidas()[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function erro(req: Request, mensagem: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return json(req, { erro: mensagem, ...extra }, status);
}

export function preflight(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  return null;
}

export function ipDoCliente(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "desconhecido";
}
