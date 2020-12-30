import { Api, IRPC, RPC } from 'custom-types';
let RPC:IRPC;

class ApiError extends Error {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	constructor(...args: any[]) {
		super(...args);
		this.name = 'ApiError';
		Error.captureStackTrace(this, ApiError);
	}
}

const missingRPCProviderError = ()=>{
	throw new ApiError(`RPC privider is missing. Please set RPC using 
		Wallet.setRPC(rpc_provider).`);
}

export const setRPC = (rpc:IRPC)=>{
	RPC = rpc;
}

export const getRPC = ():IRPC=>{
	return RPC;
}

export const buildUtxoMap = (entries:RPC.UTXOsByAddressesEntry[]):Map<string, Api.Utxo[]> =>{
	let result:Map<string, Api.Utxo[]> = new Map();
	entries.map(entry=>{
		//console.log("entry", entry)
		let {transactionId, index} = entry.outpoint;
		let {address, utxoEntry} = entry;
		let {amount, scriptPubKey, blockBlueScore, isCoinbase} = utxoEntry;

		let item: Api.Utxo = {
			amount,
			scriptPubKey,
			blockBlueScore,
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

const buildOutpointMap = (outpoints: {address:string, outpoint:RPC.Outpoint}[]):Map<string, RPC.Outpoint[]>=>{
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

export const getVirtualSelectedParentBlueScore = async (): Promise<{blueScore:number}>=>{
	if(!RPC)
		return missingRPCProviderError();

	const response = await RPC.getVirtualSelectedParentBlueScore()
	.catch((e) => {
		throw new ApiError(`API connection error. ${e}`);
	})
	
	if (response.error)
		throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);

	return {blueScore: response.blueScore}
}

export const subscribeVirtualSelectedParentBlueScoreChanged = async(callback:RPC.callback<RPC.VirtualSelectedParentBlueScoreChangedNotification>)=>{
	if(!RPC)
		return missingRPCProviderError();

	const response = await RPC.subscribeVirtualSelectedParentBlueScoreChanged(callback)
	.catch((e) => {
		throw new ApiError(`API connection error. ${e}`);
	})
	
	if (response.error)
		throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);

	return response;
}

export const subscribeUtxosChanged = async(addresses:string[], callback:(added:Map<string, Api.Utxo[]>, removed:Map<string, RPC.Outpoint[]>)=>void)=>{
	if(!RPC)
		return missingRPCProviderError();

	const cb:RPC.callback<RPC.UtxosChangedNotification> = (res)=>{
		//console.log("UtxosChangedNotification:", res)
		const added = buildUtxoMap(res.added);
		const removed = buildOutpointMap(res.removed);
		callback(added, removed);
	}

	const response = await RPC.subscribeUtxosChanged(addresses, cb)
	.catch((e) => {
		throw new ApiError(`API connection error. ${e}`);
	})
	
	if (response.error)
		throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);

	return response;
}

export const getUtxosByAddresses = async (addresses: string[]): Promise<Map<string, Api.Utxo[]>> => {
	if(!RPC)
		return missingRPCProviderError();
	
	const response = await RPC.getUtxosByAddresses(addresses).catch((e) => {
		throw new ApiError(`API connection error. ${e}`);
	})
	
	if (response.error)
		throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);


	return buildUtxoMap(response.entries);
}

export const submitTransaction = async (tx: RPC.SubmitTransactionRequest): Promise<string> => {
	if(!RPC)
		return missingRPCProviderError();
	// eslint-disable-next-line
	const response = await RPC.submitTransaction(tx).catch((e) => {
		throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
	})
	//console.log("submitTransaction:result", response)
	if(response.transactionId)
		return response.transactionId;

	if(!response.error)
		response.error = {message: 'Api error. Please try again later. (ERROR: SUBMIT-TX:100)'};
	if(!response.error.errorCode)
		response.error.errorCode = 100;

	throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);
}


export const getBlock = async (blockHash: string): Promise<Api.BlockResponse> => {
	if(!RPC)
		return missingRPCProviderError();
	// eslint-disable-next-line
	const response = await RPC.getBlock(blockHash).catch((e) => {
		throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
	});

	if (response.error)
		throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);

	return response.blockVerboseData;
};

// TODO: handle pagination
export const getTransactionsByAddresses = async (
	addresses: string[],
	startingBlockHash: string = ""
): Promise<Api.TransactionsByAddressesResponse> => {
	if(!RPC)
		return missingRPCProviderError();
	const response = await RPC.getTransactionsByAddresses(startingBlockHash, addresses).catch((e) => {
		throw new ApiError(`API connection error. ${e}`);
	});

	if (response.error)
		throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);

	let {transactions, lasBlockScanned} = response;
	return { transactions, lasBlockScanned }
}
