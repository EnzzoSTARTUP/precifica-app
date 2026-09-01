# Precifica

Calculadora de precificação — custo, markup e preço de venda por canal, com ponto de equilíbrio e ranking de margem por produto.

## Stack

- React + Vite
- Supabase (autenticação e dados por usuário, com Row Level Security)
- Netlify (hospedagem, deploy contínuo a partir da branch `main`)

## Desenvolvimento local

```bash
npm install
npm run dev
```

Crie um arquivo `.env` na raiz com:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Deploy

Qualquer push na branch `main` publica automaticamente em produção via Netlify.
