var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class ApiError extends Error {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args) {
        super(...args);
        this.name = 'ApiError';
        Error.captureStackTrace(this, ApiError);
    }
}
export const getBlock = (blockHash, apiEndpoint) => __awaiter(void 0, void 0, void 0, function* () {
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
export const getTransactions = (address, apiEndpoint) => __awaiter(void 0, void 0, void 0, function* () {
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
export const getUtxos = (address, apiEndpoint) => __awaiter(void 0, void 0, void 0, function* () {
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
export const postTx = (rawTransaction, apiEndpoint) => __awaiter(void 0, void 0, void 0, function* () {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpSGVscGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3dhbGxldC9hcGlIZWxwZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUVBLE1BQU0sUUFBUyxTQUFRLEtBQUs7SUFDMUIsOERBQThEO0lBQzlELFlBQVksR0FBRyxJQUFXO1FBQ3hCLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO1FBQ2YsSUFBSSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUM7UUFDdkIsS0FBSyxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztJQUMxQyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLENBQUMsTUFBTSxRQUFRLEdBQUcsQ0FDdEIsU0FBaUIsRUFDakIsV0FBbUIsRUFDUyxFQUFFO0lBQzlCLDJCQUEyQjtJQUMzQixNQUFNLFFBQVEsR0FBRyxNQUFNLEtBQUssQ0FBQyxHQUFHLFdBQVcsVUFBVSxTQUFTLEVBQUUsRUFBRTtRQUNoRSxJQUFJLEVBQUUsTUFBTTtLQUNiLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtRQUNiLE1BQU0sSUFBSSxRQUFRLENBQUMseUJBQXlCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxzQkFBc0I7SUFDMUUsQ0FBQyxDQUFDLENBQUM7SUFDSCxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxDQUEwQyxDQUFDLENBQUMsc0JBQXNCO0lBQ3JHLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtRQUNyQixNQUFNLEdBQUcsR0FBRyxJQUF5QixDQUFDO1FBQ3RDLE1BQU0sSUFBSSxRQUFRLENBQUMsYUFBYSxHQUFHLENBQUMsU0FBUyxLQUFLLEdBQUcsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO0tBQ3ZFO0lBQ0QsT0FBTyxJQUF5QixDQUFDO0FBQ25DLENBQUMsQ0FBQSxDQUFDO0FBRUYsMEJBQTBCO0FBQzFC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SUFBSSxHQUFHLE1BQU0sY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztJQUMzQyxPQUFPO1FBQ0wsS0FBSyxFQUFFLElBQUk7S0FDUSxDQUFDO0FBQ3hCLENBQUMsQ0FBQSxDQUFDO0FBRUYsTUFBTSxDQUFDLE1BQU0sTUFBTSxHQUFHLENBQ3BCLGNBQXNCLEVBQ3RCLFdBQW1CLEVBQ1UsRUFBRTtJQUMvQiwyQkFBMkI7SUFDM0IsTUFBTSxRQUFRLEdBQUcsTUFBTSxLQUFLLENBQUMsR0FBRyxXQUFXLGNBQWMsRUFBRTtRQUN6RCxNQUFNLEVBQUUsTUFBTTtRQUNkLElBQUksRUFBRSxNQUFNO1FBQ1osS0FBSyxFQUFFLFVBQVU7UUFDakIsT0FBTyxFQUFFLEVBQUU7UUFDWCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLGNBQWMsRUFBRSxDQUFDO0tBQ3pDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtRQUNiLE1BQU0sSUFBSSxRQUFRLENBQUMseUJBQXlCLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxzQkFBc0I7SUFDMUUsQ0FBQyxDQUFDLENBQUM7SUFDSCxJQUFJLFFBQVEsQ0FBQyxFQUFFLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxHQUFHO1FBQUUsT0FBTyxJQUFJLENBQUMsQ0FBQyxzQkFBc0I7SUFDdEcsTUFBTSxHQUFHLEdBQUcsQ0FBQyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBc0IsQ0FBQyxDQUFDLHNCQUFzQjtJQUNoRixNQUFNLElBQUksUUFBUSxDQUFDLGFBQWEsR0FBRyxDQUFDLFNBQVMsS0FBSyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztBQUN4RSxDQUFDLENBQUEsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwaSB9IGZyb20gJ2N1c3RvbS10eXBlcyc7XG5cbmNsYXNzIEFwaUVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICBjb25zdHJ1Y3RvciguLi5hcmdzOiBhbnlbXSkge1xuICAgIHN1cGVyKC4uLmFyZ3MpO1xuICAgIHRoaXMubmFtZSA9ICdBcGlFcnJvcic7XG4gICAgRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UodGhpcywgQXBpRXJyb3IpO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBnZXRCbG9jayA9IGFzeW5jIChcbiAgYmxvY2tIYXNoOiBzdHJpbmcsXG4gIGFwaUVuZHBvaW50OiBzdHJpbmdcbik6IFByb21pc2U8QXBpLkJsb2NrUmVzcG9uc2U+ID0+IHtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lXG4gIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYCR7YXBpRW5kcG9pbnR9L2Jsb2NrLyR7YmxvY2tIYXNofWAsIHtcbiAgICBtb2RlOiAnY29ycycsXG4gIH0pLmNhdGNoKChlKSA9PiB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgY29ubmVjdGlvbiBlcnJvci4gJHtlfWApOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gIH0pO1xuICBjb25zdCBqc29uID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkgYXMgQXBpLkVycm9yUmVzcG9uc2UgJiBBcGkuQmxvY2tSZXNwb25zZTsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICBpZiAoanNvbi5lcnJvck1lc3NhZ2UpIHtcbiAgICBjb25zdCBlcnIgPSBqc29uIGFzIEFwaS5FcnJvclJlc3BvbnNlO1xuICAgIHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGVycm9yICR7ZXJyLmVycm9yQ29kZX06ICR7ZXJyLmVycm9yTWVzc2FnZX1gKTtcbiAgfVxuICByZXR1cm4ganNvbiBhcyBBcGkuQmxvY2tSZXNwb25zZTtcbn07XG5cbi8vIFRPRE86IGhhbmRsZSBwYWdpbmF0aW9uXG5leHBvcnQgY29uc3QgZ2V0VHJhbnNhY3Rpb25zID0gYXN5bmMgKFxuICBhZGRyZXNzOiBzdHJpbmcsXG4gIGFwaUVuZHBvaW50OiBzdHJpbmdcbik6IFByb21pc2U8QXBpLlRyYW5zYWN0aW9uc1Jlc3BvbnNlPiA9PiB7XG4gIGNvbnN0IGdldFR4ID0gYXN5bmMgKG46IG51bWJlciwgc2tpcDogbnVtYmVyKTogUHJvbWlzZTxBcGkuVHJhbnNhY3Rpb25bXT4gPT4ge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZVxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXG4gICAgICBgJHthcGlFbmRwb2ludH0vdHJhbnNhY3Rpb25zL2FkZHJlc3MvJHthZGRyZXNzfT9saW1pdD0ke259JnNraXA9JHtza2lwfWAsXG4gICAgICB7XG4gICAgICAgIG1vZGU6ICdjb3JzJyxcbiAgICAgIH1cbiAgICApLmNhdGNoKChlKSA9PiB7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBjb25uZWN0aW9uIGVycm9yLiAke2V9YCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICB9KTtcbiAgICBsZXQganNvbiA9IChhd2FpdCByZXNwb25zZS5qc29uKCkpIGFzIEFwaS5FcnJvclJlc3BvbnNlICYgQXBpLlRyYW5zYWN0aW9uW107IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICBpZiAoanNvbi5lcnJvck1lc3NhZ2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IGpzb24gYXMgQXBpLkVycm9yUmVzcG9uc2U7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBlcnJvciAke2Vyci5lcnJvckNvZGV9OiAke2Vyci5lcnJvck1lc3NhZ2V9YCk7XG4gICAgfVxuICAgIGxldCByZXN1bHQ6IEFwaS5UcmFuc2FjdGlvbltdID0ganNvbjtcbiAgICBpZiAocmVzdWx0Lmxlbmd0aCA9PT0gMTAwMCkge1xuICAgICAgY29uc3QgdHggPSBhd2FpdCBnZXRUeChuLCBza2lwICsgMTAwMCk7XG4gICAgICByZXN1bHQgPSBbLi4udHgsIC4uLnJlc3VsdF07XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG4gIGNvbnN0IGpzb24gPSBhd2FpdCBnZXRUeCgxMDAwLCAwKTtcbiAgcmV0dXJuIHsgdHJhbnNhY3Rpb25zOiBqc29uIH0gYXMgQXBpLlRyYW5zYWN0aW9uc1Jlc3BvbnNlO1xufTtcblxuZXhwb3J0IGNvbnN0IGdldFV0eG9zID0gYXN5bmMgKGFkZHJlc3M6IHN0cmluZywgYXBpRW5kcG9pbnQ6IHN0cmluZyk6IFByb21pc2U8QXBpLlV0eG9SZXNwb25zZT4gPT4ge1xuICBjb25zdCBnZXRSZWN1cnNpdmVseSA9IGFzeW5jIChuOiBudW1iZXIsIHNraXA6IG51bWJlcikgPT4ge1xuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZVxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goXG4gICAgICBgJHthcGlFbmRwb2ludH0vdXR4b3MvYWRkcmVzcy8ke2FkZHJlc3N9P2xpbWl0PSR7bn0mc2tpcD0ke3NraXB9YCxcbiAgICAgIHtcbiAgICAgICAgbW9kZTogJ2NvcnMnLFxuICAgICAgfVxuICAgICkuY2F0Y2goKGUpID0+IHtcbiAgICAgIHRocm93IG5ldyBBcGlFcnJvcihgQVBJIGNvbm5lY3Rpb24gZXJyb3IuICR7ZX1gKTsgLy8gZXNsaW50LWRpc2FibGUtbGluZVxuICAgIH0pO1xuICAgIGNvbnN0IGpzb24gPSAoYXdhaXQgcmVzcG9uc2UuanNvbigpKSBhcyBBcGkuRXJyb3JSZXNwb25zZSAmIEFwaS5VdHhvW107IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgICBpZiAoanNvbi5lcnJvck1lc3NhZ2UpIHtcbiAgICAgIGNvbnN0IGVyciA9IGpzb24gYXMgQXBpLkVycm9yUmVzcG9uc2U7XG4gICAgICB0aHJvdyBuZXcgQXBpRXJyb3IoYEFQSSBlcnJvciAke2Vyci5lcnJvckNvZGV9OiAke2Vyci5lcnJvck1lc3NhZ2V9YCk7XG4gICAgfVxuICAgIGxldCByZXN1bHQ6IEFwaS5VdHhvW10gPSBqc29uO1xuICAgIGlmIChyZXN1bHQubGVuZ3RoID09PSAxMDAwKSB7XG4gICAgICBjb25zdCB1dHhvcyA9IGF3YWl0IGdldFJlY3Vyc2l2ZWx5KG4sIHNraXAgKyAxMDAwKTtcbiAgICAgIHJlc3VsdCA9IFsuLi51dHhvcywgLi4ucmVzdWx0XTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcbiAgY29uc3QganNvbiA9IGF3YWl0IGdldFJlY3Vyc2l2ZWx5KDEwMDAsIDApO1xuICByZXR1cm4ge1xuICAgIHV0eG9zOiBqc29uLFxuICB9IGFzIEFwaS5VdHhvUmVzcG9uc2U7XG59O1xuXG5leHBvcnQgY29uc3QgcG9zdFR4ID0gYXN5bmMgKFxuICByYXdUcmFuc2FjdGlvbjogc3RyaW5nLFxuICBhcGlFbmRwb2ludDogc3RyaW5nXG4pOiBQcm9taXNlPEFwaS5TZW5kVHhSZXNwb25zZT4gPT4ge1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmVcbiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgJHthcGlFbmRwb2ludH0vdHJhbnNhY3Rpb25gLCB7XG4gICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgbW9kZTogJ2NvcnMnLFxuICAgIGNhY2hlOiAnbm8tY2FjaGUnLFxuICAgIGhlYWRlcnM6IHt9LFxuICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgcmF3VHJhbnNhY3Rpb24gfSksXG4gIH0pLmNhdGNoKChlKSA9PiB7XG4gICAgdGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgY29ubmVjdGlvbiBlcnJvci4gJHtlfWApOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lXG4gIH0pO1xuICBpZiAocmVzcG9uc2Uub2sgJiYgcmVzcG9uc2UuaGVhZGVycy5nZXQoJ0NvbnRlbnQtTGVuZ3RoJykgPT09ICcwJykgcmV0dXJuIHRydWU7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgY29uc3QgZXJyID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkgYXMgQXBpLkVycm9yUmVzcG9uc2U7IC8vIGVzbGludC1kaXNhYmxlLWxpbmVcbiAgdGhyb3cgbmV3IEFwaUVycm9yKGBBUEkgZXJyb3IgJHtlcnIuZXJyb3JDb2RlfTogJHtlcnIuZXJyb3JNZXNzYWdlfWApO1xufTtcbiJdfQ==