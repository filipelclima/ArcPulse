# ArcPulse — Roadmap

> Dashboard de monitoramento da Arc blockchain testnet. Builder: HashZero.
> Objetivo: ganhar reputação na comunidade Arc House e conseguir o cargo de Builder/Architect.

## Status atual (última atualização: 01/07/2026, sessão 3)

10 abas/rotas em produção: Dashboard, Reports (AI Report + Uptime History + Export CSV/JSON),
Compare (Export CSV/JSON), Anomalies, Network Status (Success Rate + Tx Type Breakdown + RPC Monitor
+ Gas Estimator + **Faucet Status Tracker**), Dev Dashboard (Connect Wallet via MetaMask/Rabby),
Networks (Arc vs Ethereum/Polygon/BNB/Arbitrum), Memo Activity, **Batch Transactions**,
+ **API Pública** (`/api/public-stats`).

9 abas em `page.tsx`: Dashboard, Reports (AI Report + Uptime History), Compare, Anomalies,
Network Status (Success Rate + Tx Type Breakdown + RPC Monitor + Gas Estimator), Dev Dashboard
(Connect Wallet via MetaMask/Rabby), Networks (Arc vs Ethereum/Polygon/BNB/Arbitrum), Memo Activity,
**Batch Transactions** (nova).

**Concluído recentemente:**

- **Memo Activity Monitor:** varredura corrigida de 200 → 2000 blocos (sub-1s block time da Arc fazia
  txs "saltarem fora" da janela rápido demais). Trocada amostragem esparsa (20 blocos) por varredura
  completa em lotes de 50 (`MEMO_SCAN_RANGE`, `MEMO_SCAN_BATCH_SIZE` no `page.tsx`). Validado em
  produção com 39 memo txs capturadas corretamente.
- **Memo ID zerado — resolvido:** confirmado via doc oficial (`docs.arc.io/arc/references/contract-addresses`)
  que o endereço USDC na Arc é `0x3600000000000000000000000000000000000000` — exatamente o "Target"
  que aparecia em todas as memo txs. O parsing está correto: o target real é o contrato USDC, porque o
  `send-memo.ts` testa memos anexados a transferências de USDC. O Memo ID sempre zerado é o script de
  teste usando um placeholder fixo, não bug no `page.tsx`.
- **Batch Transactions Monitor (nova aba "📦 Batch Transactions") — concluído e em produção.** Usa o
  contrato oficial `Multicall3From` (`0x522fAf9A91c41c443c66765030741e4AaCe147D0`, confirmado em
  `docs.arc.io/arc/references/contract-addresses` — preserva `msg.sender` via precompile `CallFrom`).
  Decodificação via `viem` (`decodeFunctionData`, ABI padrão do Multicall3:
  `aggregate`/`aggregate3`/`aggregate3Value`) em vez de slicing manual. Mostra: txs em lote, total de
  calls batchadas, contratos mais chamados via batch, gas economizado estimado (~21k gas por call extra
  evitada).
- **Investigação do gap no Uptime History (19-23/06) — causa raiz não 100% confirmada, mas
  infraestrutura corrigida.** Resumo da investigação:
  - Descartado bug de código: `ReportsTab`/Uptime History só lista dias que realmente têm linhas no
    Supabase, sem `LIMIT` e sem criar buracos artificiais.
  - Descoberto e descartado: existia um **projeto Vercel duplicado** (`arc-pulse`, com hífen →
    `arc-pulse-ruddy.vercel.app`), importado por engano em 03/06, com seu próprio cron e env vars do
    Supabase — mas confirmado via teste direto (inserção não apareceu na tabela) que ele escrevia num
    banco Supabase **diferente** (órfão). Não era a causa do gap. Já deletado (ver abaixo).
  - Causa mais provável: cron do Hobby da Vercel não tem retry em caso de falha (confirmado na doc
    oficial), combinado possivelmente com pause por inatividade do Supabase free tier (pausa após 7
    dias sem query real). Logs de execução do cron e da function no Hobby só ficam retidos por 1h — não
    foi possível confirmar forense o que houve especificamente em 19-23/06.
  - **Descoberta importante ao testar a correção:** o problema não era só histórico — entre 24/06 e
    28/06 (4 dias) o cron ficou mudo de novo, sem nenhum snapshot novo. Ou seja, é um problema **crônico**
    da infra free tier, não um incidente isolado.
- **Self-heal + alerta no Discord — implementado e validado em produção (28/06).**
  - Frontend (`page.tsx`, componente `Home`): ao abrir o site, checa há quanto tempo veio o último
    snapshot; se > 26h, dispara `/api/collect` na hora, sem esperar o cron.
  - Backend (`/api/collect/route.ts`): antes de inserir, compara com o último `created_at` existente;
    se o gap > 26h, manda alerta pro Discord via `DISCORD_WEBHOOK_URL` (env var). Se a própria inserção
    falhar, manda alerta de erro também.
  - Validado: ao testar, capturou um gap real de **99.6h** (24/06 → 28/06) e alertou corretamente.
- **Alerta de anomalia de rede no Discord — concluído (28/06).** Reaproveita o mesmo
  `sendDiscordAlert`/`DISCORD_WEBHOOK_URL` do item acima. Compara o estado de anomalia do snapshot
  anterior (`anomaly` no banco) com o atual e alerta só na **transição**: 🔴 quando entra em anomalia
  (com score, block time médio, latência e bloco), ✅ quando volta a saudável. Não espama o canal
  enquanto o problema persiste — 1 aviso no início, 1 na recuperação. Isso fecha os dois itens
  "Webhook/Discord Alert" do roadmap (confiabilidade da coleta + anomalia de rede).
- **Projeto Vercel duplicado `arc-pulse` — deletado (28/06).** Housekeeping concluído.
- **Export de dados CSV/JSON — concluído (30/06).** Botões "⬇ CSV" / "⬇ JSON" reutilizáveis
  (`ExportButtons`, helpers `toCSV`/`exportCSV`/`exportJSON`/`downloadFile` em escopo de módulo).
  Em **Reports**: na barra de filtro (exporta todos os snapshots do período filtrado) e no detalhe do
  dia selecionado (exporta só aquele dia). Em **Compare**: um par de botões por período (A e B),
  exportando os dados brutos de cada um. CSV gerado sem dependência nova, com escape correto de
  vírgulas/aspas/quebras de linha. Botões desabilitados quando não há dados.
- **Faucet Status Tracker — concluído (01/07).** Nova rota `/api/faucet-status` (server-side,
  `force-dynamic`) + card "💧 Circle Faucet Status" no topo da aba Network Status. Três estados:
  🟢 Online (2xx + latência), 🟡 Reachable com bloqueio (4xx — bot protection comum em IPs de
  datacenter, não significa fora do ar), 🔴 Offline (timeout/sem resposta). Detalhe importante: testado
  e confirmado que `faucet.circle.com` retorna 403 pra IPs de cloud/datacenter (incluindo Vercel
  serverless) — um monitor simples verde/vermelho mostraria falso positivo permanente de "OFFLINE".
  A versão atual distingue os 3 estados e explica ao usuário o que cada um significa.
- **API Pública `/api/public-stats` — concluída (01/07).** Rota read-only, unauthenticated, CORS
  aberto (`*`), cache de 5min. Três endpoints: `summary` (agregados 7d + 30d: block time, gas price,
  latência RPC, health score, tx count, anomaly count), `latest` (snapshot mais recente), `snapshots`
  (dados brutos paginados, params `limit` até 100 e `days` até 30). Usa `ANON_KEY` (não a
  `SERVICE_KEY`) — princípio de menor privilégio. Autodocumentada via campo `meta` em cada resposta.
  Validado em produção: `{"ok":true,"endpoint":"summary","last_7d":{"snapshots":9,"avg_health_score":96},...}`

**Pendências abertas:**
- Localizar e limpar o projeto Supabase órfão associado ao `arc-pulse` (free tier permite só 2
  projetos ativos) — o projeto Vercel já foi deletado, mas o banco órfão pode ainda existir do lado do
  Supabase.
- Confirmar nos próximos dias se o cron da Vercel "voltou a funcionar" sozinho ou se vai continuar
  falhando (nesse caso, o self-heal cobre o buraco toda vez que alguém visita o site, mas o ideal seria
  o cron funcionar de verdade).
- Considerar trocar a varredura do Memo Activity por `eth_getLogs` (mais eficiente que varrer 2000
  blocos) — doc oficial confirma que o contrato Memo "emits `Memo` events with a sequential index".
  Ainda não implementado para não arriscar quebrar o que já foi validado em produção.
- Confirmar decodificação do Multicall3From com uma batch tx real (ainda não testado contra a RPC ao
  vivo — sandbox de desenvolvimento não tem acesso à RPC da Arc).

## Arc Ecosystem Watch (log de novidades do Discord/Arc)

> HashZero cola aqui resumos de anúncios do Discord da Arc entre sessões, pra manter qualquer chat
> novo atualizado sem precisar reexplicar tudo.

- **26/06/2026 — Vyper on Arc (agentic payments).** Spotlight da Arc sobre o trabalho da Vyper
  (linguagem Pythonic para EVM, framework Titanoboa) na Arc Testnet combinando três camadas: identidade
  (registro/validação/reputação de agentes via **ERC-8004**), liquidação (fluxos **x402** + Circle Gateway
  para pagamentos software-native) e controles programáveis (escrow, assinaturas, split payments, limites
  de gasto). Relevante pro ArcPulse: doc oficial da Arc já tem tutoriais nativos pra ERC-8004
  (`/arc/tutorials/register-your-first-ai-agent`) e ERC-8183 (`/arc/tutorials/create-your-first-erc-8183-job`)
  — possível ideia futura: aba "Agent Activity" monitorando registros ERC-8004 ou settlements x402, no
  mesmo padrão do Memo/Batch Activity. Ainda não implementado, só anotado.
  Fontes: community.arc.io/Arc House (blog) e arc.io/blog/building-agentic-economic-workflows-with-vyper-on-arc.

## 🏁 Roadmap original — 100% concluído

Todos os itens planejados foram implementados e validados em produção.

## 💡 Próximas ideias (a priorizar)

1. **Apresentação para Arc House / Office Hours** — documentar o ArcPulse de forma clara
   para a comunidade Arc: o que monitora, quais features da v0.7.2 cobre, dados reais capturados,
   link para o site e API pública. Impacto direto no objetivo de Builder/Architect.

2. **Agent Activity Monitor** — monitorar registros ERC-8004 (agentes de IA) e settlements x402
   na Arc Testnet, no mesmo padrão do Memo/Batch Activity. Inspirado no spotlight da Vyper (26/06).

3. **Melhorar varredura do Memo Activity** — trocar varredura bloco-a-bloco por `eth_getLogs`
   (muito mais eficiente). Doc oficial confirma que o contrato Memo emite eventos com índice sequencial.

## Contexto do projeto (para retomar em chat novo)

- Site: https://arcpulse-self.vercel.app
- GitHub: https://github.com/filipelclima/ArcPulse
- Supabase: `xquxgqypeappuxdmusdt` (snapshots) — projeto Vercel correto é **`arcpulse`** (sem hífen).
  Existia um projeto duplicado **`arc-pulse`** (com hífen) que escrevia num Supabase órfão diferente —
  **já deletado da Vercel (28/06)**. Banco Supabase órfão associado a ele pode ainda existir, pendente
  de limpeza (ver pendências abertas).
- Pasta local: `C:\Users\faecu\Downloads\arcpulse\arcpulse`
- Stack: Next.js 14 + Vercel + Supabase + Anthropic API + RPC público `https://rpc.testnet.arc.network`
- `/api/collect`: coleta snapshots no Supabase (cron 1x/dia + manual + self-heal no frontend) + alerta
  Discord via `DISCORD_WEBHOOK_URL`
- `/api/report`: gera relatório via Anthropic API
- `DevDashboard.tsx`: ConnectButton/DevDashboardTab própria, sem Reown/WalletConnect (`window.ethereum` direto)
- Script de teste de memos: `send-memo.ts` em `C:\Users\faecu\Downloads\memo-test\memo-test` (fora do projeto principal)
- Fluxo de deploy: Claude gera arquivo → zip → usuário extrai com `tar -xf` no CMD → `git add/commit/push` → Vercel auto-deploy
- v0.7.2 hardfork (18/06/2026): Transaction Memos + Batch Transactions (ativos). Privacy whitepaper:
  anunciado, ainda não implementado na chain.
- HashZero já submeteu formulário de Office Hours da Arc.
