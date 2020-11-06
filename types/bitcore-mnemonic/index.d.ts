// These types generated using tsd-jsdoc on the bitcore-mnemnoic module, and then hand-modified for correctness.
/// <reference path="../bitcore-lib-cash/index.d.ts" />
import { HDPrivateKey, Networks } from 'bitcore-lib-cash';
type Network = Networks.Network;

declare module 'bitcore-mnemonic' {
  /**
   * This is an immutable class that represents a BIP39 Mnemonic code.
   * See BIP39 specification for more info: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
   * A Mnemonic code is a a group of easy to remember words used for the generation
   * of deterministic wallets. A Mnemonic can be used to generate a seed using
   * an optional passphrase, for later generate a HDPrivateKey.
   * @example
   * // generate a random mnemonic
   * var mnemonic = new Mnemonic();
   * var phrase = mnemonic.phrase;
   *
   * // use a different language
   * var mnemonic = new Mnemonic(Mnemonic.Words.SPANISH);
   * var xprivkey = mnemonic.toHDPrivateKey();
   * @param [data] - a seed, phrase, or entropy to initialize (can be skipped)
   * @param [wordlist] - the wordlist to generate mnemonics from
   */
  export default class Mnemonic {
    constructor(data?: string);
    constructor(wordlist?: string[]);
    /**
     * Will return a boolean if the mnemonic is valid
     * @example
     * var valid = Mnemonic.isValid('lab rescue lunch elbow recall phrase perfect donkey biology guess moment husband');
     * // true
     * @param mnemonic - The mnemonic string
     * @param [wordlist] - The wordlist used
     */
    static isValid(mnemonic: string, wordlist?: string): boolean;
    /**
     * Internal function to check if a mnemonic belongs to a wordlist.
     * @param mnemonic - The mnemonic string
     * @param wordlist - The wordlist
     */
    static _belongsToWordlist(mnemonic: string, wordlist: string): boolean;
    /**
     * Internal function to detect the wordlist used to generate the mnemonic.
     * @param mnemonic - The mnemonic string
     * @returns the wordlist or null
     */
    static _getDictionary(mnemonic: string): any[];
    /**
     * Will generate a seed based on the mnemonic and optional passphrase.
     */
    toSeed(passphrase?: string): Buffer;
    /**
     * Will generate a Mnemonic object based on a seed.
     */
    static fromSeed(seed?: Buffer, wordlist?: string): Mnemonic;
    /**
     * Generates a HD Private Key from a Mnemonic.
     * Optionally receive a passphrase and bitcoin network.
     * @param [network] - The network: 'livenet' or 'testnet'
     */
    toHDPrivateKey(passphrase?: string, network?: Network | string | number): HDPrivateKey;
    /**
     * Will return a the string representation of the mnemonic
     * @returns Mnemonic
     */
    toString(): string;
    /**
     * Will return a string formatted for the console
     * @returns Mnemonic
     */
    inspect(): string;
    /**
     * Internal function to generate a random mnemonic
     * @param ENT - Entropy size, defaults to 128
     * @param wordlist - Array of words to generate the mnemonic
     * @returns Mnemonic string
     */
    static _mnemonic(ENT: number, wordlist: any[]): string;
    /**
     * Internal function to generate mnemonic based on entropy
     * @param entropy - Entropy buffer
     * @param wordlist - Array of words to generate the mnemonic
     * @returns Mnemonic string
     */
    static _entropy2mnemonic(entropy: Buffer, wordlist: any[]): string;
    static Words: {
      CHINESE: string[];
      ENGLISH: string[];
    };
  }

  /**
   * PDKBF2
   * Credit to: https://github.com/stayradiated/pbkdf2-sha512
   * Copyright (c) 2014, JP Richardson Copyright (c) 2010-2011 Intalio Pte, All Rights Reserved
   */
  export function pbkdf2(): void;
}
