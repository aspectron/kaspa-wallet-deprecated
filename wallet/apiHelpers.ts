import { Api } from 'custom-types';

class ApiError extends Error {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(...args: any[]) {
    super(...args);
    this.name = 'ApiError';
    Error.captureStackTrace(this, ApiError);
  }
}

export const getBlock = async (
  blockHash: string,
  apiEndpoint: string
): Promise<Api.BlockResponse> => {
  // eslint-disable-next-line
  const response = await fetch(`${apiEndpoint}/block/${blockHash}`, {
    mode: 'cors',
  }).catch((e) => {
    throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
  });
  const json = (await response.json()) as Api.ErrorResponse & Api.BlockResponse; // eslint-disable-line
  if (json.errorMessage) {
    const err = json as Api.ErrorResponse;
    throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
  }
  return json as Api.BlockResponse;
};

// TODO: handle pagination
export const getTransactions = async (
  address: string,
  apiEndpoint: string
): Promise<Api.TransactionsResponse> => {
  const getTx = async (n: number, skip: number): Promise<Api.Transaction[]> => {
    // eslint-disable-next-line
    const response = await fetch(
      `${apiEndpoint}/transactions/address/${address}?limit=${n}&skip=${skip}`,
      {
        mode: 'cors',
      }
    ).catch((e) => {
      throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
    });
    let json = (await response.json()) as Api.ErrorResponse & Api.Transaction[]; // eslint-disable-line
    if (json.errorMessage) {
      const err = json as Api.ErrorResponse;
      throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
    }
    let result: Api.Transaction[] = json;
    if (result.length === 1000) {
      const tx = await getTx(n, skip + 1000);
      result = [...tx, ...result];
    }
    return result;
  };
  const json = await getTx(1000, 0);
  return { transactions: json } as Api.TransactionsResponse;
};

export const getUtxos = async (address: string, apiEndpoint: string): Promise<Api.UtxoResponse> => {
  const getRecursively = async (n: number, skip: number) => {
    // eslint-disable-next-line
    const response = await fetch(
      `${apiEndpoint}/utxos/address/${address}?limit=${n}&skip=${skip}`,
      {
        mode: 'cors',
      }
    ).catch((e) => {
      throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
    });
    const json = (await response.json()) as Api.ErrorResponse & Api.Utxo[]; // eslint-disable-line
    if (json.errorMessage) {
      const err = json as Api.ErrorResponse;
      throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
    }
    let result: Api.Utxo[] = json;
    if (result.length === 1000) {
      const utxos = await getRecursively(n, skip + 1000);
      result = [...utxos, ...result];
    }
    return result;
  };
  const json = await getRecursively(1000, 0);
  return {
    utxos: json,
  } as Api.UtxoResponse;
};

export const postTx = async (
  rawTransaction: string,
  apiEndpoint: string
): Promise<Api.SendTxResponse> => {
  // eslint-disable-next-line
  const response = await fetch(`${apiEndpoint}/transaction`, {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    headers: {},
    body: JSON.stringify({ rawTransaction }),
  }).catch((e) => {
    throw new ApiError(`API connection error. ${e}`); // eslint-disable-line
  });
  if (response.ok && response.headers.get('Content-Length') === '0') return true; // eslint-disable-line
  const err = (await response.json()) as Api.ErrorResponse; // eslint-disable-line
  throw new ApiError(`API error ${err.errorCode}: ${err.errorMessage}`);
};
