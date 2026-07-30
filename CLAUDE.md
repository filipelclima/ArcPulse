# ArcPulse

Dashboard de monitoramento da Arc blockchain testnet. Builder: HashZero. Objetivo: reputação na comunidade Arc House / cargo de Builder-Architect.

- **Deploy:** https://arcpulse-self.vercel.app — **em produção, uso real.** Qualquer mudança de código deve ser testada localmente antes de deploy; nunca empurrar mudança não verificada direto pra produção.
- **GitHub:** https://github.com/filipelclima/ArcPulse
- **Histórico completo / decisões passadas:** `ROADMAP.md` neste repo — sempre consultar antes de mexer em áreas já existentes (várias armadilhas já documentadas lá, ex. cron do Vercel Hobby sem retry, Supabase free tier pausando por inatividade, projeto Vercel duplicado já deletado).

## Stack

- Next.js `14.2.3`
- ethers `^6.16.0` + viem `^2.21.19`
- @supabase/supabase-js `^2.107.0` (coleta de snapshots)
- recharts `^2.12.7` (gráficos)
- Tailwind CSS

## Estrutura

- `src/app/page.tsx` — dashboard principal (abas: Reports, Compare, Anomalies, Network Status, Networks, Memo Activity, Batch Transactions, Chainlink Monitor)
- `src/app/DevDashboard.tsx` — aba Dev Dashboard (Connect Wallet via MetaMask/Rabby)
- `src/app/useArcData.ts` — hook de coleta/leitura de dados da chain
- API routes (`/api/collect`, `/api/public-stats`, `/api/faucet-status`) — ver `ROADMAP.md` para detalhes de cada uma

## Regras de trabalho

1. **Sempre rodar os testes unitários existentes antes de fazer commit.**
2. **Sempre escrever testes novos para features novas ou correções de bugs.**
3. **Sempre atualizar este CLAUDE.md após mudanças significativas** (e continuar registrando o histórico detalhado no `ROADMAP.md`, como já é feito neste projeto).
4. **Manter dependências fixadas em versões exatas** (sem `^` ou `~`) ao adicionar ou atualizar pacotes.
5. **Nunca usar atalhos que escondem erros** (`ignoreBuildErrors`, `@ts-nocheck`, etc.) — sempre corrigir a causa raiz.

## Comandos

```bash
npm run dev      # dev server
npm run build    # build de produção
```

> **Nota:** este projeto ainda não tem framework de testes configurado (sem Vitest/Jest). Antes de aplicar a regra 1 numa mudança específica, configurar um test runner e escrever os primeiros testes — com cuidado redobrado aqui por ser produção real, com cron e alertas Discord já dependendo do comportamento atual.
