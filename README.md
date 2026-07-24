# Passagem Sombria — Deck de Campo Online

Webapp multiplayer para o RPG **Passagem Sombria** (livro v1.3): perfis de usuário, fichas salvas na nuvem, campanhas com código de convite, mesa com chat em tempo real (rolagens pelos personagens, direcionamento de dano/cura, nave da campanha com estações de batalha) e biblioteca completa do sistema.

**Stack:** vanilla JS (ES Modules) + Supabase (Auth, Postgres, Realtime) + Vercel — a mesma do Forja de Cartas.

## Estrutura

```
webapp/
├── README.md
├── supabase/
│   └── schema.sql          ← todo o banco: tabelas, RLS, RPC, realtime
└── public/                 ← raiz de deploy (Vercel)
    ├── index.html
    ├── css/estilo.css
    └── js/
        ├── config.js       ← SUAS CHAVES AQUI
        ├── dados-jogo.js   ← dados do livro (raças c/ lore, 50 armas, 10 naves, scripts…)
        └── app.js          ← SPA: auth, hangar, ficha, campanhas, mesa, biblioteca
```

## Setup (15 minutos)

### 1. Supabase
1. Crie um projeto em [supabase.com](https://supabase.com) (free tier serve).
2. **SQL Editor** → cole o conteúdo de `supabase/schema.sql` → Run. Isso cria:
   - `perfis` (criado automaticamente no signup via trigger)
   - `personagens` (ficha inteira em `dados` jsonb — mesmo formato do artifact Deck de Campo)
   - `campanhas` (código de convite de 6 letras + estado da nave em jsonb)
   - `campanha_membros` (com `posto` da estação de batalha)
   - `mensagens` (chat: texto / rolagem / dano / cura / sistema / nave)
   - RLS completa + função `entrar_campanha(codigo)` + realtime
3. **Authentication → Providers**: habilite **Google** (cole Client ID/Secret do Google Cloud Console, igual você fez no Forja de Cartas) e deixe **Email** ativo para o link mágico.
4. **Authentication → URL Configuration**: adicione a URL do deploy (e `http://localhost:3000` para dev) em *Redirect URLs*.

### 2. Chaves
Edite `public/js/config.js` com a URL e a **anon key** do projeto (Settings → API). A anon key é pública por design; quem protege os dados são as políticas RLS.

### 3. Rodar local
```bash
cd public
npx serve .        # ou python3 -m http.server 3000
```

### 4. Deploy na Vercel
- Importe o repositório; **Root Directory = `public`** (site estático, sem build).
- Depois adicione o domínio final nas Redirect URLs do Supabase.

## Como funciona a mesa

- **Vincular personagem**: cada jogador escolhe um dos seus personagens; ele fica visível para o grupo (RLS libera leitura aos membros da campanha).
- **Rolagens**: testes de perícia, ataques com a arma equipada (dano e crítico já calculados) e Scripts (debitam a RAM da ficha na nuvem) são postadas no chat via Realtime. `/r 2d6+1` no chat rola dados livres.
- **Dano/cura direcionados**: qualquer jogador envia `💥 DANO` apontando um personagem; a mensagem chega com o botão **APLICAR** visível apenas para o dono do alvo (a RLS impede editar ficha alheia). Ao aplicar, o PV atualiza e o sistema anuncia na mesa.
- **Nave**: o Mestre define o modelo (as 10 do livro, com Casco/Escudos/Manobra/Dano) e batiza. Membros escolhem seu **posto** (Leme, Artilharia, Engenharia, Sensores) e executam as ações da estação — Redirecionar Energia e Reparos de Emergência curam escudos/casco de verdade, com as rolagens do livro. O Mestre aplica dano à nave (escudos absorvem primeiro).
- **Biblioteca**: acessível até sem login — lore completa das 9 raças (com Lendárias), 15 classes v1.3, 50 armas com descrição, armaduras, implantes, 30 Scripts, filosofias, 10 naves + estações + regras de dobra.

## Próximos passos sugeridos

1. Portar o editor completo do artifact (console de ações local, tracking de usos, descansos) para a página de ficha.
2. Iniciativa compartilhada na mesa e marcador de turno.
3. Upload de retrato para o Supabase Storage (hoje a foto vive no jsonb como no artifact).
4. Página pública de campanha (log da sessão) para os ausentes lerem depois.
