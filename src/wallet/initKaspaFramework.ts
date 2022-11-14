import { Wallet } from './wallet';

export const initKaspaFramework = async () => {
  // console.log("Kaspa - framework: init");
  await Wallet.initRuntime();
  // console.log("Kaspa - framework: ready");
};

