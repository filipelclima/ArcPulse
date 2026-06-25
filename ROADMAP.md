# ArcPulse — Roadmap

> Dashboard de monitoramento da Arc blockchain testnet. Builder: HashZero.
> Objetivo: ganhar reputação na comunidade Arc House e conseguir o cargo de Builder/Architect.

## Status atual (última atualização: 24/06/2026)

8 abas em `page.tsx`: Dashboard, Reports (AI Report + Uptime History), Compare, Anomalies,
Network Status (Success Rate + Tx Type Breakdown + RPC Monitor + Gas Estimator), Dev Dashboard
(Connect Wallet via MetaMask/Rabby), Networks (Arc vs Ethereum/Polygon/BNB/Arbitrum), Memo Activity.

**Concluído recentemente:**
- Memo Activity Monitor: varredura corrigida de 200 → 2000 blocos (sub-1s block time da Arc fazia
  txs "saltarem fora" da janela rápido demais). Trocada amostragem esparsa (20 blocos) por varredura
  completa em lotes de 50 (`MEMO_SCAN_RANGE`, `MEMO_SCAN_BATCH_SIZE` no `page.tsx`). Validado em
  produção com 39 memo txs capturadas corretamente.
- **Pendência aberta:** todas as 39 memo txs capturadas mostram o mesmo Memo ID
  (`0x0000000000000000...`) repetido. Pode ser comportamento esperado do script de teste
  (`send-memo.ts`, fora do projeto principal) ou bug de offset no parsing de `tx.input`
  (linha que faz `tx.input.slice(34,74)` / `.slice(74,138)` no `MemoActivityTab`). Precisa
  confirmar com o `tx.input` bruto de uma transação antes de decidir se corrige.

## 🔴 Alta prioridade

1. **Batch Transactions Monitor**
   Par do Memo Activity — v0.7.2 também trouxe Batch Transactions (múltiplas calls em uma tx).
   Mostrar: quantas txs usam batching, economia de gas estimada, quais contratos mais se
   beneficiam. Reaproveitar a estrutura do `MemoActivityTab` (varredura em lotes já resolvida ali).

2. **Export de dados (CSV/JSON)**
   Botão em Reports e Compare para exportar dados brutos. Aumenta percepção de "ferramenta
   profissional" para builders e para a própria equipe Arc.

## 🟡 Médio prazo

3. **Webhook/Discord Alert**
   Anomalia crítica detectada → notificação automática via webhook num canal Discord. Transforma
   o ArcPulse de dashboard passivo em sistema de alerta ativo.

4. **Faucet Status Tracker**
   Monitorar se o Circle Faucet está respondendo normalmente — pergunta recorrente de builders novos.

## 🟢 Mais ambicioso

5. **API pública do ArcPulse**
   Expor dados já coletados via `/api/public-stats` para outros builders consumirem. Posiciona o
   ArcPulse como infraestrutura da comunidade, não só um dashboard.

## Contexto do projeto (para retomar em chat novo)

- Site: https://arcpulse-self.vercel.app
- GitHub: https://github.com/filipelclima/ArcPulse
- Supabase: `xquxgqypeappuxdmusdt` (snapshots)
- Pasta local: `C:\Users\faecu\Downloads\arcpulse\arcpulse`
- Stack: Next.js 14 + Vercel + Supabase + Anthropic API + RPC público `https://rpc.testnet.arc.network`
- `/api/collect`: coleta snapshots no Supabase (cron 1x/dia + manual)
- `/api/report`: gera relatório via Anthropic API
- `DevDashboard.tsx`: ConnectButton/DevDashboardTab própria, sem Reown/WalletConnect (`window.ethereum` direto)
- Script de teste de memos: `send-memo.ts` em `C:\Users\faecu\Downloads\memo-test\memo-test` (fora do projeto principal)
- Fluxo de deploy: Claude gera arquivo → zip → usuário extrai com `tar -xf` no CMD → `git add/commit/push` → Vercel auto-deploy
- v0.7.2 hardfork (18/06/2026): Transaction Memos + Batch Transactions (ativos). Privacy whitepaper:
  anunciado, ainda não implementado na chain.
- HashZero já submeteu formulário de Office Hours da Arc.
