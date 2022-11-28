import {Wallet} from './wallet';
import {iDB} from './indexed-db';
import {Api} from 'custom-types';

const API_BASE = "https://api.kaspa.org/";

interface APITx{
	block_time:number,
	transaction_id:string
}

export interface TXStoreItem{
	in:boolean;
	ts:number;
	id:string;
	amount:number;
	address:string;
	blueScore:number;
	note?:string;
	tx?:any,
	myAddress?:boolean,
	isCoinbase:boolean,
	isMoved?:boolean,
	version?:number
}

export const internalNames = {
	mainnet : "default",
	kaspa: "default",
	testnet : "testnet",
	kaspatest: "testnet",
	kaspasim: "simnet",
	kaspadev: "devnet",
  kaspareg: "kaspareg"
}

export class TXStore{

	static MAX = 20000;
	wallet:Wallet;
	store:Map<string, TXStoreItem> = new Map();
	txToEmitList:TXStoreItem[] = [];
	updatedTxToEmitList:TXStoreItem[] = [];
	idb:iDB|undefined;

	constructor(wallet:Wallet){
		this.wallet = wallet;
		let {uid, network} = wallet;
		let sNetwork:string = internalNames[network]||network;
		//this.restore();
		if(typeof indexedDB != "undefined")
			this.idb = new iDB({storeName:"tx", dbName:"kaspa_"+uid+"_"+sNetwork});
	}

	add(tx:TXStoreItem, skipSave=false){
		//console.log("idb add:tx:", "ts:"+tx.ts, "skipSave:"+skipSave, tx)
		if(this.store.has(tx.id))
			return false;
		this.store.set(tx.id, tx);
		this.emitTx(tx);
		if(this.store.size > TXStore.MAX)
			this.store = new Map([...this.store.entries()].slice(-TXStore.MAX));
		if(!skipSave)
			this.save(tx);
		return true;
	}
	removePendingUTXO(utxo:Api.Utxo, address:string=''){
		let id = utxo.transactionId+":"+utxo.index;
		let dbItem = this.store.get(id);
		if(dbItem){
			dbItem.isMoved = true;
			this.store.set(id, dbItem);
			this.save(dbItem);
		}else{
			dbItem = {
				in: true,
				ts: Date.now(),
				id,
				amount: utxo.amount,
				address,
				blueScore:utxo.blockDaaScore,
				tx:false,//TODO
				isMoved:true,
				isCoinbase:false
			};
		}
		this.emitTx(dbItem);
	}
	fetchTransactions(txIds:string[]):Promise<APITx[]> {
		return fetch(`${API_BASE}transactions/search?fields=transaction_id%2Cblock_time`, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'content-type': 'application/json'
				},
				method: "POST",
				body: JSON.stringify({ "transactionIds": txIds })
			})
			.catch(err=>{
				this.wallet.logger.debug("ExplorerAPI transactions/search : error", err);
			})
			.then((response:void|Response) => {
				this.wallet.logger.debug("ExplorerAPI transactions/search, txIds:", txIds,  "Response:", response);
				if (response){
					return response.json()
				}
			})
			.then(data => {
				this.wallet.logger.debug("ExplorerAPI transactions/search, data:", data);
				if (Array.isArray(data))
					return data
				return [];
			});
	}
	async fetchTxTime(txIds:string[]):Promise<Record<string, number>>{
		let txs = await this.fetchTransactions(txIds);
		//this.wallet.logger.info("fetchTransactions: result", txs);
		let txid2time:Record<string, number> = {};
		if (Array.isArray(txs)){
			txs.forEach(tx=>{
				txid2time[tx.transaction_id] = tx.block_time;
			});
		}

		return txid2time;
	}
	async addAddressUTXOs(address:string, utxos:Api.Utxo[], ts?:number){
		if(!utxos.length || this.wallet.addressManager.isOurChange(address))
			return

		utxos.forEach(utxo=>{
			let item = {
				in: true,
				ts: ts||Date.now(),
				id: utxo.transactionId+":"+utxo.index,
				amount: utxo.amount,
				address,
				blueScore:utxo.blockDaaScore,
				isCoinbase:utxo.isCoinbase,
				tx:false//TODO
			};
			this.add(item);
		})
	}
	addFromUTXOs(list:Map<string, Api.Utxo[]>){
		let ts = Date.now();
		list.forEach((utxos, address)=>{
			this.addAddressUTXOs(address, utxos, ts)
		})
	}

	save(tx:TXStoreItem){
		if (this.wallet.options.updateTxTimes){
			this.updateTransactionTime(tx.id);
		}
		if(typeof indexedDB != "undefined"){
			this.idb?.set(tx.id, JSON.stringify(tx))
		}
	}

	pendingUpdate:string[] = [];
	updateTxTimeoutId:NodeJS.Timeout|null = null;
	updateTransactionTime(id:string){
		this.wallet.logger.debug("updateTransactionTime", id);

		this.pendingUpdate.push(id);
		if (this.updateTxTimeoutId){
			clearTimeout(this.updateTxTimeoutId);
		}
	
		if(this.pendingUpdate.length > 500){
			this.updateTransactionTimeImpl();
		}else{
			this.updateTxTimeoutId = setTimeout(()=>{
				this.updateTransactionTimeImpl();
			}, 10000);
		}
	}

	emitTx(tx:TXStoreItem){
		if(this.wallet.syncSignal && !this.wallet.syncInProggress){
			if(tx.isMoved){
				this.wallet.emit("moved-transaction", tx);
			}else{
				this.wallet.emit("new-transaction", tx);
			}
			return;
		}

		if (this.emitTxTimeoutId){
			clearTimeout(this.emitTxTimeoutId);
		}

		this.txToEmitList.push(tx);
		if(this.txToEmitList.length > 500){
			this.emitTxs();
		}else{
			this.emitTxTimeoutId = setTimeout(()=>{
				this.emitTxs();
			}, 3000);
		}
	}
	emitTxs(){
		let list = this.txToEmitList;
		this.txToEmitList = [];
		this.wallet.emit("transactions", list);
	}

	emitTxTimeoutId:NodeJS.Timeout|null = null;
	emitUpdateTxTimeoutId:NodeJS.Timeout|null = null;
	emitUpdateTx(tx:TXStoreItem){
		this.updatedTxToEmitList.push(tx);
		if (this.emitUpdateTxTimeoutId){
			clearTimeout(this.emitUpdateTxTimeoutId);
		}
	
		if(this.updatedTxToEmitList.length > 500){
			this.emitUpdateTxImpl();
		}else{
			this.emitUpdateTxTimeoutId = setTimeout(()=>{
				this.emitUpdateTxImpl();
			}, 3000);
		}
	}

	emitUpdateTxImpl(){
		let list = this.updatedTxToEmitList;
		this.updatedTxToEmitList = [];
		this.wallet.emit("update-transactions", list);
	}

	updatingTransactionsInprogress:boolean = false;
	async startUpdatingTransactions(version:undefined|number=undefined):Promise<boolean>{
		this.wallet.logger.info("startUpdatingTransactions:", this.updatingTransactionsInprogress);
		if (this.updatingTransactionsInprogress){
			this.wallet.emit("transactions-update-status", {status:"in-progress"});
			return false
		}
		
		let {txWithMissingVersion:ids} = await this.getDBEntries(version);
		
		if (ids.length){
			this.updatingTransactionsInprogress = true;
			this.wallet.emit("transactions-update-status", {status:"started"});
			await this.updateTransactionTimeImpl(ids, true, ()=>{
				this.updatingTransactionsInprogress = false;
				this.wallet.emit("transactions-update-status", {status:"finished"});
			});
		}else{
			this.wallet.emit("transactions-update-status", {status:"finished", total:0, updated:0});
		}
		return true
	}
	transactionUpdating:boolean = false;
	async updateTransactionTimeImpl(txIdList:string[]|null=null, notify:boolean=false, callback:Function|null=null){
		if (this.transactionUpdating){
			setTimeout(()=>{
				this.updateTransactionTimeImpl(txIdList, notify, callback);
			}, 2000);
			return
		}
		this.transactionUpdating = true;
		let ids = txIdList||this.pendingUpdate;
		let total = 0;
		this.pendingUpdate = [];
		this.wallet.logger.debug("updateTransactionTimeImpl:", ids);
		const CHUNK_SIZE = 500;
		let chunks:string[][] = [];

		let txIds:string[] = [];
		let txId2Id:Record<string, string[]> = {};

		ids.map(id=>{
			let txId = id.split(":")[0];
			if (!txId2Id[txId]){
				txId2Id[txId] = [];
				txIds.push(txId);
				total++;
				if (txIds.length == CHUNK_SIZE){
					chunks.push(txIds);
					txIds = [];
				}
			}
			txId2Id[txId].push(id);
		})

		if (notify){
			this.wallet.emit("transactions-update-status", {
				status:"progress",
				total,
				updated:0
			});
		}

		if (txIds.length){
			chunks.push(txIds);
		}

		const updateTx = async (id:string, ts:number=0)=>{
			let tx = null;
			if (this.idb){
				let txStr = await this.idb.get(id);
				try{
					tx = JSON.parse(txStr);
				}catch(e){
					tx = {};
				}
			}
			tx = tx||{};
			
			if (ts){
				tx.ts = ts;
				tx.version = 2;
			}else{
				tx.version = 1;
			}
			
			if (tx.id == id && this.idb){
				this.idb.set(id, JSON.stringify(tx))
			}

			tx.id = id;

			this.emitUpdateTx(tx);
			this.wallet.logger.debug("updateTransactionTimeImpl: tx updated", id, "ts:", ts, tx);
		}
		let updatedCount = 0;
		let fetch_txs = async()=>{
			let txIds = chunks.shift();
			//this.wallet.logger.info("updateTransactionTimeImpl: fetch_txs", txIds);
			if (!txIds){
				this.transactionUpdating = false;
				callback?.();
				return
			}
			let count = txIds.length;
			let txId2time = await this.fetchTxTime(txIds);
			//this.wallet.logger.info("updateTransactionTimeImpl: txId2time", txId2time);
			Object.keys(txId2time).forEach(txId=>{
				let ts = txId2time[txId];
				let index = (txIds as string[]).indexOf(txId);
				if (index > -1){
					(txIds as string[]).splice(index, 1);
				}

				txId2Id[txId].forEach(async(id)=>{
					await updateTx(id, ts);
				})
			});

			//txs which failed to fetch
			if (this.idb){
				txIds.map(txId=>{
					txId2Id[txId].forEach(async(id)=>{
						await updateTx(id);
					})
				})
			}
			updatedCount += count;

			if (notify){
				this.wallet.emit("transactions-update-status", {
					status:"progress",
					total,
					updated:updatedCount
				});
			}

			setTimeout(fetch_txs, 2000)
		};
		setTimeout(fetch_txs, 1000)
	}

	async getDBEntries(version:undefined|number=undefined):Promise<{list:TXStoreItem[], txWithMissingVersion:string[]}>{
		if (!this.idb){
			return {
				list:[],
				txWithMissingVersion:[]
			}
		}
	
		let entries = await this.idb.entries().catch((err)=>{
			console.log("tx-store: entries():error", err)
		})||[];
		let length = entries.length;
		console.log("tx-entries length:", length)
		let list:TXStoreItem[] = [];
		let ids:string[] = [];
		for (let i=0; i<length;i++){
			let [key, txStr] = entries[i]
			if(!txStr)
				continue;
			try{
				let tx = JSON.parse(txStr);
				if (tx.version === undefined || (version && tx.version != version)){
					ids.push(tx.id);
				}
				list.push(tx);
			}catch(e){
				this.wallet.logger.error("LS-TX parse error - 104:", txStr, e)
			}
		}

		return {
			list,
			txWithMissingVersion:ids
		}
	}
	async restore(){
		if(this.idb){
			let {list} = await this.getDBEntries();

			list.sort((a, b)=>{
				return a.ts-b.ts;
			}).map(o=>{
				this.add(o, true)
			})
		}
	}
}
