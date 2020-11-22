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
     * Queries API for address[] UTXOs. Adds tx to transactions storage. Also sorts the entire transaction set.
     * @param addresses
     */
    findUtxos(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.log('info', `Getting UTXOs for ${addresses.length} addresses.`);
            const addressesWithUTXOs = [];
            const utxoResults = yield Promise.all(addresses.map((address) => api.getUtxos(address)));
            addresses.forEach((address, i) => {
                const { utxos } = utxoResults[i];
                console.log("utxos", utxos);
                logger_1.logger.log('info', `${address}: ${utxos.length} utxos found.`);
                if (utxos.length !== 0) {
                    //const confirmedTx = utxos.filter((tx:Api.Utxo) => tx.confirmations > 0);
                    this.utxoSet.utxoStorage[address] = utxos;
                    this.utxoSet.add(utxos, address);
                    addressesWithUTXOs.push(address);
                }
            });
            /*/ @ts-ignore
            this.transactions = txParser(this.transactionsStorage, Object.keys(this.addressManager.all));
            const pendingTxHashes = Object.keys(this.pending.transactions);
            if (pendingTxHashes.length > 0) {
              pendingTxHashes.forEach((hash) => {
                if (this.transactions.map((tx) => tx.transactionHash).includes(hash)) {
                  this.deletePendingTx(hash);
                }
              });
            }
            */
            const isActivityOnReceiveAddr = this.utxoSet.utxoStorage[this.addressManager.receiveAddress.current.address] !== undefined;
            if (isActivityOnReceiveAddr) {
                this.addressManager.receiveAddress.next();
            }
            return addressesWithUTXOs;
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
     
    async addressDiscovery(threshold = 20): Promise<void> {
      const doDiscovery = async (
        n: number,
        deriveType: 'receive' | 'change',
        offset: number
      ): Promise<number> => {
        const derivedAddresses = this.addressManager.getAddresses(n, deriveType, offset);
        const addresses = derivedAddresses.map((obj) => obj.address);
        logger.log(
          'info',
          `Fetching ${deriveType} address data for derived indices ${JSON.stringify(
            derivedAddresses.map((obj) => obj.index)
          )}`
        );
        const addressesWithTx = await this.updateTransactions(addresses);
        if (addressesWithTx.length === 0) {
          // address discovery complete
          const lastAddressIndexWithTx = offset - (threshold - n) - 1;
          logger.log(
            'info',
            `${deriveType}Address discovery complete. Last activity on address #${lastAddressIndexWithTx}. No activity from ${deriveType}#${
              lastAddressIndexWithTx + 1
            }~${lastAddressIndexWithTx + threshold}.`
          );
          return lastAddressIndexWithTx;
        }
        // else keep doing discovery
        const nAddressesLeft =
          derivedAddresses
            .filter((obj) => addressesWithTx.indexOf(obj.address) !== -1)
            .reduce((prev, cur) => Math.max(prev, cur.index), 0) + 1;
        return doDiscovery(nAddressesLeft, deriveType, offset + n);
      };
      const highestReceiveIndex = await doDiscovery(threshold, 'receive', 0);
      const highestChangeIndex = await doDiscovery(threshold, 'change', 0);
      this.addressManager.receiveAddress.advance(highestReceiveIndex + 1);
      this.addressManager.changeAddress.advance(highestChangeIndex + 1);
      logger.log(
        'info',
        `receive address index: ${highestReceiveIndex}; change address index: ${highestChangeIndex}`
      );
      await this.updateUtxos(Object.keys(this.transactionsStorage));
      this.runStateChangeHooks();
    }
    */
    /**
     * Derives receiveAddresses and changeAddresses and checks their transactions and UTXOs.
     * @param threshold stop discovering after `threshold` addresses with no activity
     */
    addressDiscovery(threshold = 20) {
        return __awaiter(this, void 0, void 0, function* () {
            let addressList = [];
            let lastIndex = -1;
            const doDiscovery = (n, deriveType, offset) => __awaiter(this, void 0, void 0, function* () {
                const derivedAddresses = this.addressManager.getAddresses(n, deriveType, offset);
                const addresses = derivedAddresses.map((obj) => obj.address);
                addressList = [...addressList, ...addresses];
                logger_1.logger.log('info', `Fetching ${deriveType} address data for derived indices ${JSON.stringify(derivedAddresses.map((obj) => obj.index))}`);
                const addressesWithUTXOs = yield this.findUtxos(addresses);
                if (addressesWithUTXOs.length === 0) {
                    // address discovery complete
                    const lastAddressIndexWithTx = offset - (threshold - n) - 1;
                    logger_1.logger.log('info', `${deriveType}Address discovery complete. Last activity on address #${lastAddressIndexWithTx}. No activity from ${deriveType}#${lastAddressIndexWithTx + 1}~${lastAddressIndexWithTx + threshold}.`);
                    return lastAddressIndexWithTx;
                }
                // else keep doing discovery
                const nAddressesLeft = derivedAddresses
                    .filter((obj) => addressesWithUTXOs.includes(obj.address))
                    .reduce((prev, cur) => Math.max(prev, cur.index), 0) + 1;
                return doDiscovery(nAddressesLeft, deriveType, offset + n);
            });
            const highestReceiveIndex = yield doDiscovery(threshold, 'receive', 0);
            const highestChangeIndex = yield doDiscovery(threshold, 'change', 0);
            this.addressManager.receiveAddress.advance(highestReceiveIndex + 1);
            this.addressManager.changeAddress.advance(highestChangeIndex + 1);
            logger_1.logger.log('info', `receive address index: ${highestReceiveIndex}; change address index: ${highestChangeIndex}`);
            //await this.updateUtxos(Object.keys(this.transactionsStorage));
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
            const savedWallet = JSON.parse(decrypted);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiV2FsbGV0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vd2FsbGV0L1dhbGxldC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0FBQzdDLGFBQWE7QUFDYiw0Q0FBNEM7QUFDNUMsYUFBYTtBQUViLGtEQUFrRDtBQUNsRCx5REFBeUQ7QUFDekQsSUFBSSxVQUFrRCxDQUFDO0FBQ3ZELGFBQWE7QUFDYixJQUFHLE9BQU8sTUFBTSxJQUFJLFdBQVcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUM7SUFDNUMsVUFBVSxHQUFHLFdBQVcsQ0FBQztDQUMxQjtLQUFJO0lBQ0gsVUFBVSxHQUFHLFdBQVcsQ0FBQztDQUMxQjtBQVlELDRDQUF5QztBQUN6QyxxREFBa0Q7QUFDbEQsdUNBQW9DO0FBQ3BDLG9DQUFvQztBQUNwQyx5Q0FBc0M7QUFDdEMsZ0RBQThEO0FBRTlELG9FQUFvRTtBQUNwRSxNQUFNLE1BQU07SUFnRVY7Ozs7T0FJRztJQUNILFlBQVksT0FBZ0IsRUFBRSxVQUFtQjtRQTlEakQ7O1dBRUc7UUFDSCxZQUFPLEdBQXVCLFNBQVMsQ0FBQztRQVN4Qzs7V0FFRztRQUNILGFBQWE7UUFDYixZQUFPLEdBQVksNkJBQWUsQ0FBQyxNQUFpQixDQUFDO1FBRXJEOztXQUVHO1FBQ0gsZ0JBQVcsR0FBRyw2QkFBZSxDQUFDLFVBQVUsQ0FBQztRQU96QyxZQUFPLEdBQUcsSUFBSSxpQkFBTyxFQUFFLENBQUM7UUFJeEIsb0JBQW9CO1FBQ3BCLFlBQU8sR0FBd0I7WUFDN0IsWUFBWSxFQUFFLEVBQUU7WUFDaEIsSUFBSSxNQUFNO2dCQUNSLE1BQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUN0RCxJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQztvQkFBRSxPQUFPLENB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QyxPQUFPLEVBQUUsV0FBVyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sUUFBUSxDQUFDO1FBQ2xCLENBQUM7S0FBQTtJQUVEOzs7O09BSUc7SUFDRyxNQUFNLENBQUMsUUFBZ0I7O1lBQzNCLE1BQU0sV0FBVyxHQUFlO2dCQUM5QixPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEVBQUU7Z0JBQ2pDLFVBQVUsRUFBRSxJQUFJLENBQUMsUUFBUTthQUMxQixDQUFDO1lBQ0YsT0FBTyxVQUFVLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7UUFDbkUsQ0FBQztLQUFBO0NBQ0Y7QUFFRCxrQkFBZSxNQUFNLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBNbmVtb25pYyA9IHJlcXVpcmUoJ2JpdGNvcmUtbW5lbW9uaWMnKTtcbi8vIEB0cy1pZ25vcmVcbmltcG9ydCAqIGFzIGJpdGNvcmUgZnJvbSAnYml0Y29yZS1saWItY2FzaCc7XG4vLyBAdHMtaWdub3JlXG5cbmltcG9ydCAqIGFzIHBhc3N3b3JkZXIxIGZyb20gJ2Jyb3dzZXItcGFzc3dvcmRlcic7XG5pbXBvcnQgKiBhcyBwYXNzd29yZGVyMiBmcm9tICdAYXNwZWN0cm9uL2Zsb3cta2V5LWNyeXB0JztcbmxldCBwYXNzd29yZGVyOnR5cGVvZiBwYXNzd29yZGVyMSB8IHR5cGVvZiBwYXNzd29yZGVyMjtcbi8vIEB0cy1pZ25vcmVcbmlmKHR5cGVvZiB3aW5kb3cgIT0gXCJ1bmRlZmluZWRcIiAmJiAhd2luZG93Lm53KXtcbiAgcGFzc3dvcmRlciA9IHBhc3N3b3JkZXIxO1xufWVsc2V7XG4gIHBhc3N3b3JkZXIgPSBwYXNzd29yZGVyMjtcbn1cblxuaW1wb3J0IHsgQnVmZmVyIH0gZnJvbSAnc2FmZS1idWZmZXInO1xuaW1wb3J0IHtcbiAgTmV0d29yayxcbiAgU2VsZWN0ZWROZXR3b3JrLFxuICBXYWxsZXRTYXZlLFxuICBBcGksXG4gIFR4U2VuZCxcbiAgUGVuZGluZ1RyYW5zYWN0aW9ucyxcbiAgV2FsbGV0Q2FjaGUsIElSUENcbn0gZnJvbSAnLi4vdHlwZXMvY3VzdG9tLXR5cGVzJztcbmltcG9ydCB7IGxvZ2dlciB9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgeyBBZGRyZXNzTWFuYWdlciB9IGZyb20gJy4vQWRkcmVzc01hbmFnZXInO1xuaW1wb3J0IHsgVXR4b1NldCB9IGZyb20gJy4vVXR4b1NldCc7XG5pbXBvcnQgKiBhcyBhcGkgZnJvbSAnLi9hcGlIZWxwZXJzJztcbmltcG9ydCB7IHR4UGFyc2VyIH0gZnJvbSAnLi90eFBhcnNlcic7XG5pbXBvcnQgeyBERUZBVUxUX0ZFRSwgREVGQVVMVF9ORVRXT1JLIH0gZnJvbSAnLi4vY29uZmlnLmpzb24nO1xuXG4vKiogQ2xhc3MgcmVwcmVzZW50aW5nIGFuIEhEV2FsbGV0IHdpdGggZGVyaXZhYmxlIGNoaWxkIGFkZHJlc3NlcyAqL1xuY2xhc3MgV2FsbGV0IHtcblxuICAvL3N0YXRpYyBwYXNzd29yZGVyMTphbnkgPSBwYXNzd29yZGVyMTtcbiAgLy9zdGF0aWMgcGFzc3dvcmRlcjI6YW55ID0gcGFzc3dvcmRlcjI7XG5cbiAgSERXYWxsZXQ6IGJpdGNvcmUuSERQcml2YXRlS2V5O1xuXG4gIC8qKlxuICAgKiBUaGUgc3VtbWVkIGJhbGFuY2UgYWNyb3NzIGFsbCBvZiBXYWxsZXQncyBkaXNjb3ZlcmVkIGFkZHJlc3NlcywgbWludXMgYW1vdW50IGZyb20gcGVuZGluZyB0cmFuc2FjdGlvbnMuXG4gICAqL1xuICBiYWxhbmNlOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqIFNldCBieSBhZGRyZXNzTWFuYWdlclxuICAgKi9cbiAgZ2V0IHJlY2VpdmVBZGRyZXNzKCkge1xuICAgIHJldHVybiB0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmN1cnJlbnQuYWRkcmVzcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDdXJyZW50IG5ldHdvcmsuXG4gICAqL1xuICAvLyBAdHMtaWdub3JlXG4gIG5ldHdvcms6IE5ldHdvcmsgPSBERUZBVUxUX05FVFdPUksucHJlZml4IGFzIE5ldHdvcms7XG5cbiAgLyoqXG4gICAqIEN1cnJlbnQgQVBJIGVuZHBvaW50IGZvciBzZWxlY3RlZCBuZXR3b3JrXG4gICAqL1xuICBhcGlFbmRwb2ludCA9IERFRkFVTFRfTkVUV09SSy5hcGlCYXNlVXJsO1xuXG4gIC8qKlxuICAgKiBBIDEyIHdvcmQgbW5lbW9uaWMuXG4gICAqL1xuICBtbmVtb25pYzogc3RyaW5nO1xuXG4gIHV0eG9TZXQgPSBuZXcgVXR4b1NldCgpO1xuXG4gIGFkZHJlc3NNYW5hZ2VyOiBBZGRyZXNzTWFuYWdlcjtcblxuICAvKiBlc2xpbnQtZGlzYWJsZSAqL1xuICBwZW5kaW5nOiBQZW5kaW5nVHJhbnNhY3Rpb25zID0ge1xuICAgIHRyYW5zYWN0aW9uczoge30sXG4gICAgZ2V0IGFtb3VudCgpIHtcbiAgICAgIGNvbnN0IHRyYW5zYWN0aW9ucyA9IE9iamVjdC52YWx1ZXModGhpcy50cmFuc2FjdGlvbnMpO1xuICAgICAgaWYgKHRyYW5zYWN0aW9ucy5sZW5ndGggPT09IDApIHJldHVybiAwO1xuICAgICAgcmV0dXJuIHRyYW5zYWN0aW9ucy5yZWR1Y2UoKHByZXYsIGN1cikgPT4gcHJldiArIGN1ci5hbW91bnQgKyBjdXIuZmVlLCAwKTtcbiAgICB9LFxuICAgIGFkZChcbiAgICAgIGlkOiBzdHJpbmcsXG4gICAgICB0eDogeyB0bzogc3RyaW5nOyB1dHhvSWRzOiBzdHJpbmdbXTsgcmF3VHg6IHN0cmluZzsgYW1vdW50OiBudW1iZXI7IGZlZTogbnVtYmVyIH1cbiAgICApIHtcbiAgICAgIHRoaXMudHJhbnNhY3Rpb25zW2lkXSA9IHR4O1xuICAgIH0sXG4gIH07XG4gIC8qKlxuICAgKiBUcmFuc2FjdGlvbnMgc29ydGVkIGJ5IGhhc2guXG4gICAqL1xuICB0cmFuc2FjdGlvbnM6IEFwaS5UcmFuc2FjdGlvbltdID0gW107XG5cbiAgLyoqXG4gICAqIFRyYW5zYWN0aW9uIGFycmF5cyBrZXllZCBieSBhZGRyZXNzLlxuICAgKi9cbiAgdHJhbnNhY3Rpb25zU3RvcmFnZTogUmVjb3JkPHN0cmluZywgQXBpLlRyYW5zYWN0aW9uW10+ID0ge307XG5cbiAgLyoqIENyZWF0ZSBhIHdhbGxldC5cbiAgICogQHBhcmFtIHdhbGxldFNhdmUgKG9wdGlvbmFsKVxuICAgKiBAcGFyYW0gd2FsbGV0U2F2ZS5wcml2S2V5IFNhdmVkIHdhbGxldCdzIHByaXZhdGUga2V5LlxuICAgKiBAcGFyYW0gd2FsbGV0U2F2ZS5zZWVkUGhyYXNlIFNhdmVkIHdhbGxldCdzIHNlZWQgcGhyYXNlLlxuICAgKi9cbiAgY29uc3RydWN0b3IocHJpdktleT86IHN0cmluZywgc2VlZFBocmFzZT86IHN0cmluZykge1xuICAgIGlmIChwcml2S2V5ICYmIHNlZWRQaHJhc2UpIHtcbiAgICAgIHRoaXMuSERXYWxsZXQgPSBuZXcgYml0Y29yZS5IRFByaXZhdGVLZXkocHJpdktleSk7XG4gICAgICB0aGlzLm1uZW1vbmljID0gc2VlZFBocmFzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdGVtcCA9IG5ldyBNbmVtb25pYyhNbmVtb25pYy5Xb3Jkcy5FTkdMSVNIKTtcbiAgICAgIHRoaXMubW5lbW9uaWMgPSB0ZW1wLnRvU3RyaW5nKCk7XG4gICAgICB0aGlzLkhEV2FsbGV0ID0gbmV3IGJpdGNvcmUuSERQcml2YXRlS2V5KHRlbXAudG9IRFByaXZhdGVLZXkoKS50b1N0cmluZygpKTtcbiAgICB9XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlciA9IG5ldyBBZGRyZXNzTWFuYWdlcih0aGlzLkhEV2FsbGV0LCB0aGlzLm5ldHdvcmspO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MubmV4dCgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCBycGMgcHJvdmlkZXJcbiAgICogQHBhcmFtIHJwY1xuICAgKi9cbiAgc3RhdGljIHNldFJQQyhycGM6SVJQQyl7XG4gICAgYXBpLnNldFJQQyhycGMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFF1ZXJpZXMgQVBJIGZvciBhZGRyZXNzW10gVVRYT3MuIEFkZHMgVVRYT3MgdG8gVVRYTyBzZXQuIFVwZGF0ZXMgd2FsbGV0IGJhbGFuY2UuXG4gICAqIEBwYXJhbSBhZGRyZXNzZXNcbiAgICovXG4gIGFzeW5jIHVwZGF0ZVV0eG9zKGFkZHJlc3Nlczogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBsb2dnZXIubG9nKCdpbmZvJywgYEdldHRpbmcgdXR4b3MgZm9yICR7YWRkcmVzc2VzLmxlbmd0aH0gYWRkcmVzc2VzLmApO1xuICAgIGNvbnN0IHV0eG9SZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBhZGRyZXNzZXMubWFwKChhZGRyZXNzKSA9PiBhcGkuZ2V0VXR4b3MoYWRkcmVzcykpXG4gICAgKTtcbiAgICBhZGRyZXNzZXMuZm9yRWFjaCgoYWRkcmVzcywgaSkgPT4ge1xuICAgICAgY29uc3QgeyB1dHhvcyB9ID0gdXR4b1Jlc3VsdHNbaV07XG4gICAgICBsb2dnZXIubG9nKCdpbmZvJywgYCR7YWRkcmVzc306ICR7dXR4b3MubGVuZ3RofSB0b3RhbCBVVFhPcyBmb3VuZC5gKTtcbiAgICAgIHRoaXMudXR4b1NldC51dHhvU3RvcmFnZVthZGRyZXNzXSA9IHV0eG9zO1xuICAgICAgdGhpcy51dHhvU2V0LmFkZCh1dHhvcywgYWRkcmVzcyk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUXVlcmllcyBBUEkgZm9yIGFkZHJlc3NbXSB0cmFuc2FjdGlvbnMuIEFkZHMgdHggdG8gdHJhbnNhY3Rpb25zIHN0b3JhZ2UuIEFsc28gc29ydHMgdGhlIGVudGlyZSB0cmFuc2FjdGlvbiBzZXQuXG4gICAqIEBwYXJhbSBhZGRyZXNzZXNcbiAgICovXG4gIGFzeW5jIHVwZGF0ZVRyYW5zYWN0aW9ucyhhZGRyZXNzZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGxvZ2dlci5sb2coJ2luZm8nLCBgR2V0dGluZyB0cmFuc2FjdGlvbnMgZm9yICR7YWRkcmVzc2VzLmxlbmd0aH0gYWRkcmVzc2VzLmApO1xuICAgIGNvbnN0IGFkZHJlc3Nlc1dpdGhUeDogc3RyaW5nW10gPSBbXTtcbiAgICBjb25zdCB0eFJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgIGFkZHJlc3Nlcy5tYXAoKGFkZHJlc3MpID0+IGFwaS5nZXRUcmFuc2FjdGlvbnMoYWRkcmVzcykpXG4gICAgKTtcbiAgICBhZGRyZXNzZXMuZm9yRWFjaCgoYWRkcmVzcywgaSkgPT4ge1xuICAgICAgY29uc3QgeyB0cmFuc2FjdGlvbnMgfSA9IHR4UmVzdWx0c1tpXTtcbiAgICAgIGxvZ2dlci5sb2coJ2luZm8nLCBgJHthZGRyZXNzfTogJHt0cmFuc2FjdGlvbnMubGVuZ3RofSB0cmFuc2FjdGlvbnMgZm91bmQuYCk7XG4gICAgICBpZiAodHJhbnNhY3Rpb25zLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICBjb25zdCBjb25maXJtZWRUeCA9IHRyYW5zYWN0aW9ucy5maWx0ZXIoKHR4OkFwaS5UcmFuc2FjdGlvbikgPT4gdHguY29uZmlybWF0aW9ucyA+IDApO1xuICAgICAgICB0aGlzLnRyYW5zYWN0aW9uc1N0b3JhZ2VbYWRkcmVzc10gPSBjb25maXJtZWRUeDtcbiAgICAgICAgYWRkcmVzc2VzV2l0aFR4LnB1c2goYWRkcmVzcyk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIHRoaXMudHJhbnNhY3Rpb25zID0gdHhQYXJzZXIodGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlLCBPYmplY3Qua2V5cyh0aGlzLmFkZHJlc3NNYW5hZ2VyLmFsbCkpO1xuICAgIGNvbnN0IHBlbmRpbmdUeEhhc2hlcyA9IE9iamVjdC5rZXlzKHRoaXMucGVuZGluZy50cmFuc2FjdGlvbnMpO1xuICAgIGlmIChwZW5kaW5nVHhIYXNoZXMubGVuZ3RoID4gMCkge1xuICAgICAgcGVuZGluZ1R4SGFzaGVzLmZvckVhY2goKGhhc2gpID0+IHtcbiAgICAgICAgaWYgKHRoaXMudHJhbnNhY3Rpb25zLm1hcCgodHgpID0+IHR4LnRyYW5zYWN0aW9uSGFzaCkuaW5jbHVkZXMoaGFzaCkpIHtcbiAgICAgICAgICB0aGlzLmRlbGV0ZVBlbmRpbmdUeChoYXNoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIGNvbnN0IGlzQWN0aXZpdHlPblJlY2VpdmVBZGRyID1cbiAgICAgIHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZVt0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmN1cnJlbnQuYWRkcmVzc10gIT09IHVuZGVmaW5lZDtcbiAgICBpZiAoaXNBY3Rpdml0eU9uUmVjZWl2ZUFkZHIpIHtcbiAgICAgIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MubmV4dCgpO1xuICAgIH1cbiAgICByZXR1cm4gYWRkcmVzc2VzV2l0aFR4O1xuICB9XG5cbiAgLyoqXG4gICAqIFF1ZXJpZXMgQVBJIGZvciBhZGRyZXNzW10gVVRYT3MuIEFkZHMgdHggdG8gdHJhbnNhY3Rpb25zIHN0b3JhZ2UuIEFsc28gc29ydHMgdGhlIGVudGlyZSB0cmFuc2FjdGlvbiBzZXQuXG4gICAqIEBwYXJhbSBhZGRyZXNzZXNcbiAgICovXG4gIGFzeW5jIGZpbmRVdHhvcyhhZGRyZXNzZXM6IHN0cmluZ1tdKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGxvZ2dlci5sb2coJ2luZm8nLCBgR2V0dGluZyBVVFhPcyBmb3IgJHthZGRyZXNzZXMubGVuZ3RofSBhZGRyZXNzZXMuYCk7XG4gICAgY29uc3QgYWRkcmVzc2VzV2l0aFVUWE9zOiBzdHJpbmdbXSA9IFtdO1xuICAgIGNvbnN0IHV0eG9SZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBhZGRyZXNzZXMubWFwKChhZGRyZXNzKSA9PiBhcGkuZ2V0VXR4b3MoYWRkcmVzcykpXG4gICAgKTtcbiAgICBhZGRyZXNzZXMuZm9yRWFjaCgoYWRkcmVzcywgaSkgPT4ge1xuICAgICAgY29uc3QgeyB1dHhvcyB9ID0gdXR4b1Jlc3VsdHNbaV07XG4gICAgICBjb25zb2xlLmxvZyhcInV0eG9zXCIsIHV0eG9zKVxuICAgICAgbG9nZ2VyLmxvZygnaW5mbycsIGAke2FkZHJlc3N9OiAke3V0eG9zLmxlbmd0aH0gdXR4b3MgZm91bmQuYCk7XG4gICAgICBpZiAodXR4b3MubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgIC8vY29uc3QgY29uZmlybWVkVHggPSB1dHhvcy5maWx0ZXIoKHR4OkFwaS5VdHhvKSA9PiB0eC5jb25maXJtYXRpb25zID4gMCk7XG4gICAgICAgIHRoaXMudXR4b1NldC51dHhvU3RvcmFnZVthZGRyZXNzXSA9IHV0eG9zO1xuICAgICAgICB0aGlzLnV0eG9TZXQuYWRkKHV0eG9zLCBhZGRyZXNzKTtcbiAgICAgICAgYWRkcmVzc2VzV2l0aFVUWE9zLnB1c2goYWRkcmVzcyk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgLyovIEB0cy1pZ25vcmVcbiAgICB0aGlzLnRyYW5zYWN0aW9ucyA9IHR4UGFyc2VyKHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZSwgT2JqZWN0LmtleXModGhpcy5hZGRyZXNzTWFuYWdlci5hbGwpKTtcbiAgICBjb25zdCBwZW5kaW5nVHhIYXNoZXMgPSBPYmplY3Qua2V5cyh0aGlzLnBlbmRpbmcudHJhbnNhY3Rpb25zKTtcbiAgICBpZiAocGVuZGluZ1R4SGFzaGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHBlbmRpbmdUeEhhc2hlcy5mb3JFYWNoKChoYXNoKSA9PiB7XG4gICAgICAgIGlmICh0aGlzLnRyYW5zYWN0aW9ucy5tYXAoKHR4KSA9PiB0eC50cmFuc2FjdGlvbkhhc2gpLmluY2x1ZGVzKGhhc2gpKSB7XG4gICAgICAgICAgdGhpcy5kZWxldGVQZW5kaW5nVHgoaGFzaCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICAqL1xuICAgIGNvbnN0IGlzQWN0aXZpdHlPblJlY2VpdmVBZGRyID1cbiAgICAgIHRoaXMudXR4b1NldC51dHhvU3RvcmFnZVt0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmN1cnJlbnQuYWRkcmVzc10gIT09IHVuZGVmaW5lZDtcbiAgICBpZiAoaXNBY3Rpdml0eU9uUmVjZWl2ZUFkZHIpIHtcbiAgICAgIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MubmV4dCgpO1xuICAgIH1cbiAgICByZXR1cm4gYWRkcmVzc2VzV2l0aFVUWE9zO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlY2FsY3VsYXRlcyB3YWxsZXQgYmFsYW5jZS5cbiAgICovXG4gIHVwZGF0ZUJhbGFuY2UoKTogdm9pZCB7XG4gICAgdGhpcy5iYWxhbmNlID0gdGhpcy51dHhvU2V0LnRvdGFsQmFsYW5jZSAtIHRoaXMucGVuZGluZy5hbW91bnQ7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlcyB0aGUgc2VsZWN0ZWQgbmV0d29ya1xuICAgKiBAcGFyYW0gbmV0d29yayBuYW1lIG9mIHRoZSBuZXR3b3JrXG4gICAqL1xuICBhc3luYyB1cGRhdGVOZXR3b3JrKG5ldHdvcms6IFNlbGVjdGVkTmV0d29yayk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuZGVtb2xpc2hXYWxsZXRTdGF0ZShuZXR3b3JrLnByZWZpeCk7XG4gICAgdGhpcy5uZXR3b3JrID0gbmV0d29yay5wcmVmaXg7XG4gICAgdGhpcy5hcGlFbmRwb2ludCA9IG5ldHdvcmsuYXBpQmFzZVVybDtcbiAgfVxuXG4gIGRlbW9saXNoV2FsbGV0U3RhdGUobmV0d29ya1ByZWZpeDogTmV0d29yayA9IHRoaXMubmV0d29yayk6IHZvaWQge1xuICAgIHRoaXMudXR4b1NldC5jbGVhcigpO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIgPSBuZXcgQWRkcmVzc01hbmFnZXIodGhpcy5IRFdhbGxldCwgbmV0d29ya1ByZWZpeCk7XG4gICAgdGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9ucyA9IHt9O1xuICAgIHRoaXMudHJhbnNhY3Rpb25zID0gW107XG4gICAgdGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlID0ge307XG4gIH1cblxuICAvKipcbiAgICogRGVyaXZlcyByZWNlaXZlQWRkcmVzc2VzIGFuZCBjaGFuZ2VBZGRyZXNzZXMgYW5kIGNoZWNrcyB0aGVpciB0cmFuc2FjdGlvbnMgYW5kIFVUWE9zLlxuICAgKiBAcGFyYW0gdGhyZXNob2xkIHN0b3AgZGlzY292ZXJpbmcgYWZ0ZXIgYHRocmVzaG9sZGAgYWRkcmVzc2VzIHdpdGggbm8gYWN0aXZpdHlcbiAgIFxuICBhc3luYyBhZGRyZXNzRGlzY292ZXJ5KHRocmVzaG9sZCA9IDIwKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZG9EaXNjb3ZlcnkgPSBhc3luYyAoXG4gICAgICBuOiBudW1iZXIsXG4gICAgICBkZXJpdmVUeXBlOiAncmVjZWl2ZScgfCAnY2hhbmdlJyxcbiAgICAgIG9mZnNldDogbnVtYmVyXG4gICAgKTogUHJvbWlzZTxudW1iZXI+ID0+IHtcbiAgICAgIGNvbnN0IGRlcml2ZWRBZGRyZXNzZXMgPSB0aGlzLmFkZHJlc3NNYW5hZ2VyLmdldEFkZHJlc3NlcyhuLCBkZXJpdmVUeXBlLCBvZmZzZXQpO1xuICAgICAgY29uc3QgYWRkcmVzc2VzID0gZGVyaXZlZEFkZHJlc3Nlcy5tYXAoKG9iaikgPT4gb2JqLmFkZHJlc3MpO1xuICAgICAgbG9nZ2VyLmxvZyhcbiAgICAgICAgJ2luZm8nLFxuICAgICAgICBgRmV0Y2hpbmcgJHtkZXJpdmVUeXBlfSBhZGRyZXNzIGRhdGEgZm9yIGRlcml2ZWQgaW5kaWNlcyAke0pTT04uc3RyaW5naWZ5KFxuICAgICAgICAgIGRlcml2ZWRBZGRyZXNzZXMubWFwKChvYmopID0+IG9iai5pbmRleClcbiAgICAgICAgKX1gXG4gICAgICApO1xuICAgICAgY29uc3QgYWRkcmVzc2VzV2l0aFR4ID0gYXdhaXQgdGhpcy51cGRhdGVUcmFuc2FjdGlvbnMoYWRkcmVzc2VzKTtcbiAgICAgIGlmIChhZGRyZXNzZXNXaXRoVHgubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIGFkZHJlc3MgZGlzY292ZXJ5IGNvbXBsZXRlXG4gICAgICAgIGNvbnN0IGxhc3RBZGRyZXNzSW5kZXhXaXRoVHggPSBvZmZzZXQgLSAodGhyZXNob2xkIC0gbikgLSAxO1xuICAgICAgICBsb2dnZXIubG9nKFxuICAgICAgICAgICdpbmZvJyxcbiAgICAgICAgICBgJHtkZXJpdmVUeXBlfUFkZHJlc3MgZGlzY292ZXJ5IGNvbXBsZXRlLiBMYXN0IGFjdGl2aXR5IG9uIGFkZHJlc3MgIyR7bGFzdEFkZHJlc3NJbmRleFdpdGhUeH0uIE5vIGFjdGl2aXR5IGZyb20gJHtkZXJpdmVUeXBlfSMke1xuICAgICAgICAgICAgbGFzdEFkZHJlc3NJbmRleFdpdGhUeCArIDFcbiAgICAgICAgICB9fiR7bGFzdEFkZHJlc3NJbmRleFdpdGhUeCArIHRocmVzaG9sZH0uYFxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gbGFzdEFkZHJlc3NJbmRleFdpdGhUeDtcbiAgICAgIH1cbiAgICAgIC8vIGVsc2Uga2VlcCBkb2luZyBkaXNjb3ZlcnlcbiAgICAgIGNvbnN0IG5BZGRyZXNzZXNMZWZ0ID1cbiAgICAgICAgZGVyaXZlZEFkZHJlc3Nlc1xuICAgICAgICAgIC5maWx0ZXIoKG9iaikgPT4gYWRkcmVzc2VzV2l0aFR4LmluZGV4T2Yob2JqLmFkZHJlc3MpICE9PSAtMSlcbiAgICAgICAgICAucmVkdWNlKChwcmV2LCBjdXIpID0+IE1hdGgubWF4KHByZXYsIGN1ci5pbmRleCksIDApICsgMTtcbiAgICAgIHJldHVybiBkb0Rpc2NvdmVyeShuQWRkcmVzc2VzTGVmdCwgZGVyaXZlVHlwZSwgb2Zmc2V0ICsgbik7XG4gICAgfTtcbiAgICBjb25zdCBoaWdoZXN0UmVjZWl2ZUluZGV4ID0gYXdhaXQgZG9EaXNjb3ZlcnkodGhyZXNob2xkLCAncmVjZWl2ZScsIDApO1xuICAgIGNvbnN0IGhpZ2hlc3RDaGFuZ2VJbmRleCA9IGF3YWl0IGRvRGlzY292ZXJ5KHRocmVzaG9sZCwgJ2NoYW5nZScsIDApO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuYWR2YW5jZShoaWdoZXN0UmVjZWl2ZUluZGV4ICsgMSk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmFkdmFuY2UoaGlnaGVzdENoYW5nZUluZGV4ICsgMSk7XG4gICAgbG9nZ2VyLmxvZyhcbiAgICAgICdpbmZvJyxcbiAgICAgIGByZWNlaXZlIGFkZHJlc3MgaW5kZXg6ICR7aGlnaGVzdFJlY2VpdmVJbmRleH07IGNoYW5nZSBhZGRyZXNzIGluZGV4OiAke2hpZ2hlc3RDaGFuZ2VJbmRleH1gXG4gICAgKTtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVV0eG9zKE9iamVjdC5rZXlzKHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZSkpO1xuICAgIHRoaXMucnVuU3RhdGVDaGFuZ2VIb29rcygpO1xuICB9XG4gICovXG5cbiAgLyoqXG4gICAqIERlcml2ZXMgcmVjZWl2ZUFkZHJlc3NlcyBhbmQgY2hhbmdlQWRkcmVzc2VzIGFuZCBjaGVja3MgdGhlaXIgdHJhbnNhY3Rpb25zIGFuZCBVVFhPcy5cbiAgICogQHBhcmFtIHRocmVzaG9sZCBzdG9wIGRpc2NvdmVyaW5nIGFmdGVyIGB0aHJlc2hvbGRgIGFkZHJlc3NlcyB3aXRoIG5vIGFjdGl2aXR5XG4gICAqL1xuICBhc3luYyBhZGRyZXNzRGlzY292ZXJ5KHRocmVzaG9sZCA9IDIwKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgbGV0IGFkZHJlc3NMaXN0OnN0cmluZ1tdID0gW107XG4gICAgbGV0IGxhc3RJbmRleCA9IC0xO1xuICAgIGNvbnN0IGRvRGlzY292ZXJ5ID0gYXN5bmMgKFxuICAgICAgbjogbnVtYmVyLFxuICAgICAgZGVyaXZlVHlwZTogJ3JlY2VpdmUnIHwgJ2NoYW5nZScsXG4gICAgICBvZmZzZXQ6IG51bWJlclxuICAgICk6IFByb21pc2U8bnVtYmVyPiA9PiB7XG4gICAgICBjb25zdCBkZXJpdmVkQWRkcmVzc2VzID0gdGhpcy5hZGRyZXNzTWFuYWdlci5nZXRBZGRyZXNzZXMobiwgZGVyaXZlVHlwZSwgb2Zmc2V0KTtcbiAgICAgIGNvbnN0IGFkZHJlc3NlcyA9IGRlcml2ZWRBZGRyZXNzZXMubWFwKChvYmopID0+IG9iai5hZGRyZXNzKTtcbiAgICAgIGFkZHJlc3NMaXN0ID0gWy4uLmFkZHJlc3NMaXN0LCAuLi5hZGRyZXNzZXNdO1xuICAgICAgbG9nZ2VyLmxvZyhcbiAgICAgICAgJ2luZm8nLFxuICAgICAgICBgRmV0Y2hpbmcgJHtkZXJpdmVUeXBlfSBhZGRyZXNzIGRhdGEgZm9yIGRlcml2ZWQgaW5kaWNlcyAke0pTT04uc3RyaW5naWZ5KFxuICAgICAgICAgIGRlcml2ZWRBZGRyZXNzZXMubWFwKChvYmopID0+IG9iai5pbmRleClcbiAgICAgICAgKX1gXG4gICAgICApO1xuICAgICAgY29uc3QgYWRkcmVzc2VzV2l0aFVUWE9zID0gYXdhaXQgdGhpcy5maW5kVXR4b3MoYWRkcmVzc2VzKTtcbiAgICAgIGlmIChhZGRyZXNzZXNXaXRoVVRYT3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vIGFkZHJlc3MgZGlzY292ZXJ5IGNvbXBsZXRlXG4gICAgICAgIGNvbnN0IGxhc3RBZGRyZXNzSW5kZXhXaXRoVHggPSBvZmZzZXQgLSAodGhyZXNob2xkIC0gbikgLSAxO1xuICAgICAgICBsb2dnZXIubG9nKFxuICAgICAgICAgICdpbmZvJyxcbiAgICAgICAgICBgJHtkZXJpdmVUeXBlfUFkZHJlc3MgZGlzY292ZXJ5IGNvbXBsZXRlLiBMYXN0IGFjdGl2aXR5IG9uIGFkZHJlc3MgIyR7bGFzdEFkZHJlc3NJbmRleFdpdGhUeH0uIE5vIGFjdGl2aXR5IGZyb20gJHtkZXJpdmVUeXBlfSMke1xuICAgICAgICAgICAgbGFzdEFkZHJlc3NJbmRleFdpdGhUeCArIDFcbiAgICAgICAgICB9fiR7bGFzdEFkZHJlc3NJbmRleFdpdGhUeCArIHRocmVzaG9sZH0uYFxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gbGFzdEFkZHJlc3NJbmRleFdpdGhUeDtcbiAgICAgIH1cbiAgICAgIC8vIGVsc2Uga2VlcCBkb2luZyBkaXNjb3ZlcnlcbiAgICAgIGNvbnN0IG5BZGRyZXNzZXNMZWZ0ID1cbiAgICAgICAgZGVyaXZlZEFkZHJlc3Nlc1xuICAgICAgICAgIC5maWx0ZXIoKG9iaikgPT4gYWRkcmVzc2VzV2l0aFVUWE9zLmluY2x1ZGVzKG9iai5hZGRyZXNzKSlcbiAgICAgICAgICAucmVkdWNlKChwcmV2LCBjdXIpID0+IE1hdGgubWF4KHByZXYsIGN1ci5pbmRleCksIDApICsgMTtcbiAgICAgIHJldHVybiBkb0Rpc2NvdmVyeShuQWRkcmVzc2VzTGVmdCwgZGVyaXZlVHlwZSwgb2Zmc2V0ICsgbik7XG4gICAgfTtcbiAgICBjb25zdCBoaWdoZXN0UmVjZWl2ZUluZGV4ID0gYXdhaXQgZG9EaXNjb3ZlcnkodGhyZXNob2xkLCAncmVjZWl2ZScsIDApO1xuICAgIGNvbnN0IGhpZ2hlc3RDaGFuZ2VJbmRleCA9IGF3YWl0IGRvRGlzY292ZXJ5KHRocmVzaG9sZCwgJ2NoYW5nZScsIDApO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIucmVjZWl2ZUFkZHJlc3MuYWR2YW5jZShoaWdoZXN0UmVjZWl2ZUluZGV4ICsgMSk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmFkdmFuY2UoaGlnaGVzdENoYW5nZUluZGV4ICsgMSk7XG4gICAgbG9nZ2VyLmxvZyhcbiAgICAgICdpbmZvJyxcbiAgICAgIGByZWNlaXZlIGFkZHJlc3MgaW5kZXg6ICR7aGlnaGVzdFJlY2VpdmVJbmRleH07IGNoYW5nZSBhZGRyZXNzIGluZGV4OiAke2hpZ2hlc3RDaGFuZ2VJbmRleH1gXG4gICAgKTtcbiAgICAvL2F3YWl0IHRoaXMudXBkYXRlVXR4b3MoT2JqZWN0LmtleXModGhpcy50cmFuc2FjdGlvbnNTdG9yYWdlKSk7XG4gICAgdGhpcy5ydW5TdGF0ZUNoYW5nZUhvb2tzKCk7XG4gIH1cblxuICAvLyBUT0RPOiBjb252ZXJ0IGFtb3VudCB0byBzb21waXMgYWthIHNhdG9zaGlzXG4gIC8vIFRPRE86IGJuXG4gIC8qKlxuICAgKiBDb21wb3NlIGEgc2VyaWFsaXplZCwgc2lnbmVkIHRyYW5zYWN0aW9uXG4gICAqIEBwYXJhbSBvYmpcbiAgICogQHBhcmFtIG9iai50b0FkZHIgVG8gYWRkcmVzcyBpbiBjYXNoYWRkciBmb3JtYXQgKGUuZy4ga2FzcGF0ZXN0OnFxMGQ2aDBwcmptNW1wZGxkNXBuY3N0M2FkdTB5YW02eGNoNHRyNjlrMilcbiAgICogQHBhcmFtIG9iai5hbW91bnQgQW1vdW50IHRvIHNlbmQgaW4gc29tcGlzICgxMDAwMDAwMDAgKDFlOCkgc29tcGlzIGluIDEgS1NQKVxuICAgKiBAcGFyYW0gb2JqLmZlZSBGZWUgZm9yIG1pbmVycyBpbiBzb21waXNcbiAgICogQHBhcmFtIG9iai5jaGFuZ2VBZGRyT3ZlcnJpZGUgVXNlIHRoaXMgdG8gb3ZlcnJpZGUgYXV0b21hdGljIGNoYW5nZSBhZGRyZXNzIGRlcml2YXRpb25cbiAgICogQHRocm93cyBpZiBhbW91bnQgaXMgYWJvdmUgYE51bWJlci5NQVhfU0FGRV9JTlRFR0VSYFxuICAgKi9cbiAgY29tcG9zZVR4KHtcbiAgICB0b0FkZHIsXG4gICAgYW1vdW50LFxuICAgIGZlZSA9IERFRkFVTFRfRkVFLFxuICAgIGNoYW5nZUFkZHJPdmVycmlkZSxcbiAgfTogVHhTZW5kICYgeyBjaGFuZ2VBZGRyT3ZlcnJpZGU/OiBzdHJpbmcgfSk6IHtcbiAgICBpZDogc3RyaW5nO1xuICAgIHJhd1R4OiBzdHJpbmc7XG4gICAgdXR4b0lkczogc3RyaW5nW107XG4gICAgYW1vdW50OiBudW1iZXI7XG4gIH0ge1xuICAgIGlmICghTnVtYmVyLmlzU2FmZUludGVnZXIoYW1vdW50KSkgdGhyb3cgbmV3IEVycm9yKCdBbW91bnQgdG9vIGxhcmdlJyk7XG4gICAgY29uc3QgeyB1dHhvcywgdXR4b0lkcyB9ID0gdGhpcy51dHhvU2V0LnNlbGVjdFV0eG9zKGFtb3VudCArIGZlZSk7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGNvbnN0IHByaXZLZXlzID0gdXR4b3MucmVkdWNlKChwcmV2OiBzdHJpbmdbXSwgY3VyKSA9PiB7XG4gICAgICByZXR1cm4gW3RoaXMuYWRkcmVzc01hbmFnZXIuYWxsW1N0cmluZyhjdXIuYWRkcmVzcyldLCAuLi5wcmV2XTtcbiAgICB9LCBbXSk7XG4gICAgY29uc3QgY2hhbmdlQWRkciA9IGNoYW5nZUFkZHJPdmVycmlkZSB8fCB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MubmV4dCgpO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB0eDogYml0Y29yZS5UcmFuc2FjdGlvbiA9IG5ldyBiaXRjb3JlLlRyYW5zYWN0aW9uKClcbiAgICAgICAgLmZyb20odXR4b3MpXG4gICAgICAgIC50byh0b0FkZHIsIGFtb3VudClcbiAgICAgICAgLnNldFZlcnNpb24oMSlcbiAgICAgICAgLmZlZShmZWUpXG4gICAgICAgIC5jaGFuZ2UoY2hhbmdlQWRkcilcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAuc2lnbihwcml2S2V5cywgYml0Y29yZS5jcnlwdG8uU2lnbmF0dXJlLlNJR0hBU0hfQUxMLCAnc2Nobm9ycicpO1xuICAgICAgdGhpcy51dHhvU2V0LmluVXNlLnB1c2goLi4udXR4b0lkcyk7XG4gICAgICB0aGlzLnBlbmRpbmcuYWRkKHR4LmlkLCB7IHJhd1R4OiB0eC50b1N0cmluZygpLCB1dHhvSWRzLCBhbW91bnQsIHRvOiB0b0FkZHIsIGZlZSB9KTtcbiAgICAgIHRoaXMucnVuU3RhdGVDaGFuZ2VIb29rcygpO1xuICAgICAgcmV0dXJuIHsgaWQ6IHR4LmlkLCByYXdUeDogdHgudG9TdHJpbmcoKSwgdXR4b0lkcywgYW1vdW50OiBhbW91bnQgKyBmZWUgfTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MucmV2ZXJzZSgpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU2VuZCBhIHRyYW5zYWN0aW9uLiBSZXR1cm5zIHRyYW5zYWN0aW9uIGlkLlxuICAgKiBAcGFyYW0gdHhQYXJhbXNcbiAgICogQHBhcmFtIHR4UGFyYW1zLnRvQWRkciBUbyBhZGRyZXNzIGluIGNhc2hhZGRyIGZvcm1hdCAoZS5nLiBrYXNwYXRlc3Q6cXEwZDZoMHByam01bXBkbGQ1cG5jc3QzYWR1MHlhbTZ4Y2g0dHI2OWsyKVxuICAgKiBAcGFyYW0gdHhQYXJhbXMuYW1vdW50IEFtb3VudCB0byBzZW5kIGluIHNvbXBpcyAoMTAwMDAwMDAwICgxZTgpIHNvbXBpcyBpbiAxIEtTUClcbiAgICogQHBhcmFtIHR4UGFyYW1zLmZlZSBGZWUgZm9yIG1pbmVycyBpbiBzb21waXNcbiAgICogQHRocm93cyBgRmV0Y2hFcnJvcmAgaWYgZW5kcG9pbnQgaXMgZG93bi4gQVBJIGVycm9yIG1lc3NhZ2UgaWYgdHggZXJyb3IuIEVycm9yIGlmIGFtb3VudCBpcyB0b28gbGFyZ2UgdG8gYmUgcmVwcmVzZW50ZWQgYXMgYSBqYXZhc2NyaXB0IG51bWJlci5cbiAgICovXG4gIGFzeW5jIHNlbmRUeCh0eFBhcmFtczogVHhTZW5kKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCB7IGlkLCByYXdUeCB9ID0gdGhpcy5jb21wb3NlVHgodHhQYXJhbXMpO1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBhcGkucG9zdFR4KHJhd1R4KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB0aGlzLnVuZG9QZW5kaW5nVHgoaWQpO1xuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gICAgcmV0dXJuIGlkO1xuICB9XG5cbiAgYXN5bmMgdXBkYXRlU3RhdGUoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgYWN0aXZlQWRkcnMgPSBhd2FpdCB0aGlzLnVwZGF0ZVRyYW5zYWN0aW9ucyh0aGlzLmFkZHJlc3NNYW5hZ2VyLnNob3VsZEZldGNoKTtcbiAgICBhd2FpdCB0aGlzLnVwZGF0ZVV0eG9zKGFjdGl2ZUFkZHJzKTtcbiAgICB0aGlzLnJ1blN0YXRlQ2hhbmdlSG9va3MoKTtcbiAgfVxuXG4gIHVuZG9QZW5kaW5nVHgoaWQ6IHN0cmluZyk6IHZvaWQge1xuICAgIGNvbnN0IHsgdXR4b0lkcyB9ID0gdGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9uc1tpZF07XG4gICAgZGVsZXRlIHRoaXMucGVuZGluZy50cmFuc2FjdGlvbnNbaWRdO1xuICAgIHRoaXMudXR4b1NldC5yZWxlYXNlKHV0eG9JZHMpO1xuICAgIHRoaXMuYWRkcmVzc01hbmFnZXIuY2hhbmdlQWRkcmVzcy5yZXZlcnNlKCk7XG4gICAgdGhpcy5ydW5TdGF0ZUNoYW5nZUhvb2tzKCk7XG4gIH1cblxuICAvKipcbiAgICogQWZ0ZXIgd2Ugc2VlIHRoZSB0cmFuc2FjdGlvbiBpbiB0aGUgQVBJIHJlc3VsdHMsIGRlbGV0ZSBpdCBmcm9tIG91ciBwZW5kaW5nIGxpc3QuXG4gICAqIEBwYXJhbSBpZCBUaGUgdHggaGFzaFxuICAgKi9cbiAgZGVsZXRlUGVuZGluZ1R4KGlkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICAvLyB1bmRvICsgZGVsZXRlIG9sZCB1dHhvc1xuICAgIGNvbnN0IHsgdXR4b0lkcyB9ID0gdGhpcy5wZW5kaW5nLnRyYW5zYWN0aW9uc1tpZF07XG4gICAgZGVsZXRlIHRoaXMucGVuZGluZy50cmFuc2FjdGlvbnNbaWRdO1xuICAgIHRoaXMudXR4b1NldC5yZW1vdmUodXR4b0lkcyk7XG4gIH1cblxuICBydW5TdGF0ZUNoYW5nZUhvb2tzKCk6IHZvaWQge1xuICAgIHRoaXMudXR4b1NldC51cGRhdGVVdHhvQmFsYW5jZSgpO1xuICAgIHRoaXMudXBkYXRlQmFsYW5jZSgpO1xuICB9XG5cbiAgZ2V0IGNhY2hlKCkge1xuICAgIHJldHVybiB7XG4gICAgICBwZW5kaW5nVHg6IHRoaXMucGVuZGluZy50cmFuc2FjdGlvbnMsXG4gICAgICB1dHhvczoge1xuICAgICAgICB1dHhvU3RvcmFnZTogdGhpcy51dHhvU2V0LnV0eG9TdG9yYWdlLFxuICAgICAgICBpblVzZTogdGhpcy51dHhvU2V0LmluVXNlLFxuICAgICAgfSxcbiAgICAgIHRyYW5zYWN0aW9uc1N0b3JhZ2U6IHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZSxcbiAgICAgIGFkZHJlc3Nlczoge1xuICAgICAgICByZWNlaXZlQ291bnRlcjogdGhpcy5hZGRyZXNzTWFuYWdlci5yZWNlaXZlQWRkcmVzcy5jb3VudGVyLFxuICAgICAgICBjaGFuZ2VDb3VudGVyOiB0aGlzLmFkZHJlc3NNYW5hZ2VyLmNoYW5nZUFkZHJlc3MuY291bnRlcixcbiAgICAgIH0sXG4gICAgfTtcbiAgfVxuXG4gIHJlc3RvcmVDYWNoZShjYWNoZTogV2FsbGV0Q2FjaGUpOiB2b2lkIHtcbiAgICB0aGlzLnBlbmRpbmcudHJhbnNhY3Rpb25zID0gY2FjaGUucGVuZGluZ1R4O1xuICAgIHRoaXMudXR4b1NldC51dHhvU3RvcmFnZSA9IGNhY2hlLnV0eG9zLnV0eG9TdG9yYWdlO1xuICAgIHRoaXMudXR4b1NldC5pblVzZSA9IGNhY2hlLnV0eG9zLmluVXNlO1xuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMudXR4b1NldC51dHhvU3RvcmFnZSkuZm9yRWFjaCgoW2FkZHIsIHV0eG9zXTogW3N0cmluZywgQXBpLlV0eG9bXV0pID0+IHtcbiAgICAgIHRoaXMudXR4b1NldC5hZGQodXR4b3MsIGFkZHIpO1xuICAgIH0pO1xuICAgIHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZSA9IGNhY2hlLnRyYW5zYWN0aW9uc1N0b3JhZ2U7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5nZXRBZGRyZXNzZXMoY2FjaGUuYWRkcmVzc2VzLnJlY2VpdmVDb3VudGVyICsgMSwgJ3JlY2VpdmUnKTtcbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLmdldEFkZHJlc3NlcyhjYWNoZS5hZGRyZXNzZXMuY2hhbmdlQ291bnRlciArIDEsICdjaGFuZ2UnKTtcbiAgICB0aGlzLmFkZHJlc3NNYW5hZ2VyLnJlY2VpdmVBZGRyZXNzLmFkdmFuY2UoY2FjaGUuYWRkcmVzc2VzLnJlY2VpdmVDb3VudGVyIC0gMSk7XG4gICAgdGhpcy5hZGRyZXNzTWFuYWdlci5jaGFuZ2VBZGRyZXNzLmFkdmFuY2UoY2FjaGUuYWRkcmVzc2VzLmNoYW5nZUNvdW50ZXIpO1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICB0aGlzLnRyYW5zYWN0aW9ucyA9IHR4UGFyc2VyKHRoaXMudHJhbnNhY3Rpb25zU3RvcmFnZSwgT2JqZWN0LmtleXModGhpcy5hZGRyZXNzTWFuYWdlci5hbGwpKTtcbiAgICB0aGlzLnJ1blN0YXRlQ2hhbmdlSG9va3MoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiAgQ29udmVydHMgYSBtbmVtb25pYyB0byBhIG5ldyB3YWxsZXQuXG4gICAqIEBwYXJhbSBzZWVkUGhyYXNlIFRoZSAxMiB3b3JkIHNlZWQgcGhyYXNlLlxuICAgKiBAcmV0dXJucyBuZXcgV2FsbGV0XG4gICAqL1xuICBzdGF0aWMgZnJvbU1uZW1vbmljKHNlZWRQaHJhc2U6IHN0cmluZyk6IFdhbGxldCB7XG4gICAgY29uc3QgcHJpdktleSA9IG5ldyBNbmVtb25pYyhzZWVkUGhyYXNlLnRyaW0oKSkudG9IRFByaXZhdGVLZXkoKS50b1N0cmluZygpO1xuICAgIGNvbnN0IHdhbGxldCA9IG5ldyB0aGlzKHByaXZLZXksIHNlZWRQaHJhc2UpO1xuICAgIHJldHVybiB3YWxsZXQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBXYWxsZXQgZnJvbSBlbmNyeXB0ZWQgd2FsbGV0IGRhdGEuXG4gICAqIEBwYXJhbSBwYXNzd29yZCB0aGUgcGFzc3dvcmQgdGhlIHVzZXIgZW5jcnlwdGVkIHRoZWlyIHNlZWQgcGhyYXNlIHdpdGhcbiAgICogQHBhcmFtIGVuY3J5cHRlZE1uZW1vbmljIHRoZSBlbmNyeXB0ZWQgc2VlZCBwaHJhc2UgZnJvbSBsb2NhbCBzdG9yYWdlXG4gICAqIEB0aHJvd3MgV2lsbCB0aHJvdyBcIkluY29ycmVjdCBwYXNzd29yZFwiIGlmIHBhc3N3b3JkIGlzIHdyb25nXG4gICAqL1xuICBzdGF0aWMgYXN5bmMgaW1wb3J0KHBhc3N3b3JkOiBzdHJpbmcsIGVuY3J5cHRlZE1uZW1vbmljOiBzdHJpbmcpOiBQcm9taXNlPFdhbGxldD4ge1xuICAgIGNvbnN0IGRlY3J5cHRlZCA9IGF3YWl0IHBhc3N3b3JkZXIuZGVjcnlwdChwYXNzd29yZCwgZW5jcnlwdGVkTW5lbW9uaWMpO1xuICAgIGNvbnN0IHNhdmVkV2FsbGV0ID0gSlNPTi5wYXJzZShkZWNyeXB0ZWQpIGFzIFdhbGxldFNhdmU7XG4gICAgY29uc3QgbXlXYWxsZXQgPSBuZXcgdGhpcyhzYXZlZFdhbGxldC5wcml2S2V5LCBzYXZlZFdhbGxldC5zZWVkUGhyYXNlKTtcbiAgICByZXR1cm4gbXlXYWxsZXQ7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGVzIGVuY3J5cHRlZCB3YWxsZXQgZGF0YS5cbiAgICogQHBhcmFtIHBhc3N3b3JkIHVzZXIncyBjaG9zZW4gcGFzc3dvcmRcbiAgICogQHJldHVybnMgUHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIG9iamVjdC1saWtlIHN0cmluZy4gU3VnZ2VzdGVkIHRvIHN0b3JlIGFzIHN0cmluZyBmb3IgLmltcG9ydCgpLlxuICAgKi9cbiAgYXN5bmMgZXhwb3J0KHBhc3N3b3JkOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGNvbnN0IHNhdmVkV2FsbGV0OiBXYWxsZXRTYXZlID0ge1xuICAgICAgcHJpdktleTogdGhpcy5IRFdhbGxldC50b1N0cmluZygpLFxuICAgICAgc2VlZFBocmFzZTogdGhpcy5tbmVtb25pYyxcbiAgICB9O1xuICAgIHJldHVybiBwYXNzd29yZGVyLmVuY3J5cHQocGFzc3dvcmQsIEpTT04uc3RyaW5naWZ5KHNhdmVkV2FsbGV0KSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgV2FsbGV0O1xuIl19