# Decisions Register

<!-- Append-only. Never edit or remove existing rows.
     To reverse a decision, add a new row that supersedes it.
     Read this file at the start of any planning or research phase. -->

| # | When | Scope | Decision | Choice | Rationale | Revisable? | Made By |
|---|------|-------|----------|--------|-----------|------------|---------|
| D001 |  | architecture | Sidebar consolidation strategy | Agrupar telas por abas dentro de páginas existentes (Tabs do shadcn/ui) | Mantém URLs simples, não quebra bookmarks, usa componente já disponível no projeto. Alternativas: nested routes (mais complexo) ou dropdown menus (esconde funcionalidades). | Yes | collaborative |
| D002 |  | architecture | Dashboard do dia como página principal | /dashboard mostra visão do dia por padrão com toggle para visão mensal | Freelancer precisa da visão diária como porta de entrada; visão mensal continua acessível mas não é o default. Alternativas: rota separada /hoje (fragmenta) ou widget no topo (pouco destaque). | Yes | collaborative |
| D003 |  | architecture | Error handling strategy | Toast genérico + console log para erros de query; estados vazios amigáveis; TypeScript strict mode | App single-user — toast + console é suficiente sem over-engineering. Error boundaries e Sentry são overkill nesse estágio. | Yes | collaborative |
| D004 |  | architecture | Remover journaling/mood feature | Remover daily_journal e todas as referências; Diário na sidebar vira Tracking (Logs) | Tracking de horas é essencial para freelancer; journaling com mood é ruído que compete por atenção na navegação. | Yes | human |
| D005 |  | architecture | How to handle old routes after tab consolidation (/disponibilidade, /folgas, /pipeline) | Keep standalone route page.tsx files intact for backward compatibility — old URLs continue to work but are no longer in the sidebar | Preserves bookmarks and any external links. Zero cost to keep them since the server components are trivial. Users who navigate via old URLs see the full-page version; sidebar users see the tab version. No redirects needed. | yes — can add redirects later if analytics show old routes have zero traffic | agent |
