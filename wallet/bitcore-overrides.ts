import { Buffer } from 'safe-buffer';
const _ = require('lodash');
import * as bitcore from 'bitcore-lib-cash';

export const setup = ()=>{

}

console.log("########################")
console.log("########################")
console.log("########################")
console.log("########################")
console.log("########################")
console.log("########################")

const Output = require('bitcore-lib-cash/lib/transaction/output');
const Input = require('bitcore-lib-cash/lib/transaction/input');
const Interpreter = require('bitcore-lib-cash/lib/script/interpreter');
const DEFAULT_SIGN_FLAGS = Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID;
const SIGHASH_SINGLE_BUG = '0000000000000000000000000000000000000000000000000000000000000001';
const BITS_64_ON = 'ffffffffffffffff';
const blake2 = require('blake2');
const secp256k1 = require('../../secp256k1/secp.js');

let {PrivateKey, PublicKey, Script, Transaction} = bitcore;
let {Schnorr, Signature, BN, Hash} = bitcore.crypto;
let {BufferReader, BufferWriter} = bitcore.encoding;
let {sighash} = Transaction;

const TransactionSigningHashKey  = Buffer.from("TransactionSigningHash");
const blake2b_256 = (buf:Buffer, key:string):Buffer=>{
  //let buf = Buffer.from(str, "hex");
  return blake2.createKeyedHash("blake2b", key, {digestLength:32}).update(buf).digest();
}


//@ts-ignore
const {preconditions:_$, buffer:BufferUtil} = bitcore.util;

//@ts-ignore
if(!sighash._sighash){
  //@ts-ignore
  sighash._sighash = sighash.sighash;
  //@ts-ignore
  sighash.sighash = (transaction, sighashType, inputNumber, subscript, satoshisBN, flags)=>{
    //ssss.sss
    //var Transaction = require('./transaction');
    //var Input = require('./input');
    
    if (_.isUndefined(flags)){
      flags = DEFAULT_SIGN_FLAGS;
    }

    // Copy transaction
    var txcopy = Transaction.shallowCopy(transaction);

    // Copy script
    subscript = new Script(subscript);

    if (flags & Interpreter.SCRIPT_ENABLE_REPLAY_PROTECTION) {
      // Legacy chain's value for fork id must be of the form 0xffxxxx.
      // By xoring with 0xdead, we ensure that the value will be different
      // from the original one, even if it already starts with 0xff.
      var forkValue = sighashType >> 8;
      var newForkValue =  0xff0000 | ( forkValue ^ 0xdead);
      sighashType =  (newForkValue << 8) | (sighashType & 0xff)
    }

    if ( ( sighashType & Signature.SIGHASH_FORKID)  && (flags & Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID) ) {
      //@ts-ignore
      return sighash.sighashForForkId(txcopy, sighashType, inputNumber, subscript, satoshisBN);
    }

    // For no ForkId sighash, separators need to be removed.
    subscript.removeCodeseparators();

    var i;

    for (i = 0; i < txcopy.inputs.length; i++) {
      // Blank signatures for other inputs
      txcopy.inputs[i] = new Input(txcopy.inputs[i]).setScript(Script.empty());
    }

    txcopy.inputs[inputNumber] = new Input(txcopy.inputs[inputNumber]).setScript(subscript);

    if ((sighashType & 31) === Signature.SIGHASH_NONE ||
      (sighashType & 31) === Signature.SIGHASH_SINGLE) {

      // clear all sequenceNumbers
      for (i = 0; i < txcopy.inputs.length; i++) {
        if (i !== inputNumber) {
          txcopy.inputs[i].sequenceNumber = 0;
        }
      }
    }

    if ((sighashType & 31) === Signature.SIGHASH_NONE) {
      txcopy.outputs = [];

    } else if ((sighashType & 31) === Signature.SIGHASH_SINGLE) {
      // The SIGHASH_SINGLE bug.
      // https://bitcointalk.org/index.php?topic=260595.0
      if (inputNumber >= txcopy.outputs.length) {
        return Buffer.from(SIGHASH_SINGLE_BUG, 'hex');
      }

      txcopy.outputs.length = inputNumber + 1;

      for (i = 0; i < inputNumber; i++) {
        txcopy.outputs[i] = new Output({
          //@ts-ignore
          satoshis: BN.fromBuffer(Buffer.from(BITS_64_ON, 'hex')),
          script: Script.empty()
        });
      }
    }
    
    if (sighashType & Signature.SIGHASH_ANYONECANPAY) {
      txcopy.inputs = [txcopy.inputs[inputNumber]];
    }

    let buf = new BufferWriter()
      .write(txcopy.toBuffer())
      .writeInt32LE(sighashType)
      .toBuffer()
    //var ret = Hash.sha256sha256(buf);
    //@ts-ignore
    let ret = blake2b_256(buf, TransactionSigningHashKey);
    console.log("\n\n\n $$$$$$$$$$tx_hash::::", ret.toString("hex"))
    //@ts-ignore
    ret = new BufferReader(ret).readReverse();
    return ret;
  }
}

//@ts-ignore
Schnorr.sign = function(hashbuf:Buffer, privateKey:PrivateKey){
  console.log(":::sighash:", hashbuf.toString("hex"))
  let result = secp256k1.schnorrsig_sign(privateKey.toString(), hashbuf.toString("hex"));
  let sig = bitcore.crypto.Signature.fromString(result.sig);
  sig.compressed = true;
  return sig;
}
//@ts-ignore
Schnorr.verify = function(hashbuf, sig, pubkey, endian) {
  return true;//TODO
}

Script.buildPublicKeyHashIn = function(publicKey, signature, sigtype) {
  _$.checkArgument(signature instanceof Signature || BufferUtil.isBuffer(signature));
  _$.checkArgument(_.isUndefined(sigtype) || _.isNumber(sigtype));
  if (signature instanceof Signature) {
    signature = signature.toBuffer();
  }
  var script = new Script()
  //@ts-ignore
    .add(BufferUtil.concat([
      signature,
      //@ts-ignore
      BufferUtil.integerAsSingleByteBuffer(sigtype || Signature.SIGHASH_ALL)
    ]))
    //@ts-ignore
    .add(new PublicKey(publicKey).toBuffer().slice(1));
  return script;
};


PrivateKey.prototype.toPublicKey = function(){
  if (!this._pubkey) {
    let publicKeys = secp256k1.export_public_keys(this.toString());
    this._pubkey = new PublicKey(publicKeys.pubkey, {network:this.network.name});//PublicKey.fromPrivateKey(this);
  }
  return this._pubkey;
};

let _txlogBuffer = false;
const txlogBuffer = (...args:any[])=>{
  //@ts-ignore
  //if(!_txlogBuffer)
  //  return
  args[args.length-1] = args[args.length-1].map((buf:Buffer)=>buf.toString("hex"));
  console.log(...args)
}

//@ts-ignore
Transaction.prototype.toBufferWriter = function(writer, extra) {
  writer.writeInt32LE(this.version);
  txlogBuffer("$$$$ version: ", this.version, writer.bufs)
  let bn = BN.fromNumber(this.inputs.length);
  writer.writeUInt64LEBN(bn);
  txlogBuffer("$$$$ inputs.length: ", this.inputs.length, writer.bufs)
  //@ts-ignore
  _.each(this.inputs, function(input) {
    input.toBufferWriter(writer);
  });
  bn = BN.fromNumber(this.outputs.length);
  writer.writeUInt64LEBN(bn);
  txlogBuffer("$$$$ outputs.length: ", this.outputs.length, writer.bufs)
  //@ts-ignore
  _.each(this.outputs, function(output) {
    output.toBufferWriter(writer);
  });
  bn = BN.fromNumber(this.nLockTime);
  writer.writeUInt64LEBN(bn);
  txlogBuffer("$$$$ nLockTime: ", this.nLockTime, writer.bufs)

  let subnetworkId = Buffer.from("0000000000000000000000000000000000000000", "hex");
  writer.write(subnetworkId);
  txlogBuffer("$$$$ subnetworkId: ", subnetworkId.toString("hex"), writer.bufs)

  //GAS
  let gas = Buffer.from("0000000000000000", "hex");
  writer.write(gas);
  txlogBuffer("$$$$ gas: ", gas.toString("hex"), writer.bufs)
  //PayloadHash
  let payload = Buffer.from("0000000000000000000000000000000000000000000000000000000000000000", "hex")
  writer.write(payload)
  txlogBuffer("$$$$ payload: ", payload.toString("hex"), writer.bufs)

  let unknown = Buffer.from("0000000000000000", "hex");
  writer.write(unknown);
  txlogBuffer("$$$$ unknown: ", unknown.toString("hex"), writer.bufs)

  return writer;
};

Transaction.prototype.fromBufferReader = function(reader) {
  _$.checkArgument(!reader.finished(), 'No transaction data received');
  var i, sizeTxIns, sizeTxOuts;

  this.version = reader.readInt32LE();
  sizeTxIns = reader.readUInt64LEBN().toNumber();
  for (i = 0; i < sizeTxIns; i++) {
    var input = Input.fromBufferReader(reader);
    this.inputs.push(input);
  }
  sizeTxOuts = reader.readUInt64LEBN().toNumber();
  for (i = 0; i < sizeTxOuts; i++) {
    this.outputs.push(Output.fromBufferReader(reader));
  }
  this.nLockTime = reader.readUInt32LE();
  return this;
};

Output.fromBufferReader = function(br:any) {
  var obj:any = {};
  obj.satoshis = br.readUInt64LEBN();
  var size = br.readUInt64LEBN().toNumber();
  if (size !== 0) {
    obj.script = br.read(size);
  } else {
    obj.script = Buffer.from([]);
  }
  return new Output(obj);
};

Output.prototype.toBufferWriter = function(writer:any) {
  if (!writer) {
    writer = new BufferWriter();
  }
  writer.writeUInt64LEBN(this._satoshisBN);
  var script = this._scriptBuffer;
  let bn = BN.fromNumber(script.length);
  writer.writeUInt64LEBN(bn);
  writer.write(script);
  return writer;
};

Input.fromBufferReader = function(br:any) {
  var input = new Input();
  input.prevTxId = br.read(32);
  input.outputIndex = br.readUInt32LE();
  input._scriptBuffer = br.read(br.readUInt64LEBN().toNumber());
  input.sequenceNumber = br.readUInt64LEBN().toNumber();
  // TODO: return different classes according to which input it is
  // e.g: CoinbaseInput, PublicKeyHashInput, MultiSigScriptHashInput, etc.
  return input;
};

Input.prototype.toBufferWriter = function(writer:any) {
  if (!writer) {
    writer = new BufferWriter();
  }

  var script = this._scriptBuffer;

  //@ts-ignore
  let prevTxId = new BufferReader(this.prevTxId).readReverse()
  writer.write(this.prevTxId);
  txlogBuffer("$$$$ prevTxId1: ", this.prevTxId.toString("hex"), writer.bufs)
  writer.writeUInt32LE(this.outputIndex);
  txlogBuffer("$$$$ outputIndex: ", this.outputIndex, writer.bufs)
  let bn = BN.fromNumber(script.length);
  writer.writeUInt64LEBN(bn);
  txlogBuffer("$$$$ script.length: ", script.length, writer.bufs)
  let scriptBuf = Buffer.from(script, "hex");
  writer.write(scriptBuf);
  txlogBuffer("$$$$ script: ", script.toString("hex"), writer.bufs)
  bn = BN.fromNumber(this.sequenceNumber);
  writer.writeUInt64LEBN(bn);
  txlogBuffer("$$$$ sequenceNumber: ", this.sequenceNumber, writer.bufs)
  
  return writer;
};

//@ts-ignore
Transaction.prototype.getSignatures = function(privKey, sigtype, signingMethod) {
  privKey = new PrivateKey(privKey);

  // By default, signs using ALL|FORKID
  //@ts-ignore
  sigtype = sigtype || (Signature.SIGHASH_ALL |  Signature.SIGHASH_FORKID);
  var transaction = this;
  //@ts-ignore
  var results = [];
  
  var hashData = Hash.sha256ripemd160(privKey.publicKey.toBuffer().slice(1));
  //@ts-ignore
  _.each(this.inputs, function forEachInput(input, index) {
    _.each(input.getSignatures(transaction, privKey, index, sigtype, hashData, signingMethod), function(signature:any) {
      results.push(signature);
    });
  });
  //@ts-ignore
  return results;
};

