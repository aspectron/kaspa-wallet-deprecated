export const now = Date.now || function() {
  return new Date().getTime();
};

export const dpc = (delay:number|Function, fn?:Function|number)=>{
  if(typeof delay == 'function'){
    let temp = fn as number;
    fn = delay;
    delay = temp;
  }
  return setTimeout(fn as Function, delay||0);
}

// Returns a function, that, when invoked, will only be triggered at most once
// during a given window of time. Normally, the throttled function will run
// as much as it can, without ever going more than once per `wait` duration;
// but if you'd like to disable the execution on the leading edge, pass
// `{leading: false}`. To disable execution on the trailing edge, ditto.
export const throttle = (func:Function, wait:number, options:{leading?:boolean, trailing?:boolean}={})=>{
  let timeout:any, context:any, args:any, result:any;
  let previous = 0;

  let later = function() {
    previous = options.leading === false ? 0 : now();
    timeout = null;
    result = func.apply(context, args);
    if (!timeout)
      context = args = null;
  };

  let throttled = function() {
    let _now = now();
    if (!previous && options.leading === false)
      previous = _now;
    let remaining = wait - (_now - previous);
    //@ts-ignore
    context = this;
    args = arguments;
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = _now;
      result = func.apply(context, args);
      if (!timeout)
        context = args = null;
    } else if (!timeout && options.trailing !== false) {
      timeout = setTimeout(later, remaining);
    }
    return result;
  };

  //@ts-ignore
  throttled.cancel = function() {
    clearTimeout(timeout);
    previous = 0;
    timeout = context = args = null;
  };

  return throttled;
}