/* eslint-disable import/no-unresolved */

// import type { Config } from '@netlify/edge-functions';

import { CacheHeaders } from 'cdn-cache-control';
import { Hono, type Context } from 'hono';
import { cors as corsMiddleware } from 'hono/cors';
import { etag as etagMiddleware } from 'hono/etag';
import { secureHeaders } from 'hono/secure-headers';
import { trimTrailingSlash } from 'hono/trailing-slash';
import { createPublicClient, http, type PublicClient } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize as normalizeEns } from 'viem/ens';

type Bindings = {
  COMMIT_SHA: string;
};

export const app = new Hono<{ Bindings: Bindings }>();

export const BASE_API_URL = 'https://api.ethscriptions.com/v2';
export const CACHE_TTL = 300;
export const DEFAULT_ENS_HANDLER = onchainEnsHandler;

export const ENDPOINTS = [
  '',
  'Checking existence of Ethscriptions',
  '',
  '/exists/:sha - 0x-prefixed or non-prefixed SHA-256 hex string',
  '/check/:sha - alias of above',
  '',
  'A generation of SHA-256 and resolving of Ethscriptions',
  '',
  '/sha/:dataURI? - create SHA256 of a given data URI (or base64 encoded one), also resovles the Ethscription if it exists',
  '/sha?of=dataURI - optionally use the `of` query param to specify the data URI',
  '/sha?of=data:,wgw - generates the SHA256 of that data URI and also resovles the Ethscription',
  '/sha/data:,foobarbaz - not exists but generates SHA256 of that data URI',
  '/sha?of=ZGF0YTosNTg0OC5ldGhtYXA= - a base64 of "data:,5848.ethmap"',
  '',
  'Resolve names - if it ends with com|lol|xyz|bg|info|net|id|org it is considered off-chain ENS',
  '',
  '/resolve/:name - find Ethereum address for any ENS (on-chain or off-chain name) or Ethscription Name',
  '/resolve/wgw - an Ethscription Name',
  '/resolve/wgw.lol - if it cannot resolve as off-chain ENS, tries to resolve the Ethscription name',
  '/resolve/foo.bar - resolves nothing, there is no such Ethscription name',
  '/resolve/foo.com - resolves nothing, there is no such off-chain ENS name, nor Ethscription name',
  '/resolve/59.eths - an Ethscription name',
  '/resolve/5848.ethmap - an Ethscription name',
  '/resolve/ckwf.cb.id - Coinbase off-chain ENS name',
  '/resolve/gregskril.com - an off-chain ENS name',
  '/resolve/mfers.base.eth - an on-chain ENS name',
  '/resolve/tunnckocore.eth - on-chain ENS name',
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
  'Filters examples, for user created and owned, better use the /profiles/:name endpoints',
  '',
  '/ethscriptions?creator=0xAddress - filter by creator address',
  "/ethscriptions?creator=wgw - since there is no `with_resolve` param, it won't find wgw's ethscriptions",
  '/ethscriptions?creator=wgw&with_resolve=1 - filter by creator, using current owner of this Ethscription Name',
  '/ethscriptions?creator=ckwf.cb.id&with_resolve=1 - filter by creator using Coinbase Off-chain ENS',
  '/ethscriptions?creator=dubie.eth&with_resolve=1 - filter by creator using On-Chain ENS',
  '/ethscriptions?initial_owner=wgw.lol&with_resolve=1 - filter by initial owner, using current owner of an Ethscription name',
  '/ethscriptions?initial_owner=5848.tree&with_resolve=1 - filter by initial owner, using current owner of this Ethscription Name',
  '/ethscriptions?creator=123.ethmap&with_resolve=1 - filter by creator, current holder/owner of this Ethscription',
  '/ethscriptions?current_owner=barry.wgw.lol&with_resolve=1 - filter by current owner of this off-chain ENS name',
  '/ethscriptions?current_owner=e5b5&with_resolve=1 - filter by creator, using current owner of this Ethscription Name',
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
  '/ethscriptions/:id/meta?with_content_uri=true - include the content_uri in the response',
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

// const permaCache = perUserPermaCacheMiddleware({
//   cacheName: 'eths',
//   cacheControl: `public,max-age=${ONE_YEAR},immutable`,
// });

// these always respond with the same, we can perma cache them safely
// app.get('/ethscriptions/:id/content', permaCache);
// app.get('/ethscriptions/:id/metadata', permaCache);
// app.get('/ethscriptions/:id/data', permaCache); // alias of /content
// app.get('/ethscriptions/:id/meta', permaCache); // alias of /metadata
// app.get('/ethscriptions/:id/number', permaCache); // ethscription_number and other static numbers
// app.get('/ethscriptions/:id/index', permaCache); // alias of /number

app.get('/', async (ctx) => {
  const commitsha = ctx.env.COMMIT_SHA;

  // console.log('process.env', process.env.CLOUDFLARE_ACCOUNT_ID);
  return ctx.json({
    about: { source: 'https://github.com/tunnckocore/ethscriptions-api-cache', commit: commitsha },
    endpoints: ENDPOINTS,
  });
});

app.get('/check/:sha', checkExistHandler);
app.get('/exists/:sha', checkExistHandler);

export async function checkExistHandler(ctx: Context) {
  const sha = ctx.req.param('sha').replace('0x', '');

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
    return ctx.json({ result: { exists: true, ethscription: normalizeResult(eth) } });
  }

  return ctx.json({ result: { exists: false } }, { headers: getHeaders(CACHE_TTL) });
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

    console.log('bro', { dataB64 });
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

  const url = new URL(ctx.req.url);
  const { result } = (await fetch(`${url.origin}/check/${sha}`).then((x) => x.json())) as any;

  return ctx.json({ result: { sha, ...result } }, { headers: getHeaders(CACHE_TTL) });
}
app.get('/sha/:data?', getSha256ForData);

app.get('/profiles/:name/created', profileHandler);
app.get('/profiles/:name/own', profileHandler);
app.get('/profiles/:name/info', profileHandler);
app.get('/profiles/:name/latest', profileHandler);

async function profileHandler(ctx: Context) {
  const url = new URL(ctx.req.url);
  const name = ctx.req.param('name');
  const endpoint = url.pathname.split('/').pop() || '';

  console.log({ name, endpoint });

  url.searchParams.set('with_resolve', 'true');

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
  const { error, result, pagination, withContentUri } = config;

  if (error) {
    return ctx.json({ error }, { status: error.httpStatus });
  }

  const data = result.map((x) => normalizeResult(x, withContentUri));

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
  const name = ctx.req.param('name').toLowerCase();

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  const address = (await nameResolver(name, DEFAULT_ENS_HANDLER, publicClient)).toLowerCase();

  return ctx.json(
    {
      result: {
        resolved: address !== name,
        name,
        address,
      },
    },
    { headers: getHeaders(3600) },
  );
}

export async function listAllEthscriptionsHandler(ctx: Context) {
  const config = (await initialNormalize(ctx)) as any;
  const { error, result, pagination, ifNoneMatch, withContentUri } = config;

  if (error) {
    return ctx.json({ error }, { status: error.httpStatus });
  }

  const data = result.map((x) => normalizeResult(x, withContentUri));

  console.log('[all] fresh miss');
  const response = ctx.json({ result: data, pagination }, { headers: getHeaders(15) });

  return response;
}

app.get('/ethscriptions', listAllEthscriptionsHandler);

async function ethscriptionByIdHandler(ctx: Context) {
  const config = (await initialNormalize(ctx)) as any;
  const { error, result, withContentUri, ifNoneMatch } = config;

  if (error) {
    return ctx.json({ error }, { status: error.httpStatus });
  }

  console.log('[id] fresh miss');
  const data = normalizeResult(result, withContentUri);

  const response = ctx.json({ result: data }, { headers: getHeaders(CACHE_TTL) });

  return response;
}

app.get('/ethscriptions/:id', ethscriptionByIdHandler);

async function ethscriptionSubHandler(ctx: Context) {
  const type = ctx.req.param('type');
  const { error, result, withContentUri, ifNoneMatch, url } = (await initialNormalize(ctx)) as any;

  if (error) {
    return ctx.json({ error }, { status: error.httpStatus });
  }

  const data = normalizeResult(result, withContentUri);

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
      // transfers can occure only after 5 blocks (60 seconds)
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
            result.ethscription_transfers.length > 1 ? result.ethscription_transfers.length : 0,
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

  await searchParamPatches(url);
  if (url.searchParams.get('with_resolve')) {
    await resolveAddressPatches(url);
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

export async function onchainEnsHandler(val: string, publicClient: PublicClient) {
  return publicClient.getEnsAddress({
    name: normalizeEns(val),
  });
}

export async function nameResolver(value: string, ensHandler?: any, publicClient?: PublicClient) {
  const val = value.toLowerCase();
  const handler = ensHandler || DEFAULT_ENS_HANDLER;

  if (/\.(com|lol|xyz|bg|info|net|id|org|eth$)/.test(val)) {
    try {
      const address = await handler(val, publicClient);

      if (address) {
        return address;
      }
    } catch {
      console.log('ENS resolution failed, continuing...');
    }
  }

  const nameUri = `data:,${val}`;
  const nameSha = await createDigest(nameUri);
  const resp = (await fetch(`${BASE_API_URL}/ethscriptions/exists/0x${nameSha}`).then((x) =>
    x.json(),
  )) as any;
  console.log({ val, nameUri, nameSha, resp });

  if (resp.result.exists) {
    return resp.result.ethscription.current_owner.toLowerCase();
  }

  return val;
}

export async function resolveAddressPatches(url) {
  const addressParams = [...url.searchParams.entries()].filter(
    ([key, value]) =>
      /creator|receiver|owner/.test(key) && value.length > 0 && !value.startsWith('0x'),
  );

  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(),
  });

  const params = await Promise.all(
    addressParams.map(async ([key, value]) => {
      // if it cannit resolve neither ENS, nor Ethscriptions Name, it passthrough the `value`
      const val = await nameResolver(value, DEFAULT_ENS_HANDLER, publicClient);

      return [key, val];
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

  // content_type is equal to `<media_type>/<media_subtype>`, it's called "mimetype" in upstream
  if (url.searchParams.get('content_type')) {
    url.searchParams.set('mimetype', url.searchParams.get('content_type') || '');
    url.searchParams.delete('content_type');
  }

  // support `is_esip6` instead of just `esip6` for consistency with fields and other ESIPs fiekds
  if (url.searchParams.get('is_esip6')) {
    url.searchParams.set('esip6', url.searchParams.get('is_esip6') || '');
    url.searchParams.delete('is_esip6');
  }

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

export function normalizeResult(result, withContent = false) {
  return {
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
    ...(withContent ? { content_uri: result.content_uri } : {}),
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
