# ethscriptions api cache proxy

> Ethscriptions API Cache Proxy. A Cloudflare Worker that caches and unifies Ethscriptions (or any
> other) API's responses, according to ESIP-9. Includes support for resolving ENS on-chain /
> off-chain names, and Ethscriptions names.

Go to [api.wgw.lol](https://api.wgw.lol) for more info and the available endpoints

You can also use it as a NPM module. Keep in mind the source code is in TypeScript and it is
directly published on NPM.

Install it with `npm install @tunnckocore/ethscriptions-api-cache` and just import it in your own
worker.

```ts
// there is `/api` and `/api.ts` exported from the package
import { getApp } from '@tunnckocore/ethscriptions-api-cache/api';

export default getApp();
```

Or you can use just parts of the handlers and utils, like:

```ts
import { Hono } from 'hono';
import {
  checkExistHandler,
  createDigest,
  normalizeResult,
} from '@tunnckocore/ethscriptions-api-cache/api.ts';

const app = new Hono();

app.get('/check-exist/:sha', checkExistHandler);
app.get('/exists/:sha', checkExistHandler);
app.get('/check/:sha', checkExistHandler);

export default app;
```

Soon it will probably be converted to tRPC so it's better typed, easier to use, and better
documented.

---

Todo better readme
