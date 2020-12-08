//([^\n \t].*) (.*) = \d{1,};
//$2: $1;

export namespace RPC {

	interface Error {
		errorCode?: number;
		message: string;
	}

	interface UTXOsByAddressesResponse{
		entries: UTXOsByAddressesEntry[];
		error: Error
	}

	interface UTXOsByAddressesEntry {
		address: string;
		outpoint: Outpoint;
		utxoEntry: UTXOEntry;
		transaction: Transaction;
	}

	interface Outpoint{
		transactionID: string;
		index: number;
	}

	interface UTXOEntry{
		amount: number;
		scriptPubKey: string;
		blockBlueScore: number; 
	}

	interface SubmitTransactionRequest{
		transaction: Transaction;
	}

	interface SubmitTransactionResponse{
	    transactionID: string;
	    error: Error;
	}

	interface Transaction{
		version: number;
		inputs: TransactionInput[];
		outputs: TransactionOutput[];
		lockTime: number;
		subnetworkID: string;
		gas?: number;
		payloadHash?: string;
		payload?: string;
		fee: number;
	}
	interface TransactionInput{
		previousOutpoint: Outpoint;
		signatureScript: string;
		sequence: number;
	}

	interface TransactionOutput{
		amount: number;
		scriptPubKey: string;
	}


	interface TransactionsByAddressesResponse{
		lasBlockScanned: string;
		transactions: TransactionVerboseData[];
		error: Error;
	}

	interface TransactionVerboseData{
		txId: string;
		hash: string;
		size: number;
		version: number;
		lockTime: number;
		subnetworkId: string;
		gas: number;
		payloadHash: string;
		payload: string;
		transactionVerboseInputs: TransactionVerboseInput[];
		transactionVerboseOutputs: TransactionVerboseOutput[];
		blockHash: string;
		time: number;
		blockTime: number;
	}

	interface TransactionVerboseInput{
		txId: string;
		outputIndex: number;
		scriptSig: ScriptSig;
		sequence: number;
	}

	interface ScriptSig{
		asm: string;
		hex: string;
	}

	interface TransactionVerboseOutput{
		value: number;
		index: number;
		scriptPubKey: ScriptPubKeyResult;
	}

	interface ScriptPubKeyResult{
		asm: string;
		hex: string;
		type: string;
		address: string;
	}

	interface BlockResponse{
		blockHash: string;
		blockVerboseData: BlockVerboseData;
		error: Error;
	}

	interface BlockVerboseData{
		hash: string;
		version: number;
		versionHex: string;
		hashMerkleRoot: string;
		acceptedIDMerkleRoot: string;
		utxoCommitment: string;
		transactionVerboseData: TransactionVerboseData[];
		time: number;
		nonce: number;
		bits: string;
		difficulty: number;
		parentHashes: string[];
		selectedParentHash: string;
		transactionIDs: string[];
	}

	/*
	###################################################
	###################################################
	###################################################
	*/
	interface SubPromise<T> extends Promise<T>{
		uid: string;
	}

	interface NotifyChainChangedResponse{
		error: Error;
	}

	interface NotifyBlockAddedResponse{
		error: Error;
	}

	interface ChainChangedNotification{
		removedChainBlockHashes: string[];
  		addedChainBlocks: ChainBlock[];
	}

	interface ChainBlock{
		hash: string;
		acceptedBlocks: AcceptedBlock[];
	}

	interface AcceptedBlock{
		hash: string;
		acceptedTxIds: string[];
	}
}

export interface IRPC {
	getBlock(blockHash:string): Promise<RPC.BlockResponse>;
	getTransactionsByAddresses(startingBlockHash:string, addresses:string[]): Promise<RPC.TransactionsByAddressesResponse>;
	getUTXOsByAddress(addresses:string[]): Promise<RPC.UTXOsByAddressesResponse>;
	submitTransaction(tx: RPC.SubmitTransactionRequest): Promise<RPC.SubmitTransactionResponse>;
	request?(method:string, data:any);
}