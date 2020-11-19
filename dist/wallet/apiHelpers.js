"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postTx = exports.getUtxos = exports.getTransactions = exports.getBlock = exports.setRPC = void 0;
let RPC;
class ApiError extends Error {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args) {
        super(...args);
        this.name = 'ApiError';
        Error.captureStackTrace(this, ApiError);
    }
}
const missingRPCProviderError = () => {
    throw new ApiError(`RPC privider is missing. Please set RPC using 
		wallet.setRPC(rpc_provider).`);
};
exports.setRPC = (rpc) => {
    RPC = rpc;
};
exports.getBlock = (blockHash) => __awaiter(void 0, void 0, void 0, function* () {
    if (!RPC)
        return missingRPCProviderError();
    // eslint-disable-next-line
    const response = yield RPC.getBlock(blockHash)
        .catch((e) => {
        throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
    });
    const json = response; // eslint-disable-line
    if (json.errorMessage) {
        const err = json;
        throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
    }
    return json;
});
// TODO: handle pagination
exports.getTransactions = (address) => __awaiter(void 0, void 0, void 0, function* () {
    if (!RPC)
        return missingRPCProviderError();
    const getTx = (limit, skip) => __awaiter(void 0, void 0, void 0, function* () {
        // eslint-disable-next-line
        const response = yield RPC.getAddressTransactions(address, limit, skip)
            .catch((e) => {
            throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
        });
        let json = response; // eslint-disable-line
        if (json.errorMessage) {
            const err = json;
            throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
        }
        let result = json;
        if (result.length === 1000) {
            const tx = yield getTx(limit, skip + 1000);
            result = [...tx, ...result];
        }
        return result;
    });
    const json = yield getTx(1000, 0);
    return { transactions: json };
});
exports.getUtxos = (address) => __awaiter(void 0, void 0, void 0, function* () {
    if (!RPC)
        return missingRPCProviderError();
    const getRecursively = (limit, skip) => __awaiter(void 0, void 0, void 0, function* () {
        // eslint-disable-next-line
        const response = yield RPC.getUtxos(address, limit, skip)
            .catch((e) => {
            throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
        });
        const json = response; // eslint-disable-line
        if (json.errorMessage) {
            const err = json;
            throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
        }
        let result = json;
        if (result.length === 1000) {
            const utxos = yield getRecursively(limit, skip + 1000);
            result = [...utxos, ...result];
        }
        return result;
    });
    const json = yield getRecursively(1000, 0);
    return {
        utxos: json,
    };
});
exports.postTx = (rawTransaction) => __awaiter(void 0, void 0, void 0, function* () {
    if (!RPC)
        return missingRPCProviderError();
    // eslint-disable-next-line
    const response = yield RPC.postTx(rawTransaction).catch((e) => {
        throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
    });
    const json = response; // eslint-disable-line
    if (json.success)
        return true;
    if (!json.errorMessage)
        json.errorMessage = 'Api error. Please try again later. (ERROR: POST-TX:100)';
    throw new ApiError(`API error ${json.errorCode}: ${json.errorMessage}`);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpSGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3dhbGxldC9hcGlIZWxwZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUNBLElBQUksR0FBUSxDQUFDO0FBRWIsTUFBTSxRQUFTLFNBQVEsS0FBSztJQUMzQiw4REFBOEQ7SUFDOUQsWUFBWSxHQUFHLElBQVc7UUFDekIsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsSUFBSSxHQUFHLFVBQVUsQ0FBQztRQUN2QixLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7Q0FDRDtBQUVELE1BQU0sdUJBQXVCLEdBQUcsR0FBRSxFQUFFO0lBQ25DLE1BQU0sSUFBSSxRQUFRLENBQUM7K0JBQ1csQ0FBQyxDQUFDO0FBQ2pDLENBQUMsQ0FBQTtBQUVZLFFBQUEsTUFBTSxHQUFHLENBQUMsR0FBUSxFQUFDLEVBQUU7SUFDakMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUNYLENBQUMsQ0FBQTtBQUVZLFFBQUEsUUFBUSxHQUFHLENBQ3ZCLFNBQWlCLEVBQ1ksRUFBRTtJQUMvQixJQUFHLENBQUMsR0FBRztRQUNOLE9BQU8sdUJBQXVCLEVBQUUsQ0FBQztJQUNsQywyQkFBMkI7SUFDM0IsTUFBTSxRQUFRLEdBQUcsTUFBTSxHQUFHLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQztTQUM3QyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtRQUNaLE1BQU0sSUFBSSxRQUFRLENBQUMseUJBQXlCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxzQkFBc0I7SUFDekUsQ0FBQyxDQUFDLENBQUM7SUFDSCxNQUFNLElBQUksR0FBRyxRQUFpRCxDQUFDLENBQUMsc0JBQXNCO0lBQ3RGLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtRQUN0QixNQUFNLEdBQUcsR0FBRyxJQUF5QixDQUFDO1FBQ3RDLE1BQU0sSUFBSSxRQUFRLENBQUMsYUFBYSxHQUFHLENBQUMsU0FBUyxLQUFLLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO0tBQ3RFO0lBQ0QsT0FBTyxJQUF5QixDQUFDO0FBQ2xDLENBQUMsQ0FBQSxDQUFDO0FBRUYsMEJBQTBCO0FBQ2IsUUFBQSxlQUFlLEdBQUcsQ0FDOUIsT0FBZSxFQUNxQixFQUFFO0lBQ3RDLElBQUcsQ0FBQyxHQUFHO1FBQ04sT0FBTyx1QkFBdUIsRUFBRSxDQUFDO0lBQ2xDLE1BQU0sS0FBSyxHQUFHLENBQU8sS0FBYSxFQUFFLElBQVksRUFBOEIsRUFBRTtRQUMvRSwyQkFBMkI7UUFDM0IsTUFBTSxRQUFRLEdBQUcsTUFBTSxHQUFHLENBQUMsc0JBQXNCLENBQUMsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUM7YUFDdEUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7WUFDWixNQUFNLElBQUksUUFBUSxDQUFDLHlCQUF5QixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsc0JBQXNCO1FBQ3pFLENBQUMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSxJQUFJLEdBQUcsUUFBaUQsQ0FBQyxDQUFDLHNCQUFzQjtRQUNwRixJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDdEIsTUFBTSxHQUFHLEdBQUcsSUFBeUIsQ0FBQztZQUN0QyxNQUFNLElBQUksUUFBUSxDQUFDLGFBQWEsR0FBRyxDQUFDLFNBQVMsS0FBSyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztTQUN0RTtRQUNELElBQUksTUFBTSxHQUFzQixJQUFJLENBQUM7UUFDckMsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLElBQUksRUFBRTtZQUMzQixNQUFNLEVBQUUsR0FBRyxNQUFNLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxHQUFHLElBQUksQ0FBQyxDQUFDO1lBQzNDLE1BQU0sR0FBRyxDQUFDLEdBQUcsRUFBRSxFQUFFLEdBQUcsTUFBTSxDQUFDLENBQUM7U0FDNUI7UUFDRCxPQUFPLE1BQU0sQ0FBQztJQUNmLENBQUMsQ0FBQSxDQUFDO0lBQ0YsTUFBTSxJQUFJLEdBQUcsTUFBTSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLE9BQU8sRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUE4QixDQUFDO0FBQzNELENBQUMsQ0FBQSxDQUFDO0FBRVcsUUFBQSxRQUFRLEdBQUcsQ0FBTyxPQUFlLEVBQTZCLEVBQUU7SUFDNUUsSUFBRyxDQUFDLEdBQUc7UUFDTixPQUFPLHVCQUF1QixFQUFFLENBQUM7SUFDbEMsTUFBTSxjQUFjLEdBQUcsQ0FBTyxLQUFhLEVBQUUsSUFBWSxFQUFFLEVBQUU7UUFDNUQsMkJBQTJCO1FBQzNCLE1BQU0sUUFBUSxHQUFHLE1BQU0sR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQzthQUN4RCxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtZQUNaLE1BQU0sSUFBSSxRQUFRLENBQUMseUJBQXlCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxzQkFBc0I7UUFDekUsQ0FBQyxDQUFDLENBQUM7UUFDSCxNQUFNLElBQUksR0FBRyxRQUEwQyxDQUFDLENBQUMsc0JBQXNCO1FBQy9FLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtZQUN0QixNQUFNLEdBQUcsR0FBRyxJQUF5QixDQUFDO1lBQ3RDLE1BQU0sSUFBSSxRQUFRLENBQUMsYUFBYSxHQUFHLENBQUMsU0FBUyxLQUFLLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1NBQ3RFO1FBQ0QsSUFBSSxNQUFNLEdBQWUsSUFBSSxDQUFDO1FBQzlCLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxJQUFJLEVBQUU7WUFDM0IsTUFBTSxLQUFLLEdBQUcsTUFBTSxjQUFjLENBQUMsS0FBSyxFQUFFLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQztZQUN2RCxNQUFNLEdBQUcsQ0FBQyxHQUFHLEtBQUssRUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDO1NBQy9CO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDZixDQUFDLENBQUEsQ0FBQztJQUNGLE1BQU0sSUFBSSxHQUFHLE1BQU0sY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMzQyxPQUFPO1FBQ04sS0FBSyxFQUFFLElBQUk7S0FDUyxDQUFDO0FBQ3ZCLENBQUMsQ0FBQSxDQUFDO0FBRVcsUUFBQSxNQUFNLEdBQUcsQ0FBTyxjQUFzQixFQUErQixFQUFFO0lBQ25GLElBQUcsQ0FBQyxHQUFHO1FBQ04sT0FBTyx1QkFBdUIsRUFBRSxDQUFDO0lBQ2xDLDJCQUEyQjtJQUMzQixNQUFNLFFBQVEsR0FBRyxNQUFNLEdBQUcsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7UUFDN0QsTUFBTSxJQUFJLFFBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLHNCQUFzQjtJQUN6RSxDQUFDLENBQUMsQ0FBQztJQUNILE1BQU0sSUFBSSxHQUFHLFFBQW1ELENBQUMsQ0FBQyxzQkFBc0I7SUFDeEYsSUFBRyxJQUFJLENBQUMsT0FBTztRQUNkLE9BQU8sSUFBSSxDQUFDO0lBQ2IsSUFBRyxDQUFDLElBQUksQ0FBQyxZQUFZO1FBQ3BCLElBQUksQ0FBQyxZQUFZLEdBQUcseURBQXlELENBQUM7SUFFL0UsTUFBTSxJQUFJLFFBQVEsQ0FBQyxhQUFhLElBQUksQ0FBQyxTQUFTLEtBQUssSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7QUFDekUsQ0FBQyxDQUFBLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcGksIElSUEMgfSBmcm9tICdjdXN0b20tdHlwZXMnO1xubGV0IFJQQzpJUlBDO1xuXG5jbGFzcyBBcGlFcnJvciBleHRlbmRzIEVycm9yIHtcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcblx0Y29uc3RydWN0b3IoLi4uYXJnczogYW55W10pIHtcblx0XHRzdXBlciguLi5hcmdzKTtcblx0XHR0aGlzLm5hbWUgPSAnQXBpRXJyb3InO1xuXHRcdEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIEFwaUVycm9yKTtcblx0fVxufVxuXG5jb25zdCBtaXNzaW5nUlBDUHJvdmlkZXJFcnJvciA9ICgpPT57XG5cdHRocm93IG5ldyBBcGlFcnJvcihgUlBDIHByaXZpZGVyIGlzIG1pc3NpbmcuIFBsZWFzZSBzZXQgUlBDIHVzaW5nIFxuXHRcdHdhbGxldC5zZXRSUEMocnBjX3Byb3ZpZGVyKS5gKTtcbn1cblxuZXhwb3J0IGNvbnN0IHNldFJQQyA9IChycGM6SVJQQyk9Pntcblx0UlBDID0gcnBjO1xufVxuXG5leHBvcnQgY29uc3QgZ2V0QmxvY2sgPSBhc3luYyAoXG5cdGJsb2NrSGFzaDogc3RyaW5nXG4pOiBQcm9taXNlPEFwaS5CbG9ja1Jlc3BvbnNlPiA9PiB7XG5cdGlmKCFSUEMpXG5cdFx0cmV0dXJuIG1pc3NpbmdSUENQcm92aWRlckVycm9yKCk7XG5cdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZVxuXHRjb25zdCByZXNwb25zZSA9IGF3YWl0IFJQQy5nZXRCbG9jayhibG9ja0hhc2gpXG5cdC5jYXRjaCgoZSkgPT4ge1xuXHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGNvbm5lY3Rpb24gZXJyb3IuICR7ZX1gKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuXHR9KTtcblx0Y29uc3QganNvbiA9IHJlc3BvbnNlIGFzIEFwaS5FcnJvclJlc3BvbnNlICYgQXBpLkJsb2NrUmVzcG9uc2U7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0aWYgKGpzb24uZXJyb3JNZXNzYWdlKSB7XG5cdFx0Y29uc3QgZXJyID0ganNvbiBhcyBBcGkuRXJyb3JSZXNwb25zZTtcblx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBlcnJvciAke2Vyci5lcnJvckNvZGV9OiAke2Vyci5lcnJvck1lc3NhZ2V9YCk7XG5cdH1cblx0cmV0dXJuIGpzb24gYXMgQXBpLkJsb2NrUmVzcG9uc2U7XG59O1xuXG4vLyBUT0RPOiBoYW5kbGUgcGFnaW5hdGlvblxuZXhwb3J0IGNvbnN0IGdldFRyYW5zYWN0aW9ucyA9IGFzeW5jIChcblx0YWRkcmVzczogc3RyaW5nXG4pOiBQcm9taXNlPEFwaS5UcmFuc2FjdGlvbnNSZXNwb25zZT4gPT4ge1xuXHRpZighUlBDKVxuXHRcdHJldHVybiBtaXNzaW5nUlBDUHJvdmlkZXJFcnJvcigpO1xuXHRjb25zdCBnZXRUeCA9IGFzeW5jIChsaW1pdDogbnVtYmVyLCBza2lwOiBudW1iZXIpOiBQcm9taXNlPEFwaS5UcmFuc2FjdGlvbltdPiA9PiB7XG5cdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lXG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBSUEMuZ2V0QWRkcmVzc1RyYW5zYWN0aW9ucyhhZGRyZXNzLCBsaW1pdCwgc2tpcClcblx0XHQuY2F0Y2goKGUpID0+IHtcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGNvbm5lY3Rpb24gZXJyb3IuICR7ZX1gKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuXHRcdH0pO1xuXHRcdGxldCBqc29uID0gcmVzcG9uc2UgYXMgQXBpLkVycm9yUmVzcG9uc2UgJiBBcGkuVHJhbnNhY3Rpb25bXTsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuXHRcdGlmIChqc29uLmVycm9yTWVzc2FnZSkge1xuXHRcdFx0Y29uc3QgZXJyID0ganNvbiBhcyBBcGkuRXJyb3JSZXNwb25zZTtcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGVycm9yICR7ZXJyLmVycm9yQ29kZX06ICR7ZXJyLmVycm9yTWVzc2FnZX1gKTtcblx0XHR9XG5cdFx0bGV0IHJlc3VsdDogQXBpLlRyYW5zYWN0aW9uW10gPSBqc29uO1xuXHRcdGlmIChyZXN1bHQubGVuZ3RoID09PSAxMDAwKSB7XG5cdFx0XHRjb25zdCB0eCA9IGF3YWl0IGdldFR4KGxpbWl0LCBza2lwICsgMTAwMCk7XG5cdFx0XHRyZXN1bHQgPSBbLi4udHgsIC4uLnJlc3VsdF07XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH07XG5cdGNvbnN0IGpzb24gPSBhd2FpdCBnZXRUeCgxMDAwLCAwKTtcblx0cmV0dXJuIHsgdHJhbnNhY3Rpb25zOiBqc29uIH0gYXMgQXBpLlRyYW5zYWN0aW9uc1Jlc3BvbnNlO1xufTtcblxuZXhwb3J0IGNvbnN0IGdldFV0eG9zID0gYXN5bmMgKGFkZHJlc3M6IHN0cmluZyk6IFByb21pc2U8QXBpLlV0eG9SZXNwb25zZT4gPT4ge1xuXHRpZighUlBDKVxuXHRcdHJldHVybiBtaXNzaW5nUlBDUHJvdmlkZXJFcnJvcigpO1xuXHRjb25zdCBnZXRSZWN1cnNpdmVseSA9IGFzeW5jIChsaW1pdDogbnVtYmVyLCBza2lwOiBudW1iZXIpID0+IHtcblx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcblx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IFJQQy5nZXRVdHhvcyhhZGRyZXNzLCBsaW1pdCwgc2tpcClcblx0XHQuY2F0Y2goKGUpID0+IHtcblx0XHRcdHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGNvbm5lY3Rpb24gZXJyb3IuICR7ZX1gKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuXHRcdH0pO1xuXHRcdGNvbnN0IGpzb24gPSByZXNwb25zZSBhcyBBcGkuRXJyb3JSZXNwb25zZSAmIEFwaS5VdHhvW107IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0XHRpZiAoanNvbi5lcnJvck1lc3NhZ2UpIHtcblx0XHRcdGNvbnN0IGVyciA9IGpzb24gYXMgQXBpLkVycm9yUmVzcG9uc2U7XG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBlcnJvciAke2Vyci5lcnJvckNvZGV9OiAke2Vyci5lcnJvck1lc3NhZ2V9YCk7XG5cdFx0fVxuXHRcdGxldCByZXN1bHQ6IEFwaS5VdHhvW10gPSBqc29uO1xuXHRcdGlmIChyZXN1bHQubGVuZ3RoID09PSAxMDAwKSB7XG5cdFx0XHRjb25zdCB1dHhvcyA9IGF3YWl0IGdldFJlY3Vyc2l2ZWx5KGxpbWl0LCBza2lwICsgMTAwMCk7XG5cdFx0XHRyZXN1bHQgPSBbLi4udXR4b3MsIC4uLnJlc3VsdF07XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH07XG5cdGNvbnN0IGpzb24gPSBhd2FpdCBnZXRSZWN1cnNpdmVseSgxMDAwLCAwKTtcblx0cmV0dXJuIHtcblx0XHR1dHhvczoganNvbixcblx0fSBhcyBBcGkuVXR4b1Jlc3BvbnNlO1xufTtcblxuZXhwb3J0IGNvbnN0IHBvc3RUeCA9IGFzeW5jIChyYXdUcmFuc2FjdGlvbjogc3RyaW5nKTogUHJvbWlzZTxBcGkuU2VuZFR4UmVzcG9uc2U+ID0+IHtcblx0aWYoIVJQQylcblx0XHRyZXR1cm4gbWlzc2luZ1JQQ1Byb3ZpZGVyRXJyb3IoKTtcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lXG5cdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgUlBDLnBvc3RUeChyYXdUcmFuc2FjdGlvbikuY2F0Y2goKGUpID0+IHtcblx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBjb25uZWN0aW9uIGVycm9yLiAke2V9YCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0fSk7XG5cdGNvbnN0IGpzb24gPSByZXNwb25zZSBhcyBBcGkuRXJyb3JSZXNwb25zZSAmIEFwaS5TdWNjZXNzUmVzcG9uc2U7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0aWYoanNvbi5zdWNjZXNzKVxuXHRcdHJldHVybiB0cnVlO1xuXHRpZighanNvbi5lcnJvck1lc3NhZ2UpXG5cdFx0anNvbi5lcnJvck1lc3NhZ2UgPSAnQXBpIGVycm9yLiBQbGVhc2UgdHJ5IGFnYWluIGxhdGVyLiAoRVJST1I6IFBPU1QtVFg6MTAwKSc7XG5cblx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgZXJyb3IgJHtqc29uLmVycm9yQ29kZX06ICR7anNvbi5lcnJvck1lc3NhZ2V9YCk7XG59O1xuIl19