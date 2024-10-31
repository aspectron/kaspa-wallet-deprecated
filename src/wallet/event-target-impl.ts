export declare type Event = {type:string, detail:any, defaultPrevented:boolean};
export declare type EventListener = (detail:any, event:Event)=>void;
export class EventTargetImpl{

	listeners:Map<string, EventListener[]>;


	constructor(){
		this.listeners = new Map()
	}

	/**
	* fire CustomEvent
	* @param {String} eventName name of event
	* @param {Object=} detail event's [detail]{@link https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail} property
	* @since 0.0.1
	*/
	emit(type:string, detail:any={}){
		this.dispatchEvent({type, detail, defaultPrevented:false});
	}

	on(type:string, callback:EventListener){
		this.addEventListener(type, callback)
	}

	addEventListener(type:string, callback:EventListener) {
		let list = this.listeners.get(type);
		if (!list) {
			list = [];
			this.listeners.set(type, list);
		}
		list.push(callback);
	}

	removeEventListener(type:string, callback:EventListener) {
		let stack = this.listeners.get(type);
		if (!stack)
			return;

		for (let i = 0, l = stack.length; i < l; i++) {
			if (stack[i] === callback){
				stack.splice(i, 1);
				return;
			}
		}
	}

	dispatchEvent(event:Event){
		let list = this.listeners.get(event.type);
		if (!list)
			return true;

		let stack = list.slice();

		for (let i = 0, l = stack.length; i < l; i++) {
			stack[i].call(this, event.detail, event);
		}
		return !event.defaultPrevented;
	}
}