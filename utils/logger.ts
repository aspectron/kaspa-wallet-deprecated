const winston = require('winston');


const levels = {
	error: 0,
	warn: 1,
	info : 2,
	verbose: 3,
	debug: 4,
}

const colors = {
	error: 'red',
	warn: 'magenta',
	info: 'cyan',
	verbose: 'yellow',
	debug: 'green',
}

winston.addColors(colors);

const logger = winston.createLogger({
  level: 'info',
  levels,
  format: winston.format.json(),
});

logger.add(
	new winston.transports.Console({
		format: winston.format.combine(
			winston.format.colorize(),
			winston.format.simple()
		)
	})
);

export type Logger = typeof logger; //TODO find how to export type from module
export const log = logger;

export const CreateLogger = () : Logger=>{
	let logger = winston.createLogger({
		level: 'info',
		levels,
		format: winston.format.json()
	});

	//if (process.env.NODE_ENV !== 'production') {
		logger.add(
			new winston.transports.Console({
				format: winston.format.combine(
					winston.format.colorize(),
					winston.format.simple()
				)
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
