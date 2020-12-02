const Mnemonic = require('bitcore-mnemonic');
// @ts-ignore
import * as bitcore from 'bitcore-lib-cash';
// @ts-ignore

import * as passworder1 from 'browser-passworder';
import * as passworder2 from '@aspectron/flow-key-crypt';
let passworder:typeof passworder1 | typeof passworder2;
// @ts-ignore
if(typeof window != "undefined" && !window.nw){
  passworder = passworder1;
}else{
  passworder = passworder2;
}

import { Buffer } from 'safe-buffer';
import {
  Network,
  SelectedNetwork,
  WalletSave,
  Api,
  TxSend,
  PendingTransactions,
  WalletCache, IRPC
} from '../types/custom-types';
import { logger } from '../utils/logger';
import { AddressManager } from './AddressManager';
import { UtxoSet } from './UtxoSet';
import * as api from './apiHelpers';
import { txParser } from './txParser';
import { DEFAULT_FEE, DEFAULT_NETWORK } from '../config.json';

/** Class representing an HDWallet with derivable child addresses */
class Wallet {

  //static passworder1:any = passworder1;
  //static passworder2:any = passworder2;

  HDWallet: bitcore.HDPrivateKey;

  /**
   * The summed balance across all of Wallet's discovered addresses, minus amount from pending transactions.
   */
  balance: number | undefined = undefined;

  /**
   * Set by addressManager
   */
  get receiveAddress() {
    return this.addressManager.receiveAddress.current.address;
  }

  /**
   * Current network.
   */
  // @ts-ignore
  network: Network = DEFAULT_NETWORK.prefix as Network;


  subnetworkId:string = "0000000000000000000000000000000000000000";//hex string

  /**
   * Current API endpoint for selected network
   */
  apiEndpoint = DEFAULT_NETWORK.apiBaseUrl;

  /**
   * A 12 word mnemonic.
   */
  mnemonic: string;

  utxoSet = new UtxoSet();

  addressManager: AddressManager;

  /* eslint-disable */
  pending: PendingTransactions = {
    transactions: {},
    get amount() {
      const transactions = Object.values(this.transactions);
      if (transactions.length === 0) return 0;
      return transactions.reduce((prev, cur) => prev + cur.amount + cur.fee, 0);
    },
    add(
      id: string,
      tx: { to: string; utxoIds: string[]; rawTx: string; amount: number; fee: number }
    ) {
      this.transactions[id] = tx;
    },
  };
  /**
   * Transactions sorted by hash.
   */
  transactions: Api.Transaction[] = [];

  /**
   * Transaction arrays keyed by address.
   */
  transactionsStorage: Record<string, Api.Transaction[]> = {};

  /** Create a wallet.
   * @param walletSave (optional)
   * @param walletSave.privKey Saved wallet's private key.
   * @param walletSave.seedPhrase Saved wallet's seed phrase.
   */
  constructor(privKey?: string, seedPhrase?: string) {
    if (privKey && seedPhrase) {
      this.HDWallet = new bitcore.HDPrivateKey(privKey);
      this.mnemonic = seedPhrase;
    } else {
      const temp = new Mnemonic(Mnemonic.Words.ENGLISH);
      this.mnemonic = temp.toString();
      this.HDWallet = new bitcore.HDPrivateKey(temp.toHDPrivateKey().toString());
    }
    this.addressManager = new AddressManager(this.HDWallet, this.network);
    this.addressManager.receiveAddress.next();
  }

  /**
   * Set rpc provider
   * @param rpc
   */
  static setRPC(rpc:IRPC){
    api.setRPC(rpc);
  }

  /**
   * Queries API for address[] UTXOs. Adds UTXOs to UTXO set. Updates wallet balance.
   * @param addresses
   */
  async updateUtxos(addresses: string[]): Promise<void> {
    logger.log('info', `Getting utxos for ${addresses.length} addresses.`);
    const utxoResults = await Promise.all(
      addresses.map((address) => api.getUtxos(address))
    );
    addresses.forEach((address, i) => {
      const { utxos } = utxoResults[i];
      logger.log('info', `${address}: ${utxos.length} total UTXOs found.`);
      this.utxoSet.utxoStorage[address] = utxos;
      this.utxoSet.add(utxos, address);
    });
  }

  /**
   * Queries API for address[] transactions. Adds tx to transactions storage. Also sorts the entire transaction set.
   * @param addresses
   */
  async updateTransactions(addresses: string[]): Promise<string[]> {
    logger.log('info', `Getting transactions for ${addresses.length} addresses.`);
    const addressesWithTx: string[] = [];
    const txResults = await Promise.all(
      addresses.map((address) => api.getTransactions(address))
    );
    addresses.forEach((address, i) => {
      const { transactions } = txResults[i];
      logger.log('info', `${address}: ${transactions.length} transactions found.`);
      if (transactions.length !== 0) {
        const confirmedTx = transactions.filter((tx:Api.Transaction) => tx.confirmations > 0);
        this.transactionsStorage[address] = confirmedTx;
        addressesWithTx.push(address);
      }
    });
    // @ts-ignore
    this.transactions = txParser(this.transactionsStorage, Object.keys(this.addressManager.all));
    const pendingTxHashes = Object.keys(this.pending.transactions);
    if (pendingTxHashes.length > 0) {
      pendingTxHashes.forEach((hash) => {
        if (this.transactions.map((tx) => tx.transactionHash).includes(hash)) {
          this.deletePendingTx(hash);
        }
      });
    }
    const isActivityOnReceiveAddr =
      this.transactionsStorage[this.addressManager.receiveAddress.current.address] !== undefined;
    if (isActivityOnReceiveAddr) {
      this.addressManager.receiveAddress.next();
    }
    return addressesWithTx;
  }

  /**
   * Queries API for address[] UTXOs. Adds tx to transactions storage. Also sorts the entire transaction set.
   * @param addresses
   */
  async findUtxos(addresses: string[], debug=false): Promise<{
    txID2Info:Map<string, {utxos: Api.Utxo[], address:string}>,
    addressesWithUTXOs:string[]
  }> {
    logger.log('info', `Getting UTXOs for ${addresses.length} addresses.`);
    const addressesWithUTXOs: string[] = [];
    const txID2Info = new Map();
    const utxoResults = await Promise.all(
      addresses.map((address) => api.getUtxos(address))
    );
    
    if(debug){
      utxoResults.forEach(({utxos}, index)=>{
        utxos.map(t=>{
          let info = txID2Info.get(t.txID);
          if(!info){
            info = {utxos:[], address:addresses[index]};
            txID2Info.set(t.txID, info);
          }
          info.utxos.push(t);
        })
      })
    }

    addresses.forEach((address, i) => {
      const { utxos } = utxoResults[i];
      //console.log("utxos", utxos)
      logger.log('info', `${address}: ${utxos.length} utxos found.`);
      if (utxos.length !== 0) {
        //const confirmedTx = utxos.filter((tx:Api.Utxo) => tx.confirmations > 0);
        this.utxoSet.utxoStorage[address] = utxos;
        this.utxoSet.add(utxos, address);
        addressesWithUTXOs.push(address);
      }
    });
    /*/ @ts-ignore
    this.transactions = txParser(this.transactionsStorage, Object.keys(this.addressManager.all));
    const pendingTxHashes = Object.keys(this.pending.transactions);
    if (pendingTxHashes.length > 0) {
      pendingTxHashes.forEach((hash) => {
        if (this.transactions.map((tx) => tx.transactionHash).includes(hash)) {
          this.deletePendingTx(hash);
        }
      });
    }
    */
    const isActivityOnReceiveAddr =
      this.utxoSet.utxoStorage[this.addressManager.receiveAddress.current.address] !== undefined;
    if (isActivityOnReceiveAddr) {
      this.addressManager.receiveAddress.next();
    }
    return {addressesWithUTXOs, txID2Info};
  }

  /**
   * Recalculates wallet balance.
   */
  updateBalance(): void {
    this.balance = this.utxoSet.totalBalance - this.pending.amount;
  }

  /**
   * Updates the selected network
   * @param network name of the network
   */
  async updateNetwork(network: SelectedNetwork): Promise<void> {
    this.demolishWalletState(network.prefix);
    this.network = network.prefix;
    this.apiEndpoint = network.apiBaseUrl;
  }

  demolishWalletState(networkPrefix: Network = this.network): void {
    this.utxoSet.clear();
    this.addressManager = new AddressManager(this.HDWallet, networkPrefix);
    this.pending.transactions = {};
    this.transactions = [];
    this.transactionsStorage = {};
  }

  /**
   * Derives receiveAddresses and changeAddresses and checks their transactions and UTXOs.
   * @param threshold stop discovering after `threshold` addresses with no activity
   
  async addressDiscovery(threshold = 20): Promise<void> {
    const doDiscovery = async (
      n: number,
      deriveType: 'receive' | 'change',
      offset: number
    ): Promise<number> => {
      const derivedAddresses = this.addressManager.getAddresses(n, deriveType, offset);
      const addresses = derivedAddresses.map((obj) => obj.address);
      logger.log(
        'info',
        `Fetching ${deriveType} address data for derived indices ${JSON.stringify(
          derivedAddresses.map((obj) => obj.index)
        )}`
      );
      const addressesWithTx = await this.updateTransactions(addresses);
      if (addressesWithTx.length === 0) {
        // address discovery complete
        const lastAddressIndexWithTx = offset - (threshold - n) - 1;
        logger.log(
          'info',
          `${deriveType}Address discovery complete. Last activity on address #${lastAddressIndexWithTx}. No activity from ${deriveType}#${
            lastAddressIndexWithTx + 1
          }~${lastAddressIndexWithTx + threshold}.`
        );
        return lastAddressIndexWithTx;
      }
      // else keep doing discovery
      const nAddressesLeft =
        derivedAddresses
          .filter((obj) => addressesWithTx.indexOf(obj.address) !== -1)
          .reduce((prev, cur) => Math.max(prev, cur.index), 0) + 1;
      return doDiscovery(nAddressesLeft, deriveType, offset + n);
    };
    const highestReceiveIndex = await doDiscovery(threshold, 'receive', 0);
    const highestChangeIndex = await doDiscovery(threshold, 'change', 0);
    this.addressManager.receiveAddress.advance(highestReceiveIndex + 1);
    this.addressManager.changeAddress.advance(highestChangeIndex + 1);
    logger.log(
      'info',
      `receive address index: ${highestReceiveIndex}; change address index: ${highestChangeIndex}`
    );
    await this.updateUtxos(Object.keys(this.transactionsStorage));
    this.runStateChangeHooks();
  }
  */

  /**
   * Derives receiveAddresses and changeAddresses and checks their transactions and UTXOs.
   * @param threshold stop discovering after `threshold` addresses with no activity
   */
  async addressDiscovery(threshold = 20, debug = false): Promise<Map<string, {utxos: Api.Utxo[], address:string}>|null> {
    let addressList:string[] = [];
    let lastIndex = -1;
    let debugInfo:Map<string, {utxos: Api.Utxo[], address:string}>|null = null;
    const doDiscovery = async (
      n: number,
      deriveType: 'receive' | 'change',
      offset: number
    ): Promise<number> => {
      const derivedAddresses = this.addressManager.getAddresses(n, deriveType, offset);
      const addresses = derivedAddresses.map((obj) => obj.address);
      addressList = [...addressList, ...addresses];
      logger.log(
        'info',
        `Fetching ${deriveType} address data for derived indices ${JSON.stringify(
          derivedAddresses.map((obj) => obj.index)
        )}`
      );
      const {addressesWithUTXOs, txID2Info} = await this.findUtxos(addresses, debug);
      if(!debugInfo)
        debugInfo = txID2Info;
      if (addressesWithUTXOs.length === 0) {
        // address discovery complete
        const lastAddressIndexWithTx = offset - (threshold - n) - 1;
        logger.log(
          'info',
          `${deriveType}Address discovery complete. Last activity on address #${lastAddressIndexWithTx}. No activity from ${deriveType}#${
            lastAddressIndexWithTx + 1
          }~${lastAddressIndexWithTx + threshold}.`
        );
        return lastAddressIndexWithTx;
      }
      // else keep doing discovery
      const nAddressesLeft =
        derivedAddresses
          .filter((obj) => addressesWithUTXOs.includes(obj.address))
          .reduce((prev, cur) => Math.max(prev, cur.index), 0) + 1;
      return doDiscovery(nAddressesLeft, deriveType, offset + n);
    };
    const highestReceiveIndex = await doDiscovery(threshold, 'receive', 0);
    const highestChangeIndex = await doDiscovery(threshold, 'change', 0);
    this.addressManager.receiveAddress.advance(highestReceiveIndex + 1);
    this.addressManager.changeAddress.advance(highestChangeIndex + 1);
    logger.log(
      'info',
      `receive address index: ${highestReceiveIndex}; change address index: ${highestChangeIndex}`
    );
    //await this.updateUtxos(Object.keys(this.transactionsStorage));
    this.runStateChangeHooks();
    return debugInfo;
  }

  // TODO: convert amount to sompis aka satoshis
  // TODO: bn
  /**
   * Compose a serialized, signed transaction
   * @param obj
   * @param obj.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
   * @param obj.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KSP)
   * @param obj.fee Fee for miners in sompis
   * @param obj.changeAddrOverride Use this to override automatic change address derivation
   * @throws if amount is above `Number.MAX_SAFE_INTEGER`
   */
  composeTx({
    toAddr,
    amount,
    fee = DEFAULT_FEE,
    changeAddrOverride,
  }: TxSend & { changeAddrOverride?: string }): {
    tx: bitcore.Transaction;
    id: string;
    rawTx: string;
    utxoIds: string[];
    amount: number;
  } {
    if (!Number.isSafeInteger(amount)) throw new Error('Amount too large');
    const { utxos, utxoIds } = this.utxoSet.selectUtxos(amount + fee);
    // @ts-ignore
    const privKeys = utxos.reduce((prev: string[], cur) => {
      return [this.addressManager.all[String(cur.address)], ...prev];
    }, []);
    const changeAddr = changeAddrOverride || this.addressManager.changeAddress.next();
    try {
      const tx: bitcore.Transaction = new bitcore.Transaction()
        .from(utxos)
        .to(toAddr, amount)
        .setVersion(1)
        .fee(fee)
        .change(changeAddr)
        // @ts-ignore
        .sign(privKeys, bitcore.crypto.Signature.SIGHASH_ALL, 'schnorr');
      this.utxoSet.inUse.push(...utxoIds);
      this.pending.add(tx.id, { rawTx: tx.toString(), utxoIds, amount, to: toAddr, fee });
      this.runStateChangeHooks();
      //window.txxxx = tx;
      return { tx: tx, id: tx.id, rawTx: tx.toString(), utxoIds, amount: amount + fee };
    } catch (e) {
      this.addressManager.changeAddress.reverse();
      throw e;
    }
  }

  /**
   * Send a transaction. Returns transaction id.
   * @param txParams
   * @param txParams.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
   * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KSP)
   * @param txParams.fee Fee for miners in sompis
   * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
   */
  async sendTx(txParams: TxSend): Promise<string> {
    const { id, tx } = this.composeTx(txParams);

    const {nLockTime:lockTime, version} = tx;
    //console.log("composeTx:tx", tx.inputs, tx.outputs)


    const inputs: Api.TransactionRequestTxInput[] = tx.inputs.map((input:bitcore.Transaction.Input)=>{
      //console.log("prevTxId", input.prevTxId.toString("hex"))
      return {
        previousOutpoint:{
          transactionId: {
            bytes: input.prevTxId.toString("base64")
          },
          index: input.outputIndex
        },
        signatureScript: input.script.toBuffer().toString("base64"),
        sequence: input.sequenceNumber
      };
    })

    const outputs:Api.TransactionRequestTxOutput[] = tx.outputs.map((output:bitcore.Transaction.Output)=>{
      return {
        value: output.satoshis,
        scriptPubKey: output.script.toBuffer().toString("base64")
      }
    })
    
    //const payloadStr = "00000000000000000000000000000000";
    //const payload = Buffer.from(payloadStr).toString("base64");
    //console.log("payload-hex:", Buffer.from(payloadStr).toString("hex"))
    //@ ts-ignore
    //const payloadHash = bitcore.crypto.Hash.sha256sha256(Buffer.from(payloadStr));
    const rpcTX: Api.TransactionRequest = {
      transaction: {
        version,
        inputs,
        outputs,
        lockTime,
        /*
        payload,
        payloadHash:{
          bytes: payloadHash.toString("base64")
        },
        */
        subnetworkId: {
          bytes: Buffer.from(this.subnetworkId, "hex").toString("base64")
        },
        fee: txParams.fee
      }
    }
    console.log("rpcTX", JSON.stringify(rpcTX, null, "  "))
    console.log("rpcTX", JSON.stringify(rpcTX))
    //console.log("rpcTX.transaction.inputs[0]", rpcTX.transaction.inputs[0])
    try {
      await api.postTx(rpcTX);
    } catch (e) {
      this.undoPendingTx(id);
      throw e;
    }
    return id;
  }

  async updateState(): Promise<void> {
    const activeAddrs = await this.updateTransactions(this.addressManager.shouldFetch);
    await this.updateUtxos(activeAddrs);
    this.runStateChangeHooks();
  }

  undoPendingTx(id: string): void {
    const { utxoIds } = this.pending.transactions[id];
    delete this.pending.transactions[id];
    this.utxoSet.release(utxoIds);
    this.addressManager.changeAddress.reverse();
    this.runStateChangeHooks();
  }

  /**
   * After we see the transaction in the API results, delete it from our pending list.
   * @param id The tx hash
   */
  deletePendingTx(id: string): void {
    // undo + delete old utxos
    const { utxoIds } = this.pending.transactions[id];
    delete this.pending.transactions[id];
    this.utxoSet.remove(utxoIds);
  }

  runStateChangeHooks(): void {
    this.utxoSet.updateUtxoBalance();
    this.updateBalance();
  }

  get cache() {
    return {
      pendingTx: this.pending.transactions,
      utxos: {
        utxoStorage: this.utxoSet.utxoStorage,
        inUse: this.utxoSet.inUse,
      },
      transactionsStorage: this.transactionsStorage,
      addresses: {
        receiveCounter: this.addressManager.receiveAddress.counter,
        changeCounter: this.addressManager.changeAddress.counter,
      },
    };
  }

  restoreCache(cache: WalletCache): void {
    this.pending.transactions = cache.pendingTx;
    this.utxoSet.utxoStorage = cache.utxos.utxoStorage;
    this.utxoSet.inUse = cache.utxos.inUse;
    Object.entries(this.utxoSet.utxoStorage).forEach(([addr, utxos]: [string, Api.Utxo[]]) => {
      this.utxoSet.add(utxos, addr);
    });
    this.transactionsStorage = cache.transactionsStorage;
    this.addressManager.getAddresses(cache.addresses.receiveCounter + 1, 'receive');
    this.addressManager.getAddresses(cache.addresses.changeCounter + 1, 'change');
    this.addressManager.receiveAddress.advance(cache.addresses.receiveCounter - 1);
    this.addressManager.changeAddress.advance(cache.addresses.changeCounter);
    // @ts-ignore
    this.transactions = txParser(this.transactionsStorage, Object.keys(this.addressManager.all));
    this.runStateChangeHooks();
  }

  /**
   *  Converts a mnemonic to a new wallet.
   * @param seedPhrase The 12 word seed phrase.
   * @returns new Wallet
   */
  static fromMnemonic(seedPhrase: string): Wallet {
    const privKey = new Mnemonic(seedPhrase.trim()).toHDPrivateKey().toString();
    const wallet = new this(privKey, seedPhrase);
    return wallet;
  }

  /**
   * Creates a new Wallet from encrypted wallet data.
   * @param password the password the user encrypted their seed phrase with
   * @param encryptedMnemonic the encrypted seed phrase from local storage
   * @throws Will throw "Incorrect password" if password is wrong
   */
  static async import(password: string, encryptedMnemonic: string): Promise<Wallet> {
    const decrypted = await passworder.decrypt(password, encryptedMnemonic);
    const savedWallet = JSON.parse(decrypted) as WalletSave;
    const myWallet = new this(savedWallet.privKey, savedWallet.seedPhrase);
    return myWallet;
  }

  /**
   * Generates encrypted wallet data.
   * @param password user's chosen password
   * @returns Promise that resolves to object-like string. Suggested to store as string for .import().
   */
  async export(password: string): Promise<string> {
    const savedWallet: WalletSave = {
      privKey: this.HDWallet.toString(),
      seedPhrase: this.mnemonic,
    };
    return passworder.encrypt(password, JSON.stringify(savedWallet));
  }
}

export {Wallet}
