# Lojas, PWA e Capacitor — pesquisa de 12/Nov/2026

Frente: o que o plano precisa saber para sair de site (PWA) para iOS e Android com Capacitor, e o que as lojas exigem de um app que devolve uma frase sobre uma seleção.

**Método.** Toda página foi baixada com `curl -A "art-index-probe/1.0"`, com 1,2 s ou mais entre chamadas ao mesmo host, e lida em texto. Nenhuma chave de API. Os testes locais rodaram em um projeto descartável na pasta temporária, com `HOME` redirecionado para não gravar nada fora dela. Procedência de cada item: **medido** (comando rodado aqui), **lido** (URL e trecho), **memória** (sem prova).

## Resumo

1. O Capacitor estável é o **8.6.0**. Pede Node 22+, Xcode 26+ e Android Studio 2025.2.1+. O 9 ainda é beta.
2. `cap init`, `cap add android`, `cap add ios`, `cap sync` e `cap doctor` rodaram aqui sem Xcode ativo e sem Android SDK. Só compilar, assinar e rodar ficam de fora.
3. A premissa "esta máquina não tem Xcode" está **parcialmente errada**: existe `/Applications/Xcode.app` 27.1 com SDK do iOS 27.1. Ele só não é o diretório ativo. Android segue sem Java, sem Android Studio e sem SDK.
4. No Safari do iPhone o som só toca depois de um toque. Dentro do Capacitor essa trava vem desligada. Um caminho único (tocar som só em resposta a toque) serve aos três ambientes.
5. As duas lojas aceitam o app se ele não parecer diagnóstico nem casca de site. O texto das regras está citado abaixo, com o que cada uma obriga.
6. Nudez frontal sem censura cai em "Unrated" na tabela nova da Apple, que não pode ser publicado na App Store. É a decisão de acervo mais cara desta frente.
7. Sem retenção no servidor, dá para declarar "dados não coletados" na Apple. Política de privacidade pública é obrigatória nas duas lojas mesmo assim.

## (a) Capacitor: versão, requisitos e o que fica pronto sem toolchain

| Item | Valor | Procedência |
|---|---|---|
| Versão `latest` de `@capacitor/core` | **8.6.0**, publicada em 28/Out/2026 (8.0.0 em 08/Dez/2025) | medido: `registry.npmjs.org/@capacitor/core`, `dist-tags` e `time` |
| Próxima versão | `next` = 9.0.0-beta.0, CLI pede `node >=24.0.0` | medido: `registry.npmjs.org/@capacitor/cli` |
| Node | "you will need NodeJS 22 or higher installed"; CLI 8.6.0 traz `engines: node >=22.0.0` | lido + medido. Esta máquina: v22.23.2 |
| Xcode | "Capacitor 8 requires a minimum of Xcode 26.0." iOS 15+ | lido: capacitorjs.com/docs/getting-started/environment-setup e /docs/ios |
| Android Studio | "Capacitor 8 requires a minimum of Android Studio 2025.2.1." | lido: mesma página |
| Android SDK | `minSdkVersion = 24`, `compileSdkVersion = 36`, `targetSdkVersion = 36` | lido em /docs/updating/8-0 e medido no `android/variables.gradle` gerado |
| Dependências iOS | "Since Capacitor 8, the default has been replaced with SPM" (CocoaPods opcional) | lido; medido: `ios/App/CapApp-SPM/Package.swift` gerado |

**Mínimos das lojas hoje, que o Capacitor 8 atende:** Apple, "Since April 28, 2026 — Apps uploaded to App Store Connect must be built with Xcode 26 or later using an SDK for iOS 26" (developer.apple.com/news/upcoming-requirements). Google, "Starting August 31, 2026: New apps and app updates must target Android 16 (API level 36) or higher" (support.google.com/googleplay/android-developer/answer/11926878).

**Passos mínimos para embrulhar o site do Vite** (capacitorjs.com/docs/getting-started). O projeto precisa de três coisas: "A package.json file", "A separate directory for built web assets such as dist or www" e "An index.html file at the root of your web assets directory" (com `<head>`).

```
npm i @capacitor/core && npm i -D @capacitor/cli
npx cap init "Eu Não Sei Me Comunicar" [id.do.app] --web-dir dist
npm i @capacitor/android @capacitor/ios
npx cap add android && npx cap add ios
npm run build && npx cap sync
```

**Medido nesta máquina** (projeto de teste, Capacitor 8.6.0): os cinco comandos saíram com código 0. `cap add android` criou 65 arquivos, `cap add ios` criou 28, `cap doctor` respondeu "iOS looking great" e "Android looking great". O build para aqui:

- Android: `./gradlew assembleDebug` devolve "Unable to locate a Java Runtime". Não há Android Studio em `/Applications`, nem `ANDROID_HOME`, nem `~/Library/Android/sdk`.
- iOS: `npx cap build ios` devolve "tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools' is a command line tools instance".

**Achado que contradiz o contexto recebido.** `/Applications/Xcode.app` existe (pasta datada de 18/Out/2026, 3,8 GB, versão 27.1, build 27A9275). Com `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`, `xcodebuild -showsdks` lista `iphoneos27.1` e `iphonesimulator27.1`. `xcrun simctl list runtimes` volta vazio, então não há simulador instalado. Não tentei compilar: o build baixaria o pacote Swift do Capacitor com um User-Agent que não controlo, e a frente é de documentação. `NÃO PROVEI: Capacitor 8.6.0 compilando com Xcode 27.1`.

**O que fica pronto sem toolchain:** o site e a PWA inteiros, `capacitor.config`, as pastas `android/` e `ios/` versionadas, ícones e splash, `Info.plist` e `AndroidManifest.xml` editados à mão, textos de loja, política de privacidade. **O que não fica:** binário, assinatura, teste em aparelho, envio às lojas.

**Não use `server.url` para apontar o app ao site hospedado.** A doc de configuração diz: "This is intended for use with live-reload servers. **This is not intended for use in production.**" (capacitorjs.com/docs/config). O app leva o site dentro do pacote.

## (b) Áudio no iOS

- **Safari.** "Safari on iOS has required a user gesture to play media in a `<video>` or `<audio>` element." O gesto vale quando a chamada a `play()` "must have directly resulted from a handler for a touchend, click, doubleclick, or keydown event" (webkit.org/blog/6784/new-video-policies-for-ios). Orientação geral do WebKit: "Websites should assume any use of `<video>` or `<audio>` requires a user gesture click to play" (webkit.org/blog/7734). *Lido.*
- **PWA instalada.** Não achei texto oficial atual que diferencie o web app da tela de início do Safari. O registro 198277 do WebKit ("Audio stops playing when standalone web app is no longer in foreground") está RESOLVED e os comentários apontam conserto no iOS 15.4 (bugs.webkit.org/show_bug.cgi?id=198277). Tratar como igual ao Safari e testar em aparelho. *Lido, sem garantia para iOS 26/27.*
- **Capacitor.** O WebView nasce com a trava desligada. Medido no código do 8.6.0: `CAPBridgeViewController.swift:125` traz `mediaTypesRequiringUserActionForPlayback = []` e `:122` traz `allowsInlineMediaPlayback = true`; `Bridge.java:592` traz `settings.setMediaPlaybackRequiresUserGesture(false)`. A Apple descreve a propriedade como "The media types that require a user gesture to begin playing" (developer.apple.com/documentation/webkit/wkwebviewconfiguration/mediatypesrequiringuseractionforplayback).
- **Memória, sem prova:** a chave de silêncio do iPhone cala Web Audio no Safari; `AudioContext` no WKWebView do Capacitor inicia sem gesto. A especificação Audio Session do W3C (w3.org/TR/audio-session) não fala da chave. Só teste em aparelho resolve.

## (c) App Store: 4.2 e 1.4.1 (diretrizes com "Last Updated: October 16, 2026")

Fonte: developer.apple.com/app-store/review/guidelines.

- **4.2 Minimum Functionality:** "Your app should include features, content, and UI that elevate it beyond a repackaged website. If your app is not particularly useful, unique, or “app-like,” it doesn’t belong on the App Store." E 4.2.2: "apps shouldn’t primarily be marketing materials, advertisements, web clippings, content aggregators, or a collection of links."
- **1.4.1:** "Medical apps that could provide inaccurate data or information, or that could be used for diagnosing or treating patients may be reviewed with greater scrutiny." E ainda: "Apps should remind users to check with a doctor in addition to using the app and before making medical decisions."
- **1.1.6**, que pega a palavra "científico": "False information and features […] Stating that the app is “for entertainment purposes” won’t overcome this guideline."
- **Gatilho de dispositivo médico:** apps com categoria primária ou secundária "Health & Fitness or Medical", ou que marcaram "frequent" em "Medical or Treatment Information", precisam declarar se são dispositivo médico regulado na UE, Reino Unido e EUA (developer.apple.com/help/app-store-connect/manage-app-information/declare-regulated-medical-device-status).

**O que o app precisa fazer (leitura minha dos textos acima, não é texto da Apple):**

1. A frase fala da seleção ("esta combinação comunica…"), nunca atribui quadro clínico à pessoa. Um validador depois do LLM barra nosologia clínica nas três línguas.
2. Categoria fora de Medical e de Health & Fitness. No questionário etário, "Medical or Treatment Information" fica em nenhum, o que só é honesto se o item 1 valer.
3. Aviso curto e fixo na tela do resultado e na descrição da loja: descreve uma seleção, não avalia a pessoa.
4. A loja não promete leitura científica da pessoa. Promete descrição com vocabulário científico, feita a partir de anotações humanas com fonte visível.
5. Para não ser casca de site: site dentro do pacote, índice curado offline, modo demonstração sem rede, e pelo menos um recurso de aparelho (compartilhar a frase como imagem, vibração no toque, histórico guardado só no aparelho).

## (d) Google Play: saúde e alegações médicas

- **Declaração obrigatória para todo app:** "Even developers with apps that do not offer any health features must complete this form and certify that no health features are offered through the app." Entre as categorias de saúde estão "Stress Management, Relaxation, Mental Acuity" e "Mental and Behavioral Health — Tools for mental health support, counseling services and addiction recovery programs" (support.google.com/googleplay/android-developer/answer/14738291).
- **Se for lido como app de saúde:** "We don’t allow apps with health and medical related functionalities that are misleading or potentially harmful." E: "Other health and medical apps must include a clear disclaimer in their app description indicating that the app is “not a medical device and does not diagnose, treat, cure, or prevent any medical condition.”" Mais: "Apps must also remind users to consult a healthcare professional for medical advice, diagnosis, or treatment." (answer/16679511, Health Content and Services).
- **Alegações:** "We don't allow apps that contain false or misleading information or claims, including in the description, title, icon, and screenshots." E: "Any claim that an app is a "prank", "for entertainment purposes" (or other synonym) does not exempt an app from application of our policies." (answer/17006354, Deceptive Behavior).
- **Conteúdo gerado por IA:** "Apps that generate content using AI must contain in-app user reporting or flagging features that allow users to report or flag offensive content to developers without needing to exit the app." (answer/13985936). A definição fala em conteúdo gerado "based on user prompts"; aqui a pessoa escolhe itens, não digita. O botão de denúncia custa pouco e tira a dúvida.
- **Casca de site:** "We don’t allow apps whose primary purpose is to […] provide a webview of a website without permission from the website owner or administrator." (answer/9899034). O dono do site é o dono do app, então não se aplica, mas o revisor precisa ver isso na conta.
- **Conta pessoal nova:** contas pessoais criadas depois de 13/Nov/2023 "must run a closed test for their app with a minimum of 12 testers who have been opted in continuously for at least 14 days" antes de pedir produção (answer/14151465).

## (e) Classificação etária com nudez artística e violência histórica

**Apple** (developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions; faixas novas 4+, 9+, 13+, 16+, 18+):

| Resposta no questionário | Faixa global | Brasil (autodeclarado) |
|---|---|---|
| "Mature or Suggestive Themes" infrequente (inclui "censored or implied nudity […] war or political strife") | 9+ | A12 |
| "Sexual Content or Nudity" infrequente ("Non-explicit depictions […] including brief or partial nudity") | 13+ | A12 |
| "Mature or Suggestive Themes" frequente | 16+ | A18 |
| "Sexual Content or Nudity" frequente | 18+ | A18 |
| "Realistic Violence" infrequente / frequente | 13+ / 18+ | A12 / A18 |
| "Graphic Sexual Content and Nudity" ("May include: uncensored or full-frontal nudity") | **Unrated**: "can’t be published on the App Store" | — |
| "Medical or Treatment Information" infrequente / frequente | 13+ / 16+ | A12 / A16 |

A diretriz 1.1.4 define o proibido como material "intended to stimulate erotic rather than aesthetic or emotional feelings", o que protege pintura. A tabela etária, porém, não traz exceção para arte. Como a Apple aplica "full-frontal nudity" a um nu de museu não está escrito em lugar nenhum que eu tenha lido. Diretriz 2.3.6: "Answer the age rating questions in App Store Connect honestly".

**Google Play.** Classificação sai do questionário IARC no Play Console; "Misrepresentation of your app’s content may result in its removal or suspension" (answer/9859655). Nudez tem exceção escrita: "Content that contains nudity may be allowed if the primary purpose is educational, documentary, scientific or artistic, and is not gratuitous." (answer/9878810). No Brasil a régua é ClassInd: "Rated 14+ — Medium impact content. It may contain death, erotic settings, nudity"; "Rated 16+ […] frequent violence, gore, mutilation, torture". Violência: "We don't allow apps that depict or facilitate gratuitous violence".

## (f) Privacidade quando só os identificadores dos itens saem do aparelho

- **Apple, definição:** "“Collect” refers to transmitting data off the device in a way that allows you and/or your third-party partners to access it for a period longer than what is necessary to service the transmitted request in real time." E o exemplo: "if an authentication token or IP address is sent on a server call and not retained, or if data is sent to your servers then immediately discarded after servicing the request, you do not need to disclose this" (developer.apple.com/app-store/app-privacy-details). Com servidor sem retenção, a etiqueta pode ser "Data Not Collected". Se o servidor guardar seleções, o tipo é "Product Interaction".
- **Apple, política:** "All apps must include a link to their privacy policy in the App Store Connect metadata field and within the app in an easily accessible manner." (5.1.1(i)). E 5.1.2(i) pede consentimento explícito para mandar dado pessoal a "third-party AI"; identificador de item do acervo não é dado pessoal, desde que o LLM seja chamado só pelo servidor.
- **Google:** "Even developers with apps that do not collect any user data must complete this form and provide a link to their privacy policy." A definição de coleta é larga: «"Collect" means transmitting data from your app off a user’s device.» Processamento efêmero é dado "only stored in memory and retained for no longer than necessary to service the specific request in real-time", e nesse caso não aparece na seção pública (answer/10787469). Se guardado, o tipo é "App interactions".
- **Manifesto de privacidade do iOS:** o Capacitor 8.6.0 já traz `PrivacyInfo.xcprivacy` com listas vazias (medido em `node_modules/@capacitor/ios`). Plugins como `@capacitor/preferences` e `@capacitor/filesystem` "may necessitate a Privacy Manifest File" (capacitorjs.com/docs/ios/privacy-manifest).
- O `AndroidManifest.xml` gerado pede só `android.permission.INTERNET` (medido).

## (g) PWA instalável hoje

- **Chrome e Android** (web.dev/articles/install-criteria, atualizado em 19/Set/2024): HTTPS e um manifesto com "short_name or name", "icons - must include a 192px and a 512px icon", "start_url", "display - must be one of fullscreen, standalone, minimal-ui, or window-controls-overlay", e "prefer_related_applications must not be present, or be false". Service worker deixou de ser exigência: "we have removed the requirement to have a service worker that implements the fetch() method for installation from the menu, since version 108 on mobile and 112 on Desktop" (developer.chrome.com/blog/update-install-criteria). Continua necessário para o índice funcionar offline.
- **iOS 26 em diante:** "there are now zero requirements for “installability” in Safari. Users can add any site to their Home Screen and open it as a web app" (webkit.org/blog/17333). A instalação é pelo menu Compartilhar. Ícones: manifesto vale desde o iOS 15.4, e "If you do both, apple-touch-icon will take precedence over the Manifest-declared icons" (webkit.org/blog/13878).
- **Memória, sem prova:** o Safari não dispara `beforeinstallprompt`; o tamanho usual do `apple-touch-icon` é 180 px.

## Recomendações para o plano

1. Fixar Capacitor **8.6.x** com SPM e Node 22. Não usar o 9 beta.
2. Versionar `android/` e `ios/` gerados. Separar as tarefas que rodam hoje (site, PWA, `cap sync`, textos de loja) das que dependem de toolchain.
3. Site dentro do pacote. Rede só para pedir a frase. Sem `server.url`.
4. Som sempre disparado por toque, com o mesmo código no Safari, na PWA instalada e no Capacitor. Tarefa de teste em iPhone real.
5. Validador de saída do LLM em pt-BR, en e zh-CN contra linguagem de diagnóstico, com teste automatizado. Aviso fixo na tela e na loja.
6. Botão "denunciar esta frase" dentro do app.
7. O pipeline grava em cada pintura um campo de conteúdo sensível (nudez: nenhuma, parcial, frontal; violência: nenhuma, histórica, gráfica). Sem esse campo ninguém responde os questionários das lojas com honestidade.
8. Servidor sem retenção: recebe identificadores, não grava IP junto com a seleção. Política de privacidade pública nas três línguas, com link dentro do app.
9. Manifesto com nome, ícones de 192 e 512 px, `start_url`, `display: standalone`, mais `apple-touch-icon`; service worker para o índice offline.
10. Para iOS sem mexer no sistema: `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` antes dos comandos. Trocar o diretório ativo pede `sudo` e é do dono.
11. Se a conta do Play for pessoal e nova, reservar 14 dias corridos de teste fechado com 12 pessoas.

## Decisões que só o dono toma

1. **Posicionamento nas lojas:** arte e expressão (declara "sem recurso de saúde") ou bem-estar (aciona aviso obrigatório no Play e a declaração de dispositivo médico na Apple).
2. **Nudez no acervo das lojas:** tirar nudez frontal dos apps e deixar no site; manter só parcial (13+ ou 18+ conforme a frequência); ou assumir o risco de "Unrated" na Apple.
3. **Violência histórica:** mesma régua, 13+ se rara e 18+ se frequente.
4. **Toolchain:** ativar o Xcode 27.1 já instalado e instalar Android Studio nesta máquina, ou compilar em outra máquina ou em nuvem.
5. **Contas de desenvolvedor:** pessoal ou de organização, nas duas lojas. Custo das contas: `NÃO PROVEI: valores não conferidos nesta pesquisa`.
6. **Retenção:** zero registro, ou guardar seleções anônimas para melhorar o índice (obriga a declarar coleta nas duas lojas).
7. **A palavra "científico" na loja:** manter, com o risco de 1.1.6 e de "Misleading Claims", ou descrever como vocabulário científico aplicado a anotações humanas.
8. **China continental (zh-CN):** as lojas de Android de lá não são o Google Play e a App Store da China tem exigências próprias. `NÃO PROVEI: não pesquisado nesta frente`.
