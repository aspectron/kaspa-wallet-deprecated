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

export const getUTXOsByAddress = async (addresses: string[]): Promise<Map<string, Api.Utxo[]>> => {
	if(!RPC)
		return missingRPCProviderError();
	
	const response = await RPC.getUTXOsByAddress(addresses).catch((e) => {
		throw new ApiError(`API connection error. ${e}`);
	})
	
	if (response.error)
		throw new ApiError(`API error (${response.error.errorCode}): ${response.error.message}`);

	let result:Map<string, Api.Utxo[]> = new Map();

	response.entries.map(entry=>{
		let {transactionID, index} = entry.outpoint;
		let {address, utxoEntry} = entry;
		let {amount, scriptPubKey, blockBlueScore} = utxoEntry;

		let item: Api.Utxo = {
			amount,
			scriptPubKey,
			blockBlueScore,
			transactionID,
			index
		}

		let items:Api.Utxo[]|undefined = result.get(address);
		if(!items){
			items = [];
			result.set(address, items);
		}

		items.push(item);
	})

	return result;
}

export const submitTransaction = async (tx: RPC.SubmitTransactionRequest): Promise<string> => {
	if(!RPC)
		return missingRPCProviderError();
	// eslint-disable-next-line
	const response = await RPC.submitTransaction(tx).catch((e) => {
		throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
	})
	//console.log("submitTransaction:result", response)
	if(response.transactionID)
		return response.transactionID;

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
