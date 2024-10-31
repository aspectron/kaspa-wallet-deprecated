import {FlowLogger} from '@aspectron/flow-logger';

let custom = ['utxo:cyan', 'utxodebug:cyan', 'tx:green', 'txdebug:green']
const logger = new FlowLogger('Kaspa Wallet', { 
	display : ['name', 'level', 'time'], 
	custom, 
	color: ['level']
});

logger.enable('all');

export type Logger = typeof logger; //TODO find how to export type from module
export const log = logger;
export {FlowLogger};
export const CreateLogger = (name:string="KaspaWallet") : Logger=>{
	let logger = new FlowLogger(name, { 
		display : ['name', 'level', 'time'], 
		custom, 
		color: ['level']
	});
	return logger;
}
