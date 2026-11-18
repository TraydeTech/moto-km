# Moto KM

App para registrar km, bateria (5 tracinhos), consumo e recargas de moto elétrica usando o GPS do celular. Dados ficam só no aparelho.

Existem duas formas de usar:

| | Site (PWA, tela inicial) | App iPhone (nativo) |
|---|---|---|
| GPS com a tela bloqueada | ❌ o iOS pausa; o trecho sem GPS fica fora da rota e da distância | ✅ continua medindo, igual ao Strava |
| Instalação | abrir o site no Safari → Compartilhar → Tela de Início | Xcode (Mac) ou TestFlight |

O iPhone **não deixa sites usarem o GPS com a tela bloqueada**. Por isso o Strava é um app nativo. ## Mapa e perigos no caminho

Na aba **Mapa** aparecem as rotas das viagens e os perigos marcados (fio caído, buraco, alagamento, obra, acidente). Para marcar: botão **Avisar perigo aqui** (usa o GPS) ou segurar o dedo no mapa. Durante a viagem o app avisa com voz quando chega a 200 m de um perigo. Por enquanto os avisos ficam só neste aparelho; o compartilhamento entre usuários (com login) vem numa próxima etapa.

O mapa usa OpenFreeMap (grátis, sem chave) com dados do OpenStreetMap e precisa de internet.

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

Sempre que mudar o `index.html`, rode `npm run ios:sync` de novo. Quando o `package.json` ganhar plugins novos, rode `npm install` antes.

Sem Mac: dá para compilar na nuvem com serviços como Codemagic ou Ionic Appflow, usando a pasta `ios/`.

## Versões e releases

A versão pública fica no `package.json` (`MAJOR.MINOR.PATCH`) e aparece em **Ajustes → Sobre o Moto KM**. No iPhone aparece também o número do build, por exemplo `1.2.0 (3)`. O histórico está no [CHANGELOG.md](CHANGELOG.md).

- **PATCH** (1.2.0 → 1.2.1): correções compatíveis.
- **MINOR** (1.2.0 → 1.3.0): funcionalidades novas compatíveis.
- **MAJOR** (1.2.0 → 2.0.0): mudanças incompatíveis, como dados antigos que deixam de abrir.

O `npm run build:www` (e portanto o `npm run ios:sync`) para com erro se a versão do `package.json`, a `APP_VERSION` do `index.html` e a `MARKETING_VERSION` do iOS forem diferentes.

### Publicar uma versão

1. Mude a versão. Este comando atualiza o `package.json`, o `index.html` e o iOS de uma vez (troque `minor` por `patch` ou `major`):

   ```bash
   npm version minor --no-git-tag-version
   ```

2. No `CHANGELOG.md`, troque `## [Não lançado]` por `## [1.2.0] - AAAA-MM-DD` e abra uma seção `## [Não lançado]` vazia em cima.
3. Antes de cada build enviado para distribuição (TestFlight ou App Store), some 1 no build do iOS:

   ```bash
   npm run ios:build-number
   ```

4. Confira tudo:

   ```bash
   npm run release:check
   ```

5. Faça o commit, junte na `main` e, no commit aprovado, crie a tag e a release do GitHub (por exemplo `v1.2.0`). Nas notas da release, liste os builds distribuídos, como `1.2.0 (3) — TestFlight`.

Para testar no seu iPhone pelo cabo não precisa mudar a versão nem o build.
