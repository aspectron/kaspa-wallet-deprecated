"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Mnemonic = require('bitcore-mnemonic');
// @ts-ignore
const bitcore = require("bitcore-lib-cash");
// @ts-ignore
const passworder1 = require("browser-passworder");
const passworder2 = require("@aspectron/flow-key-crypt");
let passworder;
// @ts-ignore
if (typeof window != "undefined" && !window.nw) {
    passworder = passworder1;
}
else {
    passworder = passworder2;
}
const logger_1 = require("../utils/logger");
const AddressManager_1 = require("./AddressManager");
const UtxoSet_1 = require("./UtxoSet");
const api = require("./apiHelpers");
const txParser_1 = require("./txParser");
const config_json_1 = require("../config.json");
/** Class representing an HDWallet with derivable child addresses */
class Wallet {
    /** Create a wallet.
     * @param walletSave (optional)
     * @param walletSave.privKey Saved wallet's private key.
     * @param walletSave.seedPhrase Saved wallet's seed phrase.
     */
    constructor(privKey, seedPhrase) {
        /**
         * The summed balance across all of Wallet's discovered addresses, minus amount from pending transactions.
         */
        this.balance = undefined;
        /**
         * Current network.
         */
        // @ts-ignore
        this.network = config_json_1.DEFAULT_NETWORK.prefix;
        /**
         * Current API endpoint for selected network
         */
        this.apiEndpoint = config_json_1.DEFAULT_NETWORK.apiBaseUrl;
        this.utxoSet = new UtxoSet_1.UtxoSet();
        /* eslint-disable */
        this.pending = {
            transactions: {},
            get amount() {
                const transactions = Object.values(this.transactions);
                if (transactions.length === 0)
                    return 0;
                return transactions.reduce((prev, cur) => prev + cur.amount + cur.fee, 0);
            },
            add(id, tx) {
                this.transactions[id] = tx;
            },
        };
        /**
         * Transactions sorted by hash.
         */
        this.transactions = [];
        /**
         * Transaction arrays keyed by address.
         */
        this.transactionsStorage = {};
        if (privKey && seedPhrase) {
            this.HDWallet = new bitcore.HDPrivateKey(privKey);
            this.mnemonic = seedPhrase;
        }
        else {
            const temp = new Mnemonic(Mnemonic.Words.ENGLISH);
            this.mnemonic = temp.toString();
            this.HDWallet = new bitcore.HDPrivateKey(temp.toHDPrivateKey().toString());
        }
        this.addressManager = new AddressManager_1.AddressManager(this.HDWallet, this.network);
        this.addressManager.receiveAddress.next();
    }
    /**
     * Set by addressManager
     */
    get receiveAddress() {
        return this.addressManager.receiveAddress.current.address;
    }
    /**
     * Set rpc provider
     * @param rpc
     */
    setRPC(rpc) {
        api.setRPC(rpc);
    }
    /**
     * Queries API for address[] UTXOs. Adds UTXOs to UTXO set. Updates wallet balance.
     * @param addresses
     */
    updateUtxos(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.log('info', `Getting utxos for ${addresses.length} addresses.`);
            const utxoResults = yield Promise.all(addresses.map((address) => api.getUtxos(address)));
            addresses.forEach((address, i) => {
                const { utxos } = utxoResults[i];
                logger_1.logger.log('info', `${address}: ${utxos.length} total UTXOs found.`);
                this.utxoSet.utxoStorage[address] = utxos;
                this.utxoSet.add(utxos, address);
            });
        });
    }
    /**
     * Queries API for address[] transactions. Adds tx to transactions storage. Also sorts the entire transaction set.
     * @param addresses
     */
    updateTransactions(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.log('info', `Getting transactions for ${addresses.length} addresses.`);
            const addressesWithTx = [];
            const txResults = yield Promise.all(addresses.map((address) => api.getTransactions(address)));
            addresses.forEach((address, i) => {
                const { transactions } = txResults[i];
                logger_1.logger.log('info', `${address}: ${transactions.length} transactions found.`);
                if (transactions.length !== 0) {
                    const confirmedTx = transactions.filter((tx) => tx.confirmations > 0);
                    this.transactionsStorage[address] = confirmedTx;
                    addressesWithTx.push(address);
                }
            });
            // @ts-ignore
            this.transactions = txParser_1.txParser(this.transactionsStorage, Object.keys(this.addressManager.all));
            const pendingTxHashes = Object.keys(this.pending.transactions);
            if (pendingTxHashes.length > 0) {
                pendingTxHashes.forEach((hash) => {
                    if (this.transactions.map((tx) => tx.transactionHash).includes(hash)) {
                        this.deletePendingTx(hash);
                    }
                });
            }
            const isActivityOnReceiveAddr = this.transactionsStorage[this.addressManager.receiveAddress.current.address] !== undefined;
            if (isActivityOnReceiveAddr) {
                this.addressManager.receiveAddress.next();
            }
            return addressesWithTx;
        });
    }
    /**
     * Recalculates wallet balance.
     */
    updateBalance() {
        this.balance = this.utxoSet.totalBalance - this.pending.amount;
    }
    /**
     * Updates the selected network
     * @param network name of the network
     */
    updateNetwork(network) {
        return __awaiter(this, void 0, void 0, function* () {
            this.demolishWalletState(network.prefix);
            this.network = network.prefix;
            this.apiEndpoint = network.apiBaseUrl;
        });
    }
    demolishWalletState(networkPrefix = this.network) {
        this.utxoSet.clear();
        this.addressManager = new AddressManager_1.AddressManager(this.HDWallet, networkPrefix);
        this.pending.transactions = {};
        this.transactions = [];
        this.transactionsStorage = {};
    }
    /**
     * Derives receiveAddresses and changeAddresses and checks their transactions and UTXOs.
     * @param threshold stop discovering after `threshold` addresses with no activity
     */
    addressDiscovery(threshold = 20) {
        return __awaiter(this, void 0, void 0, function* () {
            const doDiscovery = (n, deriveType, offset) => __awaiter(this, void 0, void 0, function* () {
                const derivedAddresses = this.addressManager.getAddresses(n, deriveType, offset);
                const addresses = derivedAddresses.map((obj) => obj.address);
                logger_1.logger.log('info', `Fetching ${deriveType} address data for derived indices ${JSON.stringify(derivedAddresses.map((obj) => obj.index))}`);
                const addressesWithTx = yield this.updateTransactions(addresses);
                if (addressesWithTx.length === 0) {
                    // address discovery complete
                    const lastAddressIndexWithTx = offset - (threshold - n) - 1;
                    logger_1.logger.log('info', `${deriveType}Address discovery complete. Last activity on address #${lastAddressIndexWithTx}. No activity from ${deriveType}#${lastAddressIndexWithTx + 1}~${lastAddressIndexWithTx + threshold}.`);
                    return lastAddressIndexWithTx;
                }
                // else keep doing discovery
                const nAddressesLeft = derivedAddresses
                    .filter((obj) => addressesWithTx.indexOf(obj.address) !== -1)
                    .reduce((prev, cur) => Math.max(prev, cur.index), 0) + 1;
                return doDiscovery(nAddressesLeft, deriveType, offset + n);
            });
            const highestReceiveIndex = yield doDiscovery(threshold, 'receive', 0);
            const highestChangeIndex = yield doDiscovery(threshold, 'change', 0);
            this.addressManager.receiveAddress.advance(highestReceiveIndex + 1);
            this.addressManager.changeAddress.advance(highestChangeIndex + 1);
            logger_1.logger.log('info', `receive address index: ${highestReceiveIndex}; change address index: ${highestChangeIndex}`);
            yield this.updateUtxos(Object.keys(this.transactionsStorage));
            this.runStateChangeHooks();
        });
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
    composeTx({ toAddr, amount, fee = config_json_1.DEFAULT_FEE, changeAddrOverride, }) {
        if (!Number.isSafeInteger(amount))
            throw new Error('Amount too large');
        const { utxos, utxoIds } = this.utxoSet.selectUtxos(amount + fee);
        // @ts-ignore
        const privKeys = utxos.reduce((prev, cur) => {
            return [this.addressManager.all[String(cur.address)], ...prev];
        }, []);
        const changeAddr = changeAddrOverride || this.addressManager.changeAddress.next();
        try {
            const tx = new bitcore.Transaction()
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
            return { id: tx.id, rawTx: tx.toString(), utxoIds, amount: amount + fee };
        }
        catch (e) {
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
    sendTx(txParams) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id, rawTx } = this.composeTx(txParams);
            try {
                yield api.postTx(rawTx);
            }
            catch (e) {
                this.undoPendingTx(id);
                throw e;
            }
            return id;
        });
    }
    updateState() {
        return __awaiter(this, void 0, void 0, function* () {
            const activeAddrs = yield this.updateTransactions(this.addressManager.shouldFetch);
            yield this.updateUtxos(activeAddrs);
            this.runStateChangeHooks();
        });
    }
    undoPendingTx(id) {
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
    deletePendingTx(id) {
        // undo + delete old utxos
        const { utxoIds } = this.pending.transactions[id];
        delete this.pending.transactions[id];
        this.utxoSet.remove(utxoIds);
    }
    runStateChangeHooks() {
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
    restoreCache(cache) {
        this.pending.transactions = cache.pendingTx;
        this.utxoSet.utxoStorage = cache.utxos.utxoStorage;
        this.utxoSet.inUse = cache.utxos.inUse;
        Object.entries(this.utxoSet.utxoStorage).forEach(([addr, utxos]) => {
            this.utxoSet.add(utxos, addr);
        });
        this.transactionsStorage = cache.transactionsStorage;
        this.addressManager.getAddresses(cache.addresses.receiveCounter + 1, 'receive');
        this.addressManager.getAddresses(cache.addresses.changeCounter + 1, 'change');
        this.addressManager.receiveAddress.advance(cache.addresses.receiveCounter - 1);
        this.addressManager.changeAddress.advance(cache.addresses.changeCounter);
        // @ts-ignore
        this.transactions = txParser_1.txParser(this.transactionsStorage, Object.keys(this.addressManager.all));
        this.runStateChangeHooks();
    }
    /**
     *  Converts a mnemonic to a new wallet.
     * @param seedPhrase The 12 word seed phrase.
     * @returns new Wallet
     */
    static fromMnemonic(seedPhrase) {
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
    static import(password, encryptedMnemonic) {
        return __awaiter(this, void 0, void 0, function* () {
            const decrypted = yield passworder.decrypt(password, encryptedMnemonic);
            const savedWallet = decrypted;
            const myWallet = new this(savedWallet.privKey, savedWallet.seedPhrase);
            return myWallet;
        });
    }
    /**
     * Generates encrypted wallet data.
     * @param password user's chosen password
     * @returns Promise that resolves to object-like string. Suggested to store as string for .import().
     */
    export(password) {
        return __awaiter(this, void 0, void 0, function* () {
            const savedWallet = {
                privKey: this.HDWallet.toString(),
                seedPhrase: this.mnemonic,
            };
            return passworder.encrypt(password, JSON.stringify(savedWallet));
        });
    }
}
exports.default = Wallet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV2FsbGV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vd2FsbGV0L1dhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzdDLGFBQWE7QUFDYiw0Q0FBNEM7QUFDNUMsYUFBYTtBQUViLGtEQUFrRDtBQUNsRCx5REFBeUQ7QUFDekQsSUFBSSxVQUFrRCxDQUFDO0FBQ3ZELGFBQWE7QUFDYixJQUFHLE9BQU8sTUFBTSxJQUFJLFdBQVcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUM7SUFDNUMsVUFBVSxHQUFHLFdBQVcsQ0FBQztDQUMxQjtLQUFJO0lBQ0gsVUFBVSxHQUFHLFdBQVcsQ0FBQztDQUMxQjtBQVlELDRDQUF5QztBQUN6QyxxREFBa0Q7QUFDbEQsdUNBQW9DO0FBQ3BDLG9DQUFvQztBQUNwQyx5Q0FBc0M7QUFDdEMsZ0RBQThEO0FBRTlELG9FQUFvRTtBQUNwRSxNQUFNLE1BQU07SUE0RFY7Ozs7T0FJRztJQUNILFlBQVksT0FBZ0IsRUFBRSxVQUFtQjtRQTlEakQ7O1dBRUc7UUFDSCxZQUFPLEdBQXVCLFNBQVMsQ0FBQztRQVN4Qzs7V0FFRztRQUNILGFBQWE7UUFDYixZQUFPLEdBQVksNkJBQWUsQ0FBQyxNQUFpQixDQUFDO1FBRXJEOztXQUVHO1FBQ0gsZ0JBQVcsR0FBRyw2QkFBZSxDQUFDLFVBQVUsQ0FBQztRQU96QyxZQUFPLEdBQUcsSUFBSSxpQkFBTyxFQUFFLENBQUM7UUFJeEIsb0JBQW9CO1FBQ3BCLFlBQU8sR0FBd0I7WUFDN0IsWUFBWSxFQUFFLEVBQUU7WUFDaEIsSUFBSSxNQUFNO2dCQUNSLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUN0RCxJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQztvQkFBRSxPQUFPLENB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QUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFDbkUsQ0FBQztLQUFBO0NBQ0Y7QUFFRCxrQkFBZSxNQUFNLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBNbmVtb25pYyA9IHJlcXVpcmUoJ2JpdGNvcmUtbW5lbW9uaWMnKTtcbi8vIEB0cy1pZ25vcmVcbmltcG9ydCAqIGFzIGJpdGNvcmUgZnJvbSAnYml0Y29yZS1saWItY2FzaCc7XG4vLyBAdHMtaWdub3JlXG5cbmltcG9ydCAqIGFzIHBhc3N3b3JkZXIxIGZyb20gJ2Jyb3dzZXItcGFzc3dvcmRlcic7XG5pbXBvcnQgKiBhcyBwYXNzd29yZGVyMiBmcm9tICdAYXNwZWN0cm9uL2Zsb3cta2V5LWNyeXB0JztcbmxldCBwYXNzd29yZGVyOnR5cGVvZiBwYXNzd29yZGVyMSB8IHR5cGVvZiBwYXNzd29yZGVyMjtcbi8vIEB0cy1pZ25vcmVcbmlmKHR5cGVvZiB3aW5kb3cgIT0gXCJ1bmRlZmluZWRcIiAmJiAhd2luZG93Lm53KXtcbiAgcGFzc3dvcmRlciA9IHBhc3N3b3JkZXIxO1xufWVsc2V7XG4gIHBhc3N3b3JkZXIgPSBwYXNzd29yZGVyMjtcbn1cblxuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSAnc2FmZS1idWZmZXInO1xuaW1wb3J0IHtcbiAgTmV0d29yayxcbiAgU2VsZWN0ZWROZXR3b3JrLFxuICBXYWxsZXRTYXZlLFxuICBBcGksXG4gIFR4U2VuZCxcbiAgUGVuZGluZ1RyYW5zYWN0aW9ucyxcbiAgV2FsbGV0Q2FjaGUsIElSUENcbn0gZnJvbSAnLi4vdHlwZXMvY3VzdG9tLXR5cGVzJztcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgeyBBZGRyZXNzTWFuYWdlciB9IGZyb20gJy4vQWRkcmVzc01hbmFnZXInO1xuaW1wb3J0IHsgVXR4b1NldCB9IGZyb20gJy4vVXR4b1NldCc7XG5pbXBvcnQgKiBhcyBhcGkgZnJvbSAnLi9hcGlIZWxwZXJzJztcbmltcG9ydCB7IHR4UGFyc2VyIH0gZnJvbSAnLi90eFBhcnNlcic7XG5pbXBvcnQgeyBERUZBVUxUX0ZFRSwgREVGQVVMVF9ORVRXT1JLIH0gZnJvbSAnLi4vY29uZmlnLmpzb24nO1xuXG4vKiogQ2xhc3MgcmVwcmVzZW50aW5nIGFuIEhEV2FsbGV0IHdpdGggZGVyaXZhYmxlIGNoaWxkIGFkZHJlc3NlcyAqL1xuY2xhc3MgV2FsbGV0IHtcbiAgSERXYWxsZXQ6IGJpdGNvcmUuSERQcml2YXRlS2V5O1xuXG4gIC8qKlxuICAgKiBUaGUgc3VtbWVkIGJhbGFuY2UgYWNyb3NzIGFsbCBvZiBXYWxsZXQncyBkaXNjb3ZlcmVkIGFkZHJlc3NlcywgbWludXMgYW1vdW50IGZyb20gcGVuZGluZyB0cmFuc2FjdGlvbnMuXG4gICAqL1xuICBiYWxhbmNlOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqIFNldCBieSBhZGRyZXNzTWFuYWdlclxuICAgKi9cbiAgZ2V0IHJlY2VpdmVBZGRyZXNzKCkge1xuICAgIHJldHVybiB0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmN1cnJlbnQuYWRkcmVzcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDdXJyZW50IG5ldHdvcmsuXG4gICAqL1xuICAvLyBAdHMtaWdub3JlXG4gIG5ldHdvcms6IE5ldHdvcmsgPSBERUZBVUxUX05FVFdPUksucHJlZml4IGFzIE5ldHdvcms7XG5cbiAgLyoqXG4gICAqIEN1cnJlbnQgQVBJIGVuZHBvaW50IGZvciBzZWxlY3RlZCBuZXR3b3JrXG4gICAqL1xuICBhcGlFbmRwb2ludCA9IERFRkFVTFRfTkVUV09SSy5hcGlCYXNlVXJsO1xuXG4gIC8qKlxuICAgKiBBIDEyIHdvcmQgbW5lbW9uaWMuXG4gICAqL1xuICBtbmVtb25pYzogc3RyaW5nO1xuXG4gIHV0eG9TZXQgPSBuZXcgVXR4b1NldCgpO1xuXG4gIGFkZHJlc3NNYW5hZ2VyOiBBZGRyZXNzTWFuYWdlcjtcblxuICAvKiBlc2xpbnQtZGlzYWJsZSAqL1xuICBwZW5kaW5nOiBQZW5kaW5nVHJhbnNhY3Rpb25zID0ge1xuICAgIHRyYW5zYWN0aW9uczoge30sXG4gICAgZ2V0IGFtb3VudCgpIHtcbiAgICAgIGNvbnN0IHRyYW5zYWN0aW9ucyA9IE9iamVjdC52YWx1ZXModGhpcy50cmFuc2FjdGlvbnMpO1xuICAgICAgaWYgKHRyYW5zYWN0aW9ucy5sZW5ndGggPT09IDApIHJldHVybiAwO1xuICAgICAgcmV0dXJuIHRyYW5zYWN0aW9ucy5yZWR1Y2UoKHByZXYsIGN1cikgPT4gcHJldiArIGN1ci5hbW91bnQgKyBjdXIuZmVlLCAwKTtcbiAgICB9LFxuICAgIGFkZChcbiAgICAgIGlkOiBzdHJpbmcsXG4gICAgICB0eDogeyB0bzogc3RyaW5nOyB1dHhvSWRzOiBzdHJpbmdbXTsgcmF3VHg6IHN0cmluZzsgYW1vdW50OiBudW1iZXI7IGZlZTogbnVtYmVyIH1cbiAgICApIHtcbiAgICAgIHRoaXMudHJhbnNhY3Rpb25zW2lkXSA9IHR4O1xuICAgIH0sXG4gIH07XG4gIC8qKlxuICAgKiBUcmFuc2FjdGlvbnMgc29ydGVkIGJ5IGhhc2guXG4gICAqL1xuICB0cmFuc2FjdGlvbnM6IEFwaS5UcmFuc2FjdGlvbltdID0gW107XG5cbiAgLyoqXG4gICAqIFRyYW5zYWN0aW9uIGFycmF5cyBrZXllZCBieSBhZGRyZXNzLlxuICAgKi9cbiAgdHJhbnNhY3Rpb25zU3RvcmFnZTogUmVjb3JkPHN0cmluZywgQXBpLlRyYW5zYWN0aW9uW10+ID0ge307XG5cbiAgLyoqIENyZWF0ZSBhIHdhbGxldC5cbiAgICogQHBhcmFtIHdhbGxldFNhdmUgKG9wdGlvbmFsKVxuICAgKiBAcGFyYW0gd2FsbGV0U2F2ZS5wcml2S2V5IFNhdmVkIHdhbGxldCdzIHByaXZhdGUga2V5LlxuICAgKiBAcGFyYW0gd2FsbGV0U2F2ZS5zZWVkUGhyYXNlIFNhdmVkIHdhbGxldCdzIHNlZWQgcGhyYXNlLlxuICAgKi9cbiAgY29uc3RydWN0b3IocHJpdktleT86IHN0cmluZywgc2VlZFBocmFzZT86IHN0cmluZykge1xuICAgIGlmIChwcml2S2V5ICYmIHNlZWRQaHJhc2UpIHtcbiAgICAgIHRoaXMuSERXYWxsZXQgPSBuZXcgYml0Y29yZS5IRFByaXZhdGVLZXkocHJpdktleSk7XG4gICAgICB0aGlzLm1uZW1vbmljID0gc2VlZFBocmFzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGVtcCA9IG5ldyBNbmVtb25pYyhNbmVtb25pYy5Xb3Jkcy5FTkdMSVNIKTtcbiAgICAgIHRoaXMubW5lbW9uaWMgPSB0ZW1wLnRvU3RyaW5nKCk7XG4gICAgICB0aGlzLkhEV2FsbGV0ID0gbmV3IGJpdGNvcmUuSERQcml2YXRlS2V5KHRlbXAudG9IRFByaXZhdGVLZXkoKS50b1N0cmluZygpKTtcbiAgICB9XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlciA9IG5ldyBBZGRyZXNzTWFuYWdlcih0aGlzLkhEV2FsbGV0LCB0aGlzLm5ldHdvcmspO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MubmV4dCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCBycGMgcHJvdmlkZXJcbiAgICogQHBhcmFtIHJwY1xuICAgKi9cbiAgc2V0UlBDKHJwYzpJUlBDKXtcbiAgICBhcGkuc2V0UlBDKHJwYyk7XG4gIH1cblxuICAvKipcbiAgICogUXVlcmllcyBBUEkgZm9yIGFkZHJlc3NbXSBVVFhPcy4gQWRkcyBVVFhPcyB0byBVVFhPIHNldC4gVXBkYXRlcyB3YWxsZXQgYmFsYW5jZS5cbiAgICogQHBhcmFtIGFkZHJlc3Nlc1xuICAgKi9cbiAgYXN5bmMgdXBkYXRlVXR4b3MoYWRkcmVzc2VzOiBzdHJpbmdbXSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGxvZ2dlci5sb2coJ2luZm8nLCBgR2V0dGluZyB1dHhvcyBmb3IgJHthZGRyZXNzZXMubGVuZ3RofSBhZGRyZXNzZXMuYCk7XG4gICAgY29uc3QgdXR4b1Jlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgIGFkZHJlc3Nlcy5tYXAoKGFkZHJlc3MpID0+IGFwaS5nZXRVdHhvcyhhZGRyZXNzKSlcbiAgICApO1xuICAgIGFkZHJlc3Nlcy5mb3JFYWNoKChhZGRyZXNzLCBpKSA9PiB7XG4gICAgICBjb25zdCB7IHV0eG9zIH0gPSB1dHhvUmVzdWx0c1tpXTtcbiAgICAgIGxvZ2dlci5sb2coJ2luZm8nLCBgJHthZGRyZXNzfTogJHt1dHhvcy5sZW5ndGh9IHRvdGFsIFVUWE9zIGZvdW5kLmApO1xuICAgICAgdGhpcy51dHhvU2V0LnV0eG9TdG9yYWdlW2FkZHJlc3NdID0gdXR4b3M7XG4gICAgICB0aGlzLnV0eG9TZXQuYWRkKHV0eG9zLCBhZGRyZXNzKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBRdWVyaWVzIEFQSSBmb3IgYWRkcmVzc1tdIHRyYW5zYWN0aW9ucy4gQWRkcyB0eCB0byB0cmFuc2FjdGlvbnMgc3RvcmFnZS4gQWxzbyBzb3J0cyB0aGUgZW50aXJlIHRyYW5zYWN0aW9uIHNldC5cbiAgICogQHBhcmFtIGFkZHJlc3Nlc1xuICAgKi9cbiAgYXN5bmMgdXBkYXRlVHJhbnNhY3Rpb25zKGFkZHJlc3Nlczogc3RyaW5nW10pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgbG9nZ2VyLmxvZygnaW5mbycsIGBHZXR0aW5nIHRyYW5zYWN0aW9ucyBmb3IgJHthZGRyZXNzZXMubGVuZ3RofSBhZGRyZXNzZXMuYCk7XG4gICAgY29uc3QgYWRkcmVzc2VzV2l0aFR4OiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHR4UmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgYWRkcmVzc2VzLm1hcCgoYWRkcmVzcykgPT4gYXBpLmdldFRyYW5zYWN0aW9ucyhhZGRyZXNzKSlcbiAgICApO1xuICAgIGFkZHJlc3Nlcy5mb3JFYWNoKChhZGRyZXNzLCBpKSA9PiB7XG4gICAgICBjb25zdCB7IHRyYW5zYWN0aW9ucyB9ID0gdHhSZXN1bHRzW2ldO1xuICAgICAgbG9nZ2VyLmxvZygnaW5mbycsIGAke2FkZHJlc3N9OiAke3RyYW5zYWN0aW9ucy5sZW5ndGh9IHRyYW5zYWN0aW9ucyBmb3VuZC5gKTtcbiAgICAgIGlmICh0cmFuc2FjdGlvbnMubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgIGNvbnN0IGNvbmZpcm1lZFR4ID0gdHJhbnNhY3Rpb25zLmZpbHRlcigodHg6QXBpLlRyYW5zYWN0aW9uKSA9PiB0eC5jb25maXJtYXRpb25zID4gMCk7XG4gICAgICAgIHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZVthZGRyZXNzXSA9IGNvbmZpcm1lZFR4O1xuICAgICAgICBhZGRyZXNzZXNXaXRoVHgucHVzaChhZGRyZXNzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgdGhpcy50cmFuc2FjdGlvbnMgPSB0eFBhcnNlcih0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2UsIE9iamVjdC5rZXlzKHRoaXMuYWRkcmVzc01hbmFnZXIuYWxsKSk7XG4gICAgY29uc3QgcGVuZGluZ1R4SGFzaGVzID0gT2JqZWN0LmtleXModGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9ucyk7XG4gICAgaWYgKHBlbmRpbmdUeEhhc2hlcy5sZW5ndGggPiAwKSB7XG4gICAgICBwZW5kaW5nVHhIYXNoZXMuZm9yRWFjaCgoaGFzaCkgPT4ge1xuICAgICAgICBpZiAodGhpcy50cmFuc2FjdGlvbnMubWFwKCh0eCkgPT4gdHgudHJhbnNhY3Rpb25IYXNoKS5pbmNsdWRlcyhoYXNoKSkge1xuICAgICAgICAgIHRoaXMuZGVsZXRlUGVuZGluZ1R4KGhhc2gpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgY29uc3QgaXNBY3Rpdml0eU9uUmVjZWl2ZUFkZHIgPVxuICAgICAgdGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlW3RoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuY3VycmVudC5hZGRyZXNzXSAhPT0gdW5kZWZpbmVkO1xuICAgIGlmIChpc0FjdGl2aXR5T25SZWNlaXZlQWRkcikge1xuICAgICAgdGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5uZXh0KCk7XG4gICAgfVxuICAgIHJldHVybiBhZGRyZXNzZXNXaXRoVHg7XG4gIH1cblxuICAvKipcbiAgICogUmVjYWxjdWxhdGVzIHdhbGxldCBiYWxhbmNlLlxuICAgKi9cbiAgdXBkYXRlQmFsYW5jZSgpOiB2b2lkIHtcbiAgICB0aGlzLmJhbGFuY2UgPSB0aGlzLnV0eG9TZXQudG90YWxCYWxhbmNlIC0gdGhpcy5wZW5kaW5nLmFtb3VudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGVzIHRoZSBzZWxlY3RlZCBuZXR3b3JrXG4gICAqIEBwYXJhbSBuZXR3b3JrIG5hbWUgb2YgdGhlIG5ldHdvcmtcbiAgICovXG4gIGFzeW5jIHVwZGF0ZU5ldHdvcmsobmV0d29yazogU2VsZWN0ZWROZXR3b3JrKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5kZW1vbGlzaFdhbGxldFN0YXRlKG5ldHdvcmsucHJlZml4KTtcbiAgICB0aGlzLm5ldHdvcmsgPSBuZXR3b3JrLnByZWZpeDtcbiAgICB0aGlzLmFwaUVuZHBvaW50ID0gbmV0d29yay5hcGlCYXNlVXJsO1xuICB9XG5cbiAgZGVtb2xpc2hXYWxsZXRTdGF0ZShuZXR3b3JrUHJlZml4OiBOZXR3b3JrID0gdGhpcy5uZXR3b3JrKTogdm9pZCB7XG4gICAgdGhpcy51dHhvU2V0LmNsZWFyKCk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlciA9IG5ldyBBZGRyZXNzTWFuYWdlcih0aGlzLkhEV2FsbGV0LCBuZXR3b3JrUHJlZml4KTtcbiAgICB0aGlzLnBlbmRpbmcudHJhbnNhY3Rpb25zID0ge307XG4gICAgdGhpcy50cmFuc2FjdGlvbnMgPSBbXTtcbiAgICB0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2UgPSB7fTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXJpdmVzIHJlY2VpdmVBZGRyZXNzZXMgYW5kIGNoYW5nZUFkZHJlc3NlcyBhbmQgY2hlY2tzIHRoZWlyIHRyYW5zYWN0aW9ucyBhbmQgVVRYT3MuXG4gICAqIEBwYXJhbSB0aHJlc2hvbGQgc3RvcCBkaXNjb3ZlcmluZyBhZnRlciBgdGhyZXNob2xkYCBhZGRyZXNzZXMgd2l0aCBubyBhY3Rpdml0eVxuICAgKi9cbiAgYXN5bmMgYWRkcmVzc0Rpc2NvdmVyeSh0aHJlc2hvbGQgPSAyMCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGRvRGlzY292ZXJ5ID0gYXN5bmMgKFxuICAgICAgbjogbnVtYmVyLFxuICAgICAgZGVyaXZlVHlwZTogJ3JlY2VpdmUnIHwgJ2NoYW5nZScsXG4gICAgICBvZmZzZXQ6IG51bWJlclxuICAgICk6IFByb21pc2U8bnVtYmVyPiA9PiB7XG4gICAgICBjb25zdCBkZXJpdmVkQWRkcmVzc2VzID0gdGhpcy5hZGRyZXNzTWFuYWdlci5nZXRBZGRyZXNzZXMobiwgZGVyaXZlVHlwZSwgb2Zmc2V0KTtcbiAgICAgIGNvbnN0IGFkZHJlc3NlcyA9IGRlcml2ZWRBZGRyZXNzZXMubWFwKChvYmopID0+IG9iai5hZGRyZXNzKTtcbiAgICAgIGxvZ2dlci5sb2coXG4gICAgICAgICdpbmZvJyxcbiAgICAgICAgYEZldGNoaW5nICR7ZGVyaXZlVHlwZX0gYWRkcmVzcyBkYXRhIGZvciBkZXJpdmVkIGluZGljZXMgJHtKU09OLnN0cmluZ2lmeShcbiAgICAgICAgICBkZXJpdmVkQWRkcmVzc2VzLm1hcCgob2JqKSA9PiBvYmouaW5kZXgpXG4gICAgICAgICl9YFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGFkZHJlc3Nlc1dpdGhUeCA9IGF3YWl0IHRoaXMudXBkYXRlVHJhbnNhY3Rpb25zKGFkZHJlc3Nlcyk7XG4gICAgICBpZiAoYWRkcmVzc2VzV2l0aFR4Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBhZGRyZXNzIGRpc2NvdmVyeSBjb21wbGV0ZVxuICAgICAgICBjb25zdCBsYXN0QWRkcmVzc0luZGV4V2l0aFR4ID0gb2Zmc2V0IC0gKHRocmVzaG9sZCAtIG4pIC0gMTtcbiAgICAgICAgbG9nZ2VyLmxvZyhcbiAgICAgICAgICAnaW5mbycsXG4gICAgICAgICAgYCR7ZGVyaXZlVHlwZX1BZGRyZXNzIGRpc2NvdmVyeSBjb21wbGV0ZS4gTGFzdCBhY3Rpdml0eSBvbiBhZGRyZXNzICMke2xhc3RBZGRyZXNzSW5kZXhXaXRoVHh9LiBObyBhY3Rpdml0eSBmcm9tICR7ZGVyaXZlVHlwZX0jJHtcbiAgICAgICAgICAgIGxhc3RBZGRyZXNzSW5kZXhXaXRoVHggKyAxXG4gICAgICAgICAgfX4ke2xhc3RBZGRyZXNzSW5kZXhXaXRoVHggKyB0aHJlc2hvbGR9LmBcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGxhc3RBZGRyZXNzSW5kZXhXaXRoVHg7XG4gICAgICB9XG4gICAgICAvLyBlbHNlIGtlZXAgZG9pbmcgZGlzY292ZXJ5XG4gICAgICBjb25zdCBuQWRkcmVzc2VzTGVmdCA9XG4gICAgICAgIGRlcml2ZWRBZGRyZXNzZXNcbiAgICAgICAgICAuZmlsdGVyKChvYmopID0+IGFkZHJlc3Nlc1dpdGhUeC5pbmRleE9mKG9iai5hZGRyZXNzKSAhPT0gLTEpXG4gICAgICAgICAgLnJlZHVjZSgocHJldiwgY3VyKSA9PiBNYXRoLm1heChwcmV2LCBjdXIuaW5kZXgpLCAwKSArIDE7XG4gICAgICByZXR1cm4gZG9EaXNjb3ZlcnkobkFkZHJlc3Nlc0xlZnQsIGRlcml2ZVR5cGUsIG9mZnNldCArIG4pO1xuICAgIH07XG4gICAgY29uc3QgaGlnaGVzdFJlY2VpdmVJbmRleCA9IGF3YWl0IGRvRGlzY292ZXJ5KHRocmVzaG9sZCwgJ3JlY2VpdmUnLCAwKTtcbiAgICBjb25zdCBoaWdoZXN0Q2hhbmdlSW5kZXggPSBhd2FpdCBkb0Rpc2NvdmVyeSh0aHJlc2hvbGQsICdjaGFuZ2UnLCAwKTtcbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmFkdmFuY2UoaGlnaGVzdFJlY2VpdmVJbmRleCArIDEpO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5hZHZhbmNlKGhpZ2hlc3RDaGFuZ2VJbmRleCArIDEpO1xuICAgIGxvZ2dlci5sb2coXG4gICAgICAnaW5mbycsXG4gICAgICBgcmVjZWl2ZSBhZGRyZXNzIGluZGV4OiAke2hpZ2hlc3RSZWNlaXZlSW5kZXh9OyBjaGFuZ2UgYWRkcmVzcyBpbmRleDogJHtoaWdoZXN0Q2hhbmdlSW5kZXh9YFxuICAgICk7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVVdHhvcyhPYmplY3Qua2V5cyh0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2UpKTtcbiAgICB0aGlzLnJ1blN0YXRlQ2hhbmdlSG9va3MoKTtcbiAgfVxuXG4gIC8vIFRPRE86IGNvbnZlcnQgYW1vdW50IHRvIHNvbXBpcyBha2Egc2F0b3NoaXNcbiAgLy8gVE9ETzogYm5cbiAgLyoqXG4gICAqIENvbXBvc2UgYSBzZXJpYWxpemVkLCBzaWduZWQgdHJhbnNhY3Rpb25cbiAgICogQHBhcmFtIG9ialxuICAgKiBAcGFyYW0gb2JqLnRvQWRkciBUbyBhZGRyZXNzIGluIGNhc2hhZGRyIGZvcm1hdCAoZS5nLiBrYXNwYXRlc3Q6cXEwZDZoMHByam01bXBkbGQ1cG5jc3QzYWR1MHlhbTZ4Y2g0dHI2OWsyKVxuICAgKiBAcGFyYW0gb2JqLmFtb3VudCBBbW91bnQgdG8gc2VuZCBpbiBzb21waXMgKDEwMDAwMDAwMCAoMWU4KSBzb21waXMgaW4gMSBLU1ApXG4gICAqIEBwYXJhbSBvYmouZmVlIEZlZSBmb3IgbWluZXJzIGluIHNvbXBpc1xuICAgKiBAcGFyYW0gb2JqLmNoYW5nZUFkZHJPdmVycmlkZSBVc2UgdGhpcyB0byBvdmVycmlkZSBhdXRvbWF0aWMgY2hhbmdlIGFkZHJlc3MgZGVyaXZhdGlvblxuICAgKiBAdGhyb3dzIGlmIGFtb3VudCBpcyBhYm92ZSBgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVJgXG4gICAqL1xuICBjb21wb3NlVHgoe1xuICAgIHRvQWRkcixcbiAgICBhbW91bnQsXG4gICAgZmVlID0gREVGQVVMVF9GRUUsXG4gICAgY2hhbmdlQWRkck92ZXJyaWRlLFxuICB9OiBUeFNlbmQgJiB7IGNoYW5nZUFkZHJPdmVycmlkZT86IHN0cmluZyB9KToge1xuICAgIGlkOiBzdHJpbmc7XG4gICAgcmF3VHg6IHN0cmluZztcbiAgICB1dHhvSWRzOiBzdHJpbmdbXTtcbiAgICBhbW91bnQ6IG51bWJlcjtcbiAgfSB7XG4gICAgaWYgKCFOdW1iZXIuaXNTYWZlSW50ZWdlcihhbW91bnQpKSB0aHJvdyBuZXcgRXJyb3IoJ0Ftb3VudCB0b28gbGFyZ2UnKTtcbiAgICBjb25zdCB7IHV0eG9zLCB1dHhvSWRzIH0gPSB0aGlzLnV0eG9TZXQuc2VsZWN0VXR4b3MoYW1vdW50ICsgZmVlKTtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3QgcHJpdktleXMgPSB1dHhvcy5yZWR1Y2UoKHByZXY6IHN0cmluZ1tdLCBjdXIpID0+IHtcbiAgICAgIHJldHVybiBbdGhpcy5hZGRyZXNzTWFuYWdlci5hbGxbU3RyaW5nKGN1ci5hZGRyZXNzKV0sIC4uLnByZXZdO1xuICAgIH0sIFtdKTtcbiAgICBjb25zdCBjaGFuZ2VBZGRyID0gY2hhbmdlQWRkck92ZXJyaWRlIHx8IHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5uZXh0KCk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHR4OiBiaXRjb3JlLlRyYW5zYWN0aW9uID0gbmV3IGJpdGNvcmUuVHJhbnNhY3Rpb24oKVxuICAgICAgICAuZnJvbSh1dHhvcylcbiAgICAgICAgLnRvKHRvQWRkciwgYW1vdW50KVxuICAgICAgICAuc2V0VmVyc2lvbigxKVxuICAgICAgICAuZmVlKGZlZSlcbiAgICAgICAgLmNoYW5nZShjaGFuZ2VBZGRyKVxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIC5zaWduKHByaXZLZXlzLCBiaXRjb3JlLmNyeXB0by5TaWduYXR1cmUuU0lHSEFTSF9BTEwsICdzY2hub3JyJyk7XG4gICAgICB0aGlzLnV0eG9TZXQuaW5Vc2UucHVzaCguLi51dHhvSWRzKTtcbiAgICAgIHRoaXMucGVuZGluZy5hZGQodHguaWQsIHsgcmF3VHg6IHR4LnRvU3RyaW5nKCksIHV0eG9JZHMsIGFtb3VudCwgdG86IHRvQWRkciwgZmVlIH0pO1xuICAgICAgdGhpcy5ydW5TdGF0ZUNoYW5nZUhvb2tzKCk7XG4gICAgICByZXR1cm4geyBpZDogdHguaWQsIHJhd1R4OiB0eC50b1N0cmluZygpLCB1dHhvSWRzLCBhbW91bnQ6IGFtb3VudCArIGZlZSB9O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5yZXZlcnNlKCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgdHJhbnNhY3Rpb24uIFJldHVybnMgdHJhbnNhY3Rpb24gaWQuXG4gICAqIEBwYXJhbSB0eFBhcmFtc1xuICAgKiBAcGFyYW0gdHhQYXJhbXMudG9BZGRyIFRvIGFkZHJlc3MgaW4gY2FzaGFkZHIgZm9ybWF0IChlLmcuIGthc3BhdGVzdDpxcTBkNmgwcHJqbTVtcGRsZDVwbmNzdDNhZHUweWFtNnhjaDR0cjY5azIpXG4gICAqIEBwYXJhbSB0eFBhcmFtcy5hbW91bnQgQW1vdW50IHRvIHNlbmQgaW4gc29tcGlzICgxMDAwMDAwMDAgKDFlOCkgc29tcGlzIGluIDEgS1NQKVxuICAgKiBAcGFyYW0gdHhQYXJhbXMuZmVlIEZlZSBmb3IgbWluZXJzIGluIHNvbXBpc1xuICAgKiBAdGhyb3dzIGBGZXRjaEVycm9yYCBpZiBlbmRwb2ludCBpcyBkb3duLiBBUEkgZXJyb3IgbWVzc2FnZSBpZiB0eCBlcnJvci4gRXJyb3IgaWYgYW1vdW50IGlzIHRvbyBsYXJnZSB0byBiZSByZXByZXNlbnRlZCBhcyBhIGphdmFzY3JpcHQgbnVtYmVyLlxuICAgKi9cbiAgYXN5bmMgc2VuZFR4KHR4UGFyYW1zOiBUeFNlbmQpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IHsgaWQsIHJhd1R4IH0gPSB0aGlzLmNvbXBvc2VUeCh0eFBhcmFtcyk7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGFwaS5wb3N0VHgocmF3VHgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMudW5kb1BlbmRpbmdUeChpZCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgICByZXR1cm4gaWQ7XG4gIH1cblxuICBhc3luYyB1cGRhdGVTdGF0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBhY3RpdmVBZGRycyA9IGF3YWl0IHRoaXMudXBkYXRlVHJhbnNhY3Rpb25zKHRoaXMuYWRkcmVzc01hbmFnZXIuc2hvdWxkRmV0Y2gpO1xuICAgIGF3YWl0IHRoaXMudXBkYXRlVXR4b3MoYWN0aXZlQWRkcnMpO1xuICAgIHRoaXMucnVuU3RhdGVDaGFuZ2VIb29rcygpO1xuICB9XG5cbiAgdW5kb1BlbmRpbmdUeChpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgeyB1dHhvSWRzIH0gPSB0aGlzLnBlbmRpbmcudHJhbnNhY3Rpb25zW2lkXTtcbiAgICBkZWxldGUgdGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9uc1tpZF07XG4gICAgdGhpcy51dHhvU2V0LnJlbGVhc2UodXR4b0lkcyk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLnJldmVyc2UoKTtcbiAgICB0aGlzLnJ1blN0YXRlQ2hhbmdlSG9va3MoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZnRlciB3ZSBzZWUgdGhlIHRyYW5zYWN0aW9uIGluIHRoZSBBUEkgcmVzdWx0cywgZGVsZXRlIGl0IGZyb20gb3VyIHBlbmRpbmcgbGlzdC5cbiAgICogQHBhcmFtIGlkIFRoZSB0eCBoYXNoXG4gICAqL1xuICBkZWxldGVQZW5kaW5nVHgoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIHVuZG8gKyBkZWxldGUgb2xkIHV0eG9zXG4gICAgY29uc3QgeyB1dHhvSWRzIH0gPSB0aGlzLnBlbmRpbmcudHJhbnNhY3Rpb25zW2lkXTtcbiAgICBkZWxldGUgdGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9uc1tpZF07XG4gICAgdGhpcy51dHhvU2V0LnJlbW92ZSh1dHhvSWRzKTtcbiAgfVxuXG4gIHJ1blN0YXRlQ2hhbmdlSG9va3MoKTogdm9pZCB7XG4gICAgdGhpcy51dHhvU2V0LnVwZGF0ZVV0eG9CYWxhbmNlKCk7XG4gICAgdGhpcy51cGRhdGVCYWxhbmNlKCk7XG4gIH1cblxuICBnZXQgY2FjaGUoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBlbmRpbmdUeDogdGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9ucyxcbiAgICAgIHV0eG9zOiB7XG4gICAgICAgIHV0eG9TdG9yYWdlOiB0aGlzLnV0eG9TZXQudXR4b1N0b3JhZ2UsXG4gICAgICAgIGluVXNlOiB0aGlzLnV0eG9TZXQuaW5Vc2UsXG4gICAgICB9LFxuICAgICAgdHJhbnNhY3Rpb25zU3RvcmFnZTogdGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlLFxuICAgICAgYWRkcmVzc2VzOiB7XG4gICAgICAgIHJlY2VpdmVDb3VudGVyOiB0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmNvdW50ZXIsXG4gICAgICAgIGNoYW5nZUNvdW50ZXI6IHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5jb3VudGVyLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgcmVzdG9yZUNhY2hlKGNhY2hlOiBXYWxsZXRDYWNoZSk6IHZvaWQge1xuICAgIHRoaXMucGVuZGluZy50cmFuc2FjdGlvbnMgPSBjYWNoZS5wZW5kaW5nVHg7XG4gICAgdGhpcy51dHhvU2V0LnV0eG9TdG9yYWdlID0gY2FjaGUudXR4b3MudXR4b1N0b3JhZ2U7XG4gICAgdGhpcy51dHhvU2V0LmluVXNlID0gY2FjaGUudXR4b3MuaW5Vc2U7XG4gICAgT2JqZWN0LmVudHJpZXModGhpcy51dHhvU2V0LnV0eG9TdG9yYWdlKS5mb3JFYWNoKChbYWRkciwgdXR4b3NdOiBbc3RyaW5nLCBBcGkuVXR4b1tdXSkgPT4ge1xuICAgICAgdGhpcy51dHhvU2V0LmFkZCh1dHhvcywgYWRkcik7XG4gICAgfSk7XG4gICAgdGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlID0gY2FjaGUudHJhbnNhY3Rpb25zU3RvcmFnZTtcbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLmdldEFkZHJlc3NlcyhjYWNoZS5hZGRyZXNzZXMucmVjZWl2ZUNvdW50ZXIgKyAxLCAncmVjZWl2ZScpO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIuZ2V0QWRkcmVzc2VzKGNhY2hlLmFkZHJlc3Nlcy5jaGFuZ2VDb3VudGVyICsgMSwgJ2NoYW5nZScpO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuYWR2YW5jZShjYWNoZS5hZGRyZXNzZXMucmVjZWl2ZUNvdW50ZXIgLSAxKTtcbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MuYWR2YW5jZShjYWNoZS5hZGRyZXNzZXMuY2hhbmdlQ291bnRlcik7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIHRoaXMudHJhbnNhY3Rpb25zID0gdHhQYXJzZXIodGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlLCBPYmplY3Qua2V5cyh0aGlzLmFkZHJlc3NNYW5hZ2VyLmFsbCkpO1xuICAgIHRoaXMucnVuU3RhdGVDaGFuZ2VIb29rcygpO1xuICB9XG5cbiAgLyoqXG4gICAqICBDb252ZXJ0cyBhIG1uZW1vbmljIHRvIGEgbmV3IHdhbGxldC5cbiAgICogQHBhcmFtIHNlZWRQaHJhc2UgVGhlIDEyIHdvcmQgc2VlZCBwaHJhc2UuXG4gICAqIEByZXR1cm5zIG5ldyBXYWxsZXRcbiAgICovXG4gIHN0YXRpYyBmcm9tTW5lbW9uaWMoc2VlZFBocmFzZTogc3RyaW5nKTogV2FsbGV0IHtcbiAgICBjb25zdCBwcml2S2V5ID0gbmV3IE1uZW1vbmljKHNlZWRQaHJhc2UudHJpbSgpKS50b0hEUHJpdmF0ZUtleSgpLnRvU3RyaW5nKCk7XG4gICAgY29uc3Qgd2FsbGV0ID0gbmV3IHRoaXMocHJpdktleSwgc2VlZFBocmFzZSk7XG4gICAgcmV0dXJuIHdhbGxldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IFdhbGxldCBmcm9tIGVuY3J5cHRlZCB3YWxsZXQgZGF0YS5cbiAgICogQHBhcmFtIHBhc3N3b3JkIHRoZSBwYXNzd29yZCB0aGUgdXNlciBlbmNyeXB0ZWQgdGhlaXIgc2VlZCBwaHJhc2Ugd2l0aFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkTW5lbW9uaWMgdGhlIGVuY3J5cHRlZCBzZWVkIHBocmFzZSBmcm9tIGxvY2FsIHN0b3JhZ2VcbiAgICogQHRocm93cyBXaWxsIHRocm93IFwiSW5jb3JyZWN0IHBhc3N3b3JkXCIgaWYgcGFzc3dvcmQgaXMgd3JvbmdcbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbXBvcnQocGFzc3dvcmQ6IHN0cmluZywgZW5jcnlwdGVkTW5lbW9uaWM6IHN0cmluZyk6IFByb21pc2U8V2FsbGV0PiB7XG4gICAgY29uc3QgZGVjcnlwdGVkID0gYXdhaXQgcGFzc3dvcmRlci5kZWNyeXB0KHBhc3N3b3JkLCBlbmNyeXB0ZWRNbmVtb25pYyk7XG4gICAgY29uc3Qgc2F2ZWRXYWxsZXQgPSBkZWNyeXB0ZWQgYXMgV2FsbGV0U2F2ZTtcbiAgICBjb25zdCBteVdhbGxldCA9IG5ldyB0aGlzKHNhdmVkV2FsbGV0LnByaXZLZXksIHNhdmVkV2FsbGV0LnNlZWRQaHJhc2UpO1xuICAgIHJldHVybiBteVdhbGxldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgZW5jcnlwdGVkIHdhbGxldCBkYXRhLlxuICAgKiBAcGFyYW0gcGFzc3dvcmQgdXNlcidzIGNob3NlbiBwYXNzd29yZFxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gb2JqZWN0LWxpa2Ugc3RyaW5nLiBTdWdnZXN0ZWQgdG8gc3RvcmUgYXMgc3RyaW5nIGZvciAuaW1wb3J0KCkuXG4gICAqL1xuICBhc3luYyBleHBvcnQocGFzc3dvcmQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3Qgc2F2ZWRXYWxsZXQ6IFdhbGxldFNhdmUgPSB7XG4gICAgICBwcml2S2V5OiB0aGlzLkhEV2FsbGV0LnRvU3RyaW5nKCksXG4gICAgICBzZWVkUGhyYXNlOiB0aGlzLm1uZW1vbmljLFxuICAgIH07XG4gICAgcmV0dXJuIHBhc3N3b3JkZXIuZW5jcnlwdChwYXNzd29yZCwgSlNPTi5zdHJpbmdpZnkoc2F2ZWRXYWxsZXQpKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBXYWxsZXQ7XG4iXX0=