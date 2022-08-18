import { Api, IRPC, RPC } from 'custom-types';
import {EventTargetImpl, EventListener} from './event-target-impl';
export class ApiError{
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	name:string;
	message:string;
	stack:any;
	debugInfo:any;
	extraDebugInfo:any;
	constructor(message:string, debugInfo:any=null) {
		//super(...args);
		this.name = 'ApiError';
		this.message = message;
		this.debugInfo = debugInfo;
		if (!Error.captureStackTrace)
			this.stack = ((new Error(message)).stack+"").split("↵").join("\n");
		else
			Error.captureStackTrace(this, ApiError);
	}

	setDebugInfo(info:any){
		this.debugInfo = info;
	}

	setExtraDebugInfo(info:any){
		this.extraDebugInfo = info;
	}
}

const missingRPCProviderError = ()=>{
	throw new ApiError(`RPC privider is missing. Please set RPC using 
		Wallet.setRPC(rpc_provider).`);
}

class KaspaAPI extends EventTargetImpl{

	rpc?:IRPC;
	isConnected:boolean = false;
	_utxosChangedSubUid:string|undefined;

	// constructor(rpc:IRPC) {
	// 	this.rpc = rpc;
	// }

	setRPC(rpc:IRPC) {
		this.rpc = rpc;
		rpc.onConnect(()=>{
			this._setConnected(true);
		})
		rpc.onDisconnect(()=>{
			this._setConnected(false);
		})
	}

	getRPC():IRPC {
		// @ts-ignore
		return this.rpc;
	}

	on(type:string, callback:EventListener){
		super.on(type, callback);
		if(type == 'connect' && this.isConnected){
			//console.log("api.on->connect", this.isConnected, callback)
			callback({}, {type, detail:{}, defaultPrevented:false});
		}

	}
	_setConnected(isConnected:boolean){
		//console.log("wallet.api._setConnected", isConnected)
		this.isConnected = isConnected;
		this.emit(isConnected?"connect":'disconnect');
	}

	buildUtxoMap(entries:RPC.UTXOsByAddressesEntry[]):Map<string, Api.Utxo[]> {
		let result:Map<string, Api.Utxo[]> = new Map();
		entries.map(entry=>{
			//console.log("entry", entry)
			let {transactionId, index} = entry.outpoint;
			let {address, utxoEntry} = entry;
			let {amount, scriptPublicKey, blockDaaScore, isCoinbase} = utxoEntry;

			let item: Api.Utxo = {
				amount,
				scriptPublicKey,
				blockDaaScore,
				transactionId,
				index,
				isCoinbase
			}

			let items:Api.Utxo[]|undefined = result.get(address);
			if(!items){
				items = [];
				result.set(address, items);
			}

			items.push(item);
		});

		return result;
	}

	buildOutpointMap(outpoints: {address:string, outpoint:RPC.Outpoint}[]):Map<string, RPC.Outpoint[]> {
		const map:Map<string, RPC.Outpoint[]> = new Map();
		outpoints.map(item=>{
			let list:RPC.Outpoint[]|undefined = map.get(item.address);
			if(!list){
				list = [];
				map.set(item.address, list);
			}

			list.push(item.outpoint);
		});

		return map;
	}

	async getVirtualSelectedParentBlueScore(): Promise<{blueScore:number}> {
		if(!this.rpc)
			return missingRPCProviderError();

		const response = await this.rpc.getVirtualSelectedParentBlueScore()
		.catch((e) => {
			throw new ApiError(`API connection error. ${e}`);
		})
		
		if (response.error)
			throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);

		return {blueScore: response.blueScore}
	}
	
	async getVirtualDaaScore(): Promise<{virtualDaaScore:number}> {
		if(!this.rpc)
			return missingRPCProviderError();

		const response = await this.rpc.getBlockDagInfo()
		.catch((e) => {
			throw new ApiError(`API connection error. ${e}`);
		})
		
		if (response.error)
			throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);

		return {virtualDaaScore: response.virtualDaaScore}
	}
	

	async subscribeVirtualSelectedParentBlueScoreChanged(callback:RPC.callback<RPC.VirtualSelectedParentBlueScoreChangedNotification>) {
		if(!this.rpc)
			return missingRPCProviderError();

		const response = await this.rpc.subscribeVirtualSelectedParentBlueScoreChanged(callback)
		.catch((e) => {
			throw new ApiError(`API connection error. ${e}`);
		})
		
		if (response.error)
			throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);

		return response;
	}

	async subscribeVirtualDaaScoreChanged(callback:RPC.callback<RPC.VirtualDaaScoreChangedNotification>) {
		if(!this.rpc)
			return missingRPCProviderError();

		const response = await this.rpc.subscribeVirtualDaaScoreChanged(callback)
		.catch((e) => {
			throw new ApiError(`API connection error. ${e}`);
		})
		
		if (response.error)
			throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);

		return response;
	}

	async subscribeUtxosChanged(addresses:string[], callback:(added:Map<string, Api.Utxo[]>, removed:Map<string, RPC.Outpoint[]>)=>void) {
		if(!this.rpc)
			return missingRPCProviderError();

		const cb:RPC.callback<RPC.UtxosChangedNotification> = (res)=>{
			// console.log("UtxosChangedNotification:", res)
			const added = this.buildUtxoMap(res.added);
			const removed = this.buildOutpointMap(res.removed);
			callback(added, removed);
		}
		
		let p = this.rpc.subscribeUtxosChanged(addresses, cb)
		
		let {_utxosChangedSubUid} = this;

		let {uid} = p;
		this._utxosChangedSubUid = uid;

		const response = await p.catch((e) => {
			throw new ApiError(`API connection error. ${e}`);
		})

		if(_utxosChangedSubUid)
			this.rpc.unSubscribeUtxosChanged(_utxosChangedSubUid);
		
		
		if (response.error)
			throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);

		return response;
	}

	async getUtxosByAddresses(addresses: string[]): Promise<Map<string, Api.Utxo[]>> {
		if(!this.rpc)
			return missingRPCProviderError();
		
		const response = await this.rpc.getUtxosByAddresses(addresses).catch((e) => {
			throw new ApiError(`API connection error. ${e}`);
		})
		
		if (response.error)
			throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);


		return this.buildUtxoMap(response.entries);
	}

	async submitTransaction(tx: RPC.SubmitTransactionRequest): Promise<string> {
		if(!this.rpc)
			return missingRPCProviderError();
		// eslint-disable-next-line
		const response = await this.rpc.submitTransaction(tx).catch((e) => {
			throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
		})
		//console.log("submitTransaction:result", response)
		if(response.transactionId)
			return response.transactionId;

		if(!response.error)
			response.error = {message: 'Api error. Please try again later. (ERROR: SUBMIT-TX:100)'};
		if(!response.error.errorCode)
			response.error.errorCode = 100;

		throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`, tx);
	}


	async getBlock(blockHash: string): Promise<Api.BlockResponse> {
		if(!this.rpc)
			return missingRPCProviderError();
		// eslint-disable-next-line
		const response = await this.rpc.getBlock(blockHash).catch((e) => {
			throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
		});

		if (response.error)
			throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);

		return response.blockVerboseData;
	};

	// TODO: handle pagination
	async getTransactionsByAddresses(
		addresses: string[],
		startingBlockHash: string = ""
	): Promise<Api.TransactionsByAddressesResponse> {
		if(!this.rpc)
			return missingRPCProviderError();
		const response = await this.rpc.getTransactionsByAddresses(startingBlockHash, addresses).catch((e) => {
			throw new ApiError(`API connection error. ${e}`);
		});

		if (response.error)
			throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);

		let {transactions, lasBlockScanned} = response;
		return { transactions, lasBlockScanned }
	}
}

export { KaspaAPI }