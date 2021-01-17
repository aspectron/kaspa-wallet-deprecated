Kaspa Wallet
============

Kaspa Wallet library implements Wallet functionality for the [Kaspa Network](https://github.com/kaspanet/kaspad)

Kaspa Wallet is implemented in TypeScript and can be used server-side and client-side (browser)

Components
----------

Kaspa Wallet uses the following modules:

  * `kaspa-grpc` - provides GRPC bindings for `kaspad`
  * `kaspa-grpc-node` - GRPC transport for server-side (NodeJs)
  * `kaspa-grpw-web` - GRPC transport for client-side (browsers)
  * `kaspacore-lib` - Kaspa UTXO and transaction data structures


Creating a wallet
-----------------

Network types are identified by address prefixes:
  * `kaspa` (Mainnet)
  * `kaspatest` (Testnet) 
  * `kaspadev` (Devnet) 
  * `kaspasim` (Simnet)

Creating from Mnemonic:
```js
const network = "kaspatest";                          
const { port } = Wallet.networkTypes[kaspatest].port; // default port for testnet
const rpc = new RPC({ clientConfig:{ host : '127.0.0.1:'+port } });

Wallet.fromMnemonic(
    "user mnemonic string",
    { network, rpc },
    {disableAddressDerivation:true}
);
```

Creating new wallet instance with dynamically generated mnemonic:
```js
const wallet = new Wallet(null, null, {network, rpc});
const encryptedMnemonic = await wallet.export(cmd.password);
console.log('mnemonic:',wallet.mnemonic);
console.log('encrypted mnemonic:',encryptedMnemonic);
```

Restoring from encrypted mnemonic:
```js
const password = "user password";
const encryptedMnemonic = "previously encrypted mnemonic";
let wallet = await Wallet.import(password, encryptedMnemonic, { network, rpc })
```

Synchronizing a wallet
------------------------

The function `Wallet::sync(once?:boolean)` can be used to perform wallet synchronization. Wallet synchronization
will connect to `kaspad` and scan available UTXO entries for wallet addresses, update the wallet
balance and if `once` is true, exit or if `once` is false, start wallet monitoring services.

When operating with monitoring enabled, wallet will retain connection to `kaspad` and dynamically
update wallet UTXO entries as well as balances.

- `wallet.sync()` - starts the wallet in monitoring mode
- `wallet.sync(true)` - performs a single-time synchronization

Sending transactions
--------------------

```js
let response = await this.wallet.submitTransaction({
    address, // destination address
    amount,  // amount in base units
    fee,     // user fees
});
```

On success, `sumbitTransaction()` resolves:
- *Transaction id* (string) if successful

On failure, rejects with:

- `FetchError` if endpoint is down // TODO - review
- API error message (string) if `kaspad` yields an GRPC API error // TODO - review
- `Error` if amount is too large // TODO - review

// TODO - sample code that demonstrates how to appropriately handle errors


Obtaining balances
------------------

Wallet retains 2 types of balances:
- *available* balance contains KSP ready to spend, comprised of UTXO records with maturity blue score over 100
- *pending* balance contains newly received transactions with UTXO maturity less than 100.  Upon each UTXO maturity balance is relocated from pending to available


Wallet events
-------------

`api-online` - GPRC API is online
`api-offline` - GRPC API is offline

need: 'sync-started'
need: 'sync-finished'
need: 'ready' - wallet is ready for use (should be sent after sync-finished with balance info)

`blue-score-changed` - Kaspa blue score change
`utxo-change` - signaled when UTXO is added or removed from the wallet UTXO set
`balance-update` - indicates wallet balance change (available or pending)





