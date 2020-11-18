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
exports.postTx = exports.getUtxos = exports.getTransactions = exports.getBlock = void 0;
class ApiError extends Error {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args) {
        super(...args);
        this.name = 'ApiError';
        Error.captureStackTrace(this, ApiError);
    }
}
exports.getBlock = (blockHash, apiEndpoint) => __awaiter(void 0, void 0, void 0, function* () {
    // eslint-disable-next-line
    const response = yield fetch(`${apiEndpoint}/block/${blockHash}`, {
        mode: 'cors',
    }).catch((e) => {
        throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
    });
    const json = (yield response.json()); // eslint-disable-line
    if (json.errorMessage) {
        const err = json;
        throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
    }
    return json;
});
// TODO: handle pagination
exports.getTransactions = (address, apiEndpoint) => __awaiter(void 0, void 0, void 0, function* () {
    const getTx = (n, skip) => __awaiter(void 0, void 0, void 0, function* () {
        // eslint-disable-next-line
        const response = yield fetch(`${apiEndpoint}/transactions/address/${address}?limit=${n}&skip=${skip}`, {
            mode: 'cors',
        }).catch((e) => {
            throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
        });
        let json = (yield response.json()); // eslint-disable-line
        if (json.errorMessage) {
            const err = json;
            throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
        }
        let result = json;
        if (result.length === 1000) {
            const tx = yield getTx(n, skip + 1000);
            result = [...tx, ...result];
        }
        return result;
    });
    const json = yield getTx(1000, 0);
    return { transactions: json };
});
exports.getUtxos = (address, apiEndpoint) => __awaiter(void 0, void 0, void 0, function* () {
    const getRecursively = (n, skip) => __awaiter(void 0, void 0, void 0, function* () {
        // eslint-disable-next-line
        const response = yield fetch(`${apiEndpoint}/utxos/address/${address}?limit=${n}&skip=${skip}`, {
            mode: 'cors',
        }).catch((e) => {
            throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
        });
        const json = (yield response.json()); // eslint-disable-line
        if (json.errorMessage) {
            const err = json;
            throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
        }
        let result = json;
        if (result.length === 1000) {
            const utxos = yield getRecursively(n, skip + 1000);
            result = [...utxos, ...result];
        }
        return result;
    });
    const json = yield getRecursively(1000, 0);
    return {
        utxos: json,
    };
});
exports.postTx = (rawTransaction, apiEndpoint) => __awaiter(void 0, void 0, void 0, function* () {
    // eslint-disable-next-line
    const response = yield fetch(`${apiEndpoint}/transaction`, {
        method: 'POST',
        mode: 'cors',
        cache: 'no-cache',
        headers: {},
        body: JSON.stringify({ rawTransaction }),
    }).catch((e) => {
        throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
    });
    if (response.ok && response.headers.get('Content-Length') === '0')
        return true; // eslint-disable-line
    const err = (yield response.json()); // eslint-disable-line
    throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpSGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3dhbGxldC9hcGlIZWxwZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUVBLE1BQU0sUUFBUyxTQUFRLEtBQUs7SUFDMUIsOERBQThEO0lBQzlELFlBQVksR0FBRyxJQUFXO1FBQ3hCLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUM7UUFDdkIsS0FBSyxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztJQUMxQyxDQUFDO0NBQ0Y7QUFFWSxRQUFBLFFBQVEsR0FBRyxDQUN0QixTQUFpQixFQUNqQixXQUFtQixFQUNTLEVBQUU7SUFDOUIsMkJBQTJCO0lBQzNCLE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsV0FBVyxVQUFVLFNBQVMsRUFBRSxFQUFFO1FBQ2hFLElBQUksRUFBRSxNQUFNO0tBQ2IsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO1FBQ2IsTUFBTSxJQUFJLFFBQVEsQ0FBQyx5QkFBeUIsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLHNCQUFzQjtJQUMxRSxDQUFDLENBQUMsQ0FBQztJQUNILE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQTBDLENBQUMsQ0FBQyxzQkFBc0I7SUFDckcsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFO1FBQ3JCLE1BQU0sR0FBRyxHQUFHLElBQXlCLENBQUM7UUFDdEMsTUFBTSxJQUFJLFFBQVEsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxTQUFTLEtBQUssR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7S0FDdkU7SUFDRCxPQUFPLElBQXlCLENBQUM7QUFDbkMsQ0FBQyxDQUFBLENBQUM7QUFFRiwwQkFBMEI7QUFDYixRQUFBLGVB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SSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzNDLE9BQU87UUFDTCxLQUFLLEVBQUUsSUFBSTtLQUNRLENBQUM7QUFDeEIsQ0FBQyxDQUFBLENBQUM7QUFFVyxRQUFBLE1BQU0sR0FBRyxDQUNwQixjQUFzQixFQUN0QixXQUFtQixFQUNVLEVBQUU7SUFDL0IsMkJBQTJCO0lBQzNCLE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsV0FBVyxjQUFjLEVBQUU7UUFDekQsTUFBTSxFQUFFLE1BQU07UUFDZCxJQUFJLEVBQUUsTUFBTTtRQUNaLEtBQUssRUFBRSxVQUFVO1FBQ2pCLE9BQU8sRUFBRSxFQUFFO1FBQ1gsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxjQUFjLEVBQUUsQ0FBQztLQUN6QyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7UUFDYixNQUFNLElBQUksUUFBUSxDQUFDLHlCQUF5QixDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsc0JBQXNCO0lBQzFFLENBQUMsQ0FBQyxDQUFDO0lBQ0gsSUFBSSxRQUFRLENBQUMsRUFBRSxJQUFJLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLEtBQUssR0FBRztRQUFFLE9BQU8sSUFBSSxDQUFDLENBQUMsc0JBQXNCO0lBQ3RHLE1BQU0sR0FBRyxHQUFHLENBQUMsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQXNCLENBQUMsQ0FBQyxzQkFBc0I7SUFDaEYsTUFBTSxJQUFJLFFBQVEsQ0FBQyxhQUFhLEdBQUcsQ0FBQyxTQUFTLEtBQUssR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7QUFDeEUsQ0FBQyxDQUFBLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcGkgfSBmcm9tICdjdXN0b20tdHlwZXMnO1xuXG5jbGFzcyBBcGlFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbiAgY29uc3RydWN0b3IoLi4uYXJnczogYW55W10pIHtcbiAgICBzdXBlciguLi5hcmdzKTtcbiAgICB0aGlzLm5hbWUgPSAnQXBpRXJyb3InO1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIEFwaUVycm9yKTtcbiAgfVxufVxuXG5leHBvcnQgY29uc3QgZ2V0QmxvY2sgPSBhc3luYyAoXG4gIGJsb2NrSGFzaDogc3RyaW5nLFxuICBhcGlFbmRwb2ludDogc3RyaW5nXG4pOiBQcm9taXNlPEFwaS5CbG9ja1Jlc3BvbnNlPiA9PiB7XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZVxuICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke2FwaUVuZHBvaW50fS9ibG9jay8ke2Jsb2NrSGFzaH1gLCB7XG4gICAgbW9kZTogJ2NvcnMnLFxuICB9KS5jYXRjaCgoZSkgPT4ge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGNvbm5lY3Rpb24gZXJyb3IuICR7ZX1gKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICB9KTtcbiAgY29uc3QganNvbiA9IChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzIEFwaS5FcnJvclJlc3BvbnNlICYgQXBpLkJsb2NrUmVzcG9uc2U7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgaWYgKGpzb24uZXJyb3JNZXNzYWdlKSB7XG4gICAgY29uc3QgZXJyID0ganNvbiBhcyBBcGkuRXJyb3JSZXNwb25zZTtcbiAgICB0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBlcnJvciAke2Vyci5lcnJvckNvZGV9OiAke2Vyci5lcnJvck1lc3NhZ2V9YCk7XG4gIH1cbiAgcmV0dXJuIGpzb24gYXMgQXBpLkJsb2NrUmVzcG9uc2U7XG59O1xuXG4vLyBUT0RPOiBoYW5kbGUgcGFnaW5hdGlvblxuZXhwb3J0IGNvbnN0IGdldFRyYW5zYWN0aW9ucyA9IGFzeW5jIChcbiAgYWRkcmVzczogc3RyaW5nLFxuICBhcGlFbmRwb2ludDogc3RyaW5nXG4pOiBQcm9taXNlPEFwaS5UcmFuc2FjdGlvbnNSZXNwb25zZT4gPT4ge1xuICBjb25zdCBnZXRUeCA9IGFzeW5jIChuOiBudW1iZXIsIHNraXA6IG51bWJlcik6IFByb21pc2U8QXBpLlRyYW5zYWN0aW9uW10+ID0+IHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKFxuICAgICAgYCR7YXBpRW5kcG9pbnR9L3RyYW5zYWN0aW9ucy9hZGRyZXNzLyR7YWRkcmVzc30/bGltaXQ9JHtufSZza2lwPSR7c2tpcH1gLFxuICAgICAge1xuICAgICAgICBtb2RlOiAnY29ycycsXG4gICAgICB9XG4gICAgKS5jYXRjaCgoZSkgPT4ge1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgY29ubmVjdGlvbiBlcnJvci4gJHtlfWApOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgfSk7XG4gICAgbGV0IGpzb24gPSAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhcyBBcGkuRXJyb3JSZXNwb25zZSAmIEFwaS5UcmFuc2FjdGlvbltdOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgaWYgKGpzb24uZXJyb3JNZXNzYWdlKSB7XG4gICAgICBjb25zdCBlcnIgPSBqc29uIGFzIEFwaS5FcnJvclJlc3BvbnNlO1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgZXJyb3IgJHtlcnIuZXJyb3JDb2RlfTogJHtlcnIuZXJyb3JNZXNzYWdlfWApO1xuICAgIH1cbiAgICBsZXQgcmVzdWx0OiBBcGkuVHJhbnNhY3Rpb25bXSA9IGpzb247XG4gICAgaWYgKHJlc3VsdC5sZW5ndGggPT09IDEwMDApIHtcbiAgICAgIGNvbnN0IHR4ID0gYXdhaXQgZ2V0VHgobiwgc2tpcCArIDEwMDApO1xuICAgICAgcmVzdWx0ID0gWy4uLnR4LCAuLi5yZXN1bHRdO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9O1xuICBjb25zdCBqc29uID0gYXdhaXQgZ2V0VHgoMTAwMCwgMCk7XG4gIHJldHVybiB7IHRyYW5zYWN0aW9uczoganNvbiB9IGFzIEFwaS5UcmFuc2FjdGlvbnNSZXNwb25zZTtcbn07XG5cbmV4cG9ydCBjb25zdCBnZXRVdHhvcyA9IGFzeW5jIChhZGRyZXNzOiBzdHJpbmcsIGFwaUVuZHBvaW50OiBzdHJpbmcpOiBQcm9taXNlPEFwaS5VdHhvUmVzcG9uc2U+ID0+IHtcbiAgY29uc3QgZ2V0UmVjdXJzaXZlbHkgPSBhc3luYyAobjogbnVtYmVyLCBza2lwOiBudW1iZXIpID0+IHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKFxuICAgICAgYCR7YXBpRW5kcG9pbnR9L3V0eG9zL2FkZHJlc3MvJHthZGRyZXNzfT9saW1pdD0ke259JnNraXA9JHtza2lwfWAsXG4gICAgICB7XG4gICAgICAgIG1vZGU6ICdjb3JzJyxcbiAgICAgIH1cbiAgICApLmNhdGNoKChlKSA9PiB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBjb25uZWN0aW9uIGVycm9yLiAke2V9YCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICB9KTtcbiAgICBjb25zdCBqc29uID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkgYXMgQXBpLkVycm9yUmVzcG9uc2UgJiBBcGkuVXR4b1tdOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gICAgaWYgKGpzb24uZXJyb3JNZXNzYWdlKSB7XG4gICAgICBjb25zdCBlcnIgPSBqc29uIGFzIEFwaS5FcnJvclJlc3BvbnNlO1xuICAgICAgdGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgZXJyb3IgJHtlcnIuZXJyb3JDb2RlfTogJHtlcnIuZXJyb3JNZXNzYWdlfWApO1xuICAgIH1cbiAgICBsZXQgcmVzdWx0OiBBcGkuVXR4b1tdID0ganNvbjtcbiAgICBpZiAocmVzdWx0Lmxlbmd0aCA9PT0gMTAwMCkge1xuICAgICAgY29uc3QgdXR4b3MgPSBhd2FpdCBnZXRSZWN1cnNpdmVseShuLCBza2lwICsgMTAwMCk7XG4gICAgICByZXN1bHQgPSBbLi4udXR4b3MsIC4uLnJlc3VsdF07XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG4gIGNvbnN0IGpzb24gPSBhd2FpdCBnZXRSZWN1cnNpdmVseSgxMDAwLCAwKTtcbiAgcmV0dXJuIHtcbiAgICB1dHhvczoganNvbixcbiAgfSBhcyBBcGkuVXR4b1Jlc3BvbnNlO1xufTtcblxuZXhwb3J0IGNvbnN0IHBvc3RUeCA9IGFzeW5jIChcbiAgcmF3VHJhbnNhY3Rpb246IHN0cmluZyxcbiAgYXBpRW5kcG9pbnQ6IHN0cmluZ1xuKTogUHJvbWlzZTxBcGkuU2VuZFR4UmVzcG9uc2U+ID0+IHtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7YXBpRW5kcG9pbnR9L3RyYW5zYWN0aW9uYCwge1xuICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgIG1vZGU6ICdjb3JzJyxcbiAgICBjYWNoZTogJ25vLWNhY2hlJyxcbiAgICBoZWFkZXJzOiB7fSxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IHJhd1RyYW5zYWN0aW9uIH0pLFxuICB9KS5jYXRjaCgoZSkgPT4ge1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGNvbm5lY3Rpb24gZXJyb3IuICR7ZX1gKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICB9KTtcbiAgaWYgKHJlc3BvbnNlLm9rICYmIHJlc3BvbnNlLmhlYWRlcnMuZ2V0KCdDb250ZW50LUxlbmd0aCcpID09PSAnMCcpIHJldHVybiB0cnVlOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gIGNvbnN0IGVyciA9IChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzIEFwaS5FcnJvclJlc3BvbnNlOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gIHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGVycm9yICR7ZXJyLmVycm9yQ29kZX06ICR7ZXJyLmVycm9yTWVzc2FnZX1gKTtcbn07XG4iXX0=