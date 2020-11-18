"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston = require('winston');
exports.logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
});
//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
    exports.logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vdXRpbHMvbG9nZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUV0QixRQUFBLE1BQU0sR0FBRyxPQUFPLENBQUMsWUFBWSxDQUFDO0lBQ3pDLEtBQUssRUFBRSxNQUFNO0lBQ2IsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFO0NBQzlCLENBQUMsQ0FBQztBQUVILEVBQUU7QUFDRix3RUFBd0U7QUFDeEUsZ0VBQWdFO0FBQ2hFLEVBQUU7QUFDRixJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxLQUFLLFlBQVksRUFBRTtJQUN6QyxjQUFNLENBQUMsR0FBRyxDQUNSLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7UUFDN0IsTUFBTSxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO0tBQ2hDLENBQUMsQ0FDSCxDQUFDO0NBQ0giLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCB3aW5zdG9uID0gcmVxdWlyZSgnd2luc3RvbicpO1xuXG5leHBvcnQgY29uc3QgbG9nZ2VyID0gd2luc3Rvbi5jcmVhdGVMb2dnZXIoe1xuICBsZXZlbDogJ2luZm8nLFxuICBmb3JtYXQ6IHdpbnN0b24uZm9ybWF0Lmpzb24oKSxcbn0pO1xuXG4vL1xuLy8gSWYgd2UncmUgbm90IGluIHByb2R1Y3Rpb24gdGhlbiBsb2cgdG8gdGhlIGBjb25zb2xlYCB3aXRoIHRoZSBmb3JtYXQ6XG4vLyBgJHtpbmZvLmxldmVsfTogJHtpbmZvLm1lc3NhZ2V9IEpTT04uc3RyaW5naWZ5KHsgLi4ucmVzdCB9KSBgXG4vL1xuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgbG9nZ2VyLmFkZChcbiAgICBuZXcgd2luc3Rvbi50cmFuc3BvcnRzLkNvbnNvbGUoe1xuICAgICAgZm9ybWF0OiB3aW5zdG9uLmZvcm1hdC5zaW1wbGUoKSxcbiAgICB9KVxuICApO1xufVxuIl19