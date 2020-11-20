import { Api, IRPC } from 'custom-types';
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

export const getBlock = async (
	blockHash: string
): Promise<Api.BlockResponse> => {
	if(!RPC)
		return missingRPCProviderError();
	// eslint-disable-next-line
	const response = await RPC.getBlock(blockHash)
	.catch((e) => {
		throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
	});
	const json = response as Api.ErrorResponse & Api.BlockResponse; // eslint-disable-line
	if (json.errorMessage) {
		const err = json as Api.ErrorResponse;
		throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
	}
	return json as Api.BlockResponse;
};

// TODO: handle pagination
export const getTransactions = async (
	address: string
): Promise<Api.TransactionsResponse> => {
	if(!RPC)
		return missingRPCProviderError();
	const getTx = async (limit: number, skip: number): Promise<Api.Transaction[]> => {
		// eslint-disable-next-line
		const response = await RPC.getAddressTransactions(address, limit, skip)
		.catch((e) => {
			throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
		});
		let json = response as Api.ErrorResponse & Api.Transaction[]; // eslint-disable-line
		if (json.errorMessage) {
			const err = json as Api.ErrorResponse;
			throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
		}
		let result: Api.Transaction[] = json;
		if (result.length === 1000) {
			const tx = await getTx(limit, skip + 1000);
			result = [...tx, ...result];
		}
		return result;
	};
	const json = await getTx(1000, 0);
	return { transactions: json } as Api.TransactionsResponse;
};

export const getUtxos = async (address: string): Promise<Api.UtxoResponse> => {
	if(!RPC)
		return missingRPCProviderError();
	const getRecursively = async (limit: number, skip: number) => {
		// eslint-disable-next-line
		const response = await RPC.getUtxos(address, limit, skip)
		.catch((e) => {
			throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
		});
		const json = response as Api.ErrorResponse & Api.Utxo[]; // eslint-disable-line
		if (json.errorMessage) {
			const err = json as Api.ErrorResponse;
			throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
		}
		let result: Api.Utxo[] = json;
		if (result.length === 1000) {
			const utxos = await getRecursively(limit, skip + 1000);
			result = [...utxos, ...result];
		}
		return result;
	};
	const json = await getRecursively(1000, 0);
	return {
		utxos: json,
	} as Api.UtxoResponse;
};

export const postTx = async (rawTransaction: string): Promise<Api.SendTxResponse> => {
	if(!RPC)
		return missingRPCProviderError();
	// eslint-disable-next-line
	const response = await RPC.postTx(rawTransaction).catch((e) => {
		throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
	});
	const json = response as Api.ErrorResponse & Api.SuccessResponse; // eslint-disable-line
	if(json.success)
		return true;
	if(!json.errorMessage)
		json.errorMessage = 'Api error. Please try again later. (ERROR: POST-TX:100)';

	throw new ApiError(`API error ${json.errorCode}: ${json.errorMessage}`);
};
