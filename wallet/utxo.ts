import {Api,RPC} from 'custom-types';
import {UnspentOutput} from './unspent-output';
// @ts-ignore
import * as kaspacore from '@kaspa/core-lib';
import * as crypto from 'crypto';
import * as helper from '../utils/helper';
// import * as api from './apiHelpers';
import {Wallet} from './wallet';
import {EventTargetImpl} from './event-target-impl';
const KAS = helper.KAS;
export {UnspentOutput};
export const CONFIRMATION_COUNT = 10;
export const COINBASE_CFM_COUNT = 100;

let seq = 0;
export class UtxoSet extends EventTargetImpl {
	utxos: {
		confirmed: Map <string, UnspentOutput >;
		pending: Map <string, UnspentOutput >;
		used:Map <string, UnspentOutput >;
	} = {
		confirmed: new Map(),
		pending: new Map(),
		used: new Map()
	};

	inUse: string[] = [];

	totalBalance = 0;

	availableBalance = 0;
	debug: boolean = false;

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
				let confirmed = (blueScore-utxo.blockDaaScore>= (utxo.isCoinbase? COINBASE_CFM_COUNT : CONFIRMATION_COUNT));
				let unspentOutput = new UnspentOutput({
					txid: utxo.transactionId,
					address,
					vout: utxo.index,
					scriptPubKey: utxo.scriptPublicKey.scriptPublicKey,
					scriptPublicKeyVersion: utxo.scriptPublicKey.version,
					satoshis: +utxo.amount,
					blockDaaScore: utxo.blockDaaScore,
					isCoinbase: utxo.isCoinbase
				})
				//confirmed = confirmed || this.isOurChange(unspentOutput);
				//confirmed = /*confirmed || */this.isOurChange(unspentOutput);
				//if(confirmed){
				//	console.log("Change address: unspentOutput", blueScore-utxo.blockDaaScore, unspentOutput)
				//}
				let map = this.utxos[confirmed?'confirmed':'pending'];
				map.set(utxoId, unspentOutput);
				this.wallet.adjustBalance(confirmed, unspentOutput.satoshis);
			}else if(utxoInUse){
				let unspentOutput = new UnspentOutput({
					txid: utxo.transactionId,
					address,
					vout: utxo.index,
					scriptPubKey: utxo.scriptPublicKey.scriptPublicKey,
					scriptPublicKeyVersion: utxo.scriptPublicKey.version,
					satoshis: +utxo.amount,
					blockDaaScore: utxo.blockDaaScore,
					isCoinbase: utxo.isCoinbase
				})
				this.utxos.used.set(utxoId, unspentOutput);
			}
		});
		if (utxoIds.length) {
			this.logger.utxodebug(`adding ${utxoIds.length} UTXO entries:\n`, utxoIds);
			this.logger.utxo(`incoming ${utxoIds.length} UTXO entries`);
		}
		this.wallet.txStore.addAddressUTXOs(address, utxos);
		return utxoIds;
	}

	get logger(){
		return this.wallet.logger
	}

	remove(utxoIds: string[]): void {
		this.release(utxoIds);
		let {blueScore} = this.wallet;
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

				//duplicate tx issue handling
				if(utxo.blockDaaScore-blueScore < 70){
					let apiUTXO:Api.Utxo = {
						transactionId: utxo.txId,
						amount:utxo.satoshis,
						scriptPublicKey:{
							version:utxo.scriptPublicKeyVersion,
							scriptPublicKey: utxo.scriptPubKey
						},
						blockDaaScore:utxo.blockDaaScore,
						index:utxo.outputIndex,
						isCoinbase:utxo.isCoinbase
					}
					this.wallet.txStore.removePendingUTXO(apiUTXO, utxo.address.toString())
				}
			}
		});
	}

	clearUsed(){
		this.inUse = [];
		this.utxos.used.clear();
		this.wallet.updateDebugInfo();
		this.wallet.emitCache();
	}

	clearMissing():boolean{
		const {confirmed, pending, used} = this.utxos;
		let missing = this.inUse.filter(utxoId=>{
			return !(confirmed.has(utxoId) || pending.has(utxoId) || used.has(utxoId))
		})
		if(!missing.length)
			return false
		this.release(missing);
		return true;
	}

	release(utxoIdsToEnable: string[]): void {
		// assigns new array without any utxoIdsToEnable
		this.inUse = this.inUse.filter((utxoId) => !utxoIdsToEnable.includes(utxoId));
		utxoIdsToEnable.forEach(utxoId=>{
			this.utxos.used.delete(utxoId);
		})
		this.wallet.updateDebugInfo();
		this.wallet.emitCache();
		// this.updateUtxoBalance();
	}

	updateUtxoBalance(): void {
		const {blueScore} = this.wallet;
		[...this.utxos.pending.values()].forEach(utxo=>{
			if(blueScore-utxo.blockDaaScore < (utxo.isCoinbase? COINBASE_CFM_COUNT : CONFIRMATION_COUNT))
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
		this.utxos.used.clear();
		this.inUse = [];
		this.availableBalance = 0;
		this.utxoStorage = {};
		this.logger.info('UTXO set cleared.');
	}

	updateUsed(utxos:UnspentOutput[]){
		utxos.forEach(utxo=>{
			this.inUse.push(utxo.id);
			this.utxos.used.set(utxo.txId, utxo);
		})
		this.wallet.updateDebugInfo();
		this.wallet.emitCache();
	}

	/**
	 * Naively select UTXOs.
	 * @param txAmount Provide the amount that the UTXOs should cover.
	 * @throws Error message if the UTXOs can't cover the `txAmount`
	 */
	selectUtxos(txAmount: number): {
		utxoIds: string[];
		utxos: UnspentOutput[],
		mass: number
	} {
		const utxos: UnspentOutput[] = [];
		const utxoIds: string[] = [];
		let totalVal = 0;
		let list = [...this.utxos.confirmed.values()];

		list = list.filter((utxo) => {
			return !this.inUse.includes(utxo.id);
		});

		list.sort((a: UnspentOutput, b: UnspentOutput): number => {
			return a.blockDaaScore - b.blockDaaScore || b.satoshis - a.satoshis || a.txId.localeCompare(b.txId) || a.outputIndex - b.outputIndex;
		})
		let mass = 0;
		for (const utxo of list) {
			//console.log("info",`UTXO ID: ${utxoId}  , UTXO: ${utxo}`);
			//if (!this.inUse.includes(utxoId)) {
				utxoIds.push(utxo.id);
				utxos.push(utxo);
				mass += utxo.mass;
				totalVal += utxo.satoshis;
			//}
			if (totalVal >= txAmount) break;
		}
		if (totalVal < txAmount)
			throw new Error(`Insufficient balance - need: ${KAS(txAmount)} KAS, available: ${KAS(totalVal)} KAS`);

		return {
			utxoIds,
			utxos,
			mass
		};
	}

	/**
	 * Naively collect UTXOs.
	 * @param maxCount Provide the max UTXOs count.
	 */
	collectUtxos(maxCount: number = 10000): {
		utxoIds: string[];
		utxos: UnspentOutput[],
		amount: number,
		mass: number
	} {
		const utxos: UnspentOutput[] = [];
		const utxoIds: string[] = [];
		let totalVal = 0;
		let list = [...this.utxos.confirmed.values()];

		list = list.filter((utxo) => {
			return !this.inUse.includes(utxo.id);
		});

		list.sort((a: UnspentOutput, b: UnspentOutput): number => {
			return a.blockDaaScore - b.blockDaaScore || b.satoshis - a.satoshis || a.txId.localeCompare(b.txId) || a.outputIndex - b.outputIndex;
		})
		let maxMass = Wallet.MaxMassUTXOs;
		
		let mass = 0;
		for (const utxo of list) {
			if (utxos.length >= maxCount || mass+utxo.mass >= maxMass)
				break;
			utxoIds.push(utxo.id);
			utxos.push(utxo);
			totalVal += utxo.satoshis;
			mass += utxo.mass;
		}
		//console.log("maxMass:"+maxMass, "mass:"+mass)
		return {
			utxoIds,
			utxos,
			amount: totalVal,
			mass
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

	get confirmedCount():number{
		return this.utxos.confirmed.size
	}
}
