import { version } from "os";

export function promisifyRequest < T = undefined > (
	request: IDBRequest < T > | IDBTransaction,
): Promise < T > {
	return new Promise < T > ((resolve, reject) => {
		// @ts-ignore - file size hacks
		request.oncomplete = request.onsuccess = () => resolve(request.result);
		// @ts-ignore - file size hacks
		request.onabort = request.onerror = () => reject(request.error);
	});
}

export function createStore(dbName: string, storeNames: string[], version:number): CreateStoreResult {
	//console.log("createStore", dbName, storeNames, version)
	const request = indexedDB.open(dbName, version);
	request.onupgradeneeded = () => {
		const db = request.result;
		let list = db.objectStoreNames;
		storeNames.forEach(storeName=>{
			console.log("createStore", storeName, list.contains(storeName), list)
			if(!list.contains(storeName)){
				let result = db.createObjectStore(storeName)
				console.log("db.createObjectStore:", result)
			}
		})
	};

	const dbp = promisifyRequest(request);

	return {
		dbName,
		getUseStore(storeName:string){
			return <T>(txMode:IDBTransactionMode, callback:Callback<T>)=>dbp.then((db) =>
				callback(db.transaction(storeName, txMode).objectStore(storeName)),
			)
		}
	 }
}

export type Callback<T> = (store: IDBObjectStore) => T | PromiseLike < T >;

export type CreateStoreResult = {
	dbName:string,
	getUseStore(storeName: string):UseStore
}

export type UseStore = < T > (
	txMode: IDBTransactionMode,
	callback: (store: IDBObjectStore) => T | PromiseLike < T > ,
) => Promise < T > ;



export class iDB{

	static stores:CreateStoreResult[] = [];

	static getOrCreateStore(storeName:string, dbName:string, version:number):UseStore{
		let store = this.stores.find(s=>s.dbName == dbName);
		if(store)
			return store.getUseStore(storeName);
		return createStore(dbName, [storeName], version).getUseStore(storeName);
	}

	static buildDB(dbName:string, version=1, storeNames=["tx", "cache"]){
		let store = this.stores.find(s=>s.dbName == dbName);
		//console.log("iDB.buildDB - A", dbName, version, storeNames)
		if(!store){
			//console.log("iDB.buildDB - B", storeNames)
			this.stores.push(createStore(dbName, storeNames, version))
		}
	}

	defaultGetStoreFunc: UseStore;
	constructor(options:{storeName:string, dbName:string}){
		let {storeName, dbName} = options;
		const version = 4;
		iDB.buildDB(dbName, version);
		this.defaultGetStoreFunc = iDB.getOrCreateStore(storeName, dbName, version);
	}

	/**
	 * Get a value by its key.
	 *
	 * @param key
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */
	get<T=any>(key: IDBValidKey, customStore = this.defaultGetStoreFunc): Promise < T | undefined > {
		return customStore('readonly', (store) => promisifyRequest(store.get(key)));
	}

	/**
	 * Set a value with a key.
	 *
	 * @param key
	 * @param value
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */
	set(
		key: IDBValidKey,
		value: any,
		customStore = this.defaultGetStoreFunc
	): Promise < void > {
		return customStore('readwrite', (store) => {
			store.put(value, key);
			return promisifyRequest(store.transaction);
		});
	}

	/**
	 * Set multiple values at once. This is faster than calling set() multiple times.
	 * It's also atomic – if one of the pairs can't be added, none will be added.
	 *
	 * @param entries Array of entries, where each entry is an array of `[key, value]`.
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */
	setMany(
		entries: [IDBValidKey, any][],
		customStore = this.defaultGetStoreFunc,
	): Promise < void > {
		return customStore('readwrite', (store) => {
			entries.forEach((entry) => store.put(entry[1], entry[0]));
			return promisifyRequest(store.transaction);
		});
	}

	/**
	 * Get multiple values by their keys
	 *
	 * @param keys
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */
	getMany(
		keys: IDBValidKey[],
		customStore = this.defaultGetStoreFunc,
	): Promise < any[] > {
		return customStore('readonly', (store) =>
			Promise.all(keys.map((key) => promisifyRequest(store.get(key)))),
		);
	}

	/**
	 * Update a value. This lets you see the old value and update it as an atomic operation.
	 *
	 * @param key
	 * @param updater A callback that takes the old value and returns a new value.
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */
	update < T = any > (
		key: IDBValidKey,
		updater: (oldValue: T | undefined) => T,
		customStore = this.defaultGetStoreFunc,
	): Promise < void > {
		return customStore(
			'readwrite',
			(store) =>
			// Need to create the promise manually.
			// If I try to chain promises, the transaction closes in browsers
			// that use a promise polyfill (IE10/11).
			new Promise((resolve, reject) => {
				store.get(key).onsuccess = function() {
					try {
						store.put(updater(this.result), key);
						resolve(promisifyRequest(store.transaction));
					} catch (err) {
						reject(err);
					}
				};
			}),
		);
	}

	/**
	 * Delete a particular key from the store.
	 *
	 * @param key
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */
	del(
		key: IDBValidKey,
		customStore = this.defaultGetStoreFunc,
	): Promise < void > {
		return customStore('readwrite', (store) => {
			store.delete(key);
			return promisifyRequest(store.transaction);
		});
	}

	/**
	 * Clear all values in the store.
	 *
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */
	clear(customStore = this.defaultGetStoreFunc): Promise < void > {
		return customStore('readwrite', (store) => {
			store.clear();
			return promisifyRequest(store.transaction);
		});
	}

	eachCursor(
		customStore: UseStore,
		callback: (cursor: IDBCursorWithValue) => void,
	): Promise < void > {
		return customStore('readonly', (store) => {
			// This would be store.getAllKeys(), but it isn't supported by Edge or Safari.
			// And openKeyCursor isn't supported by Safari.
			let req = store.openCursor();
			req.onsuccess = function() {
				//console.log("store.openCursor.onsuccess", this)
				if (!this.result)
					return;
				callback(this.result);
				this.result.continue();
			};
			req.onerror = function(e) {
				console.log("store.openCursor.onerror", e, this)
			}
			return promisifyRequest(store.transaction);
		});
	}

	/**
	 * Get all keys in the store.
	 *
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */
	keys(customStore = this.defaultGetStoreFunc): Promise < IDBValidKey[] > {
		const items: IDBValidKey[] = [];

		return this.eachCursor(customStore, (cursor) => items.push(cursor.key)).then(
			() => items,
		);
	}

	/**
	 * Get all values in the store.
	 *
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */
	values(customStore = this.defaultGetStoreFunc): Promise < IDBValidKey[] > {
		const items: any[] = [];

		return this.eachCursor(customStore, (cursor) => items.push(cursor.value)).then(
			() => items,
		);
	}

	/**
	 * Get all entries in the store. Each entry is an array of `[key, value]`.
	 *
	 * @param customStore Method to get a custom store. Use with caution (see the docs).
	 */
	entries(customStore = this.defaultGetStoreFunc): Promise < [IDBValidKey, any][] > {
		const items: [IDBValidKey, any][] = [];

		return this.eachCursor(customStore, (cursor) =>
			items.push([cursor.key, cursor.value]),
		).then(() => items);
	}
}