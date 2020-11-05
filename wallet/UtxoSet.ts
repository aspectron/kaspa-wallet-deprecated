import { Api } from 'custom-types';
import bitcore from 'bitcore-lib-cash';
import { logger } from '../utils/logger';

export class UtxoSet {
  utxos: Record<string, bitcore.Transaction.UnspentOutput> = {};

  inUse: string[] = [];

  totalBalance = 0;

  availableBalance = 0;

  get length(): number {
    return Object.keys(this.utxos).length;
  }

  utxoStorage: Record<string, Api.Utxo[]> = {};

  /**
   * Add UTXOs to UTXO set.
   * @param utxos Array of UTXOs from kaspa API.
   * @param address Address of UTXO owner.
   */
  add(utxos: Api.Utxo[], address: string): string[] {
    const utxoIds: string[] = [];
    utxos.forEach((utxo) => {
      const utxoId = utxo.transactionId + utxo.index.toString();
      const utxoInUse = this.inUse.indexOf(utxoId) !== -1;
      const alreadyHaveIt = this.utxos[utxoId];
      if (!utxoInUse && !alreadyHaveIt && utxo.isSpendable) {
        utxoIds.push(utxoId);
        this.utxos[utxoId] = new bitcore.Transaction.UnspentOutput({
          txid: utxo.transactionId,
          address,
          vout: utxo.index,
          scriptPubKey: utxo.scriptPubKey,
          satoshis: utxo.value,
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
    this.inUse = this.inUse.filter((utxoId) => utxoIdsToEnable.indexOf(utxoId) === -1);
    // this.updateUtxoBalance();
  }

  updateUtxoBalance(): void {
    const utxoIds = Object.keys(this.utxos);
    const utxoIdsNotInUse = utxoIds.filter((key) => this.inUse.indexOf(key) === -1);
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
    logger.log('info', 'UTXO set cleared.');
  }

  /**
   * Naively select UTXOs.
   * @param txAmount Provide the amount that the UTXOs should cover.
   * @throws Error message if the UTXOs can't cover the `txAmount`
   */
  selectUtxos(txAmount: number): { utxoIds: string[]; utxos: bitcore.Transaction.UnspentOutput[] } {
    const utxos: bitcore.Transaction.UnspentOutput[] = [];
    const utxoIds: string[] = [];
    let totalVal = 0;
    for (const [utxoId, utxo] of Object.entries(this.utxos)) {
      if (this.inUse.indexOf(utxoId) === -1) {
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
}
