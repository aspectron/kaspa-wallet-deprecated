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
	tx?:any
}

export class TXStore{

	static MAX = 5;
	wallet:Wallet;
	store:Map<string, TXStoreItem> = new Map();
	txToEmitList:TXStoreItem[] = [];
	idb:iDB|undefined;

	constructor(wallet:Wallet){
		this.wallet = wallet;
		let {uid} = wallet;
		//this.restore();
		if(typeof indexedDB != "undefined")
			this.idb = new iDB({storeName:"tx", dbName:"kaspa_"+uid});
	}

	add(tx:TXStoreItem, skipSave=false){
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
				blueScore:utxo.blockBlueScore,
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
			//let txIds = [...this.store.keys()].map(id=>id.substr(0, 15))
			//iDB.set("kaspa-tx-ids-"+uid, JSON.stringify(txIds));
			this.idb?.set(tx.id, JSON.stringify(tx))
			//localStorage.setItem("kaspa-tx-ids", JSON.stringify(txIds));
			//localStorage.setItem("kaspa-tx-"+tx.id, JSON.stringify(tx))
		}
	}
	emitTx(tx:TXStoreItem){
		if(this.wallet.syncSignal && !this.wallet.syncInProggress){
			this.wallet.emit("new-transaction", tx);
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
		let {uid} = this.wallet
		if(typeof indexedDB != "undefined"){
			/*
			let txIds:string[] =[];
			let ids = await iDB.get<string>("kaspa-tx-ids-"+uid)
			.catch(e=>{
				this.wallet.logger.error("LS-TX restore error - 101:", e)
			})
			if(!ids)
				return
			try{
				txIds = JSON.parse(ids) as string[];
			}catch(e){
				this.wallet.logger.error("LS-TX restore error - 102:", e)
			}
			*/

			//iDB.getMany(txIds)
			let entries = await this.idb?.entries()||[]
			let length = entries.length;
			let list:TXStoreItem[] = [];
			for (let i=0; i<length;i++){
				let [key, txStr] = entries[i]//await iDB.get<string>(txIds[i])

				/*
				.catch(e=>{
					this.wallet.logger.error("LS-TX restore error - 103:", e)
				})
				*/
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

		/*
		if(typeof localStorage != "undefined"){
			let txIds:string[] =[], ids:string|null = localStorage.getItem("kaspa-tx-ids");
			if(!ids)
				return
			try{
				txIds = JSON.parse(ids) as string[];
			}catch(e){
				this.wallet.logger.error("LS-TX restore error", e)
			}

			txIds.map(id=>{
				let txStr:string|null = localStorage.getItem("kaspa-tx-"+id);
				if(!txStr)
					return
				try{
					let tx = JSON.parse(txStr)
					this.add(tx)
				}catch(e){
					this.wallet.logger.error("LS-TX parse error", txStr, e)
				}
			})
		}
		*/


	}

	
}