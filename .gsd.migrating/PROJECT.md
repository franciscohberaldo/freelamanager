# Freela Manager

## What This Is

Plataforma de gestão completa para freelancers — consolida clientes, projetos, horas, faturas, finanças e automações num único painel. Em produção na Vercel com banco Supabase. UI em português brasileiro.

## Core Value

Freelancer abre o app e em 5 segundos sabe o que tem pra fazer hoje, quanto já trabalhou, e se está no caminho das metas do mês.

## Project Shape

- **Complexity:** complex
- **Why:** 30+ tabelas, 18 rotas de API, auth em middleware, consolidação de navegação + bug fixes + features novas em paralelo

## Current State

App funcional em produção com 16 telas na sidebar. Dashboard mostra KPIs mensais. Time tracking, invoicing, CRM pipeline, projetos com Gantt/Kanban, agenda, relatórios e automações (crons) todos operacionais. Client portal implementado com token de acesso. PWA estrutura pronta. Supabase free tier com cron keep-alive configurado para evitar pausa por inatividade.

Problemas: types.ts incompleto (só 8 de 30+ tabelas tipadas), 19 instâncias de `as any`, payment dialog ignora moeda da invoice, navegação pesada (16 itens), sem visão diária, sem paginação.

## Architecture / Key Patterns

- Next.js 14 (App Router) + Supabase (PostgreSQL + Auth + RLS)
- shadcn/ui + Tailwind CSS + Recharts
- supabase-js client em browser e server (createBrowserClient / createServerClient)
- Auth via middleware com session refresh
- API routes protegidas por getUser() + API keys (v1)
- Crons protegidos por CRON_SECRET
- jsPDF para geração de invoices, Resend para emails
- Claude SDK para AI descriptions em invoices

## Capability Contract

See `.gsd/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [ ] M001: Polish & Consolidation — Corrigir bugs, consolidar navegação 16→9, dashboard do dia, melhorias de UX e portal do cliente
