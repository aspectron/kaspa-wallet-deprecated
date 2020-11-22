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
		Wallet.setRPC(rpc_provider).`);
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
        //console.log("getUtxos:response", response)
        const json = response; // eslint-disable-line
        if (json.error) {
            const err = json.error;
            throw new ApiError(`API error ${err.errorCode}: ${err.message}`);
        }
        let result = json.utxosVerboseData;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpSGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3dhbGxldC9hcGlIZWxwZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUNBLElBQUksR0FBUSxDQUFDO0FBRWIsTUFBTSxRQUFTLFNBQVEsS0FBSztJQUMzQiw4REFBOEQ7SUFDOUQsWUFBWSxHQUFHLElBQVc7UUFDekIsS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7UUFDZixJQUFJLENBQUMsSUFBSSxHQUFHLFVBQVUsQ0FBQztRQUN2QixLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7Q0FDRDtBQUVELE1BQU0sdUJBQXVCLEdBQUcsR0FBRSxFQUFFO0lBQ25DLE1BQU0sSUFBSSxRQUFRLENBQUM7K0JBQ1csQ0FBQyxDQUFDO0FBQ2pDLENBQUMsQ0FBQTtBQUVZLFFBQUEsTUFBTSxHQUFHLENBQUMsR0FBUSxFQUFDLEVBQUU7SUFDakMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUNYLENBQUMsQ0FBQTtBQUVZLFFBQUEsUUFBUSxHQUFHLENBQ3ZCLFNBQWlCLEVBQ1ksRUFBRTtJQUMvQixJQUFHLENBQUMsR0FBRztRQUNOLE9BQU8sdUJBQXVCLEVBQUUsQ0FBQztJQUNsQywyQkFBMkI7SUFDM0IsTUFBTSxRQUFRLEdBQUcsTUFBTSxHQUFHLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQztTQUM3QyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtRQUNaLE1BQU0sSUFBSSxRQUFRLENBQUMseUJBQXlCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxzQkFBc0I7SUFDekUsQ0FBQyxDQUFDLENBQUM7SUFDSCxNQUFNLElBQUksR0FBRyxRQUFpRCxDQUFDLENBQUMsc0JBQXNCO0lBQ3RGLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtRQUN0QixNQUFNLEdBQUcsR0FBRyxJQUF5QixD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R0FBRyxLQUFLLEVBQUUsR0FBRyxNQUFNLENBQUMsQ0FBQztTQUMvQjtRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2YsQ0FBQyxDQUFBLENBQUM7SUFDRixNQUFNLElBQUksR0FBRyxNQUFNLGNBQWMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDM0MsT0FBTztRQUNOLEtBQUssRUFBRSxJQUFJO0tBQ1MsQ0FBQztBQUN2QixDQUFDLENBQUEsQ0FBQztBQUVXLFFBQUEsTUFBTSxHQUFHLENBQU8sY0FBc0IsRUFBK0IsRUFBRTtJQUNuRixJQUFHLENBQUMsR0FBRztRQUNOLE9BQU8sdUJBQXVCLEVBQUUsQ0FBQztJQUNsQywyQkFBMkI7SUFDM0IsTUFBTSxRQUFRLEdBQUcsTUFBTSxHQUFHLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO1FBQzdELE1BQU0sSUFBSSxRQUFRLENBQUMseUJBQXlCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxzQkFBc0I7SUFDekUsQ0FBQyxDQUFDLENBQUM7SUFDSCxNQUFNLElBQUksR0FBRyxRQUFtRCxDQUFDLENBQUMsc0JBQXNCO0lBQ3hGLElBQUcsSUFBSSxDQUFDLE9BQU87UUFDZCxPQUFPLElBQUksQ0FBQztJQUNiLElBQUcsQ0FBQyxJQUFJLENBQUMsWUFBWTtRQUNwQixJQUFJLENBQUMsWUFBWSxHQUFHLHlEQUF5RCxDQUFDO0lBRS9FLE1BQU0sSUFBSSxRQUFRLENBQUMsYUFBYSxJQUFJLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO0FBQ3pFLENBQUMsQ0FBQSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQXBpLCBJUlBDIH0gZnJvbSAnY3VzdG9tLXR5cGVzJztcbmxldCBSUEM6SVJQQztcblxuY2xhc3MgQXBpRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG5cdGNvbnN0cnVjdG9yKC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0c3VwZXIoLi4uYXJncyk7XG5cdFx0dGhpcy5uYW1lID0gJ0FwaUVycm9yJztcblx0XHRFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCBBcGlFcnJvcik7XG5cdH1cbn1cblxuY29uc3QgbWlzc2luZ1JQQ1Byb3ZpZGVyRXJyb3IgPSAoKT0+e1xuXHR0aHJvdyBuZXcgQXBpRXJyb3IoYFJQQyBwcml2aWRlciBpcyBtaXNzaW5nLiBQbGVhc2Ugc2V0IFJQQyB1c2luZyBcblx0XHRXYWxsZXQuc2V0UlBDKHJwY19wcm92aWRlcikuYCk7XG59XG5cbmV4cG9ydCBjb25zdCBzZXRSUEMgPSAocnBjOklSUEMpPT57XG5cdFJQQyA9IHJwYztcbn1cblxuZXhwb3J0IGNvbnN0IGdldEJsb2NrID0gYXN5bmMgKFxuXHRibG9ja0hhc2g6IHN0cmluZ1xuKTogUHJvbWlzZTxBcGkuQmxvY2tSZXNwb25zZT4gPT4ge1xuXHRpZighUlBDKVxuXHRcdHJldHVybiBtaXNzaW5nUlBDUHJvdmlkZXJFcnJvcigpO1xuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcblx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBSUEMuZ2V0QmxvY2soYmxvY2tIYXNoKVxuXHQuY2F0Y2goKGUpID0+IHtcblx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBjb25uZWN0aW9uIGVycm9yLiAke2V9YCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0fSk7XG5cdGNvbnN0IGpzb24gPSByZXNwb25zZSBhcyBBcGkuRXJyb3JSZXNwb25zZSAmIEFwaS5CbG9ja1Jlc3BvbnNlOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG5cdGlmIChqc29uLmVycm9yTWVzc2FnZSkge1xuXHRcdGNvbnN0IGVyciA9IGpzb24gYXMgQXBpLkVycm9yUmVzcG9uc2U7XG5cdFx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgZXJyb3IgJHtlcnIuZXJyb3JDb2RlfTogJHtlcnIuZXJyb3JNZXNzYWdlfWApO1xuXHR9XG5cdHJldHVybiBqc29uIGFzIEFwaS5CbG9ja1Jlc3BvbnNlO1xufTtcblxuLy8gVE9ETzogaGFuZGxlIHBhZ2luYXRpb25cbmV4cG9ydCBjb25zdCBnZXRUcmFuc2FjdGlvbnMgPSBhc3luYyAoXG5cdGFkZHJlc3M6IHN0cmluZ1xuKTogUHJvbWlzZTxBcGkuVHJhbnNhY3Rpb25zUmVzcG9uc2U+ID0+IHtcblx0aWYoIVJQQylcblx0XHRyZXR1cm4gbWlzc2luZ1JQQ1Byb3ZpZGVyRXJyb3IoKTtcblx0Y29uc3QgZ2V0VHggPSBhc3luYyAobGltaXQ6IG51bWJlciwgc2tpcDogbnVtYmVyKTogUHJvbWlzZTxBcGkuVHJhbnNhY3Rpb25bXT4gPT4ge1xuXHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZVxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgUlBDLmdldEFkZHJlc3NUcmFuc2FjdGlvbnMoYWRkcmVzcywgbGltaXQsIHNraXApXG5cdFx0LmNhdGNoKChlKSA9PiB7XG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBjb25uZWN0aW9uIGVycm9yLiAke2V9YCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0XHR9KTtcblx0XHRsZXQganNvbiA9IHJlc3BvbnNlIGFzIEFwaS5FcnJvclJlc3BvbnNlICYgQXBpLlRyYW5zYWN0aW9uW107IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0XHRpZiAoanNvbi5lcnJvck1lc3NhZ2UpIHtcblx0XHRcdGNvbnN0IGVyciA9IGpzb24gYXMgQXBpLkVycm9yUmVzcG9uc2U7XG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBlcnJvciAke2Vyci5lcnJvckNvZGV9OiAke2Vyci5lcnJvck1lc3NhZ2V9YCk7XG5cdFx0fVxuXHRcdGxldCByZXN1bHQ6IEFwaS5UcmFuc2FjdGlvbltdID0ganNvbjtcblx0XHRpZiAocmVzdWx0Lmxlbmd0aCA9PT0gMTAwMCkge1xuXHRcdFx0Y29uc3QgdHggPSBhd2FpdCBnZXRUeChsaW1pdCwgc2tpcCArIDEwMDApO1xuXHRcdFx0cmVzdWx0ID0gWy4uLnR4LCAuLi5yZXN1bHRdO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9O1xuXHRjb25zdCBqc29uID0gYXdhaXQgZ2V0VHgoMTAwMCwgMCk7XG5cdHJldHVybiB7IHRyYW5zYWN0aW9uczoganNvbiB9IGFzIEFwaS5UcmFuc2FjdGlvbnNSZXNwb25zZTtcbn07XG5cbmV4cG9ydCBjb25zdCBnZXRVdHhvcyA9IGFzeW5jIChhZGRyZXNzOiBzdHJpbmcpOiBQcm9taXNlPEFwaS5VdHhvUmVzcG9uc2U+ID0+IHtcblx0aWYoIVJQQylcblx0XHRyZXR1cm4gbWlzc2luZ1JQQ1Byb3ZpZGVyRXJyb3IoKTtcblx0Y29uc3QgZ2V0UmVjdXJzaXZlbHkgPSBhc3luYyAobGltaXQ6IG51bWJlciwgc2tpcDogbnVtYmVyKSA9PiB7XG5cdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lXG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBSUEMuZ2V0VXR4b3MoYWRkcmVzcywgbGltaXQsIHNraXApXG5cdFx0LmNhdGNoKChlKSA9PiB7XG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBjb25uZWN0aW9uIGVycm9yLiAke2V9YCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0XHR9KTtcblx0XHQvL2NvbnNvbGUubG9nKFwiZ2V0VXR4b3M6cmVzcG9uc2VcIiwgcmVzcG9uc2UpXG5cdFx0Y29uc3QganNvbiA9IHJlc3BvbnNlIGFzIEFwaS5FcnJvclJlc3BvbnNlICYgQXBpLlVUWE9zQnlBZGRyZXNzUmVzcG9uc2U7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0XHRpZiAoanNvbi5lcnJvcikge1xuXHRcdFx0Y29uc3QgZXJyID0ganNvbi5lcnJvciBhcyBBcGkuUlBDRXJyb3I7XG5cdFx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBlcnJvciAke2Vyci5lcnJvckNvZGV9OiAke2Vyci5tZXNzYWdlfWApO1xuXHRcdH1cblx0XHRsZXQgcmVzdWx0OiBBcGkuVXR4b1tdID0ganNvbi51dHhvc1ZlcmJvc2VEYXRhO1xuXHRcdGlmIChyZXN1bHQubGVuZ3RoID09PSAxMDAwKSB7XG5cdFx0XHRjb25zdCB1dHhvcyA9IGF3YWl0IGdldFJlY3Vyc2l2ZWx5KGxpbWl0LCBza2lwICsgMTAwMCk7XG5cdFx0XHRyZXN1bHQgPSBbLi4udXR4b3MsIC4uLnJlc3VsdF07XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH07XG5cdGNvbnN0IGpzb24gPSBhd2FpdCBnZXRSZWN1cnNpdmVseSgxMDAwLCAwKTtcblx0cmV0dXJuIHtcblx0XHR1dHhvczoganNvbixcblx0fSBhcyBBcGkuVXR4b1Jlc3BvbnNlO1xufTtcblxuZXhwb3J0IGNvbnN0IHBvc3RUeCA9IGFzeW5jIChyYXdUcmFuc2FjdGlvbjogc3RyaW5nKTogUHJvbWlzZTxBcGkuU2VuZFR4UmVzcG9uc2U+ID0+IHtcblx0aWYoIVJQQylcblx0XHRyZXR1cm4gbWlzc2luZ1JQQ1Byb3ZpZGVyRXJyb3IoKTtcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lXG5cdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgUlBDLnBvc3RUeChyYXdUcmFuc2FjdGlvbikuY2F0Y2goKGUpID0+IHtcblx0XHR0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBjb25uZWN0aW9uIGVycm9yLiAke2V9YCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0fSk7XG5cdGNvbnN0IGpzb24gPSByZXNwb25zZSBhcyBBcGkuRXJyb3JSZXNwb25zZSAmIEFwaS5TdWNjZXNzUmVzcG9uc2U7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcblx0aWYoanNvbi5zdWNjZXNzKVxuXHRcdHJldHVybiB0cnVlO1xuXHRpZighanNvbi5lcnJvck1lc3NhZ2UpXG5cdFx0anNvbi5lcnJvck1lc3NhZ2UgPSAnQXBpIGVycm9yLiBQbGVhc2UgdHJ5IGFnYWluIGxhdGVyLiAoRVJST1I6IFBPU1QtVFg6MTAwKSc7XG5cblx0dGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgZXJyb3IgJHtqc29uLmVycm9yQ29kZX06ICR7anNvbi5lcnJvck1lc3NhZ2V9YCk7XG59O1xuIl19