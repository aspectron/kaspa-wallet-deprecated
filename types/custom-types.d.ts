import bitcore from 'bitcore-lib-cash';

export type Network = 'kaspa' | 'kaspadev' | 'kaspareg' | 'kaspatest' | 'kaspasim';

export interface SelectedNetwork {
  prefix: Network;
  description: string;
  apiBaseUrl: string;
  mqttEndpoint: string;
  mqttPort: string;
}

export interface Confirmations {
  method: string;
  count: number;
  alpha: number;
  epsilon: number;
}

export type WalletSave = {
  seedPhrase: string;
  privKey: string;
};

type WalletCache = {
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

type PendingTransactions = {
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

export interface TxSend {
  toAddr: string;
  amount: number;
  fee?: number;
}

export namespace Api {
  interface Utxo {
    transactionId: string;
    value: number;
    scriptPubKey: string;
    acceptingBlockHash: string;
    acceptingBlockBlueScore: number;
    index: number;
    isSpent: boolean;
    isCoinbase: boolean;
    isSpendable: boolean;
    confirmations: number;
  }
  interface UtxoResponse {
    utxos: Utxo[];
  }
  interface ErrorResponse {
    errorCode: number;
    errorMessage: string;
  }
  interface SuccessResponse{
    success:boolean;
    message?:string
  }

  interface BlockResponse {
    blockHash: string;
    parentBlockHashes: string[];
    version: number;
    hashMerkleRoot: string;
    acceptedIdMerkleRoot: string;
    utxoCommitment: string;
    timestamp: number;
    bits: number;
    nonce: number;
    acceptingBlockHash: string;
    blueScore: number;
    isChainBlock: boolean;
    mass: number;
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
  export interface Transaction {
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

  interface TransactionsResponse {
    transactions: Transaction[];
  }
  type SendTxResponse = boolean;
}

export interface IRPC {
  getBlock(blockHash:string): Promise<Api.BlockResponse>;
  getAddressTransactions(address:string, limit:number, skip:number): Promise<Api.Transaction[]>;
  getUtxos(address:string, limit:number, skip:number): Promise<Api.Utxo[]>;
  postTx(rawTransaction: string): Promise<Api.SuccessResponse>;
}


