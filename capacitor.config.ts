import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Identificador provisório: o definitivo é decisão do dono e precisa bater com as contas de loja.
  appId: "art.eunaoseimecomunicar.app",
  appName: "Eu Não Sei Me Comunicar",
  // O site construído vai inteiro dentro do app: o acervo fica no aparelho e a rede só serve à frase do modelo.
  webDir: "dist",
  backgroundColor: "#000000",
};

export default config;
