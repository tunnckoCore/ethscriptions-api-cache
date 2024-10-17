// ?NOTE: maybe switch to @hono/zod-openapi on next iteration
import { zValidator } from '@hono/zod-validator';
import {
  checkExists,
  estimateDataCost,
  getAllEthscriptions,
  getDigestForData,
  getEthscriptionById,
  getEthscriptionDetailed,
  getUserCreatedEthscritions,
  getUserOwnedEthscriptions,
  getUserProfile,
  resolveUser,
} from 'ethscriptions';
/* eslint-enable import/no-unresolved */

import type { EnumAllDetailed } from 'ethscriptions/types.ts';
/* eslint-disable import/no-unresolved */
import { getPrices } from 'ethscriptions/utils';
import { Hono, type Context, type ValidationTargets } from 'hono';
import { cors as corsMiddleware } from 'hono/cors';
import { etag as etagMiddleware } from 'hono/etag';
import { secureHeaders } from 'hono/secure-headers';
import { trimTrailingSlash } from 'hono/trailing-slash';
import { z } from 'zod';

import { ENDPOINTS } from './endpoints-docs.ts';

const HexSchema = z.custom(
  (x) =>
    x &&
    typeof x === 'string' &&
    x.length > 0 &&
    /^[\da-f]+$/i.test(x.replace('0x', '')) &&
    x.length % 2 === 0,
  { message: 'Expected a valid hex string' },
);

const DataURISchema = z
  .string()
  .startsWith('data:')
  .or(HexSchema.and(z.string().startsWith('0x646174613a')));

const UserSchema = HexSchema.and(z.string().length(42)).or(z.string().min(1));
const HashSchema = HexSchema.and(z.string().length(66));

const FilterSchema = z.object({
  current_owner: UserSchema.optional(),
  current: UserSchema.optional(),
  initial_owner: UserSchema.optional(),
  initial: UserSchema.optional(),
  previous_owner: UserSchema.optional(),
  previous: UserSchema.optional(),
  owner: UserSchema.optional(),
  creator: UserSchema.optional(),
  receiver: UserSchema.optional(),
  page_key: HashSchema.optional(),
  content_sha: HashSchema.optional(),
  max_results: z.coerce.number().optional(),
  per_page: z.coerce.number().optional(),
  resolve: z.coerce.boolean().or(z.literal(1)).optional(),
  media_type: z
    .union([z.literal('image'), z.literal('text'), z.literal('video'), z.literal('application')])
    .optional(),
  media_subtype: z.coerce.string().optional(),
  content_type: z.coerce.string().optional(),
  attachment_present: z.coerce.boolean().optional(),
});

function toHonoHandler(fn) {
  return async (ctx: Context) => {
    const resp = await fn(ctx);

    if (!resp.ok) {
      return ctx.json({ error: resp.error }, { status: resp.error.httpStatus });
    }
    const { result, pagination, headers } = resp;

    if (result instanceof Uint8Array) {
      return new Response(result, { headers });
    }
    if (pagination) {
      return ctx.json({ result, pagination }, { headers });
    }

    return ctx.json({ result }, { headers });
  };
}

type Bindings = {
  COMMIT_SHA: string;
};

type Env = {
  ENVIRONMENT: 'production' | 'development';
  UPLOADTHING_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings & Env }>();

app.use(trimTrailingSlash());
app.use(etagMiddleware({ weak: true }));
app.use(corsMiddleware({ origin: '*' }));
app.use(secureHeaders());

app.get('/', async (ctx: Context) => {
  const commitsha = ctx.env.COMMIT_SHA || 'local';

  return ctx.html(`<html lang="en">
<head>
  <meta charset="utf-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="viewport" content="width=device-width" />
  <meta name="generator" content="Hono/v4" />
  <title>Calldata API</title>
  <!-- <script src="https://cdn.tailwindcss.com"></script> -->
</head>

<body data-theme="dark" class="relative z-10 overflow-auto overflow-x-hidden bg-[#231631]">
    <div>
      <h1>Ethscriptions API</h1>
      <p>Build: <a href="https://github.com/tunnckoCore/ethscriptions-api-cache/commit/${commitsha}">${commitsha}</a></p>
      <p>Source: <a href="https://github.com/tunnckoCore/ethscriptions-api-cache">https://github.com/tunnckoCore/ethscriptions-api-cache</a></p>
    </div>
    <div>${ENDPOINTS.map((x) => {
      if (!x) return '';

      const [key, desc] = x.split(' - ');

      if (!key?.startsWith('/')) {
        return `<h2>${key}</h2>`;
      }

      let k = key.includes('/ethscriptions/:id') ? key.replace(':id', '302469') : key;
      k = /attach|blob/i.test(key) ? key.replace(':id', '5743259') : k;

      return `<span><a href="${k}"><code>${key}</code></a> ${desc ? ` - ${desc}` : ''}</span><br>`;
    }).join('')}</div><br><br>
</body>
</html>`);
});

app.get('/endpoints', async (ctx: Context) => {
  const commitsha = ctx.env.COMMIT_SHA;

  return ctx.json({
    about: { source: 'https://github.com/tunnckocore/ethscriptions-api-cache', commit: commitsha },
    endpoints: ENDPOINTS,
  });
});

app.get(
  '/prices',
  toHonoHandler((ctx: Context) => getPrices(ctx.req.query('speed') || 'normal')),
);

function validate(target: keyof ValidationTargets, schema: z.ZodSchema<any>) {
  return zValidator(target, schema, (res, ctx: Context) => {
    if (!res.success) {
      return ctx.json(
        {
          error: {
            message: 'Failure in validation',
            httpStatus: 400,
            issues: res.error.issues,
          },
        },
        { status: 400 },
      );
    }

    return res.data;
  });
}

app.get(
  '/estimate/:data',
  validate('param', z.object({ data: DataURISchema })),
  validate(
    'query',
    z
      .object({
        speed: z.union([z.literal('normal'), z.literal('fast')]).optional(),
        ethPrice: z.coerce.number().optional(),
        gasPrice: z.coerce.number().optional(),
        gasFee: z.coerce.number().optional(),
        baseFee: z.coerce.number().optional(),
        bufferFee: z.coerce.number().optional(),
        priorityFee: z.coerce.number().optional(),
      })
      .strict(),
  ),
  toHonoHandler(async (ctx: Context) => {
    console.log('bruh');
    const data = ctx.req.param('data');
    const { searchParams } = new URL(ctx.req.url);

    const settings = Object.fromEntries(
      [...searchParams.entries()].map(([key, value]) => {
        const val = Number(value);

        return [key, Number.isNaN(val) ? value : val || 0];
      }),
    );

    return estimateDataCost(data, settings);
  }),
);

app.post(
  '/estimate',
  validate(
    'json',
    z
      .object({
        data: DataURISchema,
        speed: z.union([z.literal('normal'), z.literal('fast')]).optional(),
        ethPrice: z.coerce.number().optional(),
        gasPrice: z.coerce.number().optional(),
        gasFee: z.coerce.number().optional(),
        baseFee: z.coerce.number().optional(),
        bufferFee: z.coerce.number().optional(),
        priorityFee: z.coerce.number().optional(),
      })
      .strict(),
  ),
  toHonoHandler(async (ctx: Context) => {
    const { data, ...settings } = await ctx.req.json();

    return estimateDataCost(data, settings);
  }),
);

app.get(
  '/sha/:data?',
  validate('param', z.object({ data: DataURISchema.optional() })),
  validate(
    'query',
    z.object({ data: DataURISchema.optional(), of: DataURISchema.optional() }).strict(),
  ),
  toHonoHandler((ctx: Context) => {
    const dataParam = ctx.req.param('data');
    const dataQuery = ctx.req.query('of') || ctx.req.query('data');

    const input = (dataParam || dataQuery) as `data:${string}` | `0x646174613a${string}`;

    return getDigestForData(input, { checkExists: true });
  }),
);
app.post(
  '/sha',
  validate(
    'json',
    z
      .object({ data: DataURISchema, checkExists: z.boolean().or(z.literal(1)).optional() })
      .strict(),
  ),
  toHonoHandler(async (ctx: Context) => {
    const { data, ...settings } = await ctx.req.json();

    return getDigestForData(data, settings);
  }),
);

app.get(
  '/check/:sha',
  validate('param', z.object({ sha: HashSchema })),
  toHonoHandler((ctx: Context) => checkExists(ctx.req.param('sha'))),
);
app.get(
  '/exists/:sha',
  validate('param', z.object({ sha: HashSchema })),
  toHonoHandler((ctx: Context) => checkExists(ctx.req.param('sha'))),
);

app.get(
  '/resolve/:name',
  validate('param', z.object({ name: UserSchema })),
  validate(
    'query',
    z
      .object({
        checkCreator: z.boolean().or(z.literal(1)).optional(),
        creator: z.boolean().or(z.literal(1)).optional(),
      })
      .strict(),
  ),
  toHonoHandler(async (ctx: Context) => {
    const checkCreator = Boolean(ctx.req.query('creator') || ctx.req.query('checkCreator'));

    return resolveUser(ctx.req.param('name'), { checkCreator });
  }),
);

app.get(
  '/profiles/:name',
  validate('param', z.object({ name: UserSchema })),
  toHonoHandler((ctx: Context) => getUserProfile(ctx.req.param('name'))),
);

app.get(
  '/profiles/:name/:mode',
  validate(
    'param',
    z.object({
      name: UserSchema,
      mode: z.union([z.literal('created'), z.literal('owned')]),
    }),
  ),
  validate(
    'query',
    FilterSchema,
    // !NOTE: non-strict because we are passing through to upstream
    // .strict(),
  ),

  toHonoHandler((ctx: Context) => {
    const { searchParams } = new URL(ctx.req.url);
    const settings = Object.fromEntries([...searchParams.entries()]);

    const name = ctx.req.param('name');
    const mode = ctx.req.param('mode');
    const func = mode === 'created' ? getUserCreatedEthscritions : getUserOwnedEthscriptions;

    if (mode === 'created' || mode === 'owned') {
      return func(name, settings);
    }

    return {
      error: { message: 'Invalid mode, accepts only `created` or `owned` mode', httpStatus: 400 },
    };
  }),
);

// weird hack in hono, using named regex route like `/:routeparam{[a-z]+}`,
// cuz it doesn't support basic regex routes like `/(ethscriptions|eths)`
// came in handy for this case, because we have multiple types anyway
// support for
// - /ethscriptions & /eths
// - /blobscriptions & /blobs
//
// - /ethscriptions/:id
// - /ethscriptions/:id/owners
// - /ethscriptions/:id/content
// - /ethscriptions/:id/transfers
//
// - /blobscriptions/:id
// - /blobscriptions/:id/owners
// - /blobscriptions/:id/content
// - /blobscriptions/:id/transfers
app.get(
  '/:type{(blobscriptions|blobs|ethscriptions|eths)+}/:id?/:mode?',
  validate(
    'param',
    z
      .object({
        type: z.union([
          z.literal('ethscriptions'),
          z.literal('eths'),
          z.literal('blobscriptions'),
          z.literal('blobs'),
        ]),
        id: HashSchema.or(z.coerce.number()).optional(),
        mode: z
          .union([
            z.literal('meta'),
            z.literal('data'),
            z.literal('metadata'),
            z.literal('content'),
            z.literal('transfer'),
            z.literal('transfers'),
            z.literal('owner'),
            z.literal('owners'),
            z.literal('index'),
            z.literal('number'),
            z.literal('info'),
            z.literal('creator'),
            z.literal('receiver'),
            z.literal('previous'),
            z.literal('initial'),
            z.literal('initial_owner'),
            z.literal('current_owner'),
            z.literal('previous_owner'),
            z.literal('attachment'),
            z.literal('blob'),
          ])
          .optional(),
      })
      .strict(),
  ),
  validate(
    'query',
    FilterSchema,
    // !NOTE: non-strict because we are passing through to upstream
    // .strict(),
  ),
  toHonoHandler(async (ctx: Context) => {
    const { searchParams } = new URL(ctx.req.url);
    const settings = Object.fromEntries([...searchParams.entries()]);
    const type = ctx.req.param('type');
    const id = ctx.req.param('id');
    const mode = ctx.req.param('mode');

    if (!id) {
      return getAllEthscriptions(
        type.includes('blob') ? { ...settings, attachment_present: true } : settings,
      );
    }
    if (!mode) {
      return getEthscriptionById(id.replaceAll(',', ''), settings);
    }

    return getEthscriptionDetailed(id.replaceAll(',', ''), mode as EnumAllDetailed, settings);
  }),
);

export const getApp = () => app;
