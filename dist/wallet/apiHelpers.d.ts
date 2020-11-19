import { Api, IRPC } from 'custom-types';
export declare const setRPC: (rpc: IRPC) => void;
export declare const getBlock: (blockHash: string) => Promise<Api.BlockResponse>;
export declare const getTransactions: (address: string) => Promise<Api.TransactionsResponse>;
export declare const getUtxos: (address: string) => Promise<Api.UtxoResponse>;
export declare const postTx: (rawTransaction: string) => Promise<Api.SendTxResponse>;
//# sourceMappingURL=apiHelpers.d.ts.map