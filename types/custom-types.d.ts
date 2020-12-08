import bitcore from 'bitcore-lib-cash';

export type Network = 'kaspa' | 'kaspadev' | 'kaspareg' | 'kaspatest' | 'kaspasim';
export type bytes = string;//base84 string

export * from './rpc';

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
  tx: bitcore.Transaction;
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
  pendingTx: Record<
    string,
    { to: string; utxoIds: string[]; rawTx: string; amount: number; fee: number }
  >;
  utxos: {
    utxoStorage: Record<string, Api.Utxo[]>;
    inUse: string[];
  };
  transactionsStorage: Record<string, Api.Transaction[]>;
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
    acceptingBlockBlueScore: number;
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
    transactionID: string;
    amount: number;
    scriptPubKey: string;
    blockBlueScore: number;
    index: number;
    //acceptingBlockHash: string;
    //isSpent: boolean;
    //isCoinbase: boolean;
    //isSpendable: boolean;
    //confirmations: number;
  }

  interface TransactionsByAddressesResponse{
    lasBlockScanned: string;
    transactions: RPC.TransactionVerboseData[];
  }
  declare type BlockResponse = RPC.BlockVerboseData
}


