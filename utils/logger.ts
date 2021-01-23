import {FlowLogger} from '@aspectron/flow-logger';
//import '../types/flow-logger';
declare module '@aspectron/flow-logger' {
	interface FlowLogger{
		//utxodebug(...args: any[]):void;
		//utxo(...args: any[]):void;
	}
}

let custom = ['utxo:cyan', 'utxodebug:cyan', 'tx:green', 'txdebug:green']
const logger = new FlowLogger('FlowHttp', { 
	display : ['name', 'level', 'time'], 
	custom, 
	color: ['level']
});

logger.enable('all');

export type Logger = typeof logger; //TODO find how to export type from module
export const log = logger;

export const CreateLogger = () : Logger=>{
	let logger = new FlowLogger('FlowHttp', { 
		display : ['name', 'level', 'time'], 
		custom, 
		color: ['level']
	});
	return logger;
}
