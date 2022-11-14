import {Wallet} from './wallet';
import {iDB} from './indexed-db';
import {internalNames} from './tx-store'

export interface CacheStoreItem{
    id:string;
    ts:number;
}
export interface CacheItemAddressIndexes{
    id?:string;
    ts?:number;
    receive:number;
    change:number;
}

export class CacheStore{
	wallet:Wallet;
	store:Map<string, CacheStoreItem> = new Map();
	idb:iDB|undefined;

	constructor(wallet:Wallet){
		this.wallet = wallet;
		let {uid, network} = wallet;
        console.log("CacheStore:wallet:uid", uid)
		let sNetwork:string = internalNames[network]||network;
		if(typeof indexedDB != "undefined")
			this.idb = new iDB({storeName:"cache", dbName:"kaspa_"+uid+"_"+sNetwork});
    }

    setAddressIndexes(data:CacheItemAddressIndexes){
        let item = Object.assign({
            id: "address-indexes",
            ts: Date.now()
        }, data);

        this.set(item) 
    }
    getAddressIndexes(){
        return this.get("address-indexes") as CacheItemAddressIndexes|undefined
    }

	private set(item:CacheStoreItem, skipSave=false){
		this.store.set(item.id, item);
		this.emitCache(item);
		if(!skipSave)
			this.save(item);
	}

    private get(id:string){
        return this.store.get(id);
    }

	save(item:CacheStoreItem){
		this.idb?.set(item.id, JSON.stringify(item))
	}
	emitCache(item:CacheStoreItem){
        this.wallet.emit("wallet-cache", item);
	}
	async restore(){
		if(this.idb){
			let entries = await this.idb.entries().catch((err)=>{
				console.log("cache-store: entries():error", err)
			})||[];
			let length = entries.length;
			console.log("cache idb entries:", entries)
			let list:CacheStoreItem[] = [];
			for (let i=0; i<length;i++){
				let [key, cacheStr] = entries[i]
				if(!cacheStr)
					continue;
				try{
					let cacheItem = JSON.parse(cacheStr)
					list.push(cacheItem)
				}catch(e){
					this.wallet.logger.error("CACHE parse error - 104:", cacheStr, e)
				}
			}

			list.sort((a, b)=>{
				return a.ts-b.ts;
			}).map(o=>{
				this.set(o, true)
			})
		}
	}
}
