/* eslint-disable import/no-unresolved */

// import type { Config } from '@netlify/edge-functions';

import { CacheHeaders } from 'cdn-cache-control';
import { Hono, type Context } from 'hono';
import { cors as corsMiddleware } from 'hono/cors';
import { etag as etagMiddleware } from 'hono/etag';
import { secureHeaders } from 'hono/secure-headers';
import { trimTrailingSlash } from 'hono/trailing-slash';

type Bindings = {
  COMMIT_SHA: string;
};

export const app = new Hono<{ Bindings: Bindings }>();

export const BASE_API_URL = 'https://api.ethscriptions.com/v2';
export const CACHE_TTL = 3600;
export const DEFAULT_ENS_HANDLER = ensApiHandler;

export const ENDPOINTS = [
  '',
  'Checking existence of Ethscriptions',
  '',
  '/exists/:sha - 0x-prefixed or non-prefixed SHA-256 hex string',
  '/check/:sha - alias of above',
  '',
  'Estimating gas costs',
  '',
  'POST /estimate - estimate the cost of creating an Ethscription, pass `data` field in JSON body',
  'GET /estimate/:dataURI - could be a dataURI, or 0x-prefixed hex dataURI, or base64-ed dataURI',
  'GET /estimate/0x646174613a3b72756c653d65736970362c666f6f20626172 - estimate cost of "data:,rule=esip6,foo bar"',
  'GET /estimate/data:,wgw - for simple things',
  'GET /estimeate/ZGF0YTosaGVsbG8gd29ybGQ= - a base64 of "data:,hello world"',
  'GET /estimate/data:,foobie?type=fast&ethPrice=4000 - use "fast" instead of normal gas price, and custom ETH price',
  '',
  'A generation of SHA-256 and resolving of Ethscriptions',
  '',
  '/sha/:dataURI? - create SHA256 of a given data URI (or base64 encoded one), also resovles the Ethscription if it exists',
  '/sha?of=dataURI - optionally use the `of` query param to specify the data URI',
  '/sha?of=data:,wgw - generates the SHA256 of that data URI and also resovles the Ethscription',
  '/sha/data:,foobarbaz - not exists but generates SHA256 of that data URI',
  '/sha?of=ZGF0YTosNTg0OC5ldGhtYXA= - a base64 of "data:,5848.ethmap"',
  '',
  'Resolve names and ENS - if it is not (on-chain or off-chain) ENS it fallbacks to Ethscription Name',
  '',
  '/resolve/:name - find Ethereum address for any ENS (on-chain or off-chain name) or Ethscription Name',
  '/resolve/0xa20c07f94a127fd76e61fbea1019cce759225002 - resolves the ENS if such exists for this address',
  '/resolve/wgw - find the current owner of an Ethscription Name',
  '/resolve/wgw.lol - if it cannot resolve as off-chain ENS, tries to resolve the Ethscription name',
  '/resolve/foo.bar - resolves nothing, there is no such Ethscription name',
  '/resolve/foo.com - resolves nothing, there is no such off-chain ENS name, nor Ethscription name',
  '/resolve/59.eths - an Ethscription name',
  '/resolve/5848.ethmap - an Ethscription name',
  '/resolve/ckwf.cb.id - Coinbase off-chain ENS name',
  '/resolve/gregskril.com - an off-chain ENS name',
  '/resolve/mfers.base.eth - an on-chain ENS name',
  '/resolve/tunnckocore.eth - on-chain ENS name',
  '/resolve/wgw?creator=true - find the creator of this Ethscription Name (hirsh)',
  '/resolve/wgw - defaults to resolving current owner',
  '/resolve/dubie.eth',
  '/resolve/jesse.base.eth',
  '',
  'User profiles and details about them like created & owned ethscriptions, and Ethscription profile state',
  '',
  '/profiles/:name/created - Ethscriptions created by this address, Ethscription Name or ENS name',
  '/profiles/:name/owned - Currently owned by this user',
  "/profiles/:name/info - User's ethscription's profile, banner, bio, avatar, changes history, etc",
  "/profiles/:name/latest - the latest state of the Ethscription's user profile",
  '',
  '/ethscriptions - feed of all ethscriptions, including blobscriptions, supports filters',
  '/ethscriptions?filter=params - all filters from the official API are supported, also can use ENS or Eths Names',
  '',
  'Can use comma-separated fields to include specific fields from the upstream API, like `content_uri`',
  '/ethscriptions?with=current_owner,content_uri - `current_owner` is not existent in regular response, so it comes from upstream',
  '/ethscriptions?only=transaction_hash,creator,content_uri - results in response to include only these fields',
  '',
  'Filters examples, for user created and owned, better use the /profiles/:name endpoints',
  '',
  '/ethscriptions?creator=0xAddress - filter by creator address',
  "/ethscriptions?creator=wgw - since there is no `resolve` param, it won't find wgw's ethscriptions",
  '/ethscriptions?creator=wgw&resolve=1 - filter by creator, using current owner of this Ethscription Name',
  '/ethscriptions?creator=ckwf.cb.id&resolve=1 - filter by creator using Coinbase Off-chain ENS',
  '/ethscriptions?creator=dubie.eth&resolve=1 - filter by creator using On-Chain ENS',
  '/ethscriptions?initial_owner=wgw.lol&resolve=1 - filter by initial owner, using current owner of an Ethscription name',
  '/ethscriptions?initial_owner=5848.tree&resolve=1 - filter by initial owner, using current owner of this Ethscription Name',
  '/ethscriptions?creator=123.ethmap&resolve=1 - filter by creator, current holder/owner of this Ethscription',
  '/ethscriptions?current_owner=barry.wgw.lol&resolve=1 - filter by current owner of this off-chain ENS name',
  '/ethscriptions?owner=e5b5&resolve=1 - filter by current owner',
  '',
  'Blobscriptions',
  '',
  '/ethscriptions?attachment_present=true - filter only Blobscriptions',
  '/ethscriptions?attachment_present=true&reverse=true - from first Blobscription to latest',
  '',
  'Get ethscription metadata by ":id", eg. transaction hash or ethscription number',
  '',
  '/ethscriptions/:id - where `:id` can be ethscription number or transaction hash',
  '/ethscriptions/:id/transfers',
  '',
  '/ethscriptions/:id/content',
  '/ethscriptions/:id/data - alias of above',
  '',
  '/ethscriptions/:id/metadata - alias of /ethscriptions/:id',
  '/ethscriptions/:id/meta - alias of above',
  '/ethscriptions/:id/meta?with=content_uri - include the content_uri in the response',
  '',
  '/ethscriptions/:id/attachment',
  '/ethscriptions/:id/blob - alias of above',
  '',
  '/ethscriptions/:id/number',
  '/ethscriptions/:id/numbers - alias of above',
  '/ethscriptions/:id/index - alias of above',
  '/ethscriptions/:id/stats - alias of above',
  '',
  '/ethscriptions/:id/owner',
  '/ethscriptions/:id/owners - alias of above',
  '/ethscriptions/:id/creator - alias of above',
  '/ethscriptions/:id/receiver - alias of above',
  '/ethscriptions/:id/initial_owner - alias of above',
  '/ethscriptions/:id/previous_owner - alias of above',
  '/ethscriptions/:id/current_owner - alias of above',
  '',
  '',
];

app.use(trimTrailingSlash());
app.use(etagMiddleware({ weak: true }));
app.use(corsMiddleware({ origin: '*' }));
app.use(secureHeaders());

app.get('/', async (ctx) => {
  const commitsha = ctx.env.COMMIT_SHA;

  // console.log('process.env', process.env.CLOUDFLARE_ACCOUNT_ID);
  return ctx.json({
    about: { source: 'https://github.com/tunnckocore/ethscriptions-api-cache', commit: commitsha },
    endpoints: ENDPOINTS,
  });
});

export async function getPrices(type = 'normal') {
  try {
    const resp = await fetch(`https://www.ethgastracker.com/api/gas/latest`);

    if (!resp.ok) {
      return {
        error: {
          message: `Failed to fetch gas prices: ${resp.statusText}`,
          httpStatus: resp.status || 500,
        },
      };
    }

    const { data }: any = await resp.json();
    return {
      result: {
        baseFee: data.baseFee,
        nextFee: data.nextFee,
        ethPrice: data.ethPrice,
        gasPrice: data.oracle[type].gwei,
        gasFee: data.oracle[type].gasFee,
        priorityFee: data.oracle[type].priorityFee,
      },
    };
  } catch (err: any) {
    return {
      error: { message: `Failed to fetch prices from API: ${err.toString()}`, httpStatus: 500 },
    };
  }
}

// the `:data` can be 0x-prefixed hex, base64-ed, or plain dataURI
app.get('/estimate/:data', async (c) => {
  const data = c.req.param('data');
  const url = new URL(c.req.url);

  const query = Object.fromEntries(
    [...url.searchParams.entries()].map(([key, value]) => {
      const val = Number(value);

      return [key, Number.isNaN(val) ? value : val || 0];
    }),
  );
  console.log({ query });
  return estimateHandler(c, data, query);
});

app.post('/estimate', async (c: Context) => {
  const { data, ...settings } = await c.req.json();

  return estimateHandler(c, data, settings);
});

async function estimateHandler(ctx: Context, data: string, settings) {
  const { error, result: res } = await estimateDataCost(data, settings);

  if (error) {
    return ctx.json({ error }, { status: error.httpStatus });
  }

  return ctx.json({ result: res });
}

export async function estimateDataCost(data: string, settings?: any) {
  const options = { type: 'normal', ...settings };
  const { error: err, result: prices } = await getPrices(options.type);

  if (err) {
    return { error: err };
  }

  const opts = {
    baseFee: prices.nextFee,
    useGasFee: 0,
    bufferFee: 0,
    ethPrice: prices.ethPrice,
    ...options,
  };
  const { error, result } = estimateDataCostInWei(
    data,
    opts.baseFee,
    opts.useGasFee ? prices.gasFee : prices.priorityFee,
    opts.bufferFee,
  );

  if (error) {
    return { error };
  }

  const eth = result.wei / 1e18;
  const usd = eth * opts.ethPrice;

  return {
    result: {
      prices,
      cost: { wei: result.wei, eth, usd },
      meta: result.meta,
    },
  };
}

// eslint-disable-next-line max-params
export function estimateDataCostInWei(
  data: string | `0x${string}` | Uint8Array,
  baseFee,
  priorityFee,
  bufferFee = 0,
) {
  if (!data) {
    return { error: { message: 'Invalid data, must be a string or Uint8Array', httpStatus: 400 } };
  }

  try {
    const isStrData = typeof data === 'string';
    const dataStr = isStrData ? data : '';

    if (isStrData && dataStr.length === 0) {
      throw new Error('Invalid data, must be a string non empty string');
    }

    const isRawData = dataStr.startsWith('data:');
    const isHexData = dataStr.startsWith('0x646174613a');

    const input = isStrData
      ? isRawData
        ? new TextEncoder().encode(dataStr)
        : isHexData
          ? Uint8Array.from(
              dataStr
                .slice(2)
                .match(/.{1,2}/g)
                ?.map((e) => Number.parseInt(e, 16)) || [],
            )
          : new TextEncoder().encode(atob(dataStr))
      : data;

    // const gasWei = oracle.normal.gwei * 1e9;
    const dataWei = input.reduce((acc, byte) => acc + (byte === 0 ? 4 : 16), 0);
    const transferWei = 21_000;
    const bufferWei = bufferFee; // without this extra buffer, it's  not even close, around $0.50+ off
    const usedWei = dataWei + transferWei + bufferWei;
    const costWei = usedWei * (baseFee + priorityFee);

    return { result: { wei: costWei, meta: { gasUsed: usedWei, inputLength: input.length } } };
  } catch (err: any) {
    return { error: { message: `Failure in estimate: ${err.toString()}`, httpStatus: 500 } };
  }
}

app.get('/check/:sha', (ctx) => checkExistHandler(ctx));
app.get('/exists/:sha', (ctx) => checkExistHandler(ctx));

export async function checkExistHandler(ctx: Context, _sha?: string) {
  const sha = _sha || ctx.req.param('sha').replace('0x', '');

  if (!sha || sha.length !== 64 || !/^[\dA-Fa-f]{64,}$/.test(sha)) {
    return ctx.json(
      {
        error: {
          message: 'Invalid SHA-256 hash, must be 64 hex characters long, or 66 if 0x-prefixed',
          httpStatus: 400,
        },
      },
      { status: 400 },
    );
  }

  const resp = (await fetch(`${BASE_API_URL}/ethscriptions/exists/0x${sha}`).then((x) =>
    x.json(),
  )) as any;

  if (resp.result.exists) {
    const eth = resp.result.ethscription;
    return ctx.json(
      { result: { exists: true, ethscription: normalizeResult(eth, ctx.req.url) } },
      { headers: getHeaders(CACHE_TTL) },
    );
  }

  return ctx.json({ result: { exists: false } });
}

// generate SHA-256 of a given base64-ed (or not, eg. raw "data:,wgw") data URI string.
// If the data exists it also resolves the ethscription metadata for that SHA.
// /sha?of=<base64_or_raw>
// /sha/<base64_or_raw>
// /sha/data:,wgw.lol
// /sha?of=ZGF0YTosNTg0OC5ldGhtYXA= => (data:,5848.ethmap) exists
// /sha/ZGF0YTosZm9vYmFyYmF6 => (data:,foobarbaz) not exists
export async function getSha256ForData(ctx: Context) {
  let dataB64 = ctx.req.param('data');
  let data;

  // if not in params, check query param `of=<base64_or_raw>`
  if (!dataB64) {
    dataB64 = ctx.req.query('of') || '';
  }

  // if neither in params nor query, return error
  if (!dataB64) {
    return ctx.json(
      {
        error: {
          message: 'No data provided to create SHA',
          httpStatus: 400,
        },
      },
      { status: 400 },
    );
  }

  // try to decode input as base64
  try {
    data = atob(dataB64);
  } catch {
    // if it fails, it's not base64
  }

  // if not base64, consider it as raw data
  if (!data) {
    data = dataB64;
  }

  const sha = await createDigest(data);

  const checkResp = await checkExistHandler(ctx, sha);
  const { result } = (await checkResp.json()) as any;

  return ctx.json({ result: { sha, ...result } }, { headers: getHeaders(CACHE_TTL) });
}

app.get('/sha/:data?', getSha256ForData);

app.get('/profiles/:name/created', profileHandler);
app.get('/profiles/:name/own', profileHandler);
app.get('/profiles/:name/owned', profileHandler);
app.get('/profiles/:name/info', profileHandler);
app.get('/profiles/:name/latest', profileHandler);

async function profileHandler(ctx: Context) {
  const url = new URL(ctx.req.url);
  const name = ctx.req.param('name');
  const endpoint = url.pathname.split('/').pop() || '';

  console.log({ name, endpoint });

  url.searchParams.set('resolve', 'true');

  if (endpoint === 'created') {
    url.searchParams.set('creator', name);
  } else if (endpoint === 'own' || endpoint === 'owned') {
    url.searchParams.set('current_owner', name);
  } else if (/info|latest/.test(endpoint)) {
    url.searchParams.set('creator', name);
    url.searchParams.set('with_content_uri', 'true');
    // mime_subtype=vnd.esc.user.profile%2Bjson&creator=0xA20C07F94A127fD76E61fbeA1019cCe759225002
    url.searchParams.set('mime_subtype', 'vnd.esc.user.profile+json');
  }

  console.log({ url });

  const config = (await initialNormalize(ctx, url)) as any;
  const { error, result, pagination } = config;

  if (error) {
    return ctx.json({ error }, { status: error.httpStatus });
  }

  const data = result.map((x) => normalizeResult(x, url));

  if (endpoint === 'info') {
    return ctx.json(
      { result: { latest: data[0], history: data.slice(1) }, pagination },
      { headers: getHeaders(300) },
    );
  }

  if (endpoint === 'latest') {
    return ctx.json({ result: data[0] }, { headers: getHeaders(30) });
  }

  const response = ctx.json({ result: data, pagination }, { headers: getHeaders(30) });

  return response;
}

app.get('/resolve/:name', resolveHandler);
app.get('/profiles/:name', resolveHandler);

async function resolveHandler(ctx: Context) {
  // const url = new URL(ctx.req.url);
  const checkCreator = ctx.req.query('creator') || '';
  const name = ctx.req.param('name').toLowerCase();

  // const publicClient = createPublicClient({
  //   chain: mainnet,
  //   transport: http(),
  // });

  const resolveName = isAddress(name);

  const value = (await nameResolver(name, null, { resolveName, checkCreator }))?.toLowerCase();
  const error = !value || (value && value === name);

  if (error) {
    return ctx.json({ error: { message: `Cannot resolve ${name} address` } }, { status: 404 });
  }

  const result = resolveName ? { name: value, address: name } : { name, address: value };
  return ctx.json({ result }, { headers: getHeaders(3600) });
}

export async function listAllEthscriptionsHandler(ctx: Context) {
  const config = (await initialNormalize(ctx)) as any;
  const { error, result, pagination } = config;

  if (error) {
    return ctx.json({ error }, { status: error.httpStatus });
  }

  const data = result.map((x) => normalizeResult(x, ctx.req.url));

  console.log('[all] fresh miss');
  const response = ctx.json({ result: data, pagination }, { headers: getHeaders(15) });

  return response;
}

app.get('/ethscriptions', listAllEthscriptionsHandler);

async function ethscriptionByIdHandler(ctx: Context) {
  const config = (await initialNormalize(ctx)) as any;
  const { error, result } = config;

  if (error) {
    return ctx.json({ error }, { status: error.httpStatus });
  }

  console.log('[id] fresh miss');
  const data = normalizeResult(result, ctx.req.url);

  const response = ctx.json({ result: data }, { headers: getHeaders(CACHE_TTL) });

  return response;
}

app.get('/ethscriptions/:id', ethscriptionByIdHandler);

async function ethscriptionSubHandler(ctx: Context) {
  const type = ctx.req.param('type');
  const { error, result, url } = (await initialNormalize(ctx)) as any;

  if (error) {
    return ctx.json({ error }, { status: error.httpStatus });
  }

  const data = normalizeResult(result, ctx.req.url);

  let response;
  if (type && /meta/.test(type)) {
    response = ctx.json({ result: data }, { headers: getHeaders(CACHE_TTL) });
  } else if (type && /content|data/.test(type)) {
    const contentBuffer = await fetch(result.content_uri).then((res) => res.arrayBuffer());
    response = ctx.body(contentBuffer, {
      headers: getHeaders(CACHE_TTL, { 'content-type': result.content_type }),
    });
  } else if (type && /owner|creator|receiver|previous|initial/.test(type)) {
    const transfers = normalizeAndSortTransfers(result);
    response = ctx.json(
      {
        result: {
          latest_transfer_timestamp: transfers[0].block_timestamp,
          latest_transfer_datetime: new Date(Number(result.block_timestamp) * 1000).toISOString(),
          latest_transfer_block: transfers[0].block_number,
          creator: result.creator,
          initial: result.initial_owner,
          current: result.current_owner,
          previous: result.previous_owner,
        },
      },
      // transfers can occure only after 5 blocks (60 seconds, so 45s is fine)
      { headers: getHeaders(45) },
    );
  } else if (type && /number|index|stat|info/.test(type)) {
    response = ctx.json(
      {
        result: {
          block_timestamp: result.block_timestamp,
          block_datetime: new Date(Number(result.block_timestamp) * 1000).toISOString(),
          block_blockhash: result.block_blockhash,
          block_number: result.block_number,
          block_number_fmt: numfmt(result.block_number),
          transaction_index: result.transaction_index,
          event_log_index: result.event_log_index,
          ethscription_number: result.ethscription_number,
          ethscription_number_fmt: numfmt(result.ethscription_number),
          ethscription_transfers: String(
            normalizeAndSortTransfers(result).filter((x) => x.is_esip0 === false).length,
          ),
        },
      },
      { headers: getHeaders(CACHE_TTL) },
    );
  } else if (type && /transfer/.test(type)) {
    response = ctx.json(
      {
        result: { transfers: normalizeAndSortTransfers(result) },
      },
      { headers: getHeaders(30) },
    );
  } else if (type && /\/(attachment|blob)/.test(url.pathname)) {
    console.log({ blobs: result });
    if (!result.attachment_sha) {
      return ctx.json(
        {
          error: {
            message:
              'No attachment for this ethscription, it is not an ESIP-8 compatible Blobscription',
            httpStatus: 404,
          },
        },
        { status: 404 },
      );
    }

    const contentBuffer = await fetch(
      `${BASE_API_URL}/ethscriptions/${result.transaction_hash}/attachment`,
    ).then((res) => res.arrayBuffer());

    response = ctx.body(contentBuffer, {
      headers: getHeaders(CACHE_TTL, { 'content-type': result.attachment_content_type }),
    });
  } else {
    return ctx.json({ error: { message: 'Invalid request', httpStatus: 400 } }, { status: 400 });
  }

  console.log('[sub] fresh miss');

  return response;
}
app.get('/ethscriptions/:id/:type', ethscriptionSubHandler);

export function normalizeAndSortTransfers(result) {
  return (
    result.ethscription_transfers
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ ethscription_transaction_hash, ...x }, idx) => ({
        ...x,
        is_esip0: idx === 0,
        // theoretically, it could be ESIP-1 Transfer too, but ESIP-2 is more used and more likely
        is_esip1: Boolean(x.event_log_index !== null),
        is_esip2: Boolean(x.event_log_index !== null),
      }))
      // sort by block number, newest fist
      .sort((a, b) => b.block_number - a.block_number)
  );
}

export async function initialNormalize(ctx, alternativeUrl?: URL) {
  const url = alternativeUrl || new URL(ctx.req.url);
  const id = ctx.req.param('id');
  const withContentUri = Boolean(url.searchParams.get('with_content_uri'));
  const ifNoneMatch = ctx.req.header('If-None-Match') ?? null;
  //  with=current_owner&only=transaction_hash,current_owner&max_results=1000

  await searchParamPatches(url);

  if (url.searchParams.get('resolve')) {
    await resolveAddressPatches(url);
    url.searchParams.delete('resolve');
  }

  const resp = await fetch(`${BASE_API_URL}/ethscriptions${id ? `/${id}` : ''}${url.search}`);

  if (!resp.ok) {
    return {
      error: {
        message: 'Transaction not found or it is not an Ethscription.',
        httpStatus: resp.status,
      },
    };
  }

  const { result, pagination } = (await resp.json()) as any;

  // enough is enough
  result.content_type = result.mimetype;

  return { result, pagination, ifNoneMatch, withContentUri, url, id };
}

export async function ensBasicOnchainHandler(
  val: string,
  options: {
    checkCreator: string | undefined;
    publicClient: any;
    normalizeEns: any;
  },
) {
  const opts = { ...options };

  // never throws, returns the passed value if ENS name not found
  return opts.publicClient.getEnsAddress({
    name: opts.normalizeEns(val),
  });
}

async function ensApiHandler(val: string | `0x${string}`, options = {}) {
  // if `val` is address, resolve to ens name
  const opts = { resolveName: val && val.startsWith('0x') && val.length === 42, ...options };
  const resp = await fetch(`https://api.ensdata.net/${val}`);

  if (!resp.ok) {
    return null;
  }

  const data = (await resp.json()) as any;

  return opts.resolveName ? data.ens : data.address;
}

export async function nameResolver(
  value: string,
  ensHandler?: any,
  options?: {
    resolveName?: boolean;
    checkCreator?: string | undefined;
    publicClient?: any;
  },
) {
  const opts = { ...options };
  const val = value.toLowerCase();
  const handler = ensHandler || DEFAULT_ENS_HANDLER;

  // if (handler.name === 'onchainEnsHandler' && /\.(com|lol|xyz|bg|info|net|id|org|eth$)/.test(val)) {
  //   try {
  //     const address = await handler(val, opts);

  //     if (address) {
  //       return address;
  //     }
  //   } catch {
  //     console.log('ENS resolution failed, continuing...');
  //   }
  // }
  //
  const result = await handler(val, opts);

  // if the name is found in the ENS registry, return it
  if (result) {
    return result;
  }

  // if it's an address, there's no sense trying resolving it as ethscription name
  if (isAddress(val)) {
    return null;
  }

  const nameUri = `data:,${val}`;
  const nameSha = await createDigest(nameUri);
  const resp = (await fetch(`${BASE_API_URL}/ethscriptions/exists/0x${nameSha}`).then((x) =>
    x.json(),
  )) as any;
  console.log({ val, nameUri, nameSha, resp });

  if (resp.result.exists) {
    const eth = resp.result.ethscription;
    return (opts.checkCreator ? eth.creator : eth.current_owner).toLowerCase();
  }

  return val;
}

export function isAddress(val: string) {
  return Boolean(val && val.startsWith('0x') && val.length === 42);
}

export async function resolveAddressPatches(url) {
  const addressParams = [...url.searchParams.entries()].filter(
    ([key, value]) => /creator|receiver|owner/.test(key) && value.length > 0 && !isAddress(value),
  );

  // const publicClient = createPublicClient({
  //   chain: mainnet,
  //   transport: http(),
  // });

  const params = await Promise.all(
    addressParams.map(async ([key, value]) => {
      // if it cannit resolve neither ENS, nor Ethscriptions Name, it passthrough the `value`
      const val = await nameResolver(value, null, { resolveName: false } /* { publicClient } */);

      return [key, val || value];
    }),
  );

  for (const [key, val] of params) {
    url.searchParams.set(key, val);
  }

  return url;
}

export function searchParamPatches(url) {
  // consistency, we name mime_subtype as media_subtype, to be consistent with media_type
  if (url.searchParams.get('media_subtype')) {
    url.searchParams.set('mime_subtype', url.searchParams.get('media_subtype') || '');
    url.searchParams.delete('media_subtype');
  }

  // patch `receiver` with `initial_owner` for consistency with other fields
  if (url.searchParams.get('receiver')) {
    url.searchParams.set('initial_owner', url.searchParams.get('receiver') || '');
    url.searchParams.delete('receiver');
  }

  // patch `initial` with `initial_owner` for consistency with other fields
  if (url.searchParams.get('initial')) {
    url.searchParams.set('initial_owner', url.searchParams.get('initial') || '');
    url.searchParams.delete('initial');
  }

  // patch `current` with `current_owner` for consistency with other fields
  if (url.searchParams.get('current')) {
    url.searchParams.set('current_owner', url.searchParams.get('current') || '');
    url.searchParams.delete('current');
  }
  if (url.searchParams.get('owner')) {
    url.searchParams.set('current_owner', url.searchParams.get('owner') || '');
    url.searchParams.delete('owner');
  }

  // content_type is equal to `<media_type>/<media_subtype>`, it's called "mimetype" in upstream
  if (url.searchParams.get('content_type')) {
    url.searchParams.set('mimetype', url.searchParams.get('content_type') || '');
    url.searchParams.delete('content_type');
  }

  // support `is_esip6` instead of just `esip6` for consistency with fields and other ESIPs fiekds
  // Note: no such `esip6` filter on upstream, i thought there is. But lets keep it for now
  if (url.searchParams.get('is_esip6')) {
    url.searchParams.set('esip6', url.searchParams.get('is_esip6'));
    url.searchParams.delete('is_esip6');
  }

  // const withs = url.searchParams.get('with')?.split(',') || [];
  // const onlys = url.searchParams.get('only')?.split(',') || [];
  // const ogParam = url.searchParams.get('transaction_hash_only');

  // const isTxOnly =
  //   withs.includes('transaction_hash') || onlys.includes('transaction_hash') || ogParam;

  // if (isTxOnly) {
  //   url.searchParams.set('transaction_hash_only', 'true');
  // }

  return url;
}

// default time 1 YEAR
export function getHeaders(time = 31_536_000, additionalHeaders = {}, cfType = 'must-revalidate') {
  // adds vary, cache-control, and cdn-cache-control headers
  const headers = new CacheHeaders({
    'Netlify-CDN-Cache-Control': `public,s-maxage=${time},must-revalidate,durable`,
    'Vercel-CDN-Cache-Control': `public,s-maxage=${time},must-revalidate`,
    'Cloudflare-CDN-Cache-Control': `public,s-maxage=${time},${cfType}`,
    ...additionalHeaders,
  }).ttl(time);

  return headers;
  // return {
  //   'Cache-Control': `public,max-age=0,must-revalidate`, // always must-revalidate, force checks on CDNs
  //   'CDN-Cache-Control': `public,s-maxage=${time},${type}`,
  //   'Netlify-CDN-Cache-Control': `public,s-maxage=${time},${type},durable`,
  //   'Cloudflare-CDN-Cache-Control': `public,s-maxage=${time},${type}`,
  //   ...additionalHeaders,
  // };
}

export function normalizeResult(result, withUrl?: any) {
  const keys = Object.keys(result || {});
  const url = withUrl ? new URL(withUrl) : new URL('http://foo.com');

  const withs = url.searchParams.get('with')?.split(',') || [];
  const onlys = url.searchParams.get('only')?.split(',') || [];
  const isTxOnly =
    (keys.length === 1 && keys[0] === 'transaction_hash') ||
    url.searchParams.get('transaction_hash_only');

  if (isTxOnly) {
    console.log({ isTxOnly });
    return result;
  }
  // const txonly = Boolean(
  //   (keys.length === 1 && keys[0] === 'transaction_hash') ||
  //     url.searchParams.get('transaction_hash_only') ||
  //     false,
  // );

  // // // if `transaction_hash_only` param is used
  // if (txonly) {
  //   return result;
  // }

  const res = {
    block_number: String(result.block_number),
    block_blockhash: result.block_blockhash,
    block_timestamp: String(result.block_timestamp),
    block_datetime: new Date(Number(result.block_timestamp) * 1000).toISOString(),
    transaction_hash: result.transaction_hash,
    transaction_index: String(result.transaction_index),
    transaction_value: String(result.value).replace(/\.0$/, ''),
    transaction_fee: String(result.transaction_fee).replace(/\.0$/, ''),
    gas_price: String(result.gas_price).replace(/\.0$/, ''),
    gas_used: String(result.gas_used),
    creator: result.creator,
    receiver: result.initial_owner,
    media_type: result.media_type,
    media_subtype: result.mime_subtype,
    content_type: result.mimetype,
    content_sha: result.content_sha,
    content_path: `/ethscriptions/${result.transaction_hash}/content`,
    // Note use `with=content_uri`
    // ...(withContent ? { content_uri: result.content_uri } : {}),
    ...(result.attachment_sha
      ? {
          attachment_content_type: result.attachment_content_type,
          attachment_media_type: result.attachment_content_type.split('/')?.at(0) || null,
          attachment_sha: result.attachment_sha,
          attachment_path: `/ethscriptions/${result.transaction_hash}/attachment`,
        }
      : {}),
    is_esip0: Boolean(result.event_log_index === null),
    is_esip3: Boolean(result.event_log_index !== null),
    is_esip4: result.content_uri?.includes('vnd.facet.tx+json') || false,
    is_esip6: result.esip6,
    is_esip8: Boolean(result.attachment_sha),
  };

  const onlyRes = Object.fromEntries(
    Object.entries(res).filter(([key, _val]) => {
      if (onlys.length > 0) {
        return onlys.includes(key);
      }
      return true;
    }),
  );

  const withRes = withs.reduce((acc, withKey) => {
    if (!acc[withKey]) {
      acc[withKey] = res[withKey] || result[withKey];
    }

    return acc;
  }, onlyRes);

  return withRes.length > 0 ? withRes : onlyRes;
}

export async function createDigest(msg, algo: 'SHA-1' | 'SHA-256' | 'SHA-512' = 'SHA-256') {
  const data = new TextEncoder().encode(msg);
  const hashBuffer = await crypto.subtle.digest(algo, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function numfmt(x, delim = ',') {
  return x
    .split('')
    .reverse()
    .join('')
    .match(/.{1,3}/g)
    .map((z) => z.split('').reverse().join(''))
    .reverse()
    .join(delim);
}

export const getApp = () => app;
