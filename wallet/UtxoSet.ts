import { Api, RPC, UnspentOutputInfo } from 'custom-types';
// @ts-ignore
import * as bitcore from 'bitcore-lib-cash';
import { logger } from '../utils/logger';
import * as crypto from 'crypto';
import * as helper from '../utils/helper';
// import * as api from './apiHelpers';
import {Wallet} from './wallet';
import {EventTargetImpl} from './event-target-impl';

export class UnspentOutput extends bitcore.Transaction.UnspentOutput{
  blockBlueScore:number;
  constructor(o: UnspentOutputInfo){
    super(o);
    this.blockBlueScore = o.blockBlueScore;
  }
}
let seq = 0;
export class UtxoSet extends EventTargetImpl{
  utxos: Record<string, UnspentOutput> = {};

  inUse: string[] = [];

  totalBalance = 0;

  availableBalance = 0;
  debug:boolean = false;

  get length(): number {
    return Object.keys(this.utxos).length;
  }

  utxoStorage: Record<string, Api.Utxo[]> = {};

  wallet: Wallet;

  addressesUtxoSyncStatuses:Map<string, boolean> = new Map();
  throttledUtxoSync:Function;

  constructor(wallet:Wallet){
    super();
    this.wallet = wallet;
    this.throttledUtxoSync = helper.throttle(this.utxoSync.bind(this), wallet.options.utxoSyncThrottleDelay)
  }

  /**
   * Add UTXOs to UTXO set.
   * @param utxos Array of UTXOs from kaspa API.
   * @param address Address of UTXO owner.
   */
  add(utxos: Api.Utxo[], address: string): string[] {
    const utxoIds: string[] = [];
    this.debug && console.log("utxos", utxos)
    utxos.forEach((utxo) => {
      /***********************************************/
      /**** until gRPC response comes correctly *****
      if(!utxo.transactionId){
        utxo.transactionId = sha256( `${Date.now()+Math.random()}` )
      }
      if(utxo.index ===  undefined)
        utxo.index = 0;
      utxo.isSpendable = true;
      /***********************************************/

      const utxoId = utxo.transactionId + utxo.index.toString();
      const utxoInUse = this.inUse.includes(utxoId);
      const alreadyHaveIt = this.utxos[utxoId];
      console.log("utxo.scriptPubKey", utxo.scriptPubKey+"", utxo)
      //console.log("utxoInUse", {utxoInUse, alreadyHaveIt})
      if (!utxoInUse && !alreadyHaveIt /*&& utxo.isSpendable*/) {
        utxoIds.push(utxoId);
        this.utxos[utxoId] = new UnspentOutput({
          txid: utxo.transactionId,
          address,
          vout: utxo.index,
          scriptPubKey: utxo.scriptPubKey,
          satoshis: +utxo.amount,
          blockBlueScore: utxo.blockBlueScore
        });
      }
    });
    if (utxoIds.length) {
      logger.log('info', `Added ${utxoIds.length} UTXOs to UtxoSet.`);
      // this.updateUtxoBalance();
    }
    return utxoIds;
  }

  remove(utxoIds: string[]): void {
    this.release(utxoIds);
    utxoIds.forEach((id) => delete this.utxos[id]);
  }

  release(utxoIdsToEnable: string[]): void {
    // assigns new array without any utxoIdsToEnable
    this.inUse = this.inUse.filter((utxoId) => !utxoIdsToEnable.includes(utxoId));
    // this.updateUtxoBalance();
  }

  updateUtxoBalance(): void {
    const utxoIds = Object.keys(this.utxos);
    const utxoIdsNotInUse = utxoIds.filter((key) => !this.inUse.includes(key));
    this.totalBalance = utxoIds.reduce((prev, cur) => prev + this.utxos[cur].satoshis, 0);
    this.availableBalance = utxoIdsNotInUse.reduce(
      (prev, cur) => prev + this.utxos[cur].satoshis,
      0
    );
  }

  clear(): void {
    this.utxos = {};
    this.inUse = [];
    this.availableBalance = 0;
    this.utxoStorage = {};
    logger.log('info', 'UTXO set cleared.');
  }

  /**
   * Naively select UTXOs.
   * @param txAmount Provide the amount that the UTXOs should cover.
   * @throws Error message if the UTXOs can't cover the `txAmount`
   */
  selectUtxos(txAmount: number): { utxoIds: string[]; utxos: UnspentOutput[] } {
    const utxos: UnspentOutput[] = [];
    const utxoIds: string[] = [];
    let totalVal = 0;
    let list = Object.values(this.utxos);

    list = list.filter((utxo)=>{
      const utxoId = utxo.txId+utxo.outputIndex;
        return (!this.inUse.includes(utxoId) && this.wallet.blueScore - utxo.blockBlueScore > 100);
    });

    list.sort((a:UnspentOutput, b:UnspentOutput): number=>{
      return a.blockBlueScore - b.blockBlueScore || a.satoshis - b.satoshis || a.txId.localeCompare(b.txId) || a.outputIndex - b.outputIndex; 
    })

    for (const utxo of list ){ 
      const utxoId = utxo.txId+utxo.outputIndex;
      console.log("info",`UTXO ID: ${utxoId}  , UTXO: ${utxo}`);
      if (!this.inUse.includes(utxoId) && this.wallet.blueScore - utxo.blockBlueScore > 100) {
    
        utxoIds.push(utxoId);
        utxos.push(utxo);
        totalVal += utxo.satoshis;
      }
      if (totalVal >= txAmount) break;
    }
    if (totalVal < txAmount)
      throw new Error(`Transaction compose error. Need: ${txAmount}, UTXO Balance: ${totalVal}`);

    return { utxoIds, utxos };
  }

  syncAddressesUtxos(addresses:string[]){
    const newAddresses = addresses.map(address=>{
      if(this.addressesUtxoSyncStatuses.has(address))
        return
      this.addressesUtxoSyncStatuses.set(address, false);
      return address;
    }).filter(address=>address);

    if(!newAddresses.length)
      return 
    this.throttledUtxoSync();
  }

  async utxoSync():Promise<string[]>{
    let addresses:string[] = [];
    this.addressesUtxoSyncStatuses.forEach((sent, address)=>{
      //if(sent)
      //  return

      //  !!!FIXME prevent multiple address subscriptions
      //      if(!this.addressesUtxoSyncStatuses.get(address)) {
        this.addressesUtxoSyncStatuses.set(address, true);
        addresses.push(address);
      //      }
    });

    if(!addresses.length)
      return addresses;
    console.log(`[${this.wallet.network}] !!! +++++++++++++++ SUBSCRIBING TO ADDRESSES :)\n`,addresses);
    let utxoChangedRes = await this.wallet.api.subscribeUtxosChanged(addresses, this.onUtxosChanged.bind(this))
    .catch((error:RPC.Error)=>{
      console.log(`[${this.wallet.network}] RPC ERROR in uxtoSync! while registering addresses:`, error, addresses);
      addresses.map(address=>{
        this.addressesUtxoSyncStatuses.set(address, false);
      })
    })

    //console.log("utxoSync:utxoChangedRes:", utxoChangedRes, "\n utxoSync addresses:", addresses)
    return addresses;
  }

  onUtxosChanged(added:Map<string, Api.Utxo[]>, removed:Map<string, RPC.Outpoint[]>){
    //console.log("onUtxosChanged:res", added, removed)


    added.forEach((utxos, address)=>{


      // utxos.sort((b, a)=> a.index-b.index)
//      logger.log('info', `${address}: ${utxos.length} utxos found.+=+=+=+=+=+=+++++=======+===+====+====+====+`);
      if (!utxos.length)
        return

      console.log('seq:',seq++,'tx:',utxos[0].transactionId);

      if(!this.utxoStorage[address]){
        this.utxoStorage[address] = utxos;
      }else{
        let txid2Utxo:Record<string, Api.Utxo> = {};
        utxos.forEach(utxo=>{
          txid2Utxo[utxo.transactionId+utxo.index] = utxo;
        })
        let oldUtxos = this.utxoStorage[address].filter(utxo=>{
          return !txid2Utxo[utxo.transactionId+utxo.index]
        });
        this.utxoStorage[address] = [...oldUtxos, ...utxos];
      }
      this.add(utxos, address);
    })

    let utxoIds:string[] = [];
    removed.forEach((utxos, address)=>{
      let txid2Outpoint:Record<string, RPC.Outpoint> = {};
      utxos.forEach(utxo=>{
        txid2Outpoint[utxo.transactionId+utxo.index] = utxo;
        utxoIds.push(utxo.transactionId+utxo.index);
      })
      if(!this.utxoStorage[address])
        return
      this.utxoStorage[address] = this.utxoStorage[address].filter(utxo=>{
        return !txid2Outpoint[utxo.transactionId+utxo.index]
      });
    })  

    if(utxoIds.length)
      this.remove(utxoIds);

    const isActivityOnReceiveAddr =
      this.utxoStorage[this.wallet.receiveAddress] !== undefined;
    if (isActivityOnReceiveAddr)
      this.wallet.addressManager.receiveAddress.next();

    this.updateUtxoBalance();
    this.emit("balance-update");
    this.wallet.emit("utxo-change", {added,removed});
  }
}
