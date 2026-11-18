# Histórico de mudanças

Mudanças relevantes do Moto KM. A versão pública fica no `package.json` e segue `MAJOR.MINOR.PATCH`: PATCH para correções compatíveis, MINOR para funcionalidades compatíveis e MAJOR para mudanças incompatíveis (por exemplo, dados antigos que deixam de abrir). O processo de release está no README, em "Versões e releases".

## [Não lançado]

Próxima release sugerida: **1.2.0** (funcionalidades novas, compatíveis com os dados de antes).

### Novo
- Ajustes: **Aparência** com Claro, Escuro e Sistema (padrão). Em Sistema, acompanha o aparelho com o app aberto; no iPhone, a barra de status acompanha o tema.
- Ajustes: **Sobre o Moto KM** com a versão (e o build no iPhone) e um botão para copiar ao relatar um problema.
- Visual de painel elétrico nas telas da viagem: "Bora rodar", distância em destaque durante a viagem e resumo "Rolê salvo" com rota, duração, média, bateria e consumo estimado (#8).
- Pausar e retomar a viagem, com o tempo pausado fora do cálculo (#7).
- Autonomia de fábrica (40 km) em Ajustes e "Ainda dá para rodar" durante a viagem (#5).

### Corrigido
- Viagem em andamento volta com os pontos já gravados se o app for fechado, e é salva uma vez só (#6).
- A tela da viagem aparece na hora ao tocar em iniciar (#3).
- A lista de viagens mostra a hora de chegada em vez do tempo em movimento com cara de horário (#1).

### Interno
- Versão única: `package.json` → `APP_VERSION` no `index.html` e `MARKETING_VERSION` no iOS (`npm run version:sync`); o build falha se divergirem.
- Plugins `@capacitor/app` (versão e build instalados) e `@capacitor/status-bar`.
- App nativo e mapa juntados na `main` (#2); prints de teste removidos (#4).

## [1.1.0] - 2026-11-12

### Novo
- App iOS nativo (Capacitor) com GPS em segundo plano: mede a viagem com a tela bloqueada.
- No site, o trecho em que o GPS ficou parado é estimado em linha reta.
- Mapa com as rotas e avisos de perigo no caminho, com alerta por voz (2026-11-13, sem mudança de versão).

## [1.0.0] - 2026-11-07

### Novo
- Primeira versão do site (PWA): km, bateria em 5 tracinhos, consumo e recargas, com os dados só no aparelho.
