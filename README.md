# Moto KM

App para registrar km, bateria (5 tracinhos), consumo e recargas de moto elétrica usando o GPS do celular. Dados ficam só no aparelho.

Existem duas formas de usar:

| | Site (PWA, tela inicial) | App iPhone (nativo) |
|---|---|---|
| GPS com a tela bloqueada | ❌ o iOS pausa; o trecho é estimado em linha reta | ✅ continua medindo, igual ao Strava |
| Instalação | abrir o site no Safari → Compartilhar → Tela de Início | Xcode (Mac) ou TestFlight |

O iPhone **não deixa sites usarem o GPS com a tela bloqueada**. Por isso o Strava é um app nativo. ## Mapa e perigos no caminho

Na aba **Mapa** aparecem as rotas das viagens e os perigos marcados (fio caído, buraco, alagamento, obra, acidente). Para marcar: botão **Avisar perigo aqui** (usa o GPS) ou segurar o dedo no mapa. Durante a viagem o app avisa com voz quando chega a 200 m de um perigo. Por enquanto os avisos ficam só neste aparelho; o compartilhamento entre usuários (com login) vem numa próxima etapa.

O mapa usa OpenStreetMap/CARTO e precisa de internet.

O app nativo aqui usa o [Capacitor](https://capacitorjs.com) com o plugin `@capacitor-community/background-geolocation`, que liga o modo "localização em segundo plano" do iOS (a seta azul no topo da tela).

## Gerar o app do iPhone

Precisa de um Mac com Xcode 16+ e uma conta Apple (a grátis instala no seu iPhone por 7 dias; a de desenvolvedor, US$ 99/ano, permite TestFlight e não expira).

```bash
npm install
npm run ios:sync
npm run ios:open
```

No Xcode: selecione o projeto **App** → *Signing & Capabilities* → escolha seu *Team* (troque o *Bundle Identifier* `br.motokm.app` se o Xcode reclamar), conecte o iPhone e aperte ▶︎.

Na primeira viagem, aceite o acesso à localização. Depois disso pode bloquear a tela.

Sempre que mudar o `index.html`, rode `npm run ios:sync` de novo.

Sem Mac: dá para compilar na nuvem com serviços como Codemagic ou Ionic Appflow, usando a pasta `ios/`.
