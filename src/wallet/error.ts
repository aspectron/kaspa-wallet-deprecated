//@ts-ignore
if(!Error.captureStackTrace && !self.__Error__){
	//@ts-ignore
	self.__Error__ = self.Error;
	class Error{
		stack:string;
		message:string;
		constructor(message:string) {
			this.message = message;
			//@ts-ignore
			this.stack = ((new self.__Error__(message)).stack+"").split("↵").join("\n");
		}
	}

	//@ts-ignore
	self.Error = Error;
}

export {};