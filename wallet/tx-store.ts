import {Wallet} from './wallet';
import {iDB} from './indexed-db';
import {Api} from 'custom-types';

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
	isMoved?:boolean
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
	addAddressUTXOs(address:string, utxos:Api.Utxo[], ts?:number){
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
		let {uid} = this.wallet
		if(typeof indexedDB != "undefined"){
			this.idb?.set(tx.id, JSON.stringify(tx))
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

		this.txToEmitList.push(tx)
		if(this.txToEmitList.length > 500){
			this.emitTxs();
		}
	}
	emitTxs(){
		let list = this.txToEmitList;
		this.txToEmitList = [];
		this.wallet.emit("transactions", list);
	}
	async restore(){
		if(this.idb){
			let entries = await this.idb.entries().catch((err)=>{
				console.log("tx-store: entries():error", err)
			})||[];
			let length = entries.length;
			console.log("tx-entries length:", length)
			let list:TXStoreItem[] = [];
			for (let i=0; i<length;i++){
				let [key, txStr] = entries[i]
				if(!txStr)
					continue;
				try{
					let tx = JSON.parse(txStr)
					list.push(tx)
				}catch(e){
					this.wallet.logger.error("LS-TX parse error - 104:", txStr, e)
				}
			}

			list.sort((a, b)=>{
				return a.ts-b.ts;
			}).map(o=>{
				this.add(o, true)
			})
		}
	}
}
