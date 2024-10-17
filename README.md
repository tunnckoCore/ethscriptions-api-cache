# ethscriptions server

> Ethscriptions API Cache Proxy. A Cloudflare Worker that caches and unifies Ethscriptions (or any
> other) API's responses, according to ESIP-9. Includes support for estimating gas costs, resolving
> ENS on-chain / off-chain names, and Ethscriptions names.

Go to [api.wgw.lol](https://api.wgw.lol) for more info and the available endpoints

You can also use it as a NPM module. Or better just use the
[`ethscriptions` library](https://npmjs.com/package/ethscriptions).

The server exports uses and exports Hono instance. You can practically deploy it everywhere.

```ts
// there is `/server` (ESM) and `/server.ts` (TS) exported from the package
import { getApp } from '@tunnckocore/ethscriptions-api-cache/server';

export default getApp();
```
