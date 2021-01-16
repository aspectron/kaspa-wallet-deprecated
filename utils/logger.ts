const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
});

export type Logger = typeof logger; //TODO find how to export type from module

export const CreateLogger = () : Logger=>{
	let logger = winston.createLogger({
		level: 'none',
		format: winston.format.json()
	});

	//if (process.env.NODE_ENV !== 'production') {
		logger.add(
			new winston.transports.Console({
				format: winston.format.simple(),
			})
		);
	//}
	return logger;
}

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
/*
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}
*/
