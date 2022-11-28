import kaspacore from '@kaspa/core-lib';
import { KaspaAPI } from 'wallet/apiHelpers';

export type Network = 'kaspa' | 'kaspadev' | 'kaspareg' | 'kaspatest' | 'kaspasim';
export type bytes = string;//base84 string

export * from './rpc';
import {IRPC, RPC} from './rpc';
import { KaspaAPI } from './apiHelpers';


export interface ScaneMoreResultItem{
  start:number,
  end:number,
  final:number
}
export interface ScaneMoreResult{
  error?:any,
  code:string,
  receive?:ScaneMoreResultItem,
  change?:ScaneMoreResultItem
}

export interface DebugInfo {
  inUseUTXOs:{satoshis:number, count:number}
}

export interface WalletOpt{
  skipSyncBalance:boolean;
  syncOnce:boolean;
  addressDiscoveryExtent:number;
  logLevel:string;
  disableAddressDerivation:boolean;
  checkGRPCFlags:boolean;
  minimumRelayTransactionFee:number;
  updateTxTimes:boolean
}

export interface WalletOptions{
  skipSyncBalance?:boolean;
  addressDiscoveryExtent?:number;
  syncOnce?:boolean;
  logLevel?:string;
  disableAddressDerivation?:boolean;
  checkGRPCFlags?:boolean;
  minimumRelayTransactionFee?:number;
  updateTxTimes?:boolean
}
 
export interface NetworkOptions{
  network:Network;
  defaultFee?:number;
  rpc?:IRPC;
}

export interface UnspentOutputInfo{
  txid:string,
  address:string,
  vout:number,
  scriptPubKey:string,
  satoshis:number,
  blockDaaScore:number,
  scriptPublicKeyVersion:number,
  isCoinbase:boolean
}

export interface SelectedNetwork {
  prefix: Network;
  description: string;
  apiBaseUrl: string;
  mqttEndpoint: string;
  mqttPort: string;
}

export type WalletSave = {
  seedPhrase: string;
  privKey: string;
}

export interface TxSend {
  toAddr: string;
  amount: number;
  fee: number;
  //tx?: kaspacore.Transaction;
  changeAddrOverride? : string;
  networkFeeMax?:number;
  note?:string;
  calculateNetworkFee?:boolean;
  inclusiveFee?:boolean;
  skipSign?:boolean,
  privKeysInfo?:boolean;
  skipUTXOInUseMark?:boolean,
  compoundingUTXO?:boolean,
  compoundingUTXOMaxCount?:number
}

export interface TxCompoundOptions {
  UTXOMaxCount?:number;
  networkFeeMax?:number;
  fee?:number;
  useLatestChangeAddress?:boolean
}

export interface TxResp {
  txid: string;
  rpctx?: string;
}

export interface ComposeTxInfo{
  tx: kaspacore.Transaction;
  id: string;
  rawTx: string;
  utxoIds: string[];
  amount: number;
  toAddr: string;
  fee: number;
  utxos: UnspentOutput[];
  dataFee?:number;
  totalAmount?:number;
  txSize?:number;
  note?:string;
  privKeys:string[];
}

export interface TxInfo  extends ComposeTxInfo{
  dataFee:number;
  totalAmount:number;
  txSize:number;
  note:string;
}

export interface BuildTxResult extends TxInfo{
  rpcTX: RPC.SubmitTransactionRequest;
}

/*
export interface Confirmations {
  method: string;
  count: number;
  alpha: number;
  epsilon: number;
}
*/

export type WalletCache = {
  /*pendingTx: Record<
    string,
    { to: string; utxoIds: string[]; rawTx: string; amount: number; fee: number }
  >;*/
  utxos: {
    //utxoStorage: Record<string, Api.Utxo[]>;
    inUse: string[];
  };
  /*transactionsStorage: Record<string, Api.Transaction[]>;*/
  addresses: {
    receiveCounter: number;
    changeCounter: number;
  };
};

export type PendingTransactions = {
  amount: number;
  transactions: Record<
    string,
    {
      utxoIds: string[];
      rawTx: string;
      amount: number;
      fee: number;
      to: string;
    }
  >;
  add(
    id: string,
    tx: { utxoIds: string[]; rawTx: string; amount: number; fee: number; to: string }
  ): void;
};

export namespace Api{
  interface Transaction {
    transactionId: string;
    transactionHash: string;
    acceptingBlockHash: string;
    acceptingblockDaaScore: number;
    subnetworkId: string;
    lockTime: number;
    gas: number;
    payloadHash: string;
    payload: string;
    inputs: Array<TransactionInput>;
    outputs: Array<TransactionOutput>;
    mass: number;
    confirmations: number;
  }
  interface TransactionInput {
    previousTransactionId: string;
    previousTransactionOutputIndex: string;
    scriptSig: string;
    sequence: string;
    address: string;
  }
  interface TransactionOutput {
    value: number;
    scriptPubKey: string;
    address: string;
  }

  interface Utxo {
    transactionId: string;
    amount: number;
    scriptPublicKey: RPC.ScriptPublicKey;
    blockDaaScore: number;
    index: number;
    //acceptingBlockHash: string;
    //isSpent: boolean;
    isCoinbase: boolean;
    //isSpendable: boolean;
    //confirmations: number;
  }

  interface TransactionsByAddressesResponse{
    lasBlockScanned: string;
    transactions: RPC.TransactionVerboseData[];
  }
  declare type BlockResponse = RPC.BlockVerboseData
}


