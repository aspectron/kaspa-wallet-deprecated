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
const passworder = require("passworder");
const safe_buffer_1 = require("safe-buffer");
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
     * Queries API for address[] UTXOs. Adds UTXOs to UTXO set. Updates wallet balance.
     * @param addresses
     */
    updateUtxos(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.log('info', `Getting utxos for ${addresses.length} addresses.`);
            const utxoResults = yield Promise.all(addresses.map((address) => api.getUtxos(address, this.apiEndpoint)));
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
            const txResults = yield Promise.all(addresses.map((address) => api.getTransactions(address, this.apiEndpoint)));
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
                yield api.postTx(rawTx, this.apiEndpoint);
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
            const savedWallet = JSON.parse(safe_buffer_1.Buffer.from(decrypted).toString('utf8'));
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
            return passworder.encrypt(password, safe_buffer_1.Buffer.from(JSON.stringify(savedWallet), 'utf8'));
        });
    }
}
exports.default = Wallet;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV2FsbGV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vd2FsbGV0L1dhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzdDLGFBQWE7QUFDYiw0Q0FBNEM7QUFDNUMsYUFBYTtBQUNiLHlDQUF5QztBQUN6Qyw2Q0FBcUM7QUFVckMsNENBQXlDO0FBQ3pDLHFEQUFrRDtBQUNsRCx1Q0FBb0M7QUFDcEMsb0NBQW9DO0FBQ3BDLHlDQUFzQztBQUN0QyxnREFBOEQ7QUFFOUQsb0VBQW9FO0FBQ3BFLE1BQU0sTUFBTTtJQTREVjs7OztPQUlHO0lBQ0gsWUFBWSxPQUFnQixFQUFFLFVBQW1CO1FBOURqRDs7V0FFRztRQUNILFlBQU8sR0FBdUIsU0FBUyxDQUFDO1FBU3hDOztXQUVHO1FBQ0gsYUFBYTtRQUNiLFlBQU8sR0FBWSw2QkFBZSxDQUFDLE1BQWlCLENBQUM7UUFFckQ7O1dBRUc7UUFDSCxnQkFBVyxHQUFHLDZCQUFlLENBQUMsVUFBVSxDQUFDO1FBT3pDLFlBQU8sR0FBRyxJQUFJLGlCQUFPLEVBQUUsQ0FBQztRQUl4QixvQkFBb0I7UUFDcEIsWUFBTyxHQUF3QjtZQUM3QixZQUFZLEVBQUUsRUFBRTtZQUNoQixJQUFJLE1BQU07Z0JBQ1IsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQ3RELElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDO29CQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUN4QyxPQUFPLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzVFLENBQUM7WUFDRCxHQUFH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QUMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBNbmVtb25pYyA9IHJlcXVpcmUoJ2JpdGNvcmUtbW5lbW9uaWMnKTtcbi8vIEB0cy1pZ25vcmVcbmltcG9ydCAqIGFzIGJpdGNvcmUgZnJvbSAnYml0Y29yZS1saWItY2FzaCc7XG4vLyBAdHMtaWdub3JlXG5pbXBvcnQgKiBhcyBwYXNzd29yZGVyIGZyb20gJ3Bhc3N3b3JkZXInO1xuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSAnc2FmZS1idWZmZXInO1xuaW1wb3J0IHtcbiAgTmV0d29yayxcbiAgU2VsZWN0ZWROZXR3b3JrLFxuICBXYWxsZXRTYXZlLFxuICBBcGksXG4gIFR4U2VuZCxcbiAgUGVuZGluZ1RyYW5zYWN0aW9ucyxcbiAgV2FsbGV0Q2FjaGVcbn0gZnJvbSAnLi4vdHlwZXMvY3VzdG9tLXR5cGVzJztcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgeyBBZGRyZXNzTWFuYWdlciB9IGZyb20gJy4vQWRkcmVzc01hbmFnZXInO1xuaW1wb3J0IHsgVXR4b1NldCB9IGZyb20gJy4vVXR4b1NldCc7XG5pbXBvcnQgKiBhcyBhcGkgZnJvbSAnLi9hcGlIZWxwZXJzJztcbmltcG9ydCB7IHR4UGFyc2VyIH0gZnJvbSAnLi90eFBhcnNlcic7XG5pbXBvcnQgeyBERUZBVUxUX0ZFRSwgREVGQVVMVF9ORVRXT1JLIH0gZnJvbSAnLi4vY29uZmlnLmpzb24nO1xuXG4vKiogQ2xhc3MgcmVwcmVzZW50aW5nIGFuIEhEV2FsbGV0IHdpdGggZGVyaXZhYmxlIGNoaWxkIGFkZHJlc3NlcyAqL1xuY2xhc3MgV2FsbGV0IHtcbiAgSERXYWxsZXQ6IGJpdGNvcmUuSERQcml2YXRlS2V5O1xuXG4gIC8qKlxuICAgKiBUaGUgc3VtbWVkIGJhbGFuY2UgYWNyb3NzIGFsbCBvZiBXYWxsZXQncyBkaXNjb3ZlcmVkIGFkZHJlc3NlcywgbWludXMgYW1vdW50IGZyb20gcGVuZGluZyB0cmFuc2FjdGlvbnMuXG4gICAqL1xuICBiYWxhbmNlOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqIFNldCBieSBhZGRyZXNzTWFuYWdlclxuICAgKi9cbiAgZ2V0IHJlY2VpdmVBZGRyZXNzKCkge1xuICAgIHJldHVybiB0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmN1cnJlbnQuYWRkcmVzcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDdXJyZW50IG5ldHdvcmsuXG4gICAqL1xuICAvLyBAdHMtaWdub3JlXG4gIG5ldHdvcms6IE5ldHdvcmsgPSBERUZBVUxUX05FVFdPUksucHJlZml4IGFzIE5ldHdvcms7XG5cbiAgLyoqXG4gICAqIEN1cnJlbnQgQVBJIGVuZHBvaW50IGZvciBzZWxlY3RlZCBuZXR3b3JrXG4gICAqL1xuICBhcGlFbmRwb2ludCA9IERFRkFVTFRfTkVUV09SSy5hcGlCYXNlVXJsO1xuXG4gIC8qKlxuICAgKiBBIDEyIHdvcmQgbW5lbW9uaWMuXG4gICAqL1xuICBtbmVtb25pYzogc3RyaW5nO1xuXG4gIHV0eG9TZXQgPSBuZXcgVXR4b1NldCgpO1xuXG4gIGFkZHJlc3NNYW5hZ2VyOiBBZGRyZXNzTWFuYWdlcjtcblxuICAvKiBlc2xpbnQtZGlzYWJsZSAqL1xuICBwZW5kaW5nOiBQZW5kaW5nVHJhbnNhY3Rpb25zID0ge1xuICAgIHRyYW5zYWN0aW9uczoge30sXG4gICAgZ2V0IGFtb3VudCgpIHtcbiAgICAgIGNvbnN0IHRyYW5zYWN0aW9ucyA9IE9iamVjdC52YWx1ZXModGhpcy50cmFuc2FjdGlvbnMpO1xuICAgICAgaWYgKHRyYW5zYWN0aW9ucy5sZW5ndGggPT09IDApIHJldHVybiAwO1xuICAgICAgcmV0dXJuIHRyYW5zYWN0aW9ucy5yZWR1Y2UoKHByZXYsIGN1cikgPT4gcHJldiArIGN1ci5hbW91bnQgKyBjdXIuZmVlLCAwKTtcbiAgICB9LFxuICAgIGFkZChcbiAgICAgIGlkOiBzdHJpbmcsXG4gICAgICB0eDogeyB0bzogc3RyaW5nOyB1dHhvSWRzOiBzdHJpbmdbXTsgcmF3VHg6IHN0cmluZzsgYW1vdW50OiBudW1iZXI7IGZlZTogbnVtYmVyIH1cbiAgICApIHtcbiAgICAgIHRoaXMudHJhbnNhY3Rpb25zW2lkXSA9IHR4O1xuICAgIH0sXG4gIH07XG4gIC8qKlxuICAgKiBUcmFuc2FjdGlvbnMgc29ydGVkIGJ5IGhhc2guXG4gICAqL1xuICB0cmFuc2FjdGlvbnM6IEFwaS5UcmFuc2FjdGlvbltdID0gW107XG5cbiAgLyoqXG4gICAqIFRyYW5zYWN0aW9uIGFycmF5cyBrZXllZCBieSBhZGRyZXNzLlxuICAgKi9cbiAgdHJhbnNhY3Rpb25zU3RvcmFnZTogUmVjb3JkPHN0cmluZywgQXBpLlRyYW5zYWN0aW9uW10+ID0ge307XG5cbiAgLyoqIENyZWF0ZSBhIHdhbGxldC5cbiAgICogQHBhcmFtIHdhbGxldFNhdmUgKG9wdGlvbmFsKVxuICAgKiBAcGFyYW0gd2FsbGV0U2F2ZS5wcml2S2V5IFNhdmVkIHdhbGxldCdzIHByaXZhdGUga2V5LlxuICAgKiBAcGFyYW0gd2FsbGV0U2F2ZS5zZWVkUGhyYXNlIFNhdmVkIHdhbGxldCdzIHNlZWQgcGhyYXNlLlxuICAgKi9cbiAgY29uc3RydWN0b3IocHJpdktleT86IHN0cmluZywgc2VlZFBocmFzZT86IHN0cmluZykge1xuICAgIGlmIChwcml2S2V5ICYmIHNlZWRQaHJhc2UpIHtcbiAgICAgIHRoaXMuSERXYWxsZXQgPSBuZXcgYml0Y29yZS5IRFByaXZhdGVLZXkocHJpdktleSk7XG4gICAgICB0aGlzLm1uZW1vbmljID0gc2VlZFBocmFzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGVtcCA9IG5ldyBNbmVtb25pYyhNbmVtb25pYy5Xb3Jkcy5FTkdMSVNIKTtcbiAgICAgIHRoaXMubW5lbW9uaWMgPSB0ZW1wLnRvU3RyaW5nKCk7XG4gICAgICB0aGlzLkhEV2FsbGV0ID0gbmV3IGJpdGNvcmUuSERQcml2YXRlS2V5KHRlbXAudG9IRFByaXZhdGVLZXkoKS50b1N0cmluZygpKTtcbiAgICB9XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlciA9IG5ldyBBZGRyZXNzTWFuYWdlcih0aGlzLkhEV2FsbGV0LCB0aGlzLm5ldHdvcmspO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MubmV4dCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFF1ZXJpZXMgQVBJIGZvciBhZGRyZXNzW10gVVRYT3MuIEFkZHMgVVRYT3MgdG8gVVRYTyBzZXQuIFVwZGF0ZXMgd2FsbGV0IGJhbGFuY2UuXG4gICAqIEBwYXJhbSBhZGRyZXNzZXNcbiAgICovXG4gIGFzeW5jIHVwZGF0ZVV0eG9zKGFkZHJlc3Nlczogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBsb2dnZXIubG9nKCdpbmZvJywgYEdldHRpbmcgdXR4b3MgZm9yICR7YWRkcmVzc2VzLmxlbmd0aH0gYWRkcmVzc2VzLmApO1xuICAgIGNvbnN0IHV0eG9SZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBhZGRyZXNzZXMubWFwKChhZGRyZXNzKSA9PiBhcGkuZ2V0VXR4b3MoYWRkcmVzcywgdGhpcy5hcGlFbmRwb2ludCkpXG4gICAgKTtcbiAgICBhZGRyZXNzZXMuZm9yRWFjaCgoYWRkcmVzcywgaSkgPT4ge1xuICAgICAgY29uc3QgeyB1dHhvcyB9ID0gdXR4b1Jlc3VsdHNbaV07XG4gICAgICBsb2dnZXIubG9nKCdpbmZvJywgYCR7YWRkcmVzc306ICR7dXR4b3MubGVuZ3RofSB0b3RhbCBVVFhPcyBmb3VuZC5gKTtcbiAgICAgIHRoaXMudXR4b1NldC51dHhvU3RvcmFnZVthZGRyZXNzXSA9IHV0eG9zO1xuICAgICAgdGhpcy51dHhvU2V0LmFkZCh1dHhvcywgYWRkcmVzcyk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUXVlcmllcyBBUEkgZm9yIGFkZHJlc3NbXSB0cmFuc2FjdGlvbnMuIEFkZHMgdHggdG8gdHJhbnNhY3Rpb25zIHN0b3JhZ2UuIEFsc28gc29ydHMgdGhlIGVudGlyZSB0cmFuc2FjdGlvbiBzZXQuXG4gICAqIEBwYXJhbSBhZGRyZXNzZXNcbiAgICovXG4gIGFzeW5jIHVwZGF0ZVRyYW5zYWN0aW9ucyhhZGRyZXNzZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGxvZ2dlci5sb2coJ2luZm8nLCBgR2V0dGluZyB0cmFuc2FjdGlvbnMgZm9yICR7YWRkcmVzc2VzLmxlbmd0aH0gYWRkcmVzc2VzLmApO1xuICAgIGNvbnN0IGFkZHJlc3Nlc1dpdGhUeDogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCB0eFJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgIGFkZHJlc3Nlcy5tYXAoKGFkZHJlc3MpID0+IGFwaS5nZXRUcmFuc2FjdGlvbnMoYWRkcmVzcywgdGhpcy5hcGlFbmRwb2ludCkpXG4gICAgKTtcbiAgICBhZGRyZXNzZXMuZm9yRWFjaCgoYWRkcmVzcywgaSkgPT4ge1xuICAgICAgY29uc3QgeyB0cmFuc2FjdGlvbnMgfSA9IHR4UmVzdWx0c1tpXTtcbiAgICAgIGxvZ2dlci5sb2coJ2luZm8nLCBgJHthZGRyZXNzfTogJHt0cmFuc2FjdGlvbnMubGVuZ3RofSB0cmFuc2FjdGlvbnMgZm91bmQuYCk7XG4gICAgICBpZiAodHJhbnNhY3Rpb25zLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICBjb25zdCBjb25maXJtZWRUeCA9IHRyYW5zYWN0aW9ucy5maWx0ZXIoKHR4OkFwaS5UcmFuc2FjdGlvbikgPT4gdHguY29uZmlybWF0aW9ucyA+IDApO1xuICAgICAgICB0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2VbYWRkcmVzc10gPSBjb25maXJtZWRUeDtcbiAgICAgICAgYWRkcmVzc2VzV2l0aFR4LnB1c2goYWRkcmVzcyk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIHRoaXMudHJhbnNhY3Rpb25zID0gdHhQYXJzZXIodGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlLCBPYmplY3Qua2V5cyh0aGlzLmFkZHJlc3NNYW5hZ2VyLmFsbCkpO1xuICAgIGNvbnN0IHBlbmRpbmdUeEhhc2hlcyA9IE9iamVjdC5rZXlzKHRoaXMucGVuZGluZy50cmFuc2FjdGlvbnMpO1xuICAgIGlmIChwZW5kaW5nVHhIYXNoZXMubGVuZ3RoID4gMCkge1xuICAgICAgcGVuZGluZ1R4SGFzaGVzLmZvckVhY2goKGhhc2gpID0+IHtcbiAgICAgICAgaWYgKHRoaXMudHJhbnNhY3Rpb25zLm1hcCgodHgpID0+IHR4LnRyYW5zYWN0aW9uSGFzaCkuaW5jbHVkZXMoaGFzaCkpIHtcbiAgICAgICAgICB0aGlzLmRlbGV0ZVBlbmRpbmdUeChoYXNoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIGNvbnN0IGlzQWN0aXZpdHlPblJlY2VpdmVBZGRyID1cbiAgICAgIHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZVt0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmN1cnJlbnQuYWRkcmVzc10gIT09IHVuZGVmaW5lZDtcbiAgICBpZiAoaXNBY3Rpdml0eU9uUmVjZWl2ZUFkZHIpIHtcbiAgICAgIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MubmV4dCgpO1xuICAgIH1cbiAgICByZXR1cm4gYWRkcmVzc2VzV2l0aFR4O1xuICB9XG5cbiAgLyoqXG4gICAqIFJlY2FsY3VsYXRlcyB3YWxsZXQgYmFsYW5jZS5cbiAgICovXG4gIHVwZGF0ZUJhbGFuY2UoKTogdm9pZCB7XG4gICAgdGhpcy5iYWxhbmNlID0gdGhpcy51dHhvU2V0LnRvdGFsQmFsYW5jZSAtIHRoaXMucGVuZGluZy5hbW91bnQ7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlcyB0aGUgc2VsZWN0ZWQgbmV0d29ya1xuICAgKiBAcGFyYW0gbmV0d29yayBuYW1lIG9mIHRoZSBuZXR3b3JrXG4gICAqL1xuICBhc3luYyB1cGRhdGVOZXR3b3JrKG5ldHdvcms6IFNlbGVjdGVkTmV0d29yayk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuZGVtb2xpc2hXYWxsZXRTdGF0ZShuZXR3b3JrLnByZWZpeCk7XG4gICAgdGhpcy5uZXR3b3JrID0gbmV0d29yay5wcmVmaXg7XG4gICAgdGhpcy5hcGlFbmRwb2ludCA9IG5ldHdvcmsuYXBpQmFzZVVybDtcbiAgfVxuXG4gIGRlbW9saXNoV2FsbGV0U3RhdGUobmV0d29ya1ByZWZpeDogTmV0d29yayA9IHRoaXMubmV0d29yayk6IHZvaWQge1xuICAgIHRoaXMudXR4b1NldC5jbGVhcigpO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIgPSBuZXcgQWRkcmVzc01hbmFnZXIodGhpcy5IRFdhbGxldCwgbmV0d29ya1ByZWZpeCk7XG4gICAgdGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9ucyA9IHt9O1xuICAgIHRoaXMudHJhbnNhY3Rpb25zID0gW107XG4gICAgdGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlID0ge307XG4gIH1cblxuICAvKipcbiAgICogRGVyaXZlcyByZWNlaXZlQWRkcmVzc2VzIGFuZCBjaGFuZ2VBZGRyZXNzZXMgYW5kIGNoZWNrcyB0aGVpciB0cmFuc2FjdGlvbnMgYW5kIFVUWE9zLlxuICAgKiBAcGFyYW0gdGhyZXNob2xkIHN0b3AgZGlzY292ZXJpbmcgYWZ0ZXIgYHRocmVzaG9sZGAgYWRkcmVzc2VzIHdpdGggbm8gYWN0aXZpdHlcbiAgICovXG4gIGFzeW5jIGFkZHJlc3NEaXNjb3ZlcnkodGhyZXNob2xkID0gMjApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBkb0Rpc2NvdmVyeSA9IGFzeW5jIChcbiAgICAgIG46IG51bWJlcixcbiAgICAgIGRlcml2ZVR5cGU6ICdyZWNlaXZlJyB8ICdjaGFuZ2UnLFxuICAgICAgb2Zmc2V0OiBudW1iZXJcbiAgICApOiBQcm9taXNlPG51bWJlcj4gPT4ge1xuICAgICAgY29uc3QgZGVyaXZlZEFkZHJlc3NlcyA9IHRoaXMuYWRkcmVzc01hbmFnZXIuZ2V0QWRkcmVzc2VzKG4sIGRlcml2ZVR5cGUsIG9mZnNldCk7XG4gICAgICBjb25zdCBhZGRyZXNzZXMgPSBkZXJpdmVkQWRkcmVzc2VzLm1hcCgob2JqKSA9PiBvYmouYWRkcmVzcyk7XG4gICAgICBsb2dnZXIubG9nKFxuICAgICAgICAnaW5mbycsXG4gICAgICAgIGBGZXRjaGluZyAke2Rlcml2ZVR5cGV9IGFkZHJlc3MgZGF0YSBmb3IgZGVyaXZlZCBpbmRpY2VzICR7SlNPTi5zdHJpbmdpZnkoXG4gICAgICAgICAgZGVyaXZlZEFkZHJlc3Nlcy5tYXAoKG9iaikgPT4gb2JqLmluZGV4KVxuICAgICAgICApfWBcbiAgICAgICk7XG4gICAgICBjb25zdCBhZGRyZXNzZXNXaXRoVHggPSBhd2FpdCB0aGlzLnVwZGF0ZVRyYW5zYWN0aW9ucyhhZGRyZXNzZXMpO1xuICAgICAgaWYgKGFkZHJlc3Nlc1dpdGhUeC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgLy8gYWRkcmVzcyBkaXNjb3ZlcnkgY29tcGxldGVcbiAgICAgICAgY29uc3QgbGFzdEFkZHJlc3NJbmRleFdpdGhUeCA9IG9mZnNldCAtICh0aHJlc2hvbGQgLSBuKSAtIDE7XG4gICAgICAgIGxvZ2dlci5sb2coXG4gICAgICAgICAgJ2luZm8nLFxuICAgICAgICAgIGAke2Rlcml2ZVR5cGV9QWRkcmVzcyBkaXNjb3ZlcnkgY29tcGxldGUuIExhc3QgYWN0aXZpdHkgb24gYWRkcmVzcyAjJHtsYXN0QWRkcmVzc0luZGV4V2l0aFR4fS4gTm8gYWN0aXZpdHkgZnJvbSAke2Rlcml2ZVR5cGV9IyR7XG4gICAgICAgICAgICBsYXN0QWRkcmVzc0luZGV4V2l0aFR4ICsgMVxuICAgICAgICAgIH1+JHtsYXN0QWRkcmVzc0luZGV4V2l0aFR4ICsgdGhyZXNob2xkfS5gXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiBsYXN0QWRkcmVzc0luZGV4V2l0aFR4O1xuICAgICAgfVxuICAgICAgLy8gZWxzZSBrZWVwIGRvaW5nIGRpc2NvdmVyeVxuICAgICAgY29uc3QgbkFkZHJlc3Nlc0xlZnQgPVxuICAgICAgICBkZXJpdmVkQWRkcmVzc2VzXG4gICAgICAgICAgLmZpbHRlcigob2JqKSA9PiBhZGRyZXNzZXNXaXRoVHguaW5kZXhPZihvYmouYWRkcmVzcykgIT09IC0xKVxuICAgICAgICAgIC5yZWR1Y2UoKHByZXYsIGN1cikgPT4gTWF0aC5tYXgocHJldiwgY3VyLmluZGV4KSwgMCkgKyAxO1xuICAgICAgcmV0dXJuIGRvRGlzY292ZXJ5KG5BZGRyZXNzZXNMZWZ0LCBkZXJpdmVUeXBlLCBvZmZzZXQgKyBuKTtcbiAgICB9O1xuICAgIGNvbnN0IGhpZ2hlc3RSZWNlaXZlSW5kZXggPSBhd2FpdCBkb0Rpc2NvdmVyeSh0aHJlc2hvbGQsICdyZWNlaXZlJywgMCk7XG4gICAgY29uc3QgaGlnaGVzdENoYW5nZUluZGV4ID0gYXdhaXQgZG9EaXNjb3ZlcnkodGhyZXNob2xkLCAnY2hhbmdlJywgMCk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5hZHZhbmNlKGhpZ2hlc3RSZWNlaXZlSW5kZXggKyAxKTtcbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MuYWR2YW5jZShoaWdoZXN0Q2hhbmdlSW5kZXggKyAxKTtcbiAgICBsb2dnZXIubG9nKFxuICAgICAgJ2luZm8nLFxuICAgICAgYHJlY2VpdmUgYWRkcmVzcyBpbmRleDogJHtoaWdoZXN0UmVjZWl2ZUluZGV4fTsgY2hhbmdlIGFkZHJlc3MgaW5kZXg6ICR7aGlnaGVzdENoYW5nZUluZGV4fWBcbiAgICApO1xuICAgIGF3YWl0IHRoaXMudXBkYXRlVXR4b3MoT2JqZWN0LmtleXModGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlKSk7XG4gICAgdGhpcy5ydW5TdGF0ZUNoYW5nZUhvb2tzKCk7XG4gIH1cblxuICAvLyBUT0RPOiBjb252ZXJ0IGFtb3VudCB0byBzb21waXMgYWthIHNhdG9zaGlzXG4gIC8vIFRPRE86IGJuXG4gIC8qKlxuICAgKiBDb21wb3NlIGEgc2VyaWFsaXplZCwgc2lnbmVkIHRyYW5zYWN0aW9uXG4gICAqIEBwYXJhbSBvYmpcbiAgICogQHBhcmFtIG9iai50b0FkZHIgVG8gYWRkcmVzcyBpbiBjYXNoYWRkciBmb3JtYXQgKGUuZy4ga2FzcGF0ZXN0OnFxMGQ2aDBwcmptNW1wZGxkNXBuY3N0M2FkdTB5YW02eGNoNHRyNjlrMilcbiAgICogQHBhcmFtIG9iai5hbW91bnQgQW1vdW50IHRvIHNlbmQgaW4gc29tcGlzICgxMDAwMDAwMDAgKDFlOCkgc29tcGlzIGluIDEgS1NQKVxuICAgKiBAcGFyYW0gb2JqLmZlZSBGZWUgZm9yIG1pbmVycyBpbiBzb21waXNcbiAgICogQHBhcmFtIG9iai5jaGFuZ2VBZGRyT3ZlcnJpZGUgVXNlIHRoaXMgdG8gb3ZlcnJpZGUgYXV0b21hdGljIGNoYW5nZSBhZGRyZXNzIGRlcml2YXRpb25cbiAgICogQHRocm93cyBpZiBhbW91bnQgaXMgYWJvdmUgYE51bWJlci5NQVhfU0FGRV9JTlRFR0VSYFxuICAgKi9cbiAgY29tcG9zZVR4KHtcbiAgICB0b0FkZHIsXG4gICAgYW1vdW50LFxuICAgIGZlZSA9IERFRkFVTFRfRkVFLFxuICAgIGNoYW5nZUFkZHJPdmVycmlkZSxcbiAgfTogVHhTZW5kICYgeyBjaGFuZ2VBZGRyT3ZlcnJpZGU/OiBzdHJpbmcgfSk6IHtcbiAgICBpZDogc3RyaW5nO1xuICAgIHJhd1R4OiBzdHJpbmc7XG4gICAgdXR4b0lkczogc3RyaW5nW107XG4gICAgYW1vdW50OiBudW1iZXI7XG4gIH0ge1xuICAgIGlmICghTnVtYmVyLmlzU2FmZUludGVnZXIoYW1vdW50KSkgdGhyb3cgbmV3IEVycm9yKCdBbW91bnQgdG9vIGxhcmdlJyk7XG4gICAgY29uc3QgeyB1dHhvcywgdXR4b0lkcyB9ID0gdGhpcy51dHhvU2V0LnNlbGVjdFV0eG9zKGFtb3VudCArIGZlZSk7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IHByaXZLZXlzID0gdXR4b3MucmVkdWNlKChwcmV2OiBzdHJpbmdbXSwgY3VyKSA9PiB7XG4gICAgICByZXR1cm4gW3RoaXMuYWRkcmVzc01hbmFnZXIuYWxsW1N0cmluZyhjdXIuYWRkcmVzcyldLCAuLi5wcmV2XTtcbiAgICB9LCBbXSk7XG4gICAgY29uc3QgY2hhbmdlQWRkciA9IGNoYW5nZUFkZHJPdmVycmlkZSB8fCB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MubmV4dCgpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB0eDogYml0Y29yZS5UcmFuc2FjdGlvbiA9IG5ldyBiaXRjb3JlLlRyYW5zYWN0aW9uKClcbiAgICAgICAgLmZyb20odXR4b3MpXG4gICAgICAgIC50byh0b0FkZHIsIGFtb3VudClcbiAgICAgICAgLnNldFZlcnNpb24oMSlcbiAgICAgICAgLmZlZShmZWUpXG4gICAgICAgIC5jaGFuZ2UoY2hhbmdlQWRkcilcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAuc2lnbihwcml2S2V5cywgYml0Y29yZS5jcnlwdG8uU2lnbmF0dXJlLlNJR0hBU0hfQUxMLCAnc2Nobm9ycicpO1xuICAgICAgdGhpcy51dHhvU2V0LmluVXNlLnB1c2goLi4udXR4b0lkcyk7XG4gICAgICB0aGlzLnBlbmRpbmcuYWRkKHR4LmlkLCB7IHJhd1R4OiB0eC50b1N0cmluZygpLCB1dHhvSWRzLCBhbW91bnQsIHRvOiB0b0FkZHIsIGZlZSB9KTtcbiAgICAgIHRoaXMucnVuU3RhdGVDaGFuZ2VIb29rcygpO1xuICAgICAgcmV0dXJuIHsgaWQ6IHR4LmlkLCByYXdUeDogdHgudG9TdHJpbmcoKSwgdXR4b0lkcywgYW1vdW50OiBhbW91bnQgKyBmZWUgfTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MucmV2ZXJzZSgpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIHRyYW5zYWN0aW9uLiBSZXR1cm5zIHRyYW5zYWN0aW9uIGlkLlxuICAgKiBAcGFyYW0gdHhQYXJhbXNcbiAgICogQHBhcmFtIHR4UGFyYW1zLnRvQWRkciBUbyBhZGRyZXNzIGluIGNhc2hhZGRyIGZvcm1hdCAoZS5nLiBrYXNwYXRlc3Q6cXEwZDZoMHByam01bXBkbGQ1cG5jc3QzYWR1MHlhbTZ4Y2g0dHI2OWsyKVxuICAgKiBAcGFyYW0gdHhQYXJhbXMuYW1vdW50IEFtb3VudCB0byBzZW5kIGluIHNvbXBpcyAoMTAwMDAwMDAwICgxZTgpIHNvbXBpcyBpbiAxIEtTUClcbiAgICogQHBhcmFtIHR4UGFyYW1zLmZlZSBGZWUgZm9yIG1pbmVycyBpbiBzb21waXNcbiAgICogQHRocm93cyBgRmV0Y2hFcnJvcmAgaWYgZW5kcG9pbnQgaXMgZG93bi4gQVBJIGVycm9yIG1lc3NhZ2UgaWYgdHggZXJyb3IuIEVycm9yIGlmIGFtb3VudCBpcyB0b28gbGFyZ2UgdG8gYmUgcmVwcmVzZW50ZWQgYXMgYSBqYXZhc2NyaXB0IG51bWJlci5cbiAgICovXG4gIGFzeW5jIHNlbmRUeCh0eFBhcmFtczogVHhTZW5kKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCB7IGlkLCByYXdUeCB9ID0gdGhpcy5jb21wb3NlVHgodHhQYXJhbXMpO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBhcGkucG9zdFR4KHJhd1R4LCB0aGlzLmFwaUVuZHBvaW50KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLnVuZG9QZW5kaW5nVHgoaWQpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gICAgcmV0dXJuIGlkO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlU3RhdGUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgYWN0aXZlQWRkcnMgPSBhd2FpdCB0aGlzLnVwZGF0ZVRyYW5zYWN0aW9ucyh0aGlzLmFkZHJlc3NNYW5hZ2VyLnNob3VsZEZldGNoKTtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVV0eG9zKGFjdGl2ZUFkZHJzKTtcbiAgICB0aGlzLnJ1blN0YXRlQ2hhbmdlSG9va3MoKTtcbiAgfVxuXG4gIHVuZG9QZW5kaW5nVHgoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IHsgdXR4b0lkcyB9ID0gdGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9uc1tpZF07XG4gICAgZGVsZXRlIHRoaXMucGVuZGluZy50cmFuc2FjdGlvbnNbaWRdO1xuICAgIHRoaXMudXR4b1NldC5yZWxlYXNlKHV0eG9JZHMpO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5yZXZlcnNlKCk7XG4gICAgdGhpcy5ydW5TdGF0ZUNoYW5nZUhvb2tzKCk7XG4gIH1cblxuICAvKipcbiAgICogQWZ0ZXIgd2Ugc2VlIHRoZSB0cmFuc2FjdGlvbiBpbiB0aGUgQVBJIHJlc3VsdHMsIGRlbGV0ZSBpdCBmcm9tIG91ciBwZW5kaW5nIGxpc3QuXG4gICAqIEBwYXJhbSBpZCBUaGUgdHggaGFzaFxuICAgKi9cbiAgZGVsZXRlUGVuZGluZ1R4KGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAvLyB1bmRvICsgZGVsZXRlIG9sZCB1dHhvc1xuICAgIGNvbnN0IHsgdXR4b0lkcyB9ID0gdGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9uc1tpZF07XG4gICAgZGVsZXRlIHRoaXMucGVuZGluZy50cmFuc2FjdGlvbnNbaWRdO1xuICAgIHRoaXMudXR4b1NldC5yZW1vdmUodXR4b0lkcyk7XG4gIH1cblxuICBydW5TdGF0ZUNoYW5nZUhvb2tzKCk6IHZvaWQge1xuICAgIHRoaXMudXR4b1NldC51cGRhdGVVdHhvQmFsYW5jZSgpO1xuICAgIHRoaXMudXBkYXRlQmFsYW5jZSgpO1xuICB9XG5cbiAgZ2V0IGNhY2hlKCkge1xuICAgIHJldHVybiB7XG4gICAgICBwZW5kaW5nVHg6IHRoaXMucGVuZGluZy50cmFuc2FjdGlvbnMsXG4gICAgICB1dHhvczoge1xuICAgICAgICB1dHhvU3RvcmFnZTogdGhpcy51dHhvU2V0LnV0eG9TdG9yYWdlLFxuICAgICAgICBpblVzZTogdGhpcy51dHhvU2V0LmluVXNlLFxuICAgICAgfSxcbiAgICAgIHRyYW5zYWN0aW9uc1N0b3JhZ2U6IHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZSxcbiAgICAgIGFkZHJlc3Nlczoge1xuICAgICAgICByZWNlaXZlQ291bnRlcjogdGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5jb3VudGVyLFxuICAgICAgICBjaGFuZ2VDb3VudGVyOiB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MuY291bnRlcixcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIHJlc3RvcmVDYWNoZShjYWNoZTogV2FsbGV0Q2FjaGUpOiB2b2lkIHtcbiAgICB0aGlzLnBlbmRpbmcudHJhbnNhY3Rpb25zID0gY2FjaGUucGVuZGluZ1R4O1xuICAgIHRoaXMudXR4b1NldC51dHhvU3RvcmFnZSA9IGNhY2hlLnV0eG9zLnV0eG9TdG9yYWdlO1xuICAgIHRoaXMudXR4b1NldC5pblVzZSA9IGNhY2hlLnV0eG9zLmluVXNlO1xuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMudXR4b1NldC51dHhvU3RvcmFnZSkuZm9yRWFjaCgoW2FkZHIsIHV0eG9zXTogW3N0cmluZywgQXBpLlV0eG9bXV0pID0+IHtcbiAgICAgIHRoaXMudXR4b1NldC5hZGQodXR4b3MsIGFkZHIpO1xuICAgIH0pO1xuICAgIHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZSA9IGNhY2hlLnRyYW5zYWN0aW9uc1N0b3JhZ2U7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5nZXRBZGRyZXNzZXMoY2FjaGUuYWRkcmVzc2VzLnJlY2VpdmVDb3VudGVyICsgMSwgJ3JlY2VpdmUnKTtcbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLmdldEFkZHJlc3NlcyhjYWNoZS5hZGRyZXNzZXMuY2hhbmdlQ291bnRlciArIDEsICdjaGFuZ2UnKTtcbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmFkdmFuY2UoY2FjaGUuYWRkcmVzc2VzLnJlY2VpdmVDb3VudGVyIC0gMSk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmFkdmFuY2UoY2FjaGUuYWRkcmVzc2VzLmNoYW5nZUNvdW50ZXIpO1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICB0aGlzLnRyYW5zYWN0aW9ucyA9IHR4UGFyc2VyKHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZSwgT2JqZWN0LmtleXModGhpcy5hZGRyZXNzTWFuYWdlci5hbGwpKTtcbiAgICB0aGlzLnJ1blN0YXRlQ2hhbmdlSG9va3MoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiAgQ29udmVydHMgYSBtbmVtb25pYyB0byBhIG5ldyB3YWxsZXQuXG4gICAqIEBwYXJhbSBzZWVkUGhyYXNlIFRoZSAxMiB3b3JkIHNlZWQgcGhyYXNlLlxuICAgKiBAcmV0dXJucyBuZXcgV2FsbGV0XG4gICAqL1xuICBzdGF0aWMgZnJvbU1uZW1vbmljKHNlZWRQaHJhc2U6IHN0cmluZyk6IFdhbGxldCB7XG4gICAgY29uc3QgcHJpdktleSA9IG5ldyBNbmVtb25pYyhzZWVkUGhyYXNlLnRyaW0oKSkudG9IRFByaXZhdGVLZXkoKS50b1N0cmluZygpO1xuICAgIGNvbnN0IHdhbGxldCA9IG5ldyB0aGlzKHByaXZLZXksIHNlZWRQaHJhc2UpO1xuICAgIHJldHVybiB3YWxsZXQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBXYWxsZXQgZnJvbSBlbmNyeXB0ZWQgd2FsbGV0IGRhdGEuXG4gICAqIEBwYXJhbSBwYXNzd29yZCB0aGUgcGFzc3dvcmQgdGhlIHVzZXIgZW5jcnlwdGVkIHRoZWlyIHNlZWQgcGhyYXNlIHdpdGhcbiAgICogQHBhcmFtIGVuY3J5cHRlZE1uZW1vbmljIHRoZSBlbmNyeXB0ZWQgc2VlZCBwaHJhc2UgZnJvbSBsb2NhbCBzdG9yYWdlXG4gICAqIEB0aHJvd3MgV2lsbCB0aHJvdyBcIkluY29ycmVjdCBwYXNzd29yZFwiIGlmIHBhc3N3b3JkIGlzIHdyb25nXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW1wb3J0KHBhc3N3b3JkOiBzdHJpbmcsIGVuY3J5cHRlZE1uZW1vbmljOiBzdHJpbmcpOiBQcm9taXNlPFdhbGxldD4ge1xuICAgIGNvbnN0IGRlY3J5cHRlZCA9IGF3YWl0IHBhc3N3b3JkZXIuZGVjcnlwdChwYXNzd29yZCwgZW5jcnlwdGVkTW5lbW9uaWMpO1xuICAgIGNvbnN0IHNhdmVkV2FsbGV0ID0gSlNPTi5wYXJzZShCdWZmZXIuZnJvbShkZWNyeXB0ZWQpLnRvU3RyaW5nKCd1dGY4JykpIGFzIFdhbGxldFNhdmU7XG4gICAgY29uc3QgbXlXYWxsZXQgPSBuZXcgdGhpcyhzYXZlZFdhbGxldC5wcml2S2V5LCBzYXZlZFdhbGxldC5zZWVkUGhyYXNlKTtcbiAgICByZXR1cm4gbXlXYWxsZXQ7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGVzIGVuY3J5cHRlZCB3YWxsZXQgZGF0YS5cbiAgICogQHBhcmFtIHBhc3N3b3JkIHVzZXIncyBjaG9zZW4gcGFzc3dvcmRcbiAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIG9iamVjdC1saWtlIHN0cmluZy4gU3VnZ2VzdGVkIHRvIHN0b3JlIGFzIHN0cmluZyBmb3IgLmltcG9ydCgpLlxuICAgKi9cbiAgYXN5bmMgZXhwb3J0KHBhc3N3b3JkOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IHNhdmVkV2FsbGV0OiBXYWxsZXRTYXZlID0ge1xuICAgICAgcHJpdktleTogdGhpcy5IRFdhbGxldC50b1N0cmluZygpLFxuICAgICAgc2VlZFBocmFzZTogdGhpcy5tbmVtb25pYyxcbiAgICB9O1xuICAgIHJldHVybiBwYXNzd29yZGVyLmVuY3J5cHQocGFzc3dvcmQsIEJ1ZmZlci5mcm9tKEpTT04uc3RyaW5naWZ5KHNhdmVkV2FsbGV0KSwgJ3V0ZjgnKSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgV2FsbGV0O1xuIl19