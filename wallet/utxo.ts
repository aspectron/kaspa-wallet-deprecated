import {Api,RPC,UnspentOutputInfo} from 'custom-types';
// @ts-ignore
import * as kaspacore from 'kaspacore-lib';
import * as crypto from 'crypto';
import * as helper from '../utils/helper';
// import * as api from './apiHelpers';
import {Wallet} from './wallet';
import {EventTargetImpl} from './event-target-impl';

export class UnspentOutput extends kaspacore.Transaction.UnspentOutput {
	blockBlueScore: number;
	scriptPublicKeyVersion: number;
	constructor(o: UnspentOutputInfo) {
		super(o);
		this.blockBlueScore = o.blockBlueScore;
		this.scriptPublicKeyVersion = o.scriptPublicKeyVersion;
	}
}
let seq = 0;
export class UtxoSet extends EventTargetImpl {
	utxos: {
		confirmed: Map <string, UnspentOutput >;
		pending: Map <string, UnspentOutput >;
	} = {
		confirmed: new Map(),
		pending: new Map()
	};

	inUse: string[] = [];

	totalBalance = 0;

	availableBalance = 0;
	debug: boolean = false;

	get length(): number {
		return Object.keys(this.utxos).length;
	}

	utxoStorage: Record < string, Api.Utxo[] > = {};

	wallet: Wallet;

	addressesUtxoSyncStatuses: Map < string, boolean > = new Map();

	constructor(wallet: Wallet) {
		super();
		this.wallet = wallet;
	}

	/**
	 * Add UTXOs to UTXO set.
	 * @param utxos Array of UTXOs from kaspa API.
	 * @param address Address of UTXO owner.
	 */
	add(utxos: Api.Utxo[], address: string): string[] {
		const utxoIds: string[] = [];
		this.logger.utxodebug("add utxos", utxos)
		const {blueScore} = this.wallet;
		utxos.forEach((utxo) => {
			const utxoId = utxo.transactionId + utxo.index.toString();
			const utxoInUse = this.inUse.includes(utxoId);
			const alreadyHaveIt = !!(this.utxos.confirmed.has(utxoId) || this.utxos.pending.has(utxoId));
			//console.log("utxo.scriptPubKey", utxo)
			//console.log("utxoInUse", {utxoInUse, alreadyHaveIt})
			if (!utxoInUse && !alreadyHaveIt /*&& utxo.isSpendable*/ ) {
				utxoIds.push(utxoId);
				let confirmed = (blueScore-utxo.blockBlueScore>=100);
				let map = this.utxos[confirmed?'confirmed':'pending'];
				let unspentOutput = new UnspentOutput({
					txid: utxo.transactionId,
					address,
					vout: utxo.index,
					scriptPubKey: utxo.scriptPublicKey.scriptPublicKey,
					scriptPublicKeyVersion: utxo.scriptPublicKey.version,
					satoshis: +utxo.amount,
					blockBlueScore: utxo.blockBlueScore
				})
				map.set(utxoId, unspentOutput);
				this.wallet.adjustBalance(confirmed, unspentOutput.satoshis);
			}
		});
		if (utxoIds.length) {
			this.logger.utxodebug(`adding ${utxoIds.length} UTXO entries:\n`, utxoIds);
			this.logger.utxo(`incoming ${utxoIds.length} UTXO entries`);
		}
		return utxoIds;
	}

	get logger(){
		return this.wallet.logger
	}

	remove(utxoIds: string[]): void {
		this.release(utxoIds);
		let utxo;
		utxoIds.forEach(id=> {
			utxo = this.utxos.confirmed.get(id);
			if(utxo){
				this.utxos.confirmed.delete(id);
				this.wallet.adjustBalance(true, -utxo.satoshis);
			}

			utxo = this.utxos.pending.get(id);
			if(utxo){
				this.utxos.pending.delete(id);
				this.wallet.adjustBalance(false, -utxo.satoshis);
			}
		});
	}

	release(utxoIdsToEnable: string[]): void {
		// assigns new array without any utxoIdsToEnable
		this.inUse = this.inUse.filter((utxoId) => !utxoIdsToEnable.includes(utxoId));
		// this.updateUtxoBalance();
	}

	updateUtxoBalance(): void {
		const {blueScore} = this.wallet;
		[...this.utxos.pending.values()].forEach(utxo=>{
			if(blueScore-utxo.blockBlueScore < 100)
				return
			this.utxos.pending.delete(utxo.txId+utxo.outputIndex);
			this.wallet.adjustBalance(false, -utxo.satoshis, false);
			this.utxos.confirmed.set(utxo.txId+utxo.outputIndex, utxo);
			this.wallet.adjustBalance(true, utxo.satoshis);
		})
	}

	clear(): void {
		this.utxos.confirmed.clear();
		this.utxos.pending.clear();
		this.inUse = [];
		this.availableBalance = 0;
		this.utxoStorage = {};
		this.logger.info('UTXO set cleared.');
	}

	/**
	 * Naively select UTXOs.
	 * @param txAmount Provide the amount that the UTXOs should cover.
	 * @throws Error message if the UTXOs can't cover the `txAmount`
	 */
	selectUtxos(txAmount: number): {
		utxoIds: string[];
		utxos: UnspentOutput[]
	} {
		const utxos: UnspentOutput[] = [];
		const utxoIds: string[] = [];
		let totalVal = 0;
		let list = [...this.utxos.confirmed.values()];

		list = list.filter((utxo) => {
			const utxoId = utxo.txId + utxo.outputIndex;
			return !this.inUse.includes(utxoId);
		});

		list.sort((a: UnspentOutput, b: UnspentOutput): number => {
			return a.blockBlueScore - b.blockBlueScore || a.satoshis - b.satoshis || a.txId.localeCompare(b.txId) || a.outputIndex - b.outputIndex;
		})

		for (const utxo of list) {
			const utxoId = utxo.txId + utxo.outputIndex;
			//console.log("info",`UTXO ID: ${utxoId}  , UTXO: ${utxo}`);
			//if (!this.inUse.includes(utxoId)) {
				utxoIds.push(utxoId);
				utxos.push(utxo);
				totalVal += utxo.satoshis;
			//}
			if (totalVal >= txAmount) break;
		}
		if (totalVal < txAmount)
			throw new Error(`Transaction compose error. Need: ${txAmount}, UTXO Balance: ${totalVal}`);

		return {
			utxoIds,
			utxos
		};
	}

	async syncAddressesUtxos(addresses: string[]) {
		const newAddresses = addresses.map(address => {
			if (this.addressesUtxoSyncStatuses.has(address))
				return
			this.addressesUtxoSyncStatuses.set(address, false);
			return address;
		}).filter(address => address) as string[];

		//in sync process addressDiscovery calls findUtxos
		if (!newAddresses.length || (this.wallet.syncInProggress && !this.wallet.options.disableAddressDerivation))
			return

		await this.wallet.findUtxos(newAddresses);

		if(!this.wallet.syncOnce)
			await this.utxoSubscribe();
	}

	async utxoSubscribe(): Promise < string[] > {
		let addresses: string[] = [];
		this.addressesUtxoSyncStatuses.forEach((sent, address) => {
			//if(sent)
			//  return

			//  !!!FIXME prevent multiple address subscriptions
			//if(!this.addressesUtxoSyncStatuses.get(address)) {
			//this.addressesUtxoSyncStatuses.set(address, true);
			addresses.push(address);
			//}
		});

		if (!addresses.length)
			return addresses;
		//console.log(`[${this.wallet.network}] !!! +++++++++++++++ SUBSCRIBING TO ADDRESSES :)\n`,addresses);
		let utxoChangedRes = await this.wallet.api.subscribeUtxosChanged(addresses, this.onUtxosChanged.bind(this))
			.catch((error: RPC.Error) => {
				console.log(`[${this.wallet.network}] RPC ERROR in uxtoSync! while registering addresses:`, error, addresses);
				addresses.map(address => {
					this.addressesUtxoSyncStatuses.set(address, false);
				})
			})

		//console.log("utxoSync:utxoChangedRes:", utxoChangedRes, "\n utxoSync addresses:", addresses)
		return addresses;
	}

	onUtxosChanged(added: Map < string, Api.Utxo[] > , removed: Map < string, RPC.Outpoint[] > ) {
		// console.log("onUtxosChanged:res", added, removed)
		added.forEach((utxos, address) => {
			//this.logger.log('info', `${address}: ${utxos.length} utxos found.+=+=+=+=+=+=+++++=======+===+====+====+====+`);
			if (!utxos.length)
				return

			if (!this.utxoStorage[address]) {
				this.utxoStorage[address] = utxos;
			} else {
				let txid2Utxo: Record < string, Api.Utxo > = {};
				utxos.forEach(utxo => {
					txid2Utxo[utxo.transactionId + utxo.index] = utxo;
				})
				let oldUtxos = this.utxoStorage[address].filter(utxo => {
					return !txid2Utxo[utxo.transactionId + utxo.index]
				});
				this.utxoStorage[address] = [...oldUtxos, ...utxos];
			}
			this.add(utxos, address);
		})

		this.wallet.txStore.addFromUTXOs(added);

		let utxoIds: string[] = [];
		removed.forEach((utxos, address) => {
			let txid2Outpoint: Record < string, RPC.Outpoint > = {};
			utxos.forEach(utxo => {
				txid2Outpoint[utxo.transactionId + utxo.index] = utxo;
				utxoIds.push(utxo.transactionId + utxo.index);
			})
			if (!this.utxoStorage[address])
				return
			this.utxoStorage[address] = this.utxoStorage[address].filter(utxo => {
				return !txid2Outpoint[utxo.transactionId + utxo.index]
			});
		})

		if (utxoIds.length)
			this.remove(utxoIds);

		const isActivityOnReceiveAddr =
			this.utxoStorage[this.wallet.receiveAddress] !== undefined;
		if (isActivityOnReceiveAddr)
			this.wallet.addressManager.receiveAddress.next();

		//this.updateUtxoBalance();
		this.wallet.emit("utxo-change", {added, removed});
	}

	isOur(utxo:UnspentOutput): boolean{
		return (!!this.wallet.transactions[utxo.txId]) || this.isOurChange(utxo)
	}

	isOurChange(utxo:UnspentOutput):boolean{
		return this.wallet.addressManager.isOurChange(String(utxo.address))
	}
	get count():number{
		return this.utxos.confirmed.size + this.utxos.pending.size;
	}
}
