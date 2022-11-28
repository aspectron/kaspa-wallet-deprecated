const Mnemonic = require('bitcore-mnemonic');
import * as kaspacore from '@kaspa/core-lib';
import * as helper from '../utils/helper';
import {Storage, StorageType} from './storage';
export * from './storage';
export * from './error';
import {Crypto} from './crypto';
const KAS = helper.KAS;

import {
	Network, NetworkOptions, SelectedNetwork, WalletSave, Api, TxSend, TxResp,
	PendingTransactions, WalletCache, IRPC, RPC, WalletOptions,	WalletOpt,
	TxInfo, ComposeTxInfo, BuildTxResult, TxCompoundOptions, DebugInfo,
	ScaneMoreResult
} from '../types/custom-types';

import {CreateLogger, Logger} from '../utils/logger';
import {AddressManager} from './address-manager';
import {UnspentOutput, UtxoSet, CONFIRMATION_COUNT, COINBASE_CFM_COUNT} from './utxo';
import {TXStore} from './tx-store';
import {CacheStore} from './cache-store';
import {KaspaAPI, ApiError} from './api';
import {DEFAULT_FEE,DEFAULT_NETWORK} from '../config.json';
import {EventTargetImpl} from './event-target-impl';


const BALANCE_CONFIRMED = Symbol();
const BALANCE_PENDING = Symbol();
const BALANCE_TOTAL = Symbol();
const COMPOUND_UTXO_MAX_COUNT = 500;

const SompiPerKaspa = 100_000_000

// MaxSompi is the maximum transaction amount allowed in sompi.
const MaxSompi = 21_000_000 * SompiPerKaspa

export {kaspacore, COMPOUND_UTXO_MAX_COUNT, CONFIRMATION_COUNT, COINBASE_CFM_COUNT};

/** Class representing an HDWallet with derivable child addresses */
class Wallet extends EventTargetImpl {

	static Mnemonic: typeof Mnemonic = Mnemonic;
	static passwordHandler = Crypto;
	static Crypto = Crypto;
	static kaspacore=kaspacore;
	static COMPOUND_UTXO_MAX_COUNT=COMPOUND_UTXO_MAX_COUNT;
	static MaxMassAcceptedByBlock = 100000;
	static MaxMassUTXOs = 100000;
	//Wallet.MaxMassAcceptedByBlock -
	//kaspacore.Transaction.EstimatedStandaloneMassWithoutInputs;

	// TODO - integrate with Kaspacore-lib
	static networkTypes: Object = {
		kaspa: { port: 16110, network: 'kaspa', name : 'mainnet' },
		kaspatest: { port: 16210, network: 'kaspatest', name : 'testnet' },
		kaspasim: {	port: 16510, network: 'kaspasim', name : 'simnet' },
		kaspadev: {	port: 16610, network: 'kaspadev', name : 'devnet' }
	}

	static networkAliases: Object = {
		mainnet: 'kaspa',
		testnet: 'kaspatest',
		devnet: 'kaspadev',
		simnet: 'kaspasim'
	}


	static KAS(v:number): string {
		return KAS(v);
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
		const decrypted = await Crypto.decrypt(password, encryptedMnemonic);
		const savedWallet = JSON.parse(decrypted) as WalletSave;
		const myWallet = new this(savedWallet.privKey, savedWallet.seedPhrase, networkOptions, options);
		return myWallet;
	}

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

	get changeAddress() {
		return this.addressManager.changeAddress.current.address;
	}

	/**
	 * Current network.
	 */
	network: Network = 'kaspa';

	api: KaspaAPI; //new KaspaAPI();

	/** 
	 * Default fee
	 */

	defaultFee: number = 1; //per byte

	subnetworkId: string = "0000000000000000000000000000000000000000"; //hex string

	last_tx_:string = '';
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
	connectSignal:helper.DeferredPromise;
	txStore:TXStore;
	cacheStore:CacheStore;

	uid:string;

	/** Create a wallet.
	 * @param walletSave (optional)
	 * @param walletSave.privKey Saved wallet's private key.
	 * @param walletSave.seedPhrase Saved wallet's seed phrase.
	 */
	constructor(privKey: string, seedPhrase: string, networkOptions: NetworkOptions, options: WalletOptions = {}) {
		super();
		this.logger = CreateLogger('KaspaWallet');
		this.api = new KaspaAPI();
		//@ts-ignore
		//postMessage({error:new ApiError("test") })
		let defaultOpt = {
			skipSyncBalance: false,
			syncOnce: false,
			addressDiscoveryExtent:150,
			logLevel:'info',
			disableAddressDerivation:false,
			checkGRPCFlags:false,
			minimumRelayTransactionFee:1000,
			updateTxTimes:true
		};
		// console.log("CREATING WALLET FOR NETWORK", this.network);
		this.options = {...defaultOpt,	...options};
		//this.options.addressDiscoveryExtent = 500;
		this.setLogLevel(this.options.logLevel); 

		this.network = networkOptions.network;
		this.defaultFee = networkOptions.defaultFee || this.defaultFee;
		if (networkOptions.rpc)
			this.api.setRPC(networkOptions.rpc);


		if (privKey && seedPhrase) {
			this.HDWallet = new kaspacore.HDPrivateKey(privKey);
			this.mnemonic = seedPhrase;
		} else {
			const temp = new Mnemonic(Mnemonic.Words.ENGLISH);
			this.mnemonic = temp.toString();
			this.HDWallet = new kaspacore.HDPrivateKey(temp.toHDPrivateKey().toString());
		}

		this.uid = this.createUID();

		this.utxoSet = new UtxoSet(this);
		this.txStore = new TXStore(this);
		this.cacheStore = new CacheStore(this);
		//this.utxoSet.on("balance-update", this.updateBalance.bind(this));
		
		this.addressManager = new AddressManager(this.HDWallet, this.network);
		if(this.options.disableAddressDerivation)
			this.addressManager.receiveAddress.next();
		//this.initAddressManager();
		//this.sync(this.options.syncOnce);
		this.connectSignal = helper.Deferred();
		this.api.on("connect", ()=>{
			this.onApiConnect()
		})
		this.api.on("disconnect", ()=>{
			this.onApiDisconnect();
		})
	}

	createUID(){
		const {privateKey} = this.HDWallet.deriveChild(`m/44'/972/0'/1'/0'`);
		let address = privateKey.toAddress(this.network).toString().split(":")[1]
		return helper.createHash(address);
	}

	async onApiConnect(){
		this.connectSignal.resolve();
		let {connected} = this;
		this.connected = true;
		this.logger.info("gRPC connected");
		this.emit("api-connect");
		if(this.syncSignal && connected!==undefined) {//if sync was called
			this.logger.info("starting wallet re-sync ...");
			await this.sync(this.syncOnce);
		}
		
	}

	connected:boolean|undefined;
	onApiDisconnect() {
		this.connected = false;
		this.syncVirtualSelectedParentBlueScoreStarted = false;
		this.logger.verbose("gRPC disconnected");
		this.emit("api-disconnect");
	}

	async update(syncOnce:boolean=true){
		await this.sync(syncOnce);
	}

	syncOnce:boolean|undefined;
	syncSignal: helper.DeferredPromise|undefined;
	waitOrSync(){
		if(this.syncSignal)
			return this.syncSignal;
		return this.sync();
	}
	async sync(syncOnce:boolean|undefined=undefined){
		this.syncSignal = helper.Deferred();
		await this.connectSignal;
		if(syncOnce === undefined)
			syncOnce = this.options.syncOnce;
		syncOnce = !!syncOnce;

		this.syncInProggress = true;
		this.emit("sync-start");
		await this.txStore.restore();
		await this.cacheStore.restore();
		const ts0 = Date.now();
		this.logger.info(`sync ... starting wallet sync`);// ${syncOnce?'(monitoring disabled)':''}`);
		//this.logger.info(`sync ............ started, syncOnce:${syncOnce}`)

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
		
		if(this.options.disableAddressDerivation){
			this.logger.warn('sync ... running with address discovery disabled');
			this.utxoSet.syncAddressesUtxos([this.receiveAddress]);
		}else{
		    await this.addressDiscovery(this.options.addressDiscoveryExtent)
		    .catch(e=>{
		        this.logger.info("addressDiscovery:error", e)
		    })
	    }

	    this.syncInProggress = false;
	    if(!syncOnce)
			await this.utxoSet.utxoSubscribe();

		const ts1 = Date.now();
		const delta = ((ts1-ts0)/1000).toFixed(1);
	    this.logger.info(`sync ... ${this.utxoSet.count} UTXO entries found`);
		this.logger.info(`sync ... indexed ${this.addressManager.receiveAddress.counter} receive and ${this.addressManager.changeAddress.counter} change addresses`);
	    this.logger.info(`sync ... finished (sync done in ${delta} seconds)`);
		this.emit("sync-finish");
		const {available, pending, total} = this.balance;
		this.emit("ready", {
			available,pending, total,
			confirmedUtxosCount: this.utxoSet.confirmedCount
		});
	    this.emitBalance();
	    this.emitAddress();
	    this.txStore.emitTxs();
	    this.syncSignal.resolve();
		if(!this.utxoSet.clearMissing())
			this.updateDebugInfo();
	}

	getVirtualSelectedParentBlueScore() {
		return this.api.getVirtualSelectedParentBlueScore();
	}

	getVirtualDaaScore() {
		return this.api.getVirtualDaaScore();
	}

	async initBlueScoreSync(once:boolean = false) {
		if(this.syncVirtualSelectedParentBlueScoreStarted)
			return;
		this.syncVirtualSelectedParentBlueScoreStarted = true;
		let r = await this.getVirtualDaaScore();
		let {virtualDaaScore:blueScore} = r;
		console.log("getVirtualSelectedParentBlueScore :result", r)
		this.blueScore = blueScore;
		this.emit("blue-score-changed", {blueScore})
		this.utxoSet.updateUtxoBalance();

		if(once) {
			this.syncVirtualSelectedParentBlueScoreStarted = false;
			return;
		}
		this.api.subscribeVirtualDaaScoreChanged((result) => {
			let {virtualDaaScore} = result;
			//console.log("subscribeVirtualSelectedParentBlueScoreChanged:result", result)
			this.blueScore = virtualDaaScore;
			this.emit("blue-score-changed", {
				blueScore: virtualDaaScore
			})
			this.utxoSet.updateUtxoBalance();
		}).then(r=>{
			console.log("subscribeVirtualDaaScoreChanged:responce", r)
		}, e=>{
			console.log("subscribeVirtualDaaScoreChanged:error", e)
		})
	}

	addressManagerInitialized:boolean|undefined;
	initAddressManager() {
		if(this.addressManagerInitialized)
			return
		this.addressManagerInitialized = true;

		this.addressManager.on("new-address", detail => {
			if(!this.syncInProggress){
				this.emitAddress();
			}
			//console.log("new-address", detail)
			if (this.options.skipSyncBalance)
				return

			//console.log("new-address:detail", detail)
			const {	address, type } = detail;
			this.utxoSet.syncAddressesUtxos([address]);
		})
		if(!this.receiveAddress){
			this.addressManager.receiveAddress.next();
		}
	}

	async startUpdatingTransactions(version:undefined|number=undefined):Promise<boolean>{
		return await this.txStore.startUpdatingTransactions(version);
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
	/*
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
	*/

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
		this.logger.verbose(`scanning UTXO entries for ${addresses.length} addresses`);

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
			this.logger.verbose(`${address} - ${utxos.length} UTXO entries found`);
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
		this.logger.debug(`balance available: ${available} pending: ${pending}`);
		this.emit("balance-update", {
			available,
			pending,
			total,
			confirmedUtxosCount: this.utxoSet.confirmedCount
		});
	}

	debugInfo:DebugInfo = {inUseUTXOs:{satoshis:0, count:0}};
	updateDebugInfo(){
		let inUseUTXOs = {satoshis:0, count:0};
		let {confirmed, pending, used} = this.utxoSet.utxos||{};
		this.utxoSet.inUse.map(utxoId => {
			inUseUTXOs.satoshis += confirmed.get(utxoId)?.satoshis ||
				pending.get(utxoId)?.satoshis ||
				used.get(utxoId)?.satoshis || 0;
		});
		inUseUTXOs.count = this.utxoSet.inUse.length;
		this.debugInfo = {inUseUTXOs};
		this.emit("debug-info", {debugInfo:this.debugInfo});
	}

	clearUsedUTXOs(){
		this.utxoSet.clearUsed();
	}

	emitCache(){
		let {cache} = this;
		this.emit("state-update", {cache});
	}

	lastAddressNotification:{receive?:string, change?:string} = {};
	emitAddress(){
		const receive = this.receiveAddress;
		const change = this.changeAddress;
		let {receive:_receive, change:_change}= this.lastAddressNotification
		if(receive == _receive && change == _change)
			return
		this.lastAddressNotification = {receive, change};
		this.emit("new-address", {
			receive, change
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
		//this.pendingInfo.transactions = {};
		this.transactions = {};
		this.transactionsStorage = {};
	}

	async scanMoreAddresses(count=100, debug=false, receiveStart=-1, changeStart=-1): Promise<ScaneMoreResult>{
		if (this.syncInProggress)
			return {error: "Sync in progress", code:"SYNC-IN-PROGRESS"};

		if(receiveStart < 0)
			receiveStart = this.addressManager.receiveAddress.counter

		if(changeStart < 0)
			changeStart = this.addressManager.changeAddress.counter

		this.syncInProggress = true;
		this.emit("scan-more-addresses-started", {receiveStart, changeStart})
		let error = false;
		let res = await this.addressDiscovery(this.options.addressDiscoveryExtent, debug, receiveStart, changeStart, count)
		.catch(e=>{
			this.logger.info("addressDiscovery:error", e)
			error = e;
		})

		this.syncInProggress = false;
		if(!this.syncOnce)
			this.utxoSet.utxoSubscribe();
		this.emit("scan-more-addresses-ended", {error})

		if(error)
			return {error, code:"ADDRESS-DISCOVERY"};

		let {highestIndex=null, endPoints=null} = res||{};
		this.logger.info("scanMoreAddresses:highestIndex", highestIndex)
		this.logger.info("scanMoreAddresses:endPoints", endPoints)

		this.emit("scan-more-addresses-ended", {
			receiveFinal:this.addressManager.receiveAddress.counter-1,
			changeFinal:this.addressManager.changeAddress.counter-1
		})

		return {
			code:"SUCCESS",
			receive:{
				start:receiveStart,
				end: endPoints?.receive||receiveStart+count,
				final:this.addressManager.receiveAddress.counter-1
			},
			change:{
				start:changeStart,
				end: endPoints?.change||changeStart+count,
				final:this.addressManager.changeAddress.counter-1
			}
		};
	}

	/**
	 * Derives receiveAddresses and changeAddresses and checks their transactions and UTXOs.
	 * @param threshold stop discovering after `threshold` addresses with no activity
	 */
	async addressDiscovery(threshold = 64, debug = false, receiveStart=0, changeStart=0, count=0): Promise <{
		debugInfo: Map <string, {utxos: Api.Utxo[], address: string}>|null;
		highestIndex:{receive:number, change:number},
		endPoints:{receive:number, change:number}
	}> {
		let addressList: string[] = [];
		let debugInfo: Map < string, {utxos: Api.Utxo[], address: string} > | null = null;

		this.logger.info(`sync ... running address discovery, threshold:${threshold}`);
		const cacheIndexes = this.cacheStore.getAddressIndexes()??{receive:0, change:0}
		this.logger.info(`sync ...cacheIndexes: receive:${cacheIndexes.receive}, change:${cacheIndexes.change}`);
		let highestIndex = {
			receive:this.addressManager.receiveAddress.counter-1,
			change:this.addressManager.changeAddress.counter-1
		}
		let endPoints = {
			receive:0,
			change:0
		}
		let maxOffset = {
			receive: receiveStart + count,
			change: changeStart + count
		}

		const doDiscovery = async(
			n:number, deriveType:'receive'|'change', offset:number
		): Promise <number> => {

			this.logger.info(`sync ... scanning ${offset} - ${offset+n} ${deriveType} addresses`);
			this.emit("sync-progress", {
				start:offset,
				end:offset+n,
				addressType:deriveType
			})
			const derivedAddresses = this.addressManager.getAddresses(n, deriveType, offset);
			const addresses = derivedAddresses.map((obj) => obj.address);
			addressList = [...addressList, ...addresses];
			this.logger.verbose(
				`${deriveType}: address data for derived indices ${derivedAddresses[0].index}..${derivedAddresses[derivedAddresses.length-1].index}`
			);
			// if (this.loggerLevel > 0)
			// 	this.logger.verbose("addressDiscovery: findUtxos for addresses::", addresses)
			const {addressesWithUTXOs, txID2Info} = await this.findUtxos(addresses, debug);
			if (!debugInfo)
				debugInfo = txID2Info;
			if (addressesWithUTXOs.length === 0) {
				// address discovery complete
				const lastAddressIndexWithTx = highestIndex[deriveType];//offset - (threshold - n) - 1;
				this.logger.verbose(`${deriveType}: address discovery complete`);
				this.logger.verbose(`${deriveType}: last activity on address #${lastAddressIndexWithTx}`);
				this.logger.verbose(`${deriveType}: no activity from ${offset}..${offset + n}`);
				if(offset >= maxOffset[deriveType] && offset >= cacheIndexes[deriveType]){
					endPoints[deriveType] = offset+n;
					return lastAddressIndexWithTx;
				}
			}
			// else keep doing discovery
			const index =
				derivedAddresses
				.filter((obj) => addressesWithUTXOs.includes(obj.address))
				.reduce((prev, cur) => Math.max(prev, cur.index), highestIndex[deriveType]);
			highestIndex[deriveType] = index;
			return doDiscovery(n, deriveType, offset + n);
		};
		const highestReceiveIndex = await doDiscovery(threshold, 'receive', receiveStart);
		const highestChangeIndex = await doDiscovery(threshold, 'change', changeStart);
		this.addressManager.receiveAddress.advance(highestReceiveIndex + 1);
		this.addressManager.changeAddress.advance(highestChangeIndex + 1);
		this.logger.verbose(
			`receive address index: ${highestReceiveIndex}; change address index: ${highestChangeIndex}`,
			`receive-address-index: ${this.addressManager.receiveAddress.counter}; change address index: ${this.addressManager.changeAddress.counter}`
		);

		if(!this.syncOnce && !this.syncInProggress)
			await this.utxoSet.utxoSubscribe();

		this.runStateChangeHooks();
		let addressIndexes = {
			receive:Math.max(cacheIndexes.receive, this.addressManager.receiveAddress.counter),
			change:Math.max(cacheIndexes.change, this.addressManager.changeAddress.counter)
		}
		this.logger.info(`sync ...new cache: receive:${addressIndexes.receive}, change:${addressIndexes.change}`);
		this.cacheStore.setAddressIndexes(addressIndexes)
		this.emit("sync-end", addressIndexes)
		return {highestIndex, endPoints, debugInfo};
	}

	// TODO: convert amount to sompis aka satoshis
	// TODO: bn
	/**
	 * Compose a serialized, signed transaction
	 * @param obj
	 * @param obj.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
	 * @param obj.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KAS)
	 * @param obj.fee Fee for miners in sompis
	 * @param obj.changeAddrOverride Use this to override automatic change address derivation
	 * @throws if amount is above `Number.MAX_SAFE_INTEGER`
	 */
	composeTx({
		toAddr,
		amount,
		fee = DEFAULT_FEE,
		changeAddrOverride,
		skipSign = false,
		privKeysInfo = false,
		compoundingUTXO = false,
		compoundingUTXOMaxCount = COMPOUND_UTXO_MAX_COUNT
	}: TxSend): ComposeTxInfo {
		// TODO: bn!
		amount = parseInt(amount as any);
		fee = parseInt(fee as any);
		// if (this.loggerLevel > 0) {
		// 	for (let i = 0; i < 100; i++)
		// 		console.log('Wallet transaction request for', amount, typeof amount);
		// }
		//if (!Number.isSafeInteger(amount)) throw new Error(`Amount ${amount} is too large`);
		let utxos, utxoIds, mass;
		if(compoundingUTXO){
			({utxos, utxoIds, amount, mass} = this.utxoSet.collectUtxos(compoundingUTXOMaxCount));
		}else{
			({utxos, utxoIds, mass} = this.utxoSet.selectUtxos(amount + fee));
		}
		//if(mass > Wallet.MaxMassUTXOs){
		//	throw new Error(`Maximum number of inputs (UTXOs) reached. Please reduce this transaction amount.`);
		//}
		const privKeys = utxos.reduce((prev: string[], cur:UnspentOutput) => {
			return [this.addressManager.all[String(cur.address)], ...prev] as string[];
		}, []);

		this.logger.info("utxos.length", utxos.length)

		const changeAddr = changeAddrOverride || this.addressManager.changeAddress.next();
		try {
			const tx: kaspacore.Transaction = new kaspacore.Transaction()
				.from(utxos)
				.to(toAddr, amount)
				.setVersion(0)
				.fee(fee)
				.change(changeAddr)
			if(!skipSign)
				tx.sign(privKeys, kaspacore.crypto.Signature.SIGHASH_ALL, 'schnorr');

			//window.txxxx = tx;
			return {
				tx: tx,
				id: tx.id,
				rawTx: tx.toString(),
				utxoIds,
				amount,
				fee,
				utxos,
				toAddr,
				privKeys: privKeysInfo?privKeys:[]
			};
		} catch (e) {
			console.log("composeTx:error", e)
			// !!! FIXME
			if(!changeAddrOverride)
				this.addressManager.changeAddress.reverse();
			throw e;
		}
	}

	minimumRequiredTransactionRelayFee(mass:number):number{
		let minimumFee = (mass * this.options.minimumRelayTransactionFee) / 1000

		if (minimumFee == 0 && this.options.minimumRelayTransactionFee > 0) {
			minimumFee = this.options.minimumRelayTransactionFee
		}

		// Set the minimum fee to the maximum possible value if the calculated
		// fee is not in the valid range for monetary amounts.
		if (minimumFee > MaxSompi) {
			minimumFee = MaxSompi
		}

		return minimumFee
	}

	/*
	validateAddress(addr:string):boolean{
		let address = new kaspacore.Address(addr);
		return address.type == "pubkey";
	}
	*/

	/**
	 * Estimate transaction fee. Returns transaction data.
	 * @param txParams
	 * @param txParams.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
	 * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KAS)
	 * @param txParams.fee Fee for miners in sompis
	 * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
	 */
	async estimateTransaction(txParamsArg: TxSend): Promise < TxInfo > {
		let address = this.addressManager.changeAddress.current.address;
		if(!address){
			address = this.addressManager.changeAddress.next();
		}
		txParamsArg.changeAddrOverride = address;
		return this.composeTxAndNetworkFeeInfo(txParamsArg);
	}
	async composeTxAndNetworkFeeInfo(txParamsArg: TxSend): Promise < TxInfo >{
		await this.waitOrSync();
		if(!txParamsArg.fee)
			txParamsArg.fee = 0;
		this.logger.info(`tx ... sending to ${txParamsArg.toAddr}`)
		this.logger.info(`tx ... amount: ${KAS(txParamsArg.amount)} user fee: ${KAS(txParamsArg.fee)} max data fee: ${KAS(txParamsArg.networkFeeMax||0)}`)

		//if(!this.validateAddress(txParamsArg.toAddr)){
		//	throw new Error("Invalid address")
		//}

		let txParams : TxSend = { ...txParamsArg } as TxSend;
		const networkFeeMax = txParams.networkFeeMax || 0;
		let calculateNetworkFee = !!txParams.calculateNetworkFee;
		let inclusiveFee = !!txParams.inclusiveFee;
		const {skipSign=true, privKeysInfo=false} = txParams;
		txParams.skipSign = skipSign;
		txParams.privKeysInfo = privKeysInfo;

		//console.log("calculateNetworkFee:", calculateNetworkFee, "inclusiveFee:", inclusiveFee)

		let data = this.composeTx(txParams);
		
		let {txSize, mass} = data.tx.getMassAndSize();
		let dataFee = this.minimumRequiredTransactionRelayFee(mass);
		const priorityFee = txParamsArg.fee;

		if(txParamsArg.compoundingUTXO){
			inclusiveFee = true;
			calculateNetworkFee = true;
			txParamsArg.amount = data.amount;
			txParams.amount = data.amount;
			txParams.compoundingUTXO = false;
		}

		const txAmount = txParamsArg.amount;
		let amountRequested = txParamsArg.amount+priorityFee;

		let amountAvailable = data.utxos.map(utxo=>utxo.satoshis).reduce((a,b)=>a+b,0);
		this.logger.verbose(`tx ... need data fee: ${KAS(dataFee)} total needed: ${KAS(amountRequested+dataFee)}`)
		this.logger.verbose(`tx ... available: ${KAS(amountAvailable)} in ${data.utxos.length} UTXOs`)

		if(networkFeeMax && dataFee > networkFeeMax) {
			throw new Error(`Fee max is ${networkFeeMax} but the minimum fee required for this transaction is ${KAS(dataFee)} KAS`);
		}

		if(calculateNetworkFee){
			do {
				//console.log(`insufficient data fees... incrementing by ${dataFee}`);
				txParams.fee = priorityFee+dataFee;
				if(inclusiveFee){
					txParams.amount = txAmount-txParams.fee;
				}
				this.logger.verbose(`tx ... insufficient data fee for transaction size of ${txSize} bytes`);
				this.logger.verbose(`tx ... need data fee: ${KAS(dataFee)} for ${data.utxos.length} UTXOs`);
				this.logger.verbose(`tx ... rebuilding transaction with additional inputs`);
				let utxoLen = data.utxos.length;
				this.logger.debug(`final fee ${txParams.fee}`);
				data = this.composeTx(txParams);
				({txSize, mass} = data.tx.getMassAndSize());
				dataFee = this.minimumRequiredTransactionRelayFee(mass);
				if(data.utxos.length != utxoLen)
					this.logger.verbose(`tx ... aggregating: ${data.utxos.length} UTXOs`);

			} while((!networkFeeMax || txParams.fee <= networkFeeMax) && txParams.fee < dataFee+priorityFee);

			if(networkFeeMax && txParams.fee > networkFeeMax)
				throw new Error(`Maximum network fee exceeded; need: ${KAS(dataFee)} KAS maximum is: ${KAS(networkFeeMax)} KAS`);

		}else if(dataFee > priorityFee){
			throw new Error(`Minimum fee required for this transaction is ${KAS(dataFee)} KAS`);
		}else if(inclusiveFee){
			txParams.amount -= txParams.fee;
			data = this.composeTx(txParams);
		}

		data.dataFee = dataFee;
		data.totalAmount = txParams.fee+txParams.amount;
		data.txSize = txSize;
		data.note = txParamsArg.note||"";

		return data as TxInfo
	}

	/**
	 * Build a transaction. Returns transaction info.
	 * @param txParams
	 * @param txParams.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
	 * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KAS)
	 * @param txParams.fee Fee for miners in sompis
	 * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
	 */
	async buildTransaction(txParamsArg: TxSend, debug = false): Promise < BuildTxResult > {
		const ts0 = Date.now();
		txParamsArg.skipSign = true;
		txParamsArg.privKeysInfo = true;
		const data = await this.composeTxAndNetworkFeeInfo(txParamsArg);
		const { 
			id, tx, utxos, utxoIds, amount, toAddr,
			fee, dataFee, totalAmount, txSize, note, privKeys
		} = data;

		const ts_0 = Date.now();
		tx.sign(privKeys, kaspacore.crypto.Signature.SIGHASH_ALL, 'schnorr');
		const {mass:txMass} = tx.getMassAndSize();
		this.logger.info("txMass", txMass)
		if(txMass > Wallet.MaxMassAcceptedByBlock){
			throw new Error(`Transaction size/mass limit reached. Please reduce this transaction amount. (Mass: ${txMass})`);
		}

		const ts_1 = Date.now();
		//const rawTx = tx.toString();
		const ts_2 = Date.now();


		this.logger.info(`tx ... required data fee: ${KAS(dataFee)} (${utxos.length} UTXOs)`);// (${KAS(txParamsArg.fee)}+${KAS(dataFee)})`);
		//this.logger.verbose(`tx ... final fee: ${KAS(dataFee+txParamsArg.fee)} (${KAS(txParamsArg.fee)}+${KAS(dataFee)})`);
		this.logger.info(`tx ... resulting total: ${KAS(totalAmount)}`);


		//console.log(utxos);

		if (debug || this.loggerLevel > 0) {
			this.logger.debug("submitTransaction: estimateTx", data)
			this.logger.debug("sendTx:utxos", utxos)
			this.logger.debug("::utxos[0].script::", utxos[0].script)
			//console.log("::utxos[0].address::", utxos[0].address)
		}

		const {nLockTime: lockTime, version } = tx;

		if (debug || this.loggerLevel > 0)
			this.logger.debug("composeTx:tx", "txSize:", txSize)

		const ts_3 = Date.now();
		const inputs: RPC.TransactionInput[] = tx.inputs.map((input: kaspacore.Transaction.Input) => {
			if (debug || this.loggerLevel > 0) {
				this.logger.debug("input.script.inspect", input.script.inspect())
			}

			return {
				previousOutpoint: {
					transactionId: input.prevTxId.toString("hex"),
					index: input.outputIndex
				},
				signatureScript: input.script.toBuffer().toString("hex"),
				sequence: input.sequenceNumber,
				sigOpCount:1
			};
		})
		const ts_4 = Date.now();
		const outputs: RPC.TransactionOutput[] = tx.outputs.map((output: kaspacore.Transaction.Output) => {
			return {
				amount: output.satoshis,
				scriptPublicKey: {
					scriptPublicKey: output.script.toBuffer().toString("hex"),
					version: 0
				}
			}
		})
		const ts_5 = Date.now();

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
				//payload:'f00f00000000000000001976a914784bf4c2562f38fe0c49d1e0538cee4410d37e0988ac',
				payloadHash: '0000000000000000000000000000000000000000000000000000000000000000',
				//payloadHash:'afe7fc6fe3288e79f9a0c05c22c1ead2aae29b6da0199d7b43628c2588e296f9',
				//
				subnetworkId: this.subnetworkId, //Buffer.from(this.subnetworkId, "hex").toString("base64"),
				fee,
				//gas: 0
			}
		}

		//const rpctx = JSON.stringify(rpcTX, null, "  ");

		const ts1 = Date.now();
		this.logger.info(`tx ... generation time ${((ts1-ts0)/1000).toFixed(2)} sec`)

		if (debug || this.loggerLevel > 0) {
			this.logger.debug(`rpcTX ${JSON.stringify(rpcTX, null, "  ")}`)
			this.logger.debug(`rpcTX ${JSON.stringify(rpcTX)}`)
		}

		const ts_6 = Date.now();

		this.logger.info(`time in msec`, {
			"total": ts_6-ts0,
			"estimate-transaction": ts_0-ts0,
			"tx.sign": ts_1-ts_0,
			"tx.toString": ts_2-ts_1,
			//"ts_3-ts_2": ts_3-ts_2,
			"tx.inputs.map": ts_4-ts_3,
			"tx.outputs.map": ts_5-ts_4,
			//"ts_6-ts_5": ts_6-ts_5
		})

		if(txParamsArg.skipUTXOInUseMark !== true){
			this.utxoSet.updateUsed(utxos);
		}

		//const rpctx = JSON.stringify(rpcTX, null, "  ");
		//console.log("rpcTX", rpcTX)
		//console.log("\n\n########rpctx\n", rpctx+"\n\n\n")
		//if(amount/1e8 > 3)
		//	throw new Error("TODO XXXXXX")
		return {...data, rpcTX}
	}

	/**
	 * Send a transaction. Returns transaction id.
	 * @param txParams
	 * @param txParams.toAddr To address in cashaddr format (e.g. kaspatest:qq0d6h0prjm5mpdld5pncst3adu0yam6xch4tr69k2)
	 * @param txParams.amount Amount to send in sompis (100000000 (1e8) sompis in 1 KAS)
	 * @param txParams.fee Fee for miners in sompis
	 * @throws `FetchError` if endpoint is down. API error message if tx error. Error if amount is too large to be represented as a javascript number.
	 */
	async submitTransaction(txParamsArg: TxSend, debug = false): Promise < TxResp | null > {
		txParamsArg.skipUTXOInUseMark = true;

		let reverseChangeAddress = false;
		if(!txParamsArg.changeAddrOverride){
			txParamsArg.changeAddrOverride = this.addressManager.changeAddress.next();
			reverseChangeAddress = true;
		}

		const {
			rpcTX, utxoIds, amount, toAddr, note, utxos
		} = await this.buildTransaction(txParamsArg, debug);

		//console.log("rpcTX:", rpcTX)
		//throw new Error("TODO : XXXX")
		try {
			const ts = Date.now();
			let txid: string = await this.api.submitTransaction(rpcTX);
			const ts3 = Date.now();
			this.logger.info(`tx ... submission time ${((ts3-ts)/1000).toFixed(2)} sec`);
			this.logger.info(`txid: ${txid}`);
			if(!txid){
				if(reverseChangeAddress)
					this.addressManager.changeAddress.reverse();
				return null;// as TxResp;
			}

			this.utxoSet.inUse.push(...utxoIds);
			this.txStore.add({
				in:false, ts, id:txid, amount, address:toAddr, note,
				blueScore: this.blueScore,
				tx:rpcTX.transaction,
				myAddress: this.addressManager.isOur(toAddr),
				isCoinbase: false,
				version:2
			})
			this.updateDebugInfo();
			this.emitCache()
			/*
			this.pendingInfo.add(txid, {
				rawTx: tx.toString(),
				utxoIds,
				amount,
				to: toAddr,
				fee
			});
			*/
			const resp: TxResp = {
				txid,
				//rpctx
			}
			return resp;
		} catch (e:any) {
			if(reverseChangeAddress)
				this.addressManager.changeAddress.reverse();
			if (typeof e.setExtraDebugInfo == "function"){
				let mass = 0;
				let satoshis = 0;
				let list = utxos.map(tx=>{
					mass += tx.mass;
					satoshis += tx.satoshis;
					return Object.assign({}, tx, {
						address:tx.address.toString(),
						script:tx.script?.toString()
					})
				});
				//86500,00000000
				let info = {
					mass,
					satoshis,
					utxoCount: list.length,
					utxos: list
				}
				e.setExtraDebugInfo(info)
			}
			throw e;
		}
	}

	/*
	* Compound UTXOs by re-sending funds to itself
	*/	
	async compoundUTXOs(txCompoundOptions:TxCompoundOptions={}, debug=false):Promise<TxResp|null> {
		const {
			UTXOMaxCount=COMPOUND_UTXO_MAX_COUNT,
			networkFeeMax=0,
			fee=0,
			useLatestChangeAddress=false
		} = txCompoundOptions;

		//let toAddr = this.addressManager.changeAddress.next()

		let toAddr = this.addressManager.changeAddress.atIndex[0];
		//console.log("compoundUTXOs: to address:", toAddr, "useLatestChangeAddress:"+useLatestChangeAddress)
		if (useLatestChangeAddress){
			toAddr = this.addressManager.changeAddress.current.address;
		}
		if(!toAddr){
			toAddr = this.addressManager.changeAddress.next();
		}

		let txParamsArg = {
			toAddr,
			changeAddrOverride:toAddr,
			amount: -1,
			fee,
			networkFeeMax,
			compoundingUTXO:true,
			compoundingUTXOMaxCount:UTXOMaxCount
		}
		try {
			let res = await this.submitTransaction(txParamsArg, debug);
			if(!res?.txid)
				this.addressManager.changeAddress.reverse()
			return res;
		}catch(e){
			this.addressManager.changeAddress.reverse();
			throw e;
		}
	}

	/*
	undoPendingTx(id: string): void {
		const {	utxoIds	} = this.pendingInfo.transactions[id];
		delete this.pendingInfo.transactions[id];
		this.utxoSet.release(utxoIds);
		this.addressManager.changeAddress.reverse();
		this.runStateChangeHooks();
	}
	*/

	/**
	 * After we see the transaction in the API results, delete it from our pending list.
	 * @param id The tx hash
	 */
	 /*
	deletePendingTx(id: string): void {
		// undo + delete old utxos
		const {	utxoIds } = this.pendingInfo.transactions[id];
		delete this.pendingInfo.transactions[id];
		this.utxoSet.remove(utxoIds);
	}
	*/

	runStateChangeHooks(): void {
		//this.utxoSet.updateUtxoBalance();
		//this.updateBalance();
	}

	//UTXOsPollingStarted:boolean = false;
	emitedUTXOs:Set<string> = new Set()
	startUTXOsPolling(){
		//if (this.UTXOsPollingStarted)
		//	return
		//this.UTXOsPollingStarted = true;
		this.emitUTXOs();
	}

	emitUTXOs(){
		let chunks = helper.chunks([...this.utxoSet.utxos.confirmed.values()], 100);
		chunks = chunks.concat(helper.chunks([...this.utxoSet.utxos.pending.values()], 100));

		let send = ()=>{
			let utxos = chunks.pop();
			if (!utxos)
				return
			utxos = utxos.map(tx=>{
				return Object.assign({}, tx, {
					address:tx.address.toString()
				})
			})
			this.emit("utxo-sync", {utxos})

			helper.dpc(200, send)
		}

		send();
	}

	get cache() {
		return {
			//pendingTx: this.pendingInfo.transactions,
			utxos: {
				//utxoStorage: this.utxoSet.utxoStorage,
				inUse: this.utxoSet.inUse,
			},
			//transactionsStorage: this.transactionsStorage,
			addresses: {
				receiveCounter: this.addressManager.receiveAddress.counter,
				changeCounter: this.addressManager.changeAddress.counter,
			}
		};
	}

	restoreCache(cache: WalletCache): void {
		//this.pendingInfo.transactions = cache.pendingTx;
		//this.utxoSet.utxoStorage = cache.utxos.utxoStorage;
		this.utxoSet.inUse = cache.utxos.inUse;
		/*
		Object.entries(this.utxoSet.utxoStorage).forEach(([addr, utxos]: [string, Api.Utxo[]]) => {
			this.utxoSet.add(utxos, addr);
		});
		this.transactionsStorage = cache.transactionsStorage;
		this.addressManager.getAddresses(cache.addresses.receiveCounter + 1, 'receive');
		this.addressManager.getAddresses(cache.addresses.changeCounter + 1, 'change');
		this.addressManager.receiveAddress.advance(cache.addresses.receiveCounter - 1);
		this.addressManager.changeAddress.advance(cache.addresses.changeCounter);
		//this.transactions = txParser(this.transactionsStorage, Object.keys(this.addressManager.all));
		this.runStateChangeHooks();
		*/
	}

	/**
	 * Generates encrypted wallet data.
	 * @param password user's chosen password
	 * @returns Promise that resolves to object-like string. Suggested to store as string for .import().
	 */
	async export (password: string): Promise < string > {
		const savedWallet: WalletSave = {
			privKey: this.HDWallet.toString(),
			seedPhrase: this.mnemonic
		};
		return Crypto.encrypt(password, JSON.stringify(savedWallet));
	}


	logger: Logger;
	loggerLevel: number = 0;
	setLogLevel(level: string) {
		this.logger.setLevel(level);
		this.loggerLevel = level!='none'?2:0;
		kaspacore.setDebugLevel(level?1:0);
	}
}

export {Wallet}