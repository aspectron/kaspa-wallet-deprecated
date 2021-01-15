// @ts-ignore
import * as kaspacore from 'kaspacore-lib';
import { Network } from 'custom-types';
import { Wallet } from './wallet';

export const initKaspaFramework = async () => {
  const networkPrefixes: Network[] = ['kaspa', 'kaspadev', 'kaspareg', 'kaspatest', 'kaspasim'];

  networkPrefixes.map((str: Network) => {
    return kaspacore.Networks.add({
      name: str,
      prefix: str,
      pubkeyhash: 0x00, // publickey hash prefix
      privatekey: 0x80, // privatekey prefix -- must be 128 or toWIF() result will not match with kaspa
      scripthash: 0x05,
      xpubkey: 0x0488b21e, // extended public key magic
      xprivkey: 0x0488ade4, // extended private key magic
      networkMagic: 0xdab5bffa, // network magic number
    });
  });

  // console.log("Kaspa - framework: init");
  await Wallet.initRuntime();
  // console.log("Kaspa - framework: ready");
};

