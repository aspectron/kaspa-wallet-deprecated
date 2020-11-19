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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV2FsbGV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vd2FsbGV0L1dhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzdDLGFBQWE7QUFDYiw0Q0FBNEM7QUFDNUMsYUFBYTtBQUNiLHlDQUF5QztBQUN6Qyw2Q0FBcUM7QUFVckMsNENBQXlDO0FBQ3pDLHFEQUFrRDtBQUNsRCx1Q0FBb0M7QUFDcEMsb0NBQW9DO0FBQ3BDLHlDQUFzQztBQUN0QyxnREFBOEQ7QUFFOUQsb0VBQW9FO0FBQ3BFLE1BQU0sTUFBTTtJQTREVjs7OztPQUlHO0lBQ0gsWUFBWSxPQUFnQixFQUFFLFVBQW1CO1FBOURqRDs7V0FFRztRQUNILFlBQU8sR0FBdUIsU0FBUyxDQUFDO1FBU3hDOztXQUVHO1FBQ0gsYUFBYTtRQUNiLFlBQU8sR0FBWSw2QkFBZSxDQUFDLE1BQWlCLENBQUM7UUFFckQ7O1dBRUc7UUFDSCxnQkFBVyxHQUFHLDZCQUFlLENBQUMsVUFBVSxDQUFDO1FBT3pDLFlBQU8sR0FBRyxJQUFJLGlCQUFPLEVBQUUsQ0FBQztRQUl4QixvQkFBb0I7UUFDcEIsWUFBTyxHQUF3QjtZQUM3QixZQUFZLEVBQUUsRUFBRTtZQUNoQixJQUFJLE1BQU07Z0JBQ1IsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQ3RELElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDO29CQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUN4QyxPQUFPLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzVFLENBQUM7WUFDRCxHQUFH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Q0FDRjtBQUVELGtCQUFlLE1BQU0sQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IE1uZW1vbmljID0gcmVxdWlyZSgnYml0Y29yZS1tbmVtb25pYycpO1xuLy8gQHRzLWlnbm9yZVxuaW1wb3J0ICogYXMgYml0Y29yZSBmcm9tICdiaXRjb3JlLWxpYi1jYXNoJztcbi8vIEB0cy1pZ25vcmVcbmltcG9ydCAqIGFzIHBhc3N3b3JkZXIgZnJvbSAncGFzc3dvcmRlcic7XG5pbXBvcnQgeyBCdWZmZXIgfSBmcm9tICdzYWZlLWJ1ZmZlcic7XG5pbXBvcnQge1xuICBOZXR3b3JrLFxuICBTZWxlY3RlZE5ldHdvcmssXG4gIFdhbGxldFNhdmUsXG4gIEFwaSxcbiAgVHhTZW5kLFxuICBQZW5kaW5nVHJhbnNhY3Rpb25zLFxuICBXYWxsZXRDYWNoZSwgSVJQQ1xufSBmcm9tICcuLi90eXBlcy9jdXN0b20tdHlwZXMnO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCB7IEFkZHJlc3NNYW5hZ2VyIH0gZnJvbSAnLi9BZGRyZXNzTWFuYWdlcic7XG5pbXBvcnQgeyBVdHhvU2V0IH0gZnJvbSAnLi9VdHhvU2V0JztcbmltcG9ydCAqIGFzIGFwaSBmcm9tICcuL2FwaUhlbHBlcnMnO1xuaW1wb3J0IHsgdHhQYXJzZXIgfSBmcm9tICcuL3R4UGFyc2VyJztcbmltcG9ydCB7IERFRkFVTFRfRkVFLCBERUZBVUxUX05FVFdPUksgfSBmcm9tICcuLi9jb25maWcuanNvbic7XG5cbi8qKiBDbGFzcyByZXByZXNlbnRpbmcgYW4gSERXYWxsZXQgd2l0aCBkZXJpdmFibGUgY2hpbGQgYWRkcmVzc2VzICovXG5jbGFzcyBXYWxsZXQge1xuICBIRFdhbGxldDogYml0Y29yZS5IRFByaXZhdGVLZXk7XG5cbiAgLyoqXG4gICAqIFRoZSBzdW1tZWQgYmFsYW5jZSBhY3Jvc3MgYWxsIG9mIFdhbGxldCdzIGRpc2NvdmVyZWQgYWRkcmVzc2VzLCBtaW51cyBhbW91bnQgZnJvbSBwZW5kaW5nIHRyYW5zYWN0aW9ucy5cbiAgICovXG4gIGJhbGFuY2U6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuICAvKipcbiAgICogU2V0IGJ5IGFkZHJlc3NNYW5hZ2VyXG4gICAqL1xuICBnZXQgcmVjZWl2ZUFkZHJlc3MoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuY3VycmVudC5hZGRyZXNzO1xuICB9XG5cbiAgLyoqXG4gICAqIEN1cnJlbnQgbmV0d29yay5cbiAgICovXG4gIC8vIEB0cy1pZ25vcmVcbiAgbmV0d29yazogTmV0d29yayA9IERFRkFVTFRfTkVUV09SSy5wcmVmaXggYXMgTmV0d29yaztcblxuICAvKipcbiAgICogQ3VycmVudCBBUEkgZW5kcG9pbnQgZm9yIHNlbGVjdGVkIG5ldHdvcmtcbiAgICovXG4gIGFwaUVuZHBvaW50ID0gREVGQVVMVF9ORVRXT1JLLmFwaUJhc2VVcmw7XG5cbiAgLyoqXG4gICAqIEEgMTIgd29yZCBtbmVtb25pYy5cbiAgICovXG4gIG1uZW1vbmljOiBzdHJpbmc7XG5cbiAgdXR4b1NldCA9IG5ldyBVdHhvU2V0KCk7XG5cbiAgYWRkcmVzc01hbmFnZXI6IEFkZHJlc3NNYW5hZ2VyO1xuXG4gIC8qIGVzbGludC1kaXNhYmxlICovXG4gIHBlbmRpbmc6IFBlbmRpbmdUcmFuc2FjdGlvbnMgPSB7XG4gICAgdHJhbnNhY3Rpb25zOiB7fSxcbiAgICBnZXQgYW1vdW50KCkge1xuICAgICAgY29uc3QgdHJhbnNhY3Rpb25zID0gT2JqZWN0LnZhbHVlcyh0aGlzLnRyYW5zYWN0aW9ucyk7XG4gICAgICBpZiAodHJhbnNhY3Rpb25zLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDA7XG4gICAgICByZXR1cm4gdHJhbnNhY3Rpb25zLnJlZHVjZSgocHJldiwgY3VyKSA9PiBwcmV2ICsgY3VyLmFtb3VudCArIGN1ci5mZWUsIDApO1xuICAgIH0sXG4gICAgYWRkKFxuICAgICAgaWQ6IHN0cmluZyxcbiAgICAgIHR4OiB7IHRvOiBzdHJpbmc7IHV0eG9JZHM6IHN0cmluZ1tdOyByYXdUeDogc3RyaW5nOyBhbW91bnQ6IG51bWJlcjsgZmVlOiBudW1iZXIgfVxuICAgICkge1xuICAgICAgdGhpcy50cmFuc2FjdGlvbnNbaWRdID0gdHg7XG4gICAgfSxcbiAgfTtcbiAgLyoqXG4gICAqIFRyYW5zYWN0aW9ucyBzb3J0ZWQgYnkgaGFzaC5cbiAgICovXG4gIHRyYW5zYWN0aW9uczogQXBpLlRyYW5zYWN0aW9uW10gPSBbXTtcblxuICAvKipcbiAgICogVHJhbnNhY3Rpb24gYXJyYXlzIGtleWVkIGJ5IGFkZHJlc3MuXG4gICAqL1xuICB0cmFuc2FjdGlvbnNTdG9yYWdlOiBSZWNvcmQ8c3RyaW5nLCBBcGkuVHJhbnNhY3Rpb25bXT4gPSB7fTtcblxuICAvKiogQ3JlYXRlIGEgd2FsbGV0LlxuICAgKiBAcGFyYW0gd2FsbGV0U2F2ZSAob3B0aW9uYWwpXG4gICAqIEBwYXJhbSB3YWxsZXRTYXZlLnByaXZLZXkgU2F2ZWQgd2FsbGV0J3MgcHJpdmF0ZSBrZXkuXG4gICAqIEBwYXJhbSB3YWxsZXRTYXZlLnNlZWRQaHJhc2UgU2F2ZWQgd2FsbGV0J3Mgc2VlZCBwaHJhc2UuXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihwcml2S2V5Pzogc3RyaW5nLCBzZWVkUGhyYXNlPzogc3RyaW5nKSB7XG4gICAgaWYgKHByaXZLZXkgJiYgc2VlZFBocmFzZSkge1xuICAgICAgdGhpcy5IRFdhbGxldCA9IG5ldyBiaXRjb3JlLkhEUHJpdmF0ZUtleShwcml2S2V5KTtcbiAgICAgIHRoaXMubW5lbW9uaWMgPSBzZWVkUGhyYXNlO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB0ZW1wID0gbmV3IE1uZW1vbmljKE1uZW1vbmljLldvcmRzLkVOR0xJU0gpO1xuICAgICAgdGhpcy5tbmVtb25pYyA9IHRlbXAudG9TdHJpbmcoKTtcbiAgICAgIHRoaXMuSERXYWxsZXQgPSBuZXcgYml0Y29yZS5IRFByaXZhdGVLZXkodGVtcC50b0hEUHJpdmF0ZUtleSgpLnRvU3RyaW5nKCkpO1xuICAgIH1cbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyID0gbmV3IEFkZHJlc3NNYW5hZ2VyKHRoaXMuSERXYWxsZXQsIHRoaXMubmV0d29yayk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5uZXh0KCk7XG4gIH1cblxuICAvKipcbiAgICogU2V0IHJwYyBwcm92aWRlclxuICAgKiBAcGFyYW0gcnBjXG4gICAqL1xuICBzZXRSUEMocnBjOklSUEMpe1xuICAgIGFwaS5zZXRSUEMocnBjKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBRdWVyaWVzIEFQSSBmb3IgYWRkcmVzc1tdIFVUWE9zLiBBZGRzIFVUWE9zIHRvIFVUWE8gc2V0LiBVcGRhdGVzIHdhbGxldCBiYWxhbmNlLlxuICAgKiBAcGFyYW0gYWRkcmVzc2VzXG4gICAqL1xuICBhc3luYyB1cGRhdGVVdHhvcyhhZGRyZXNzZXM6IHN0cmluZ1tdKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgbG9nZ2VyLmxvZygnaW5mbycsIGBHZXR0aW5nIHV0eG9zIGZvciAke2FkZHJlc3Nlcy5sZW5ndGh9IGFkZHJlc3Nlcy5gKTtcbiAgICBjb25zdCB1dHhvUmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgYWRkcmVzc2VzLm1hcCgoYWRkcmVzcykgPT4gYXBpLmdldFV0eG9zKGFkZHJlc3MpKVxuICAgICk7XG4gICAgYWRkcmVzc2VzLmZvckVhY2goKGFkZHJlc3MsIGkpID0+IHtcbiAgICAgIGNvbnN0IHsgdXR4b3MgfSA9IHV0eG9SZXN1bHRzW2ldO1xuICAgICAgbG9nZ2VyLmxvZygnaW5mbycsIGAke2FkZHJlc3N9OiAke3V0eG9zLmxlbmd0aH0gdG90YWwgVVRYT3MgZm91bmQuYCk7XG4gICAgICB0aGlzLnV0eG9TZXQudXR4b1N0b3JhZ2VbYWRkcmVzc10gPSB1dHhvcztcbiAgICAgIHRoaXMudXR4b1NldC5hZGQodXR4b3MsIGFkZHJlc3MpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFF1ZXJpZXMgQVBJIGZvciBhZGRyZXNzW10gdHJhbnNhY3Rpb25zLiBBZGRzIHR4IHRvIHRyYW5zYWN0aW9ucyBzdG9yYWdlLiBBbHNvIHNvcnRzIHRoZSBlbnRpcmUgdHJhbnNhY3Rpb24gc2V0LlxuICAgKiBAcGFyYW0gYWRkcmVzc2VzXG4gICAqL1xuICBhc3luYyB1cGRhdGVUcmFuc2FjdGlvbnMoYWRkcmVzc2VzOiBzdHJpbmdbXSk6IFByb21pc2U8c3RyaW5nW10+IHtcbiAgICBsb2dnZXIubG9nKCdpbmZvJywgYEdldHRpbmcgdHJhbnNhY3Rpb25zIGZvciAke2FkZHJlc3Nlcy5sZW5ndGh9IGFkZHJlc3Nlcy5gKTtcbiAgICBjb25zdCBhZGRyZXNzZXNXaXRoVHg6IHN0cmluZ1tdID0gW107XG4gICAgY29uc3QgdHhSZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBhZGRyZXNzZXMubWFwKChhZGRyZXNzKSA9PiBhcGkuZ2V0VHJhbnNhY3Rpb25zKGFkZHJlc3MpKVxuICAgICk7XG4gICAgYWRkcmVzc2VzLmZvckVhY2goKGFkZHJlc3MsIGkpID0+IHtcbiAgICAgIGNvbnN0IHsgdHJhbnNhY3Rpb25zIH0gPSB0eFJlc3VsdHNbaV07XG4gICAgICBsb2dnZXIubG9nKCdpbmZvJywgYCR7YWRkcmVzc306ICR7dHJhbnNhY3Rpb25zLmxlbmd0aH0gdHJhbnNhY3Rpb25zIGZvdW5kLmApO1xuICAgICAgaWYgKHRyYW5zYWN0aW9ucy5sZW5ndGggIT09IDApIHtcbiAgICAgICAgY29uc3QgY29uZmlybWVkVHggPSB0cmFuc2FjdGlvbnMuZmlsdGVyKCh0eDpBcGkuVHJhbnNhY3Rpb24pID0+IHR4LmNvbmZpcm1hdGlvbnMgPiAwKTtcbiAgICAgICAgdGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlW2FkZHJlc3NdID0gY29uZmlybWVkVHg7XG4gICAgICAgIGFkZHJlc3Nlc1dpdGhUeC5wdXNoKGFkZHJlc3MpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICB0aGlzLnRyYW5zYWN0aW9ucyA9IHR4UGFyc2VyKHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZSwgT2JqZWN0LmtleXModGhpcy5hZGRyZXNzTWFuYWdlci5hbGwpKTtcbiAgICBjb25zdCBwZW5kaW5nVHhIYXNoZXMgPSBPYmplY3Qua2V5cyh0aGlzLnBlbmRpbmcudHJhbnNhY3Rpb25zKTtcbiAgICBpZiAocGVuZGluZ1R4SGFzaGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHBlbmRpbmdUeEhhc2hlcy5mb3JFYWNoKChoYXNoKSA9PiB7XG4gICAgICAgIGlmICh0aGlzLnRyYW5zYWN0aW9ucy5tYXAoKHR4KSA9PiB0eC50cmFuc2FjdGlvbkhhc2gpLmluY2x1ZGVzKGhhc2gpKSB7XG4gICAgICAgICAgdGhpcy5kZWxldGVQZW5kaW5nVHgoaGFzaCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICBjb25zdCBpc0FjdGl2aXR5T25SZWNlaXZlQWRkciA9XG4gICAgICB0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2VbdGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5jdXJyZW50LmFkZHJlc3NdICE9PSB1bmRlZmluZWQ7XG4gICAgaWYgKGlzQWN0aXZpdHlPblJlY2VpdmVBZGRyKSB7XG4gICAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLm5leHQoKTtcbiAgICB9XG4gICAgcmV0dXJuIGFkZHJlc3Nlc1dpdGhUeDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWNhbGN1bGF0ZXMgd2FsbGV0IGJhbGFuY2UuXG4gICAqL1xuICB1cGRhdGVCYWxhbmNlKCk6IHZvaWQge1xuICAgIHRoaXMuYmFsYW5jZSA9IHRoaXMudXR4b1NldC50b3RhbEJhbGFuY2UgLSB0aGlzLnBlbmRpbmcuYW1vdW50O1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZXMgdGhlIHNlbGVjdGVkIG5ldHdvcmtcbiAgICogQHBhcmFtIG5ldHdvcmsgbmFtZSBvZiB0aGUgbmV0d29ya1xuICAgKi9cbiAgYXN5bmMgdXBkYXRlTmV0d29yayhuZXR3b3JrOiBTZWxlY3RlZE5ldHdvcmspOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0aGlzLmRlbW9saXNoV2FsbGV0U3RhdGUobmV0d29yay5wcmVmaXgpO1xuICAgIHRoaXMubmV0d29yayA9IG5ldHdvcmsucHJlZml4O1xuICAgIHRoaXMuYXBpRW5kcG9pbnQgPSBuZXR3b3JrLmFwaUJhc2VVcmw7XG4gIH1cblxuICBkZW1vbGlzaFdhbGxldFN0YXRlKG5ldHdvcmtQcmVmaXg6IE5ldHdvcmsgPSB0aGlzLm5ldHdvcmspOiB2b2lkIHtcbiAgICB0aGlzLnV0eG9TZXQuY2xlYXIoKTtcbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyID0gbmV3IEFkZHJlc3NNYW5hZ2VyKHRoaXMuSERXYWxsZXQsIG5ldHdvcmtQcmVmaXgpO1xuICAgIHRoaXMucGVuZGluZy50cmFuc2FjdGlvbnMgPSB7fTtcbiAgICB0aGlzLnRyYW5zYWN0aW9ucyA9IFtdO1xuICAgIHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZSA9IHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIERlcml2ZXMgcmVjZWl2ZUFkZHJlc3NlcyBhbmQgY2hhbmdlQWRkcmVzc2VzIGFuZCBjaGVja3MgdGhlaXIgdHJhbnNhY3Rpb25zIGFuZCBVVFhPcy5cbiAgICogQHBhcmFtIHRocmVzaG9sZCBzdG9wIGRpc2NvdmVyaW5nIGFmdGVyIGB0aHJlc2hvbGRgIGFkZHJlc3NlcyB3aXRoIG5vIGFjdGl2aXR5XG4gICAqL1xuICBhc3luYyBhZGRyZXNzRGlzY292ZXJ5KHRocmVzaG9sZCA9IDIwKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZG9EaXNjb3ZlcnkgPSBhc3luYyAoXG4gICAgICBuOiBudW1iZXIsXG4gICAgICBkZXJpdmVUeXBlOiAncmVjZWl2ZScgfCAnY2hhbmdlJyxcbiAgICAgIG9mZnNldDogbnVtYmVyXG4gICAgKTogUHJvbWlzZTxudW1iZXI+ID0+IHtcbiAgICAgIGNvbnN0IGRlcml2ZWRBZGRyZXNzZXMgPSB0aGlzLmFkZHJlc3NNYW5hZ2VyLmdldEFkZHJlc3NlcyhuLCBkZXJpdmVUeXBlLCBvZmZzZXQpO1xuICAgICAgY29uc3QgYWRkcmVzc2VzID0gZGVyaXZlZEFkZHJlc3Nlcy5tYXAoKG9iaikgPT4gb2JqLmFkZHJlc3MpO1xuICAgICAgbG9nZ2VyLmxvZyhcbiAgICAgICAgJ2luZm8nLFxuICAgICAgICBgRmV0Y2hpbmcgJHtkZXJpdmVUeXBlfSBhZGRyZXNzIGRhdGEgZm9yIGRlcml2ZWQgaW5kaWNlcyAke0pTT04uc3RyaW5naWZ5KFxuICAgICAgICAgIGRlcml2ZWRBZGRyZXNzZXMubWFwKChvYmopID0+IG9iai5pbmRleClcbiAgICAgICAgKX1gXG4gICAgICApO1xuICAgICAgY29uc3QgYWRkcmVzc2VzV2l0aFR4ID0gYXdhaXQgdGhpcy51cGRhdGVUcmFuc2FjdGlvbnMoYWRkcmVzc2VzKTtcbiAgICAgIGlmIChhZGRyZXNzZXNXaXRoVHgubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIGFkZHJlc3MgZGlzY292ZXJ5IGNvbXBsZXRlXG4gICAgICAgIGNvbnN0IGxhc3RBZGRyZXNzSW5kZXhXaXRoVHggPSBvZmZzZXQgLSAodGhyZXNob2xkIC0gbikgLSAxO1xuICAgICAgICBsb2dnZXIubG9nKFxuICAgICAgICAgICdpbmZvJyxcbiAgICAgICAgICBgJHtkZXJpdmVUeXBlfUFkZHJlc3MgZGlzY292ZXJ5IGNvbXBsZXRlLiBMYXN0IGFjdGl2aXR5IG9uIGFkZHJlc3MgIyR7bGFzdEFkZHJlc3NJbmRleFdpdGhUeH0uIE5vIGFjdGl2aXR5IGZyb20gJHtkZXJpdmVUeXBlfSMke1xuICAgICAgICAgICAgbGFzdEFkZHJlc3NJbmRleFdpdGhUeCArIDFcbiAgICAgICAgICB9fiR7bGFzdEFkZHJlc3NJbmRleFdpdGhUeCArIHRocmVzaG9sZH0uYFxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gbGFzdEFkZHJlc3NJbmRleFdpdGhUeDtcbiAgICAgIH1cbiAgICAgIC8vIGVsc2Uga2VlcCBkb2luZyBkaXNjb3ZlcnlcbiAgICAgIGNvbnN0IG5BZGRyZXNzZXNMZWZ0ID1cbiAgICAgICAgZGVyaXZlZEFkZHJlc3Nlc1xuICAgICAgICAgIC5maWx0ZXIoKG9iaikgPT4gYWRkcmVzc2VzV2l0aFR4LmluZGV4T2Yob2JqLmFkZHJlc3MpICE9PSAtMSlcbiAgICAgICAgICAucmVkdWNlKChwcmV2LCBjdXIpID0+IE1hdGgubWF4KHByZXYsIGN1ci5pbmRleCksIDApICsgMTtcbiAgICAgIHJldHVybiBkb0Rpc2NvdmVyeShuQWRkcmVzc2VzTGVmdCwgZGVyaXZlVHlwZSwgb2Zmc2V0ICsgbik7XG4gICAgfTtcbiAgICBjb25zdCBoaWdoZXN0UmVjZWl2ZUluZGV4ID0gYXdhaXQgZG9EaXNjb3ZlcnkodGhyZXNob2xkLCAncmVjZWl2ZScsIDApO1xuICAgIGNvbnN0IGhpZ2hlc3RDaGFuZ2VJbmRleCA9IGF3YWl0IGRvRGlzY292ZXJ5KHRocmVzaG9sZCwgJ2NoYW5nZScsIDApO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuYWR2YW5jZShoaWdoZXN0UmVjZWl2ZUluZGV4ICsgMSk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmFkdmFuY2UoaGlnaGVzdENoYW5nZUluZGV4ICsgMSk7XG4gICAgbG9nZ2VyLmxvZyhcbiAgICAgICdpbmZvJyxcbiAgICAgIGByZWNlaXZlIGFkZHJlc3MgaW5kZXg6ICR7aGlnaGVzdFJlY2VpdmVJbmRleH07IGNoYW5nZSBhZGRyZXNzIGluZGV4OiAke2hpZ2hlc3RDaGFuZ2VJbmRleH1gXG4gICAgKTtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVV0eG9zKE9iamVjdC5rZXlzKHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZSkpO1xuICAgIHRoaXMucnVuU3RhdGVDaGFuZ2VIb29rcygpO1xuICB9XG5cbiAgLy8gVE9ETzogY29udmVydCBhbW91bnQgdG8gc29tcGlzIGFrYSBzYXRvc2hpc1xuICAvLyBUT0RPOiBiblxuICAvKipcbiAgICogQ29tcG9zZSBhIHNlcmlhbGl6ZWQsIHNpZ25lZCB0cmFuc2FjdGlvblxuICAgKiBAcGFyYW0gb2JqXG4gICAqIEBwYXJhbSBvYmoudG9BZGRyIFRvIGFkZHJlc3MgaW4gY2FzaGFkZHIgZm9ybWF0IChlLmcuIGthc3BhdGVzdDpxcTBkNmgwcHJqbTVtcGRsZDVwbmNzdDNhZHUweWFtNnhjaDR0cjY5azIpXG4gICAqIEBwYXJhbSBvYmouYW1vdW50IEFtb3VudCB0byBzZW5kIGluIHNvbXBpcyAoMTAwMDAwMDAwICgxZTgpIHNvbXBpcyBpbiAxIEtTUClcbiAgICogQHBhcmFtIG9iai5mZWUgRmVlIGZvciBtaW5lcnMgaW4gc29tcGlzXG4gICAqIEBwYXJhbSBvYmouY2hhbmdlQWRkck92ZXJyaWRlIFVzZSB0aGlzIHRvIG92ZXJyaWRlIGF1dG9tYXRpYyBjaGFuZ2UgYWRkcmVzcyBkZXJpdmF0aW9uXG4gICAqIEB0aHJvd3MgaWYgYW1vdW50IGlzIGFib3ZlIGBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUmBcbiAgICovXG4gIGNvbXBvc2VUeCh7XG4gICAgdG9BZGRyLFxuICAgIGFtb3VudCxcbiAgICBmZWUgPSBERUZBVUxUX0ZFRSxcbiAgICBjaGFuZ2VBZGRyT3ZlcnJpZGUsXG4gIH06IFR4U2VuZCAmIHsgY2hhbmdlQWRkck92ZXJyaWRlPzogc3RyaW5nIH0pOiB7XG4gICAgaWQ6IHN0cmluZztcbiAgICByYXdUeDogc3RyaW5nO1xuICAgIHV0eG9JZHM6IHN0cmluZ1tdO1xuICAgIGFtb3VudDogbnVtYmVyO1xuICB9IHtcbiAgICBpZiAoIU51bWJlci5pc1NhZmVJbnRlZ2VyKGFtb3VudCkpIHRocm93IG5ldyBFcnJvcignQW1vdW50IHRvbyBsYXJnZScpO1xuICAgIGNvbnN0IHsgdXR4b3MsIHV0eG9JZHMgfSA9IHRoaXMudXR4b1NldC5zZWxlY3RVdHhvcyhhbW91bnQgKyBmZWUpO1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBjb25zdCBwcml2S2V5cyA9IHV0eG9zLnJlZHVjZSgocHJldjogc3RyaW5nW10sIGN1cikgPT4ge1xuICAgICAgcmV0dXJuIFt0aGlzLmFkZHJlc3NNYW5hZ2VyLmFsbFtTdHJpbmcoY3VyLmFkZHJlc3MpXSwgLi4ucHJldl07XG4gICAgfSwgW10pO1xuICAgIGNvbnN0IGNoYW5nZUFkZHIgPSBjaGFuZ2VBZGRyT3ZlcnJpZGUgfHwgdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLm5leHQoKTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdHg6IGJpdGNvcmUuVHJhbnNhY3Rpb24gPSBuZXcgYml0Y29yZS5UcmFuc2FjdGlvbigpXG4gICAgICAgIC5mcm9tKHV0eG9zKVxuICAgICAgICAudG8odG9BZGRyLCBhbW91bnQpXG4gICAgICAgIC5zZXRWZXJzaW9uKDEpXG4gICAgICAgIC5mZWUoZmVlKVxuICAgICAgICAuY2hhbmdlKGNoYW5nZUFkZHIpXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgLnNpZ24ocHJpdktleXMsIGJpdGNvcmUuY3J5cHRvLlNpZ25hdHVyZS5TSUdIQVNIX0FMTCwgJ3NjaG5vcnInKTtcbiAgICAgIHRoaXMudXR4b1NldC5pblVzZS5wdXNoKC4uLnV0eG9JZHMpO1xuICAgICAgdGhpcy5wZW5kaW5nLmFkZCh0eC5pZCwgeyByYXdUeDogdHgudG9TdHJpbmcoKSwgdXR4b0lkcywgYW1vdW50LCB0bzogdG9BZGRyLCBmZWUgfSk7XG4gICAgICB0aGlzLnJ1blN0YXRlQ2hhbmdlSG9va3MoKTtcbiAgICAgIHJldHVybiB7IGlkOiB0eC5pZCwgcmF3VHg6IHR4LnRvU3RyaW5nKCksIHV0eG9JZHMsIGFtb3VudDogYW1vdW50ICsgZmVlIH07XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLnJldmVyc2UoKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFNlbmQgYSB0cmFuc2FjdGlvbi4gUmV0dXJucyB0cmFuc2FjdGlvbiBpZC5cbiAgICogQHBhcmFtIHR4UGFyYW1zXG4gICAqIEBwYXJhbSB0eFBhcmFtcy50b0FkZHIgVG8gYWRkcmVzcyBpbiBjYXNoYWRkciBmb3JtYXQgKGUuZy4ga2FzcGF0ZXN0OnFxMGQ2aDBwcmptNW1wZGxkNXBuY3N0M2FkdTB5YW02eGNoNHRyNjlrMilcbiAgICogQHBhcmFtIHR4UGFyYW1zLmFtb3VudCBBbW91bnQgdG8gc2VuZCBpbiBzb21waXMgKDEwMDAwMDAwMCAoMWU4KSBzb21waXMgaW4gMSBLU1ApXG4gICAqIEBwYXJhbSB0eFBhcmFtcy5mZWUgRmVlIGZvciBtaW5lcnMgaW4gc29tcGlzXG4gICAqIEB0aHJvd3MgYEZldGNoRXJyb3JgIGlmIGVuZHBvaW50IGlzIGRvd24uIEFQSSBlcnJvciBtZXNzYWdlIGlmIHR4IGVycm9yLiBFcnJvciBpZiBhbW91bnQgaXMgdG9vIGxhcmdlIHRvIGJlIHJlcHJlc2VudGVkIGFzIGEgamF2YXNjcmlwdCBudW1iZXIuXG4gICAqL1xuICBhc3luYyBzZW5kVHgodHhQYXJhbXM6IFR4U2VuZCk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgY29uc3QgeyBpZCwgcmF3VHggfSA9IHRoaXMuY29tcG9zZVR4KHR4UGFyYW1zKTtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgYXBpLnBvc3RUeChyYXdUeCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhpcy51bmRvUGVuZGluZ1R4KGlkKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIGFzeW5jIHVwZGF0ZVN0YXRlKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGFjdGl2ZUFkZHJzID0gYXdhaXQgdGhpcy51cGRhdGVUcmFuc2FjdGlvbnModGhpcy5hZGRyZXNzTWFuYWdlci5zaG91bGRGZXRjaCk7XG4gICAgYXdhaXQgdGhpcy51cGRhdGVVdHhvcyhhY3RpdmVBZGRycyk7XG4gICAgdGhpcy5ydW5TdGF0ZUNoYW5nZUhvb2tzKCk7XG4gIH1cblxuICB1bmRvUGVuZGluZ1R4KGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCB7IHV0eG9JZHMgfSA9IHRoaXMucGVuZGluZy50cmFuc2FjdGlvbnNbaWRdO1xuICAgIGRlbGV0ZSB0aGlzLnBlbmRpbmcudHJhbnNhY3Rpb25zW2lkXTtcbiAgICB0aGlzLnV0eG9TZXQucmVsZWFzZSh1dHhvSWRzKTtcbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MucmV2ZXJzZSgpO1xuICAgIHRoaXMucnVuU3RhdGVDaGFuZ2VIb29rcygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFmdGVyIHdlIHNlZSB0aGUgdHJhbnNhY3Rpb24gaW4gdGhlIEFQSSByZXN1bHRzLCBkZWxldGUgaXQgZnJvbSBvdXIgcGVuZGluZyBsaXN0LlxuICAgKiBAcGFyYW0gaWQgVGhlIHR4IGhhc2hcbiAgICovXG4gIGRlbGV0ZVBlbmRpbmdUeChpZDogc3RyaW5nKTogdm9pZCB7XG4gICAgLy8gdW5kbyArIGRlbGV0ZSBvbGQgdXR4b3NcbiAgICBjb25zdCB7IHV0eG9JZHMgfSA9IHRoaXMucGVuZGluZy50cmFuc2FjdGlvbnNbaWRdO1xuICAgIGRlbGV0ZSB0aGlzLnBlbmRpbmcudHJhbnNhY3Rpb25zW2lkXTtcbiAgICB0aGlzLnV0eG9TZXQucmVtb3ZlKHV0eG9JZHMpO1xuICB9XG5cbiAgcnVuU3RhdGVDaGFuZ2VIb29rcygpOiB2b2lkIHtcbiAgICB0aGlzLnV0eG9TZXQudXBkYXRlVXR4b0JhbGFuY2UoKTtcbiAgICB0aGlzLnVwZGF0ZUJhbGFuY2UoKTtcbiAgfVxuXG4gIGdldCBjYWNoZSgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgcGVuZGluZ1R4OiB0aGlzLnBlbmRpbmcudHJhbnNhY3Rpb25zLFxuICAgICAgdXR4b3M6IHtcbiAgICAgICAgdXR4b1N0b3JhZ2U6IHRoaXMudXR4b1NldC51dHhvU3RvcmFnZSxcbiAgICAgICAgaW5Vc2U6IHRoaXMudXR4b1NldC5pblVzZSxcbiAgICAgIH0sXG4gICAgICB0cmFuc2FjdGlvbnNTdG9yYWdlOiB0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2UsXG4gICAgICBhZGRyZXNzZXM6IHtcbiAgICAgICAgcmVjZWl2ZUNvdW50ZXI6IHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuY291bnRlcixcbiAgICAgICAgY2hhbmdlQ291bnRlcjogdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmNvdW50ZXIsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICByZXN0b3JlQ2FjaGUoY2FjaGU6IFdhbGxldENhY2hlKTogdm9pZCB7XG4gICAgdGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9ucyA9IGNhY2hlLnBlbmRpbmdUeDtcbiAgICB0aGlzLnV0eG9TZXQudXR4b1N0b3JhZ2UgPSBjYWNoZS51dHhvcy51dHhvU3RvcmFnZTtcbiAgICB0aGlzLnV0eG9TZXQuaW5Vc2UgPSBjYWNoZS51dHhvcy5pblVzZTtcbiAgICBPYmplY3QuZW50cmllcyh0aGlzLnV0eG9TZXQudXR4b1N0b3JhZ2UpLmZvckVhY2goKFthZGRyLCB1dHhvc106IFtzdHJpbmcsIEFwaS5VdHhvW11dKSA9PiB7XG4gICAgICB0aGlzLnV0eG9TZXQuYWRkKHV0eG9zLCBhZGRyKTtcbiAgICB9KTtcbiAgICB0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2UgPSBjYWNoZS50cmFuc2FjdGlvbnNTdG9yYWdlO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIuZ2V0QWRkcmVzc2VzKGNhY2hlLmFkZHJlc3Nlcy5yZWNlaXZlQ291bnRlciArIDEsICdyZWNlaXZlJyk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5nZXRBZGRyZXNzZXMoY2FjaGUuYWRkcmVzc2VzLmNoYW5nZUNvdW50ZXIgKyAxLCAnY2hhbmdlJyk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5hZHZhbmNlKGNhY2hlLmFkZHJlc3Nlcy5yZWNlaXZlQ291bnRlciAtIDEpO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5hZHZhbmNlKGNhY2hlLmFkZHJlc3Nlcy5jaGFuZ2VDb3VudGVyKTtcbiAgICAvLyBAdHMtaWdub3JlXG4gICAgdGhpcy50cmFuc2FjdGlvbnMgPSB0eFBhcnNlcih0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2UsIE9iamVjdC5rZXlzKHRoaXMuYWRkcmVzc01hbmFnZXIuYWxsKSk7XG4gICAgdGhpcy5ydW5TdGF0ZUNoYW5nZUhvb2tzKCk7XG4gIH1cblxuICAvKipcbiAgICogIENvbnZlcnRzIGEgbW5lbW9uaWMgdG8gYSBuZXcgd2FsbGV0LlxuICAgKiBAcGFyYW0gc2VlZFBocmFzZSBUaGUgMTIgd29yZCBzZWVkIHBocmFzZS5cbiAgICogQHJldHVybnMgbmV3IFdhbGxldFxuICAgKi9cbiAgc3RhdGljIGZyb21NbmVtb25pYyhzZWVkUGhyYXNlOiBzdHJpbmcpOiBXYWxsZXQge1xuICAgIGNvbnN0IHByaXZLZXkgPSBuZXcgTW5lbW9uaWMoc2VlZFBocmFzZS50cmltKCkpLnRvSERQcml2YXRlS2V5KCkudG9TdHJpbmcoKTtcbiAgICBjb25zdCB3YWxsZXQgPSBuZXcgdGhpcyhwcml2S2V5LCBzZWVkUGhyYXNlKTtcbiAgICByZXR1cm4gd2FsbGV0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgV2FsbGV0IGZyb20gZW5jcnlwdGVkIHdhbGxldCBkYXRhLlxuICAgKiBAcGFyYW0gcGFzc3dvcmQgdGhlIHBhc3N3b3JkIHRoZSB1c2VyIGVuY3J5cHRlZCB0aGVpciBzZWVkIHBocmFzZSB3aXRoXG4gICAqIEBwYXJhbSBlbmNyeXB0ZWRNbmVtb25pYyB0aGUgZW5jcnlwdGVkIHNlZWQgcGhyYXNlIGZyb20gbG9jYWwgc3RvcmFnZVxuICAgKiBAdGhyb3dzIFdpbGwgdGhyb3cgXCJJbmNvcnJlY3QgcGFzc3dvcmRcIiBpZiBwYXNzd29yZCBpcyB3cm9uZ1xuICAgKi9cbiAgc3RhdGljIGFzeW5jIGltcG9ydChwYXNzd29yZDogc3RyaW5nLCBlbmNyeXB0ZWRNbmVtb25pYzogc3RyaW5nKTogUHJvbWlzZTxXYWxsZXQ+IHtcbiAgICBjb25zdCBkZWNyeXB0ZWQgPSBhd2FpdCBwYXNzd29yZGVyLmRlY3J5cHQocGFzc3dvcmQsIGVuY3J5cHRlZE1uZW1vbmljKTtcbiAgICBjb25zdCBzYXZlZFdhbGxldCA9IEpTT04ucGFyc2UoQnVmZmVyLmZyb20oZGVjcnlwdGVkKS50b1N0cmluZygndXRmOCcpKSBhcyBXYWxsZXRTYXZlO1xuICAgIGNvbnN0IG15V2FsbGV0ID0gbmV3IHRoaXMoc2F2ZWRXYWxsZXQucHJpdktleSwgc2F2ZWRXYWxsZXQuc2VlZFBocmFzZSk7XG4gICAgcmV0dXJuIG15V2FsbGV0O1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlcyBlbmNyeXB0ZWQgd2FsbGV0IGRhdGEuXG4gICAqIEBwYXJhbSBwYXNzd29yZCB1c2VyJ3MgY2hvc2VuIHBhc3N3b3JkXG4gICAqIEByZXR1cm5zIFByb21pc2UgdGhhdCByZXNvbHZlcyB0byBvYmplY3QtbGlrZSBzdHJpbmcuIFN1Z2dlc3RlZCB0byBzdG9yZSBhcyBzdHJpbmcgZm9yIC5pbXBvcnQoKS5cbiAgICovXG4gIGFzeW5jIGV4cG9ydChwYXNzd29yZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBzYXZlZFdhbGxldDogV2FsbGV0U2F2ZSA9IHtcbiAgICAgIHByaXZLZXk6IHRoaXMuSERXYWxsZXQudG9TdHJpbmcoKSxcbiAgICAgIHNlZWRQaHJhc2U6IHRoaXMubW5lbW9uaWMsXG4gICAgfTtcbiAgICByZXR1cm4gcGFzc3dvcmRlci5lbmNyeXB0KHBhc3N3b3JkLCBCdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShzYXZlZFdhbGxldCksICd1dGY4JykpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFdhbGxldDtcbiJdfQ==