const winston = require('winston');

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
});

export type Logger = typeof logger; //TODO find how to export type from module

export const CreateLogger = ()=>{
	return winston.createLogger({
		level: 'info',
		format: winston.format.json(),
	});
}

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}
