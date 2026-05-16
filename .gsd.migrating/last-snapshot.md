# GSD context snapshot (2026-05-16T12:34:36.599Z)

## Top project memories
- [MEM001] (architecture) Sidebar consolidation strategy Chose: Agrupar telas por abas dentro de páginas existentes (Tabs do shadcn/ui). Rationale: Mantém URLs simples, não quebra bookmarks, usa componente já disponível no projeto. Alternativas: nested routes (mais complexo) ou dropdown menus (esconde funcionalidades)..
- [MEM002] (architecture) Dashboard do dia como página principal Chose: /dashboard mostra visão do dia por padrão com toggle para visão mensal. Rationale: Freelancer precisa da visão diária como porta de entrada; visão mensal continua acessível mas não é o default. Alternativas: rota separada /hoje (fragmenta) ou widget no topo (pouco destaque)..
- [MEM003] (architecture) Error handling strategy Chose: Toast genérico + console log para erros de query; estados vazios amigáveis; TypeScript strict mode. Rationale: App single-user — toast + console é suficiente sem over-engineering. Error boundaries e Sentry são overkill nesse estágio..
- [MEM004] (architecture) Remover journaling/mood feature Chose: Remover daily_journal e todas as referências; Diário na sidebar vira Tracking (Logs). Rationale: Tracking de horas é essencial para freelancer; journaling com mood é ruído que compete por atenção na navegação..
