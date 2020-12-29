//([^\n \t].*) (.*) = \d{1,};
//$2: $1;

export declare type bytes = string;//base64 encoded string

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
		transactionId: string;
		index: number;
	}

	interface UTXOEntry{
		amount: number;
		scriptPubKey: string;
		blockBlueScore: number;
		isCoinbase: boolean; 
	}

	interface SubmitTransactionRequest{
		transaction: Transaction;
	}

	interface SubmitTransactionResponse{
	    transactionId: string;
	    error: Error;
	}

	interface TransactionId{
		bytes: bytes;
	}

	interface Transaction{
		version: number;
		inputs: TransactionInput[];
		outputs: TransactionOutput[];
		lockTime: number;
		subnetworkId: string;
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

	interface BlockAddedNotification{
		block: BlockMessage;
	}

	interface BlockMessage{
		header: BlockHeaderMessage;
  		transactions: Transaction[];
	}

	interface BlockHeaderMessage{
		version: number;
		parentHashes:bytes;
		hashMerkleRoot: bytes;
		acceptedIdMerkleRoot: bytes;
		utxoCommitment: bytes;
		timestamp: number;
		bits: number;
		nonce: number;
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

	interface NotifyVirtualSelectedParentBlueScoreChangedResponse{
		error: Error;
	}

	interface VirtualSelectedParentBlueScoreResponse{
		blueScore: number;
		error: Error;
	}

	interface VirtualSelectedParentBlueScoreChangedNotification{
		virtualSelectedParentBlueScore: number;
	}

	interface NotifyUtxosChangedResponse{
		error: Error;
	}

	interface UtxosChangedNotification{
		added:UTXOsByAddressesEntry[];
		removed:UTXOsByAddressesEntry[];
	}

	declare type callback<T> = (result: T) => void;
}

export interface IRPC {
	getBlock(blockHash:string): Promise<RPC.BlockResponse>;
	getTransactionsByAddresses(startingBlockHash:string, addresses:string[]): Promise<RPC.TransactionsByAddressesResponse>;
	getUtxosByAddresses(addresses:string[]): Promise<RPC.UTXOsByAddressesResponse>;
	submitTransaction(tx: RPC.SubmitTransactionRequest): Promise<RPC.SubmitTransactionResponse>;
	getVirtualSelectedParentBlueScore(): Promise<RPC.VirtualSelectedParentBlueScoreResponse>;
	
	subscribeChainChanged(callback:Rpc.callback<Rpc.ChainChangedNotification>): Promise<RPC.NotifyChainChangedResponse>;
	subscribeBlockAdded(callback:Rpc.callback<Rpc.BlockAddedNotification>): Promise<RPC.NotifyBlockAddedResponse>;
	subscribeVirtualSelectedParentBlueScoreChanged(callback:RPC.callback<Rpc.VirtualSelectedParentBlueScoreChangedNotification>): Promise<RPC.NotifyVirtualSelectedParentBlueScoreChangedResponse>;
	subscribeUtxosChanged(addresses:string[], callback:Rpc.callback<Rpc.UtxosChangedNotification>): Promise<RPC.NotifyUtxosChangedResponse>;

	request?(method:string, data:any);
}
