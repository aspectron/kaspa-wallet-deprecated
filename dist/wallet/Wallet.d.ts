import * as bitcore from 'bitcore-lib-cash';
import { Network, SelectedNetwork, Api, TxSend, PendingTransactions, WalletCache, IRPC } from '../types/custom-types';
import { AddressManager } from './AddressManager';
import { UtxoSet } from './UtxoSet';
/** Class representing an HDWallet with derivable child addresses */
declare class Wallet {
    HDWallet: bitcore.HDPrivateKey;
    /**
     * The summed balance across all of Wallet's discovered addresses, minus amount from pending transactions.
     */
    balance: number | undefined;
    /**
     * Set by addressManager
     */
    get receiveAddress(): string;
    /**
     * Current network.
     */
    network: Network;
    /**
     * Current API endpoint for selected network
     */
    apiEndpoint: string;
    /**
     * A 12 word mnemonic.
     */
    mnemonic: string;
    utxoSet: UtxoSet;
    addressManager: AddressManager;
    pending: PendingTransactions;
    /**
     * Transactions sorted by hash.
     */
    transactions: Api.Transaction[];
    /**
     * Transaction arrays keyed by address.
     */
    transactionsStorage: Record<string, Api.Transaction[]>;
    /** Create a wallet.
     * @param walletSave (optional)
     * @param walletSave.privKey Saved wallet's private key.
     * @param walletSave.seedPhrase Saved wallet's seed phrase.
     */
    constructor(privKey?: string, seedPhrase?: string);
    /**
     * Set rpc provider
     * @param rpc
     */
    static setRPC(rpc: IRPC): void;
    /**
     * Queries API for address[] UTXOs. Adds UTXOs to UTXO set. Updates wallet balance.
     * @param addresses
     */
    updateUtxos(addresses: string[]): Promise<void>;
    /**
     * Queries API for address[] transactions. Adds tx to transactions storage. Also sorts the entire transaction set.
     * @param addresses
     */
    updateTransactions(addresses: string[]): Promise<string[]>;
    /**
     * Recalculates wallet balance.
     */
    updateBalance(): void;
    /**
     * Updates the selected network
     * @param network name of the network
     */
    updateNetwork(network: SelectedNetwork): Promise<void>;
    demolishWalletState(networkPrefix?: Network): void;
    /**
     * Derives receiveAddresses and changeAddresses and checks their transactions and UTXOs.
     * @param threshold stop discovering after `threshold` addresses with no activity
     */
    addressDiscovery(threshold?: number): Promise<void>;
    /**
     * Compose a serialized, signed transaction
     * @param obj
     * @param obj.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param obj.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KSP)
     * @param obj.fee Fee for miners in sompis
     * @param obj.changeAddrOverride Use this to override automatic change address derivation
     * @throws if amount is above `Number.MAX_SAFE_INTEGER`
     */
    composeTx({ toAddr, amount, fee, changeAddrOverride, }: TxSend & {
        changeAddrOverride?: string;
    }): {
        id: string;
        rawTx: string;
        utxoIds: string[];
        amount: number;
    };
    /**
     * Send a transaction. Returns transaction id.
     * @param txParams
     * @param txParams.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
     * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KSP)
     * @param txParams.fee Fee for miners in sompis
     * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
     */
    sendTx(txParams: TxSend): Promise<string>;
    updateState(): Promise<void>;
    undoPendingTx(id: string): void;
    /**
     * After we see the transaction in the API results, delete it from our pending list.
     * @param id The tx hash
     */
    deletePendingTx(id: string): void;
    runStateChangeHooks(): void;
    get cache(): {
        pendingTx: Record<string, {
            utxoIds: string[];
            rawTx: string;
            amount: number;
            fee: number; /**
             * The summed balance across all of Wallet's discovered addresses, minus amount from pending transactions.
             */
            to: string;
        }>;
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
    restoreCache(cache: WalletCache): void;
    /**
     *  Converts a mnemonic to a new wallet.
     * @param seedPhrase The 12 word seed phrase.
     * @returns new Wallet
     */
    static fromMnemonic(seedPhrase: string): Wallet;
    /**
     * Creates a new Wallet from encrypted wallet data.
     * @param password the password the user encrypted their seed phrase with
     * @param encryptedMnemonic the encrypted seed phrase from local storage
     * @throws Will throw "Incorrect password" if password is wrong
     */
    static import(password: string, encryptedMnemonic: string): Promise<Wallet>;
    /**
     * Generates encrypted wallet data.
     * @param password user's chosen password
     * @returns Promise that resolves to object-like string. Suggested to store as string for .import().
     */
    export(password: string): Promise<string>;
}
export default Wallet;
//# sourceMappingURL=Wallet.d.ts.map