import {Buffer} from 'safe-buffer';
const Mnemonic = require('bitcore-mnemonic');
import * as kaspacore from 'kaspacore-lib';
import * as helper from '../utils/helper';
import {CreateStorage, StorageType, classes as storageClasses} from './storage';

import * as passworder1 from 'browser-passworder';
import * as passworder2 from '@aspectron/flow-key-crypt';
let passworder: typeof passworder1 | typeof passworder2;

// @ts-ignore
if (typeof window != "undefined" && !window.nw) {
	passworder = passworder1;
} else {
	passworder = passworder2;
}

import {
	Network, NetworkOptions, SelectedNetwork, WalletSave, Api, TxSend,
	PendingTransactions, WalletCache, IRPC, RPC, WalletOptions,	WalletOpt
} from '../types/custom-types';

import {CreateLogger, Logger} from '../utils/logger';
import {AddressManager} from './AddressManager';
import {UtxoSet} from './UtxoSet';
import {KaspaAPI} from './apiHelpers';
import {DEFAULT_FEE,DEFAULT_NETWORK} from '../config.json';
import {EventTargetImpl} from './event-target-impl';


const BALANCE_CONFIRMED = Symbol();
const BALANCE_PENDING = Symbol();
const BALANCE_TOTAL = Symbol();

/** Class representing an HDWallet with derivable child addresses */
class Wallet extends EventTargetImpl {

	static Mnemonic: typeof Mnemonic = Mnemonic;

	// TODO - integrate with Kaspacore-lib
	static networkTypes: Object = {
		kaspa: { port: 16110, network: 'kaspa' },
		kaspatest: { port: 16210, network: 'kaspatest' },
		kaspasim: {	port: 16510, network: 'kaspasim' },
		kaspadev: {	port: 16610, network: 'kaspadev' }
	}

	static networkAliases: Object = {
		mainnet: 'kaspa',
		testnet: 'kaspatest',
		devnet: 'kaspadev',
		simnet: 'kaspasim'
	}

	static initRuntime() {
		return kaspacore.initRuntime();
	}

	/**
	 * Converts a mnemonic to a new wallet.
	 * @param seedPhrase The 12 word seed phrase.
	 * @returns new Wallet
	 */
	static fromMnemonic(seedPhrase: string, networkOptions: NetworkOptions, options: WalletOptions = {}): Wallet {
		if (!networkOptions || !networkOptions.network)
			throw new Error(`fromMnemonic(seedPhrase,networkOptions): missing network argument`);
		const privKey = new Mnemonic(seedPhrase.trim()).toHDPrivateKey().toString();
		const wallet = new this(privKey, seedPhrase, networkOptions, options);
		return wallet;
	}

	/**
	 * Creates a new Wallet from encrypted wallet data.
	 * @param password the password the user encrypted their seed phrase with
	 * @param encryptedMnemonic the encrypted seed phrase from local storage
	 * @throws Will throw "Incorrect password" if password is wrong
	 */
	static async import (password: string, encryptedMnemonic: string, networkOptions: NetworkOptions, options: WalletOptions = {}): Promise < Wallet > {
		const decrypted = await passworder.decrypt(password, encryptedMnemonic);
		const savedWallet = JSON.parse(decrypted) as WalletSave;
		const myWallet = new this(savedWallet.privKey, savedWallet.seedPhrase, networkOptions, options);
		return myWallet;
	}


	//static passworder1:any = passworder1;
	//static passworder2:any = passworder2;

	HDWallet: kaspacore.HDPrivateKey;

	disableBalanceNotifications: boolean = false;

	get balance(): {available: number, pending:number, total:number} {
		return {
			available: this[BALANCE_CONFIRMED],
			pending: this[BALANCE_PENDING],
			total: this[BALANCE_CONFIRMED] + this[BALANCE_PENDING]
		}
	}

	/**
	 * Set by addressManager
	 */
	get receiveAddress() {
		return this.addressManager.receiveAddress.current.address;
	}

	/**
	 * Current network.
	 */
	// @ts-ignore
	network: Network = 'kaspa' as Network;

	// @ts-ignore
	api: KaspaAPI; //new KaspaAPI();

	/** 
	 * Default fee
	 */

	defaultFee: number = 1; //per byte

	subnetworkId: string = "0000000000000000000000000000000000000000"; //hex string

	/**
	 * Current API endpoint for selected network
	 */
	apiEndpoint = 'localhost:16210';

	/**
	 * A 12 word mnemonic.
	 */
	mnemonic: string;

	utxoSet: UtxoSet;

	addressManager: AddressManager;

	blueScore: number = -1;

	syncVirtualSelectedParentBlueScoreStarted:boolean = false;
	syncInProggress:boolean = false;

	/* eslint-disable */
	pendingInfo: PendingTransactions = {
		transactions: {},
		get amount() {
			const transactions = Object.values(this.transactions);
			if (transactions.length === 0) return 0;
			return transactions.reduce((prev, cur) => prev + cur.amount + cur.fee, 0);
		},
		add(
			id: string,
			tx: {
				to: string;
				utxoIds: string[];
				rawTx: string;
				amount: number;
				fee: number
			}
		) {
			this.transactions[id] = tx;
		}
	};
	/**
	 * Transactions sorted by hash.
	 */
	transactions:Record<string, { rawTx: string; utxoIds: string[]; amount: number; to: string; fee: number; }> = {};

	/**
	 * Transaction arrays keyed by address.
	 */
	transactionsStorage: Record < string, Api.Transaction[] > = {};


	options: WalletOpt;
	connectSignal:helper.DeferedPromise;

	/** Create a wallet.
	 * @param walletSave (optional)
	 * @param walletSave.privKey Saved wallet's private key.
	 * @param walletSave.seedPhrase Saved wallet's seed phrase.
	 */
	constructor(privKey: string, seedPhrase: string, networkOptions: NetworkOptions, options: WalletOptions = {}) {
		super();
		this.logger = CreateLogger();
		this.api = new KaspaAPI();

		let defaultOpt = {
			skipSyncBalance: false,
			utxoSyncThrottleDelay: 100,
			syncOnce: false,
			addressDiscoveryCount: 128,
			logLevel:'none'
		};
		// console.log("CREATING WALLET FOR NETWORK", this.network);
		this.options = {...defaultOpt,	...options};
		this.setLogLevel(this.options.logLevel); 

		this.network = networkOptions.network;
		this.defaultFee = networkOptions.defaultFee || this.defaultFee;
		if (networkOptions.rpc)
			this.api.setRPC(networkOptions.rpc);

		this.utxoSet = new UtxoSet(this);
		//this.utxoSet.on("balance-update", this.updateBalance.bind(this));

		if (privKey && seedPhrase) {
			this.HDWallet = new kaspacore.HDPrivateKey(privKey);
			this.mnemonic = seedPhrase;
		} else {
			const temp = new Mnemonic(Mnemonic.Words.ENGLISH);
			this.mnemonic = temp.toString();
			this.HDWallet = new kaspacore.HDPrivateKey(temp.toHDPrivateKey().toString());
		}

		this.addressManager = new AddressManager(this.HDWallet, this.network);
		//this.initAddressManager();
		//this.sync(this.options.syncOnce);
		this.connectSignal = helper.Defered();
		this.api.on("connect", ()=>{
			this.onApiConnect()
		})
		this.api.on("disconnect", ()=>{
			this.onApiDisconnect();
		})
	}

	async onApiConnect(){
		this.connectSignal.resolve();
		this.logger.info("api-connect")
		this.emit("api-connect")
		if(this.syncSignal && this.isReConnect){//if sync was called
			this.logger.info("re-sync started .......................")
			await this.sync(this.syncOnce)
		}
	}

	isReConnect:boolean|undefined;
	onApiDisconnect(){
		this.isReConnect = true;
		this.logger.info("api-disconnect")
		this.emit("api-disconnect")
	}

	async update(syncOnce:boolean=true){
		await this.sync(syncOnce);
	}

	syncOnce:boolean|undefined;
	syncSignal: helper.DeferedPromise|undefined;
	waitOrSync(){
		if(this.syncSignal)
			return this.syncSignal;
		return this.sync();
	}
	async sync(syncOnce:boolean|undefined=undefined){
		this.syncSignal = helper.Defered();
		await this.connectSignal;
		if(syncOnce === undefined)
			syncOnce = this.options.syncOnce;
		syncOnce = !!syncOnce;

		this.syncInProggress = true;
		this.logger.info(`sync ............ started, syncOnce:${syncOnce}`)

		//if last time syncOnce was OFF we have subscriptions to utxo-change
		if(this.syncOnce === false && syncOnce){
			throw new Error("Wallet sync process already running.")
		}

		this.syncOnce = syncOnce;
		this.initAddressManager();

		await this.initBlueScoreSync(syncOnce)
	    .catch(e=>{
	        this.logger.info("syncVirtualSelectedParentBlueScore:error", e)
	    })

	    await this.addressDiscovery(this.options.addressDiscoveryCount)
	    .catch(e=>{
	        this.logger.info("addressDiscovery:error", e)
	    })

	    this.syncInProggress = false;
	    if(!syncOnce)
			await this.utxoSet.utxoSubscribe();
	    this.emitBalance();

	    this.logger.info(`sync ............ finished`)
	    this.syncSignal.resolve();
	}

	getVirtualSelectedParentBlueScore() {
		return this.api.getVirtualSelectedParentBlueScore();
	}

	async initBlueScoreSync(once:boolean = false) {
		if(this.syncVirtualSelectedParentBlueScoreStarted)
			return;
		this.syncVirtualSelectedParentBlueScoreStarted = true;
		let {blueScore} = await this.getVirtualSelectedParentBlueScore();

		this.blueScore = blueScore;
		this.emit("blue-score-changed", {blueScore})
		this.utxoSet.updateUtxoBalance();

		if(once) {
			this.syncVirtualSelectedParentBlueScoreStarted = false;
			return;
		}
		this.api.subscribeVirtualSelectedParentBlueScoreChanged((result) => {
			let {virtualSelectedParentBlueScore} = result;
			this.blueScore = virtualSelectedParentBlueScore;
			this.emit("blue-score-changed", {
				blueScore: virtualSelectedParentBlueScore
			})
			this.utxoSet.updateUtxoBalance();
		});
	}

	addressManagerInitialized:boolean|undefined;
	initAddressManager() {
		if(this.addressManagerInitialized)
			return
		this.addressManagerInitialized = true;

		this.addressManager.on("new-address", detail => {
			//console.log("new-address", detail)
			if (this.options.skipSyncBalance)
				return

			//console.log("new-address:detail", detail)
			const {	address, type } = detail;
			this.utxoSet.syncAddressesUtxos([address]);
		})
		this.addressManager.receiveAddress.next();
	}

	/**
	 * Set rpc provider
	 * @param rpc
	 */
	setRPC(rpc: IRPC) {
		this.api.setRPC(rpc);
	}

	/*
	setStorageType(type:StorageType){
		this.storage.setType(type);
	}
	setStorageFolder(folder:string){
		this.storage.setFolder(folder);
	}
	setStorageFileName(fileName:string){
		this.storage.setFileName(fileName);
	}
	*/
	_storage: typeof storageClasses.Storage|undefined;

	setStoragePassword(password: string) {
		if (!this.storage)
			throw new Error("Please init storage")
		this.storage.setPassword(password);
	}
	get storage(): typeof storageClasses.Storage | undefined {
		return this._storage;
	}

	openFileStorage(fileName: string, password: string, folder: string = '') {
		let storage = CreateStorage();
		if (folder)
			storage.setFolder(folder);
		storage.setFileName(fileName);
		storage.setPassword(password);
		this._storage = storage;
	}

	/**
	 * Queries API for address[] UTXOs. Adds tx to transactions storage. Also sorts the entire transaction set.
	 * @param addresses
	 */
	async findUtxos(addresses: string[], debug = false): Promise < {
		txID2Info: Map < string,
		{
			utxos: Api.Utxo[],
			address: string
		} > ,
		addressesWithUTXOs: string[]
	} > {
		this.logger.verbose(`Getting UTXOs for ${addresses.length} addresses.`);

		const utxosMap = await this.api.getUtxosByAddresses(addresses)

		const addressesWithUTXOs: string[] = [];
		const txID2Info = new Map();

		if (debug) {
			utxosMap.forEach((utxos, address) => {
				// utxos.sort((b, a)=> a.index-b.index)
				utxos.map(t => {
					let info = txID2Info.get(t.transactionId);
					if (!info) {
						info = {
							utxos: [],
							address
						};
						txID2Info.set(t.transactionId, info);
					}
					info.utxos.push(t);
				})
			})
		}

		utxosMap.forEach((utxos, address) => {
			// utxos.sort((b, a)=> a.index-b.index)
			this.logger.verbose(`${address}: ${utxos.length} utxos found.`);
			if (utxos.length !== 0) {
        		this.disableBalanceNotifications = true;
				this.utxoSet.utxoStorage[address] = utxos;
				this.utxoSet.add(utxos, address);
				addressesWithUTXOs.push(address);
				this.disableBalanceNotifications = false;
				this.emitBalance();
      		}
		})

		const isActivityOnReceiveAddr =
			this.utxoSet.utxoStorage[this.receiveAddress] !== undefined;
		if (isActivityOnReceiveAddr) {
			this.addressManager.receiveAddress.next();
		}
		return {
			addressesWithUTXOs,
			txID2Info
		};
	}

	[BALANCE_CONFIRMED]:number = 0;
	[BALANCE_PENDING]:number = 0;
	[BALANCE_TOTAL]:number = 0;
	adjustBalance(isConfirmed:boolean, amount:number, notify:boolean=true){
		const {available, pending} = this.balance;
		if(isConfirmed){
			this[BALANCE_CONFIRMED] += amount;
		}else{
			this[BALANCE_PENDING] += amount;
		}

		this[BALANCE_TOTAL] = this[BALANCE_CONFIRMED] + this[BALANCE_PENDING];

		if(notify===false)
			return
		const {available:_available, pending:_pending} = this.balance;
		if(!this.syncInProggress && !this.disableBalanceNotifications && (available!=_available || pending!=_pending))
			this.emitBalance();
	}

	/**
	 * Emit wallet balance.
	 */
	lastBalanceNotification:{available:number, pending:number} = {available:0, pending:0}
	emitBalance(): void {
		const {available, pending, total} = this.balance;
		const {available:_available, pending:_pending} = this.lastBalanceNotification;
		if(available==_available && pending==_pending)
			return
		this.lastBalanceNotification = {available, pending};
		this.logger.verbose(`balance available: ${available} pending: ${pending}`);
		this.emit("balance-update", {
			available,
			pending,
			total
		});
	}

	/**
	 * Updates the selected network
	 * @param network name of the network
	 */
	async updateNetwork(network: SelectedNetwork): Promise < void > {
		this.demolishWalletState(network.prefix);
		this.network = network.prefix;
		this.apiEndpoint = network.apiBaseUrl;
	}

	demolishWalletState(networkPrefix: Network = this.network): void {
		this.utxoSet.clear();
		this.addressManager = new AddressManager(this.HDWallet, networkPrefix);
		this.pendingInfo.transactions = {};
		this.transactions = {};
		this.transactionsStorage = {};
	}

	/**
	 * Derives receiveAddresses and changeAddresses and checks their transactions and UTXOs.
	 * @param threshold stop discovering after `threshold` addresses with no activity
	 */
	async addressDiscovery(threshold = 20, debug = false): Promise <Map <string, {utxos: Api.Utxo[], address: string}>|null> {
		let addressList: string[] = [];
		let lastIndex = -1;
		let debugInfo: Map < string, {utxos: Api.Utxo[], address: string} > | null = null;

		const doDiscovery = async(
			n:number, deriveType:'receive'|'change', offset:number
		): Promise <number> => {
			const derivedAddresses = this.addressManager.getAddresses(n, deriveType, offset);
			const addresses = derivedAddresses.map((obj) => obj.address);
			addressList = [...addressList, ...addresses];
			this.logger.info(
				`Fetching ${deriveType} address data for derived indices ${
					JSON.stringify(
		  				derivedAddresses.map((obj) => obj.index)
					)}`
			);
			if (this.loggerLevel > 0)
				this.logger.info("addressDiscovery: findUtxos for addresses::", addresses)
			const {addressesWithUTXOs, txID2Info} = await this.findUtxos(addresses, debug);
			if (!debugInfo)
				debugInfo = txID2Info;
			if (addressesWithUTXOs.length === 0) {
				// address discovery complete
				const lastAddressIndexWithTx = offset - (threshold - n) - 1;
				this.logger.info(
					`${deriveType}Address discovery complete. Last activity on address #${lastAddressIndexWithTx}. No activity from ${deriveType}#${
						lastAddressIndexWithTx + 1
					  }~${lastAddressIndexWithTx + threshold}.`
				);
				return lastAddressIndexWithTx;
			}
			// else keep doing discovery
			const nAddressesLeft =
				derivedAddresses
				.filter((obj) => addressesWithUTXOs.includes(obj.address))
				.reduce((prev, cur) => Math.max(prev, cur.index), 0) + 1;
			return doDiscovery(nAddressesLeft, deriveType, offset + n);
		};
		const highestReceiveIndex = await doDiscovery(threshold, 'receive', 0);
		const highestChangeIndex = await doDiscovery(threshold, 'change', 0);
		this.addressManager.receiveAddress.advance(highestReceiveIndex + 1);
		this.addressManager.changeAddress.advance(highestChangeIndex + 1);
		this.logger.info(
			`receive address index: ${highestReceiveIndex}; change address index: ${highestChangeIndex}`
		);

		if(!this.syncOnce && !this.syncInProggress)
			await this.utxoSet.utxoSubscribe();

		this.runStateChangeHooks();
		return debugInfo;
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
	composeTx({
		toAddr,
		amount,
		fee = DEFAULT_FEE,
		changeAddrOverride,
	}: TxSend & {
		changeAddrOverride ? : string
	}): {
		tx: kaspacore.Transaction;
		id: string;
		rawTx: string;
		utxoIds: string[];
		amount: number;
		toAddr: string;
		fee: number;
		utxos: kaspacore.Transaction.UnspentOutput[];
	} {
		// TODO: bn!
		amount = parseInt(amount as any);
		// if (this.loggerLevel > 0) {
		// 	for (let i = 0; i < 100; i++)
		// 		console.log('Wallet transaction request for', amount, typeof amount);
		// }
		//if (!Number.isSafeInteger(amount)) throw new Error(`Amount ${amount} is too large`);
		const {	utxos, utxoIds } = this.utxoSet.selectUtxos(amount + fee);
		// @ts-ignore
		const privKeys = utxos.reduce((prev: string[], cur) => {
			return [this.addressManager.all[String(cur.address)], ...prev];
		}, []);

		//console.log("privKeys::::", privKeys)

		const changeAddr = changeAddrOverride || this.addressManager.changeAddress.next();
		try {
			const tx: kaspacore.Transaction = new kaspacore.Transaction()
				.from(utxos)
				.to(toAddr, amount)
				.setVersion(0)
				.fee(fee)
				.change(changeAddr)
				// @ts-ignore
				.sign(privKeys, kaspacore.crypto.Signature.SIGHASH_ALL, 'schnorr');

			//window.txxxx = tx;
			return {
				tx: tx,
				id: tx.id,
				rawTx: tx.toString(),
				utxoIds,
				amount,
				fee,
				utxos,
				toAddr
			};
		} catch (e) {
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
	async submitTransaction(txParams: TxSend, debug = false): Promise < string > {
		await this.waitOrSync();
		const {id, tx, utxos, utxoIds, rawTx, amount, toAddr} = this.composeTx(txParams);

		if (debug || this.loggerLevel > 0) {
			this.logger.debug("sendTx:utxos", utxos)
			this.logger.debug("::utxos[0].script::", utxos[0].script)
			//console.log("::utxos[0].address::", utxos[0].address)
		}

		const {nLockTime: lockTime, version } = tx;

		//each input have script version's 2 bytes, which kaspa dont count;
		const txSize = tx.toBuffer().length - tx.inputs.length * 2;
		const minFee = txSize * this.defaultFee;
		const fee = minFee + (txParams.fee||0);
		if (fee < minFee)
			throw new Error(`Minimum fee required for this transaction is ${minFee}`);
		if (this.loggerLevel > 0)
			this.logger.debug("composeTx:tx", "txSize:", txSize)


		const inputs: RPC.TransactionInput[] = tx.inputs.map((input: kaspacore.Transaction.Input) => {
			//console.log("prevTxId", input.prevTxId.toString("hex"))

			if (debug || this.loggerLevel > 0) {
				//@ts-ignore
				this.logger.debug("input.script.inspect", input.script.inspect())
			}

			return {
				previousOutpoint: {
					transactionId: input.prevTxId.toString("hex"),
					index: input.outputIndex
				},
				//@ts-ignore
				signatureScript: input.script.toBuffer().toString("hex"),
				sequence: input.sequenceNumber
			};
		})

		const outputs: RPC.TransactionOutput[] = tx.outputs.map((output: kaspacore.Transaction.Output) => {
			return {
				amount: output.satoshis,
				scriptPublicKey: {
					//@ts-ignore
					scriptPublicKey: output.script.toBuffer().toString("hex"),
					version: 0
				}
			}
		})

		//const payloadStr = "0000000000000000000000000000000";
		//const payload = Buffer.from(payloadStr).toString("base64");
		//console.log("payload-hex:", Buffer.from(payloadStr).toString("hex"))
		//@ ts-ignore
		//const payloadHash = kaspacore.crypto.Hash.sha256sha256(Buffer.from(payloadStr));
		const rpcTX: RPC.SubmitTransactionRequest = {
			transaction: {
				version,
				inputs,
				outputs,
				lockTime,
				//
				//payload:'f00f00000000000000001976a914784bf4c2562f38fe0c49d1e0538cee4410d37e0988ac',
				payloadHash: '0000000000000000000000000000000000000000000000000000000000000000',
				//payloadHash:'afe7fc6fe3288e79f9a0c05c22c1ead2aae29b6da0199d7b43628c2588e296f9',
				//
				subnetworkId: this.subnetworkId, //Buffer.from(this.subnetworkId, "hex").toString("base64"),
				fee,
				//gas: 0
			}
		}
		if (this.loggerLevel > 0) {
			this.logger.debug("rpcTX", JSON.stringify(rpcTX, null, "  "))
			this.logger.debug("rpcTX", JSON.stringify(rpcTX))
		}

		try {
			let result: string = await this.api.submitTransaction(rpcTX);
			this.logger.debug("submitTransaction:result", result, id)
			if(!result)
				return result;

			this.utxoSet.inUse.push(...utxoIds);
			this.pendingInfo.add(tx.id, {
				rawTx: tx.toString(),
				utxoIds,
				amount,
				to: toAddr,
				fee
			});
			return result;
		} catch (e) {
			throw e;
		}
	}

	undoPendingTx(id: string): void {
		const {	utxoIds	} = this.pendingInfo.transactions[id];
		delete this.pendingInfo.transactions[id];
		this.utxoSet.release(utxoIds);
		this.addressManager.changeAddress.reverse();
		this.runStateChangeHooks();
	}

	/**
	 * After we see the transaction in the API results, delete it from our pending list.
	 * @param id The tx hash
	 */
	deletePendingTx(id: string): void {
		// undo + delete old utxos
		const {	utxoIds } = this.pendingInfo.transactions[id];
		delete this.pendingInfo.transactions[id];
		this.utxoSet.remove(utxoIds);
	}

	runStateChangeHooks(): void {
		//this.utxoSet.updateUtxoBalance();
		//this.updateBalance();
	}

	get cache() {
		return {
			pendingTx: this.pendingInfo.transactions,
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

	restoreCache(cache: WalletCache): void {
		this.pendingInfo.transactions = cache.pendingTx;
		this.utxoSet.utxoStorage = cache.utxos.utxoStorage;
		this.utxoSet.inUse = cache.utxos.inUse;
		Object.entries(this.utxoSet.utxoStorage).forEach(([addr, utxos]: [string, Api.Utxo[]]) => {
			this.utxoSet.add(utxos, addr);
		});
		this.transactionsStorage = cache.transactionsStorage;
		this.addressManager.getAddresses(cache.addresses.receiveCounter + 1, 'receive');
		this.addressManager.getAddresses(cache.addresses.changeCounter + 1, 'change');
		this.addressManager.receiveAddress.advance(cache.addresses.receiveCounter - 1);
		this.addressManager.changeAddress.advance(cache.addresses.changeCounter);
		// @ts-ignore
		this.transactions = txParser(this.transactionsStorage, Object.keys(this.addressManager.all));
		this.runStateChangeHooks();
	}


	/**
	 * Generates encrypted wallet data.
	 * @param password user's chosen password
	 * @returns Promise that resolves to object-like string. Suggested to store as string for .import().
	 */
	async export (password: string): Promise < string > {
		const savedWallet: WalletSave = {
			privKey: this.HDWallet.toString(),
			seedPhrase: this.mnemonic,
		};
		return passworder.encrypt(password, JSON.stringify(savedWallet));
	}


	logger: Logger;
	loggerLevel: number = 0;
	setLogLevel(level: number|string) {
		this.logger.level = level;
		this.loggerLevel = this.logger.levels[level];
		kaspacore.setDebugLevel(this.logger.levels[level]);
	}
}

export {Wallet}