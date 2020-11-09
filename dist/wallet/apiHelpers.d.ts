import { Api } from 'custom-types';
export declare const getBlock: (blockHash: string, apiEndpoint: string) => Promise<Api.BlockResponse>;
export declare const getTransactions: (address: string, apiEndpoint: string) => Promise<Api.TransactionsResponse>;
export declare const getUtxos: (address: string, apiEndpoint: string) => Promise<Api.UtxoResponse>;
export declare const postTx: (rawTransaction: string, apiEndpoint: string) => Promise<Api.SendTxResponse>;
//# sourceMappingURL=apiHelpers.d.ts.map