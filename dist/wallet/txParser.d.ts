import { Api } from 'custom-types';
interface NiceTx extends Api.Transaction {
    summary?: {
        direction?: 'in' | 'out';
        address?: string;
        value?: number;
    };
}
export declare const txParser: (transactionStorage: Record<string, Api.Transaction[]>, addressArray: string[]) => NiceTx[];
export {};
//# sourceMappingURL=txParser.d.ts.map