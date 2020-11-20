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
    static setRPC(rpc) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV2FsbGV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vd2FsbGV0L1dhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzdDLGFBQWE7QUFDYiw0Q0FBNEM7QUFDNUMsYUFBYTtBQUViLGtEQUFrRDtBQUNsRCx5REFBeUQ7QUFDekQsSUFBSSxVQUFrRCxDQUFDO0FBQ3ZELGFBQWE7QUFDYixJQUFHLE9BQU8sTUFBTSxJQUFJLFdBQVcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUM7SUFDNUMsVUFBVSxHQUFHLFdBQVcsQ0FBQztDQUMxQjtLQUFJO0lBQ0gsVUFBVSxHQUFHLFdBQVcsQ0FBQztDQUMxQjtBQVlELDRDQUF5QztBQUN6QyxxREFBa0Q7QUFDbEQsdUNBQW9DO0FBQ3BDLG9DQUFvQztBQUNwQyx5Q0FBc0M7QUFDdEMsZ0RBQThEO0FBRTlELG9FQUFvRTtBQUNwRSxNQUFNLE1BQU07SUE0RFY7Ozs7T0FJRztJQUNILFlBQVksT0FBZ0IsRUFBRSxVQUFtQjtRQTlEakQ7O1dBRUc7UUFDSCxZQUFPLEdBQXVCLFNBQVMsQ0FBQztRQVN4Qzs7V0FFRztRQUNILGFBQWE7UUFDYixZQUFPLEdBQVksNkJBQWUsQ0FBQyxNQUFpQixDQUFDO1FBRXJEOztXQUVHO1FBQ0gsZ0JBQVcsR0FBRyw2QkFBZSxDQUFDLFVBQVUsQ0FBQztRQU96QyxZQUFPLEdBQUcsSUFBSSxpQkFBTyxFQUFFLENBQUM7UUFJeEIsb0JBQW9CO1FBQ3BCLFlBQU8sR0FBd0I7WUFDN0IsWUFBWSxFQUFFLEVBQUU7WUFDaEIsSUFBSSxNQUFNO2dCQUNSLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUN0RCxJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQztvQkFBRSxPQUFPLENB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QUFFLElBQUksQ0FBQyxTQUFTLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztRQUNuRSxDQUFDO0tBQUE7Q0FDRjtBQUVELGtCQUFlLE1BQU0sQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IE1uZW1vbmljID0gcmVxdWlyZSgnYml0Y29yZS1tbmVtb25pYycpO1xuLy8gQHRzLWlnbm9yZVxuaW1wb3J0ICogYXMgYml0Y29yZSBmcm9tICdiaXRjb3JlLWxpYi1jYXNoJztcbi8vIEB0cy1pZ25vcmVcblxuaW1wb3J0ICogYXMgcGFzc3dvcmRlcjEgZnJvbSAnYnJvd3Nlci1wYXNzd29yZGVyJztcbmltcG9ydCAqIGFzIHBhc3N3b3JkZXIyIGZyb20gJ0Bhc3BlY3Ryb24vZmxvdy1rZXktY3J5cHQnO1xubGV0IHBhc3N3b3JkZXI6dHlwZW9mIHBhc3N3b3JkZXIxIHwgdHlwZW9mIHBhc3N3b3JkZXIyO1xuLy8gQHRzLWlnbm9yZVxuaWYodHlwZW9mIHdpbmRvdyAhPSBcInVuZGVmaW5lZFwiICYmICF3aW5kb3cubncpe1xuICBwYXNzd29yZGVyID0gcGFzc3dvcmRlcjE7XG59ZWxzZXtcbiAgcGFzc3dvcmRlciA9IHBhc3N3b3JkZXIyO1xufVxuXG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tICdzYWZlLWJ1ZmZlcic7XG5pbXBvcnQge1xuICBOZXR3b3JrLFxuICBTZWxlY3RlZE5ldHdvcmssXG4gIFdhbGxldFNhdmUsXG4gIEFwaSxcbiAgVHhTZW5kLFxuICBQZW5kaW5nVHJhbnNhY3Rpb25zLFxuICBXYWxsZXRDYWNoZSwgSVJQQ1xufSBmcm9tICcuLi90eXBlcy9jdXN0b20tdHlwZXMnO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7IEFkZHJlc3NNYW5hZ2VyIH0gZnJvbSAnLi9BZGRyZXNzTWFuYWdlcic7XG5pbXBvcnQgeyBVdHhvU2V0IH0gZnJvbSAnLi9VdHhvU2V0JztcbmltcG9ydCAqIGFzIGFwaSBmcm9tICcuL2FwaUhlbHBlcnMnO1xuaW1wb3J0IHsgdHhQYXJzZXIgfSBmcm9tICcuL3R4UGFyc2VyJztcbmltcG9ydCB7IERFRkFVTFRfRkVFLCBERUZBVUxUX05FVFdPUksgfSBmcm9tICcuLi9jb25maWcuanNvbic7XG5cbi8qKiBDbGFzcyByZXByZXNlbnRpbmcgYW4gSERXYWxsZXQgd2l0aCBkZXJpdmFibGUgY2hpbGQgYWRkcmVzc2VzICovXG5jbGFzcyBXYWxsZXQge1xuICBIRFdhbGxldDogYml0Y29yZS5IRFByaXZhdGVLZXk7XG5cbiAgLyoqXG4gICAqIFRoZSBzdW1tZWQgYmFsYW5jZSBhY3Jvc3MgYWxsIG9mIFdhbGxldCdzIGRpc2NvdmVyZWQgYWRkcmVzc2VzLCBtaW51cyBhbW91bnQgZnJvbSBwZW5kaW5nIHRyYW5zYWN0aW9ucy5cbiAgICovXG4gIGJhbGFuY2U6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICAvKipcbiAgICogU2V0IGJ5IGFkZHJlc3NNYW5hZ2VyXG4gICAqL1xuICBnZXQgcmVjZWl2ZUFkZHJlc3MoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuY3VycmVudC5hZGRyZXNzO1xuICB9XG5cbiAgLyoqXG4gICAqIEN1cnJlbnQgbmV0d29yay5cbiAgICovXG4gIC8vIEB0cy1pZ25vcmVcbiAgbmV0d29yazogTmV0d29yayA9IERFRkFVTFRfTkVUV09SSy5wcmVmaXggYXMgTmV0d29yaztcblxuICAvKipcbiAgICogQ3VycmVudCBBUEkgZW5kcG9pbnQgZm9yIHNlbGVjdGVkIG5ldHdvcmtcbiAgICovXG4gIGFwaUVuZHBvaW50ID0gREVGQVVMVF9ORVRXT1JLLmFwaUJhc2VVcmw7XG5cbiAgLyoqXG4gICAqIEEgMTIgd29yZCBtbmVtb25pYy5cbiAgICovXG4gIG1uZW1vbmljOiBzdHJpbmc7XG5cbiAgdXR4b1NldCA9IG5ldyBVdHhvU2V0KCk7XG5cbiAgYWRkcmVzc01hbmFnZXI6IEFkZHJlc3NNYW5hZ2VyO1xuXG4gIC8qIGVzbGludC1kaXNhYmxlICovXG4gIHBlbmRpbmc6IFBlbmRpbmdUcmFuc2FjdGlvbnMgPSB7XG4gICAgdHJhbnNhY3Rpb25zOiB7fSxcbiAgICBnZXQgYW1vdW50KCkge1xuICAgICAgY29uc3QgdHJhbnNhY3Rpb25zID0gT2JqZWN0LnZhbHVlcyh0aGlzLnRyYW5zYWN0aW9ucyk7XG4gICAgICBpZiAodHJhbnNhY3Rpb25zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDA7XG4gICAgICByZXR1cm4gdHJhbnNhY3Rpb25zLnJlZHVjZSgocHJldiwgY3VyKSA9PiBwcmV2ICsgY3VyLmFtb3VudCArIGN1ci5mZWUsIDApO1xuICAgIH0sXG4gICAgYWRkKFxuICAgICAgaWQ6IHN0cmluZyxcbiAgICAgIHR4OiB7IHRvOiBzdHJpbmc7IHV0eG9JZHM6IHN0cmluZ1tdOyByYXdUeDogc3RyaW5nOyBhbW91bnQ6IG51bWJlcjsgZmVlOiBudW1iZXIgfVxuICAgICkge1xuICAgICAgdGhpcy50cmFuc2FjdGlvbnNbaWRdID0gdHg7XG4gICAgfSxcbiAgfTtcbiAgLyoqXG4gICAqIFRyYW5zYWN0aW9ucyBzb3J0ZWQgYnkgaGFzaC5cbiAgICovXG4gIHRyYW5zYWN0aW9uczogQXBpLlRyYW5zYWN0aW9uW10gPSBbXTtcblxuICAvKipcbiAgICogVHJhbnNhY3Rpb24gYXJyYXlzIGtleWVkIGJ5IGFkZHJlc3MuXG4gICAqL1xuICB0cmFuc2FjdGlvbnNTdG9yYWdlOiBSZWNvcmQ8c3RyaW5nLCBBcGkuVHJhbnNhY3Rpb25bXT4gPSB7fTtcblxuICAvKiogQ3JlYXRlIGEgd2FsbGV0LlxuICAgKiBAcGFyYW0gd2FsbGV0U2F2ZSAob3B0aW9uYWwpXG4gICAqIEBwYXJhbSB3YWxsZXRTYXZlLnByaXZLZXkgU2F2ZWQgd2FsbGV0J3MgcHJpdmF0ZSBrZXkuXG4gICAqIEBwYXJhbSB3YWxsZXRTYXZlLnNlZWRQaHJhc2UgU2F2ZWQgd2FsbGV0J3Mgc2VlZCBwaHJhc2UuXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihwcml2S2V5Pzogc3RyaW5nLCBzZWVkUGhyYXNlPzogc3RyaW5nKSB7XG4gICAgaWYgKHByaXZLZXkgJiYgc2VlZFBocmFzZSkge1xuICAgICAgdGhpcy5IRFdhbGxldCA9IG5ldyBiaXRjb3JlLkhEUHJpdmF0ZUtleShwcml2S2V5KTtcbiAgICAgIHRoaXMubW5lbW9uaWMgPSBzZWVkUGhyYXNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0ZW1wID0gbmV3IE1uZW1vbmljKE1uZW1vbmljLldvcmRzLkVOR0xJU0gpO1xuICAgICAgdGhpcy5tbmVtb25pYyA9IHRlbXAudG9TdHJpbmcoKTtcbiAgICAgIHRoaXMuSERXYWxsZXQgPSBuZXcgYml0Y29yZS5IRFByaXZhdGVLZXkodGVtcC50b0hEUHJpdmF0ZUtleSgpLnRvU3RyaW5nKCkpO1xuICAgIH1cbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyID0gbmV3IEFkZHJlc3NNYW5hZ2VyKHRoaXMuSERXYWxsZXQsIHRoaXMubmV0d29yayk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5uZXh0KCk7XG4gIH1cblxuICAvKipcbiAgICogU2V0IHJwYyBwcm92aWRlclxuICAgKiBAcGFyYW0gcnBjXG4gICAqL1xuICBzdGF0aWMgc2V0UlBDKHJwYzpJUlBDKXtcbiAgICBhcGkuc2V0UlBDKHJwYyk7XG4gIH1cblxuICAvKipcbiAgICogUXVlcmllcyBBUEkgZm9yIGFkZHJlc3NbXSBVVFhPcy4gQWRkcyBVVFhPcyB0byBVVFhPIHNldC4gVXBkYXRlcyB3YWxsZXQgYmFsYW5jZS5cbiAgICogQHBhcmFtIGFkZHJlc3Nlc1xuICAgKi9cbiAgYXN5bmMgdXBkYXRlVXR4b3MoYWRkcmVzc2VzOiBzdHJpbmdbXSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGxvZ2dlci5sb2coJ2luZm8nLCBgR2V0dGluZyB1dHhvcyBmb3IgJHthZGRyZXNzZXMubGVuZ3RofSBhZGRyZXNzZXMuYCk7XG4gICAgY29uc3QgdXR4b1Jlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgIGFkZHJlc3Nlcy5tYXAoKGFkZHJlc3MpID0+IGFwaS5nZXRVdHhvcyhhZGRyZXNzKSlcbiAgICApO1xuICAgIGFkZHJlc3Nlcy5mb3JFYWNoKChhZGRyZXNzLCBpKSA9PiB7XG4gICAgICBjb25zdCB7IHV0eG9zIH0gPSB1dHhvUmVzdWx0c1tpXTtcbiAgICAgIGxvZ2dlci5sb2coJ2luZm8nLCBgJHthZGRyZXNzfTogJHt1dHhvcy5sZW5ndGh9IHRvdGFsIFVUWE9zIGZvdW5kLmApO1xuICAgICAgdGhpcy51dHhvU2V0LnV0eG9TdG9yYWdlW2FkZHJlc3NdID0gdXR4b3M7XG4gICAgICB0aGlzLnV0eG9TZXQuYWRkKHV0eG9zLCBhZGRyZXNzKTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBRdWVyaWVzIEFQSSBmb3IgYWRkcmVzc1tdIHRyYW5zYWN0aW9ucy4gQWRkcyB0eCB0byB0cmFuc2FjdGlvbnMgc3RvcmFnZS4gQWxzbyBzb3J0cyB0aGUgZW50aXJlIHRyYW5zYWN0aW9uIHNldC5cbiAgICogQHBhcmFtIGFkZHJlc3Nlc1xuICAgKi9cbiAgYXN5bmMgdXBkYXRlVHJhbnNhY3Rpb25zKGFkZHJlc3Nlczogc3RyaW5nW10pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gICAgbG9nZ2VyLmxvZygnaW5mbycsIGBHZXR0aW5nIHRyYW5zYWN0aW9ucyBmb3IgJHthZGRyZXNzZXMubGVuZ3RofSBhZGRyZXNzZXMuYCk7XG4gICAgY29uc3QgYWRkcmVzc2VzV2l0aFR4OiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHR4UmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgYWRkcmVzc2VzLm1hcCgoYWRkcmVzcykgPT4gYXBpLmdldFRyYW5zYWN0aW9ucyhhZGRyZXNzKSlcbiAgICApO1xuICAgIGFkZHJlc3Nlcy5mb3JFYWNoKChhZGRyZXNzLCBpKSA9PiB7XG4gICAgICBjb25zdCB7IHRyYW5zYWN0aW9ucyB9ID0gdHhSZXN1bHRzW2ldO1xuICAgICAgbG9nZ2VyLmxvZygnaW5mbycsIGAke2FkZHJlc3N9OiAke3RyYW5zYWN0aW9ucy5sZW5ndGh9IHRyYW5zYWN0aW9ucyBmb3VuZC5gKTtcbiAgICAgIGlmICh0cmFuc2FjdGlvbnMubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgIGNvbnN0IGNvbmZpcm1lZFR4ID0gdHJhbnNhY3Rpb25zLmZpbHRlcigodHg6QXBpLlRyYW5zYWN0aW9uKSA9PiB0eC5jb25maXJtYXRpb25zID4gMCk7XG4gICAgICAgIHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZVthZGRyZXNzXSA9IGNvbmZpcm1lZFR4O1xuICAgICAgICBhZGRyZXNzZXNXaXRoVHgucHVzaChhZGRyZXNzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgdGhpcy50cmFuc2FjdGlvbnMgPSB0eFBhcnNlcih0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2UsIE9iamVjdC5rZXlzKHRoaXMuYWRkcmVzc01hbmFnZXIuYWxsKSk7XG4gICAgY29uc3QgcGVuZGluZ1R4SGFzaGVzID0gT2JqZWN0LmtleXModGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9ucyk7XG4gICAgaWYgKHBlbmRpbmdUeEhhc2hlcy5sZW5ndGggPiAwKSB7XG4gICAgICBwZW5kaW5nVHhIYXNoZXMuZm9yRWFjaCgoaGFzaCkgPT4ge1xuICAgICAgICBpZiAodGhpcy50cmFuc2FjdGlvbnMubWFwKCh0eCkgPT4gdHgudHJhbnNhY3Rpb25IYXNoKS5pbmNsdWRlcyhoYXNoKSkge1xuICAgICAgICAgIHRoaXMuZGVsZXRlUGVuZGluZ1R4KGhhc2gpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgY29uc3QgaXNBY3Rpdml0eU9uUmVjZWl2ZUFkZHIgPVxuICAgICAgdGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlW3RoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuY3VycmVudC5hZGRyZXNzXSAhPT0gdW5kZWZpbmVkO1xuICAgIGlmIChpc0FjdGl2aXR5T25SZWNlaXZlQWRkcikge1xuICAgICAgdGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5uZXh0KCk7XG4gICAgfVxuICAgIHJldHVybiBhZGRyZXNzZXNXaXRoVHg7XG4gIH1cblxuICAvKipcbiAgICogUmVjYWxjdWxhdGVzIHdhbGxldCBiYWxhbmNlLlxuICAgKi9cbiAgdXBkYXRlQmFsYW5jZSgpOiB2b2lkIHtcbiAgICB0aGlzLmJhbGFuY2UgPSB0aGlzLnV0eG9TZXQudG90YWxCYWxhbmNlIC0gdGhpcy5wZW5kaW5nLmFtb3VudDtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGVzIHRoZSBzZWxlY3RlZCBuZXR3b3JrXG4gICAqIEBwYXJhbSBuZXR3b3JrIG5hbWUgb2YgdGhlIG5ldHdvcmtcbiAgICovXG4gIGFzeW5jIHVwZGF0ZU5ldHdvcmsobmV0d29yazogU2VsZWN0ZWROZXR3b3JrKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5kZW1vbGlzaFdhbGxldFN0YXRlKG5ldHdvcmsucHJlZml4KTtcbiAgICB0aGlzLm5ldHdvcmsgPSBuZXR3b3JrLnByZWZpeDtcbiAgICB0aGlzLmFwaUVuZHBvaW50ID0gbmV0d29yay5hcGlCYXNlVXJsO1xuICB9XG5cbiAgZGVtb2xpc2hXYWxsZXRTdGF0ZShuZXR3b3JrUHJlZml4OiBOZXR3b3JrID0gdGhpcy5uZXR3b3JrKTogdm9pZCB7XG4gICAgdGhpcy51dHhvU2V0LmNsZWFyKCk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlciA9IG5ldyBBZGRyZXNzTWFuYWdlcih0aGlzLkhEV2FsbGV0LCBuZXR3b3JrUHJlZml4KTtcbiAgICB0aGlzLnBlbmRpbmcudHJhbnNhY3Rpb25zID0ge307XG4gICAgdGhpcy50cmFuc2FjdGlvbnMgPSBbXTtcbiAgICB0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2UgPSB7fTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZXJpdmVzIHJlY2VpdmVBZGRyZXNzZXMgYW5kIGNoYW5nZUFkZHJlc3NlcyBhbmQgY2hlY2tzIHRoZWlyIHRyYW5zYWN0aW9ucyBhbmQgVVRYT3MuXG4gICAqIEBwYXJhbSB0aHJlc2hvbGQgc3RvcCBkaXNjb3ZlcmluZyBhZnRlciBgdGhyZXNob2xkYCBhZGRyZXNzZXMgd2l0aCBubyBhY3Rpdml0eVxuICAgKi9cbiAgYXN5bmMgYWRkcmVzc0Rpc2NvdmVyeSh0aHJlc2hvbGQgPSAyMCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGRvRGlzY292ZXJ5ID0gYXN5bmMgKFxuICAgICAgbjogbnVtYmVyLFxuICAgICAgZGVyaXZlVHlwZTogJ3JlY2VpdmUnIHwgJ2NoYW5nZScsXG4gICAgICBvZmZzZXQ6IG51bWJlclxuICAgICk6IFByb21pc2U8bnVtYmVyPiA9PiB7XG4gICAgICBjb25zdCBkZXJpdmVkQWRkcmVzc2VzID0gdGhpcy5hZGRyZXNzTWFuYWdlci5nZXRBZGRyZXNzZXMobiwgZGVyaXZlVHlwZSwgb2Zmc2V0KTtcbiAgICAgIGNvbnN0IGFkZHJlc3NlcyA9IGRlcml2ZWRBZGRyZXNzZXMubWFwKChvYmopID0+IG9iai5hZGRyZXNzKTtcbiAgICAgIGxvZ2dlci5sb2coXG4gICAgICAgICdpbmZvJyxcbiAgICAgICAgYEZldGNoaW5nICR7ZGVyaXZlVHlwZX0gYWRkcmVzcyBkYXRhIGZvciBkZXJpdmVkIGluZGljZXMgJHtKU09OLnN0cmluZ2lmeShcbiAgICAgICAgICBkZXJpdmVkQWRkcmVzc2VzLm1hcCgob2JqKSA9PiBvYmouaW5kZXgpXG4gICAgICAgICl9YFxuICAgICAgKTtcbiAgICAgIGNvbnN0IGFkZHJlc3Nlc1dpdGhUeCA9IGF3YWl0IHRoaXMudXBkYXRlVHJhbnNhY3Rpb25zKGFkZHJlc3Nlcyk7XG4gICAgICBpZiAoYWRkcmVzc2VzV2l0aFR4Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyBhZGRyZXNzIGRpc2NvdmVyeSBjb21wbGV0ZVxuICAgICAgICBjb25zdCBsYXN0QWRkcmVzc0luZGV4V2l0aFR4ID0gb2Zmc2V0IC0gKHRocmVzaG9sZCAtIG4pIC0gMTtcbiAgICAgICAgbG9nZ2VyLmxvZyhcbiAgICAgICAgICAnaW5mbycsXG4gICAgICAgICAgYCR7ZGVyaXZlVHlwZX1BZGRyZXNzIGRpc2NvdmVyeSBjb21wbGV0ZS4gTGFzdCBhY3Rpdml0eSBvbiBhZGRyZXNzICMke2xhc3RBZGRyZXNzSW5kZXhXaXRoVHh9LiBObyBhY3Rpdml0eSBmcm9tICR7ZGVyaXZlVHlwZX0jJHtcbiAgICAgICAgICAgIGxhc3RBZGRyZXNzSW5kZXhXaXRoVHggKyAxXG4gICAgICAgICAgfX4ke2xhc3RBZGRyZXNzSW5kZXhXaXRoVHggKyB0aHJlc2hvbGR9LmBcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGxhc3RBZGRyZXNzSW5kZXhXaXRoVHg7XG4gICAgICB9XG4gICAgICAvLyBlbHNlIGtlZXAgZG9pbmcgZGlzY292ZXJ5XG4gICAgICBjb25zdCBuQWRkcmVzc2VzTGVmdCA9XG4gICAgICAgIGRlcml2ZWRBZGRyZXNzZXNcbiAgICAgICAgICAuZmlsdGVyKChvYmopID0+IGFkZHJlc3Nlc1dpdGhUeC5pbmRleE9mKG9iai5hZGRyZXNzKSAhPT0gLTEpXG4gICAgICAgICAgLnJlZHVjZSgocHJldiwgY3VyKSA9PiBNYXRoLm1heChwcmV2LCBjdXIuaW5kZXgpLCAwKSArIDE7XG4gICAgICByZXR1cm4gZG9EaXNjb3ZlcnkobkFkZHJlc3Nlc0xlZnQsIGRlcml2ZVR5cGUsIG9mZnNldCArIG4pO1xuICAgIH07XG4gICAgY29uc3QgaGlnaGVzdFJlY2VpdmVJbmRleCA9IGF3YWl0IGRvRGlzY292ZXJ5KHRocmVzaG9sZCwgJ3JlY2VpdmUnLCAwKTtcbiAgICBjb25zdCBoaWdoZXN0Q2hhbmdlSW5kZXggPSBhd2FpdCBkb0Rpc2NvdmVyeSh0aHJlc2hvbGQsICdjaGFuZ2UnLCAwKTtcbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmFkdmFuY2UoaGlnaGVzdFJlY2VpdmVJbmRleCArIDEpO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5hZHZhbmNlKGhpZ2hlc3RDaGFuZ2VJbmRleCArIDEpO1xuICAgIGxvZ2dlci5sb2coXG4gICAgICAnaW5mbycsXG4gICAgICBgcmVjZWl2ZSBhZGRyZXNzIGluZGV4OiAke2hpZ2hlc3RSZWNlaXZlSW5kZXh9OyBjaGFuZ2UgYWRkcmVzcyBpbmRleDogJHtoaWdoZXN0Q2hhbmdlSW5kZXh9YFxuICAgICk7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVVdHhvcyhPYmplY3Qua2V5cyh0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2UpKTtcbiAgICB0aGlzLnJ1blN0YXRlQ2hhbmdlSG9va3MoKTtcbiAgfVxuXG4gIC8vIFRPRE86IGNvbnZlcnQgYW1vdW50IHRvIHNvbXBpcyBha2Egc2F0b3NoaXNcbiAgLy8gVE9ETzogYm5cbiAgLyoqXG4gICAqIENvbXBvc2UgYSBzZXJpYWxpemVkLCBzaWduZWQgdHJhbnNhY3Rpb25cbiAgICogQHBhcmFtIG9ialxuICAgKiBAcGFyYW0gb2JqLnRvQWRkciBUbyBhZGRyZXNzIGluIGNhc2hhZGRyIGZvcm1hdCAoZS5nLiBrYXNwYXRlc3Q6cXEwZDZoMHByam01bXBkbGQ1cG5jc3QzYWR1MHlhbTZ4Y2g0dHI2OWsyKVxuICAgKiBAcGFyYW0gb2JqLmFtb3VudCBBbW91bnQgdG8gc2VuZCBpbiBzb21waXMgKDEwMDAwMDAwMCAoMWU4KSBzb21waXMgaW4gMSBLU1ApXG4gICAqIEBwYXJhbSBvYmouZmVlIEZlZSBmb3IgbWluZXJzIGluIHNvbXBpc1xuICAgKiBAcGFyYW0gb2JqLmNoYW5nZUFkZHJPdmVycmlkZSBVc2UgdGhpcyB0byBvdmVycmlkZSBhdXRvbWF0aWMgY2hhbmdlIGFkZHJlc3MgZGVyaXZhdGlvblxuICAgKiBAdGhyb3dzIGlmIGFtb3VudCBpcyBhYm92ZSBgTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVJgXG4gICAqL1xuICBjb21wb3NlVHgoe1xuICAgIHRvQWRkcixcbiAgICBhbW91bnQsXG4gICAgZmVlID0gREVGQVVMVF9GRUUsXG4gICAgY2hhbmdlQWRkck92ZXJyaWRlLFxuICB9OiBUeFNlbmQgJiB7IGNoYW5nZUFkZHJPdmVycmlkZT86IHN0cmluZyB9KToge1xuICAgIGlkOiBzdHJpbmc7XG4gICAgcmF3VHg6IHN0cmluZztcbiAgICB1dHhvSWRzOiBzdHJpbmdbXTtcbiAgICBhbW91bnQ6IG51bWJlcjtcbiAgfSB7XG4gICAgaWYgKCFOdW1iZXIuaXNTYWZlSW50ZWdlcihhbW91bnQpKSB0aHJvdyBuZXcgRXJyb3IoJ0Ftb3VudCB0b28gbGFyZ2UnKTtcbiAgICBjb25zdCB7IHV0eG9zLCB1dHhvSWRzIH0gPSB0aGlzLnV0eG9TZXQuc2VsZWN0VXR4b3MoYW1vdW50ICsgZmVlKTtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgY29uc3QgcHJpdktleXMgPSB1dHhvcy5yZWR1Y2UoKHByZXY6IHN0cmluZ1tdLCBjdXIpID0+IHtcbiAgICAgIHJldHVybiBbdGhpcy5hZGRyZXNzTWFuYWdlci5hbGxbU3RyaW5nKGN1ci5hZGRyZXNzKV0sIC4uLnByZXZdO1xuICAgIH0sIFtdKTtcbiAgICBjb25zdCBjaGFuZ2VBZGRyID0gY2hhbmdlQWRkck92ZXJyaWRlIHx8IHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5uZXh0KCk7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHR4OiBiaXRjb3JlLlRyYW5zYWN0aW9uID0gbmV3IGJpdGNvcmUuVHJhbnNhY3Rpb24oKVxuICAgICAgICAuZnJvbSh1dHhvcylcbiAgICAgICAgLnRvKHRvQWRkciwgYW1vdW50KVxuICAgICAgICAuc2V0VmVyc2lvbigxKVxuICAgICAgICAuZmVlKGZlZSlcbiAgICAgICAgLmNoYW5nZShjaGFuZ2VBZGRyKVxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIC5zaWduKHByaXZLZXlzLCBiaXRjb3JlLmNyeXB0by5TaWduYXR1cmUuU0lHSEFTSF9BTEwsICdzY2hub3JyJyk7XG4gICAgICB0aGlzLnV0eG9TZXQuaW5Vc2UucHVzaCguLi51dHhvSWRzKTtcbiAgICAgIHRoaXMucGVuZGluZy5hZGQodHguaWQsIHsgcmF3VHg6IHR4LnRvU3RyaW5nKCksIHV0eG9JZHMsIGFtb3VudCwgdG86IHRvQWRkciwgZmVlIH0pO1xuICAgICAgdGhpcy5ydW5TdGF0ZUNoYW5nZUhvb2tzKCk7XG4gICAgICByZXR1cm4geyBpZDogdHguaWQsIHJhd1R4OiB0eC50b1N0cmluZygpLCB1dHhvSWRzLCBhbW91bnQ6IGFtb3VudCArIGZlZSB9O1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5yZXZlcnNlKCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZW5kIGEgdHJhbnNhY3Rpb24uIFJldHVybnMgdHJhbnNhY3Rpb24gaWQuXG4gICAqIEBwYXJhbSB0eFBhcmFtc1xuICAgKiBAcGFyYW0gdHhQYXJhbXMudG9BZGRyIFRvIGFkZHJlc3MgaW4gY2FzaGFkZHIgZm9ybWF0IChlLmcuIGthc3BhdGVzdDpxcTBkNmgwcHJqbTVtcGRsZDVwbmNzdDNhZHUweWFtNnhjaDR0cjY5azIpXG4gICAqIEBwYXJhbSB0eFBhcmFtcy5hbW91bnQgQW1vdW50IHRvIHNlbmQgaW4gc29tcGlzICgxMDAwMDAwMDAgKDFlOCkgc29tcGlzIGluIDEgS1NQKVxuICAgKiBAcGFyYW0gdHhQYXJhbXMuZmVlIEZlZSBmb3IgbWluZXJzIGluIHNvbXBpc1xuICAgKiBAdGhyb3dzIGBGZXRjaEVycm9yYCBpZiBlbmRwb2ludCBpcyBkb3duLiBBUEkgZXJyb3IgbWVzc2FnZSBpZiB0eCBlcnJvci4gRXJyb3IgaWYgYW1vdW50IGlzIHRvbyBsYXJnZSB0byBiZSByZXByZXNlbnRlZCBhcyBhIGphdmFzY3JpcHQgbnVtYmVyLlxuICAgKi9cbiAgYXN5bmMgc2VuZFR4KHR4UGFyYW1zOiBUeFNlbmQpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IHsgaWQsIHJhd1R4IH0gPSB0aGlzLmNvbXBvc2VUeCh0eFBhcmFtcyk7XG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IGFwaS5wb3N0VHgocmF3VHgpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMudW5kb1BlbmRpbmdUeChpZCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH1cbiAgICByZXR1cm4gaWQ7XG4gIH1cblxuICBhc3luYyB1cGRhdGVTdGF0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBhY3RpdmVBZGRycyA9IGF3YWl0IHRoaXMudXBkYXRlVHJhbnNhY3Rpb25zKHRoaXMuYWRkcmVzc01hbmFnZXIuc2hvdWxkRmV0Y2gpO1xuICAgIGF3YWl0IHRoaXMudXBkYXRlVXR4b3MoYWN0aXZlQWRkcnMpO1xuICAgIHRoaXMucnVuU3RhdGVDaGFuZ2VIb29rcygpO1xuICB9XG5cbiAgdW5kb1BlbmRpbmdUeChpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgY29uc3QgeyB1dHhvSWRzIH0gPSB0aGlzLnBlbmRpbmcudHJhbnNhY3Rpb25zW2lkXTtcbiAgICBkZWxldGUgdGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9uc1tpZF07XG4gICAgdGhpcy51dHhvU2V0LnJlbGVhc2UodXR4b0lkcyk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLnJldmVyc2UoKTtcbiAgICB0aGlzLnJ1blN0YXRlQ2hhbmdlSG9va3MoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZnRlciB3ZSBzZWUgdGhlIHRyYW5zYWN0aW9uIGluIHRoZSBBUEkgcmVzdWx0cywgZGVsZXRlIGl0IGZyb20gb3VyIHBlbmRpbmcgbGlzdC5cbiAgICogQHBhcmFtIGlkIFRoZSB0eCBoYXNoXG4gICAqL1xuICBkZWxldGVQZW5kaW5nVHgoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIC8vIHVuZG8gKyBkZWxldGUgb2xkIHV0eG9zXG4gICAgY29uc3QgeyB1dHhvSWRzIH0gPSB0aGlzLnBlbmRpbmcudHJhbnNhY3Rpb25zW2lkXTtcbiAgICBkZWxldGUgdGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9uc1tpZF07XG4gICAgdGhpcy51dHhvU2V0LnJlbW92ZSh1dHhvSWRzKTtcbiAgfVxuXG4gIHJ1blN0YXRlQ2hhbmdlSG9va3MoKTogdm9pZCB7XG4gICAgdGhpcy51dHhvU2V0LnVwZGF0ZVV0eG9CYWxhbmNlKCk7XG4gICAgdGhpcy51cGRhdGVCYWxhbmNlKCk7XG4gIH1cblxuICBnZXQgY2FjaGUoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHBlbmRpbmdUeDogdGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9ucyxcbiAgICAgIHV0eG9zOiB7XG4gICAgICAgIHV0eG9TdG9yYWdlOiB0aGlzLnV0eG9TZXQudXR4b1N0b3JhZ2UsXG4gICAgICAgIGluVXNlOiB0aGlzLnV0eG9TZXQuaW5Vc2UsXG4gICAgICB9LFxuICAgICAgdHJhbnNhY3Rpb25zU3RvcmFnZTogdGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlLFxuICAgICAgYWRkcmVzc2VzOiB7XG4gICAgICAgIHJlY2VpdmVDb3VudGVyOiB0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmNvdW50ZXIsXG4gICAgICAgIGNoYW5nZUNvdW50ZXI6IHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5jb3VudGVyLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG5cbiAgcmVzdG9yZUNhY2hlKGNhY2hlOiBXYWxsZXRDYWNoZSk6IHZvaWQge1xuICAgIHRoaXMucGVuZGluZy50cmFuc2FjdGlvbnMgPSBjYWNoZS5wZW5kaW5nVHg7XG4gICAgdGhpcy51dHhvU2V0LnV0eG9TdG9yYWdlID0gY2FjaGUudXR4b3MudXR4b1N0b3JhZ2U7XG4gICAgdGhpcy51dHhvU2V0LmluVXNlID0gY2FjaGUudXR4b3MuaW5Vc2U7XG4gICAgT2JqZWN0LmVudHJpZXModGhpcy51dHhvU2V0LnV0eG9TdG9yYWdlKS5mb3JFYWNoKChbYWRkciwgdXR4b3NdOiBbc3RyaW5nLCBBcGkuVXR4b1tdXSkgPT4ge1xuICAgICAgdGhpcy51dHhvU2V0LmFkZCh1dHhvcywgYWRkcik7XG4gICAgfSk7XG4gICAgdGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlID0gY2FjaGUudHJhbnNhY3Rpb25zU3RvcmFnZTtcbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLmdldEFkZHJlc3NlcyhjYWNoZS5hZGRyZXNzZXMucmVjZWl2ZUNvdW50ZXIgKyAxLCAncmVjZWl2ZScpO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIuZ2V0QWRkcmVzc2VzKGNhY2hlLmFkZHJlc3Nlcy5jaGFuZ2VDb3VudGVyICsgMSwgJ2NoYW5nZScpO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuYWR2YW5jZShjYWNoZS5hZGRyZXNzZXMucmVjZWl2ZUNvdW50ZXIgLSAxKTtcbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MuYWR2YW5jZShjYWNoZS5hZGRyZXNzZXMuY2hhbmdlQ291bnRlcik7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIHRoaXMudHJhbnNhY3Rpb25zID0gdHhQYXJzZXIodGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlLCBPYmplY3Qua2V5cyh0aGlzLmFkZHJlc3NNYW5hZ2VyLmFsbCkpO1xuICAgIHRoaXMucnVuU3RhdGVDaGFuZ2VIb29rcygpO1xuICB9XG5cbiAgLyoqXG4gICAqICBDb252ZXJ0cyBhIG1uZW1vbmljIHRvIGEgbmV3IHdhbGxldC5cbiAgICogQHBhcmFtIHNlZWRQaHJhc2UgVGhlIDEyIHdvcmQgc2VlZCBwaHJhc2UuXG4gICAqIEByZXR1cm5zIG5ldyBXYWxsZXRcbiAgICovXG4gIHN0YXRpYyBmcm9tTW5lbW9uaWMoc2VlZFBocmFzZTogc3RyaW5nKTogV2FsbGV0IHtcbiAgICBjb25zdCBwcml2S2V5ID0gbmV3IE1uZW1vbmljKHNlZWRQaHJhc2UudHJpbSgpKS50b0hEUHJpdmF0ZUtleSgpLnRvU3RyaW5nKCk7XG4gICAgY29uc3Qgd2FsbGV0ID0gbmV3IHRoaXMocHJpdktleSwgc2VlZFBocmFzZSk7XG4gICAgcmV0dXJuIHdhbGxldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IFdhbGxldCBmcm9tIGVuY3J5cHRlZCB3YWxsZXQgZGF0YS5cbiAgICogQHBhcmFtIHBhc3N3b3JkIHRoZSBwYXNzd29yZCB0aGUgdXNlciBlbmNyeXB0ZWQgdGhlaXIgc2VlZCBwaHJhc2Ugd2l0aFxuICAgKiBAcGFyYW0gZW5jcnlwdGVkTW5lbW9uaWMgdGhlIGVuY3J5cHRlZCBzZWVkIHBocmFzZSBmcm9tIGxvY2FsIHN0b3JhZ2VcbiAgICogQHRocm93cyBXaWxsIHRocm93IFwiSW5jb3JyZWN0IHBhc3N3b3JkXCIgaWYgcGFzc3dvcmQgaXMgd3JvbmdcbiAgICovXG4gIHN0YXRpYyBhc3luYyBpbXBvcnQocGFzc3dvcmQ6IHN0cmluZywgZW5jcnlwdGVkTW5lbW9uaWM6IHN0cmluZyk6IFByb21pc2U8V2FsbGV0PiB7XG4gICAgY29uc3QgZGVjcnlwdGVkID0gYXdhaXQgcGFzc3dvcmRlci5kZWNyeXB0KHBhc3N3b3JkLCBlbmNyeXB0ZWRNbmVtb25pYyk7XG4gICAgY29uc3Qgc2F2ZWRXYWxsZXQgPSBkZWNyeXB0ZWQgYXMgV2FsbGV0U2F2ZTtcbiAgICBjb25zdCBteVdhbGxldCA9IG5ldyB0aGlzKHNhdmVkV2FsbGV0LnByaXZLZXksIHNhdmVkV2FsbGV0LnNlZWRQaHJhc2UpO1xuICAgIHJldHVybiBteVdhbGxldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZW5lcmF0ZXMgZW5jcnlwdGVkIHdhbGxldCBkYXRhLlxuICAgKiBAcGFyYW0gcGFzc3dvcmQgdXNlcidzIGNob3NlbiBwYXNzd29yZFxuICAgKiBAcmV0dXJucyBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gb2JqZWN0LWxpa2Ugc3RyaW5nLiBTdWdnZXN0ZWQgdG8gc3RvcmUgYXMgc3RyaW5nIGZvciAuaW1wb3J0KCkuXG4gICAqL1xuICBhc3luYyBleHBvcnQocGFzc3dvcmQ6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3Qgc2F2ZWRXYWxsZXQ6IFdhbGxldFNhdmUgPSB7XG4gICAgICBwcml2S2V5OiB0aGlzLkhEV2FsbGV0LnRvU3RyaW5nKCksXG4gICAgICBzZWVkUGhyYXNlOiB0aGlzLm1uZW1vbmljLFxuICAgIH07XG4gICAgcmV0dXJuIHBhc3N3b3JkZXIuZW5jcnlwdChwYXNzd29yZCwgSlNPTi5zdHJpbmdpZnkoc2F2ZWRXYWxsZXQpKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBXYWxsZXQ7XG4iXX0=