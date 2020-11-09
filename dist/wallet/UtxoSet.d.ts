import { Api } from 'custom-types';
import bitcore from 'bitcore-lib-cash';
export declare class UtxoSet {
    utxos: Record<string, bitcore.Transaction.UnspentOutput>;
    inUse: string[];
    totalBalance: number;
    availableBalance: number;
    get length(): number;
    utxoStorage: Record<string, Api.Utxo[]>;
    /**
     * Add UTXOs to UTXO set.
     * @param utxos Array of UTXOs from kaspa API.
     * @param address Address of UTXO owner.
     */
    add(utxos: Api.Utxo[], address: string): string[];
    remove(utxoIds: string[]): void;
    release(utxoIdsToEnable: string[]): void;
    updateUtxoBalance(): void;
    clear(): void;
    /**
     * Naively select UTXOs.
     * @param txAmount Provide the amount that the UTXOs should cover.
     * @throws Error message if the UTXOs can't cover the `txAmount`
     */
    selectUtxos(txAmount: number): {
        utxoIds: string[];
        utxos: bitcore.Transaction.UnspentOutput[];
    };
}
//# sourceMappingURL=UtxoSet.d.ts.map