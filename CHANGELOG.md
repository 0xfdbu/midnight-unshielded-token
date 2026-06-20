# Changelog: `states_tutorial.md` refactor for `midnight-unshielded-token`

> This log compares the original `unshielded-token/states_tutorial.md` from the `midnight-apps` monorepo with the current standalone tutorial. It documents every mentor feedback item that was applied and shows the exact passages that changed.

---

## Source of comparison

- **Old file:** `midnight-apps/unshielded-token/states_tutorial.md` (monorepo subfolder)
- **New file:** `midnight-unshielded-token/states_tutorial.md` (standalone repo)
- **Comparison generated with:** `diff -u old new`

## Word count comparison

Measured with `wc -w` (Unix word count), which counts whitespace-delimited tokens including code blocks, headings, and inline markup.

| File | Word count |
|---|---|
| Old `unshielded-token/states_tutorial.md` | 2,893 |
| New `midnight-unshielded-token/states_tutorial.md` | 3,133 |
| **Difference** | **+240 words (+8.3%)** |

The increase comes from the new Project setup section, the Dependencies/version table, the corrected protocol note, the direct `ContractState` usage snippet, and the expanded `contractStateObservable` explanations.

---

## 1. Fixed the core claim about `indexerPublicDataProvider`

**Feedback:** The article falsely claimed that `indexerPublicDataProvider` "does not surface subscriptions directly" and therefore required a raw WebSocket workaround.

### What changed in Section 1

**Before:**

````markdown
`@midnight-ntwrk/midnight-js-indexer-public-data-provider` exports `indexerPublicDataProvider`. It wraps an Apollo Client around the indexer's GraphQL V4 endpoint. It implements `PublicDataProvider` interface and gives you typed methods for querying chain data.

The provider contains three useful methods for querying smart contract state:

| Method | Returns | Use when |
|---|---|---|
| `queryContractState(address)` | `ContractState` | You only need the smart contract's public ledger data |
| `queryZSwapAndContractState(address)` | `[ZswapChainState, ContractState, LedgerParameters]` | You also need the global shielded state or parameters |
| `queryUnshieldedBalances(address)` | `UnshieldedBalances` | You only need the smart contract's native token balances |

All three — `queryContractState(address)`, `queryZSwapAndContractState(address)`, and `queryUnshieldedBalances(address)` — accept an optional second argument to query at a specific block height or hash. If omitted, the latest state is returned.
````

**After:**

````markdown
`@midnight-ntwrk/midnight-js-indexer-public-data-provider` exports `indexerPublicDataProvider`. It wraps an Apollo Client around the indexer's GraphQL V4 endpoint. It implements `PublicDataProvider` interface and gives you typed methods for querying chain data, **including streaming subscriptions**.

The provider contains useful methods for querying smart contract state:

| Method | Returns | Use when |
|---|---|---|
| `queryContractState(address)` | `ContractState` | You only need the smart contract's public ledger data |
| `queryZSwapAndContractState(address)` | `[ZswapChainState, ContractState, LedgerParameters]` | You also need the global shielded state or parameters |
| `queryUnshieldedBalances(address)` | `UnshieldedBalances` | You only need the smart contract's native token balances |
| `contractStateObservable(address, config)` | `Observable<ContractState>` | You want push-driven updates when the smart contract changes |

`queryContractState`, `queryZSwapAndContractState`, and `queryUnshieldedBalances` accept an optional second argument to query at a specific block height or hash. `contractStateObservable` accepts a config such as `{ type: 'latest' }`, `{ type: 'blockHeight', blockHeight: 42 }`, or `{ type: 'blockHash', blockHash: '...' }`.

> **Why `contractStateObservable`?** It is the same `contractActions` GraphQL subscription you would open manually, but the provider manages the WebSocket handshake, reconnects, message parsing, and RxJS cleanup for you. The official Midnight bulletin-board UI uses this exact API.
````

**Result:** The tutorial now teaches the supported SDK API and removes the false premise that raw WebSocket is required.

---

## 2. Restructured real-time updates around `contractStateObservable`

**Feedback:** For a bounty whose deliverables are "using `indexerPublicDataProvider`" and "WebSocket subscriptions for real-time updates," the tutorial must teach the supported API as primary.

### Section heading

**Before:** `## 6. Real-time updates with WebSocket subscriptions`

**After:** `## 6. Real-time updates with \`contractStateObservable\``

### Opening paragraph

**Before:**

````markdown
Using `useEffect` for polling technically works, but it is inefficient for dashboards that need to stay up to date. The Midnight indexer exposes GraphQL subscriptions over WebSocket. `contractActions` emits an event every time your smart contract is called / deployed.

`indexerPublicDataProvider` does not surface subscriptions directly, so open a raw WebSocket to the indexer and send a GraphQL `start` message to `wss://indexer.preprod.midnight.network/api/v4/graphql/ws`:
````

**After:**

````markdown
Using `useEffect` for polling technically works, but it is inefficient for dashboards that need to stay up to date. The Midnight indexer exposes GraphQL subscriptions over WebSocket, and `indexerPublicDataProvider` wraps them in `contractStateObservable`. `contractActions` emits an event every time your smart contract is called or deployed.

Create the provider, subscribe to the observable, and refetch state on every emission:
````

### Primary code block

**Before:** The section opened with a raw `WebSocket` example.

**After:** It opens with the supported `contractStateObservable` API:

```typescript
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { Subscription } from 'rxjs';

const publicDataProvider = indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS);

let subscription: Subscription;
try {
  subscription = publicDataProvider
    .contractStateObservable(contractAddress, { type: 'latest' })
    .subscribe({
      next: () => {
        console.log('[useContractState] Observable: contract state changed, refetching');
        fetchState();
      },
      error: (err) => console.error('[useContractState] Observable error:', err),
    });
} catch (err: any) {
  console.error('[useContractState] Failed to start observable:', err);
}

// Cleanup on unmount
return () => subscription?.unsubscribe();
```

### Direct `ContractState` usage snippet

A new snippet was added showing that the emitted `ContractState` can be used directly without refetching:

```typescript
subscription = publicDataProvider
  .contractStateObservable(contractAddress, { type: 'latest' })
  .subscribe({
    next: (contractState) => {
      console.log('[useContractState] Observable: raw contractState emitted', contractState);
      console.log('[useContractState] Observable: contractState.balance', contractState.balance);

      const ledgerState = contractModule.ledger(contractState.data);
      console.log('[useContractState] Observable: deserialized ledger state', {
        totalSupply: ledgerState.totalSupply.toString(),
        totalBurned: ledgerState.totalBurned.toString(),
        burnedBalance: ledgerState.burnedBalance.toString(),
      });
      // update state from ledgerState and contractState.balance
    },
    error: (err) => console.error(err),
  });
```

### `useContractState` hook code block

**Before:** The hook combined polling with raw WebSocket code (reconnect, debounce, WeakSet cleanup).

**After:** The hook uses `indexerPublicDataProvider(...).contractStateObservable(...)`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { INDEXER_HTTP, INDEXER_WS } from './wallet/wallet.constants';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import {
  getContractState,
  getContractBalance,
  getUserTokenBalance,
} from './wallet/services/contractCalls';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { Subscription } from 'rxjs';

// ... fetchState remains the same ...

// Initial fetch + polling fallback (also catches wallet-balance changes the indexer stream misses)
useEffect(() => {
  if (!contractAddress) {
    setLoading(false);
    return;
  }
  fetchState();
  const id = setInterval(() => fetchState(), pollInterval);
  return () => clearInterval(id);
}, [fetchState, pollInterval, contractAddress]);

// Primary: indexer-backed contract state observable for push updates
useEffect(() => {
  if (!contractAddress) {
    setLoading(false);
    return;
  }

  const publicDataProvider = indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS);
  let subscription: Subscription;

  try {
    subscription = publicDataProvider
      .contractStateObservable(contractAddress, { type: 'latest' })
      .subscribe({
        next: () => {
          console.log('[useContractState] Observable: contract state changed, refetching');
          fetchState();
        },
        error: (err) => console.error('[useContractState] Observable error:', err),
      });
  } catch (err: any) {
    console.error('[useContractState] Failed to start observable:', err);
    setError(err.message);
    setLoading(false);
    return;
  }

  return () => subscription?.unsubscribe();
}, [contractAddress, fetchState]);
```

### Raw WebSocket moved to "Under the hood"

The old raw WebSocket code is preserved in a new subsection:

````markdown
### Under the hood: raw WebSocket

`contractStateObservable` uses WebSocket under the hood. If you ever need to implement the same subscription without the provider — for example, in an environment where you cannot import `@midnight-ntwrk/midnight-js-indexer-public-data-provider` — the indexer accepts a raw WebSocket connection to `wss://indexer.preprod.midnight.network/api/v4/graphql/ws`.

```typescript
const ws = new WebSocket(INDEXER_WS, 'graphql-ws');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'connection_init' }));
  ws.send(JSON.stringify({
    id: 'contract-state-sub',
    type: 'start',
    payload: {
      query: `
        subscription ContractStateUpdates($address: HexEncoded!) {
          contractActions(address: $address) {
            state
            transaction { block { height } }
          }
        }
      `,
      variables: { address: contractAddress },
    },
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'data' && msg.payload?.data?.contractActions) {
    fetchState();
  }
  if (msg.type === 'ka') {
    // keep-alive, ignore
  }
};
```
````

**Result:** `contractStateObservable` is now the primary path; raw WebSocket is preserved as a valuable reference rather than a replacement.

---

## 3. Corrected the backwards protocol note

**Feedback:** The closing note incorrectly labeled the hand-rolled WebSocket code as modern `graphql-ws`. The code actually uses the legacy `subscriptions-transport-ws` protocol.

**Before:**

````markdown
> **Note:** `graphql-ws` expects a `connection_init` before `start`, so if you use `subscriptions-transport-ws` (older protocol), the handshake is slightly different. The Preprod indexer supports `graphql-ws`.
````

**After:**

````markdown
> **Protocol note:** The raw code above uses the **legacy `subscriptions-transport-ws` protocol**. Its WebSocket subprotocol string is confusingly `graphql-ws`, and its message vocabulary is `connection_init`, `start`, `data`, `ka` (keep-alive), and `stop`. The modern `graphql-ws` library uses a different subprotocol, `graphql-transport-ws`, and message types such as `subscribe`, `next`, and `complete`. The Midnight indexer accepts the legacy protocol shown here, which is why the hand-rolled code works. If you use a different GraphQL client, make sure you match the protocol it expects.
````

**Result:** Readers will not be misdirected when debugging handshakes.

---

## 4. Pinned SDK versions

**Feedback:** No `@midnight-ntwrk/*` versions were stated anywhere.

### Before: Package dump inside Prerequisites

````markdown
## Prerequisites

- Node.js installed (v20+)
- A Midnight Wallet (e.g., 1AM or Lace)
- Some Preprod [faucet](https://faucet.preprod.midnight.network/) NIGHT tokens
- An existing Midnight DApp with a deployed smart contract
- The smart contract compiled so its JS bindings exist (e.g., `/contracts/managed/<name>/contract/index.js`)
- `INDEXER_HTTP` and `INDEXER_WS` constants pointing to the Preprod indexer
- A [`package.json`](https://github.com/0xfdbu/midnight-apps/blob/main/unshielded-token/package.json) with the needed packages:
  - `@midnight-ntwrk/midnight-js-indexer-public-data-provider`
  - `@midnight-ntwrk/midnight-js-contracts`
  - ... (long list)
````

### After: Short Prerequisites + Dependencies table

````markdown
## Prerequisites

- Node.js installed (v20+)
- Git
- A Midnight wallet extension (e.g., 1AM or Lace)
- Some Preprod [faucet](https://faucet.preprod.midnight.network/) NIGHT tokens
- A deployed Midnight smart contract (the repo includes one you can deploy, or you can use your own)

## Dependencies

The project builds on the Midnight.js SDK. These packages handle the heavy lifting:

| Package | Version | Purpose |
|---|---|---|
| `@midnight-ntwrk/midnight-js-indexer-public-data-provider` | `4.0.4` | On-chain state queries and streaming subscriptions |
| `@midnight-ntwrk/midnight-js-contracts` | `4.0.4` | Contract deployment and calls |
| `@midnight-ntwrk/midnight-js-types` | `4.0.4` | Shared TypeScript types |
| `@midnight-ntwrk/midnight-js-fetch-zk-config-provider` | `4.0.4` | ZK config fetching |
| `@midnight-ntwrk/midnight-js-level-private-state-provider` | `4.0.4` | Local private-state storage |
| `@midnight-ntwrk/midnight-js-network-id` | `4.0.4` | Network identification helpers |
| `@midnight-ntwrk/dapp-connector-api` | `4.0.1` | Wallet connector API |
| `@midnight-ntwrk/compact-runtime` | `0.15.0` | Ledger deserialization |
| `@midnight-ntwrk/ledger-v8` | `8.0.3` | Transaction serialization |
| `react`, `react-dom`, `react-router-dom` | — | Frontend framework |
| `zustand` | — | State management |

Run `npm install` to install them automatically. See [`package.json`](https://github.com/0xfdbu/midnight-unshielded-token/blob/main/package.json) for the full list.
````

**Result:** Readers can reproduce the tutorial against exact, known-good package versions.

---

## 5. Clarified the `queryZSwapAndContractState` tuple shape

**Feedback:** The tutorial destructured `queryZSwapAndContractState` as a three-tuple `[ZswapChainState, ContractState, LedgerParameters]`, while some references type it as a two-tuple `[ZswapChainState, ContractState]`.

### Code stays the same

```typescript
const [zswapState, contractState, ledgerParams] = result;
```

### New note added after the snippet

````markdown
> **Tuple-shape note:** The destructuring `const [zswapState, contractState, ledgerParams] = result` returns three elements in `@midnight-ntwrk/midnight-js-indexer-public-data-provider` **4.0.4**. Some other versions type the return as a two-tuple `[ZswapChainState, ContractState]`. If you see a type error or runtime mismatch, adjust the destructuring to match your installed version.
````

**Result:** The three-tuple claim is now checkable against a stated version.

---

## 6. Added explicit starting point with project setup

**Feedback:** The tutorial needed an explicit clone step and project structure before diving into code.

### New Section 2: Project setup

````markdown
## Project setup

Start with the standalone repository:

```bash
git clone https://github.com/0xfdbu/midnight-unshielded-token.git
cd midnight-unshielded-token
npm install
```

The finished project structure looks like this:

```text
midnight-unshielded-token/
├── contracts/
│   └── Contract.compact                 # Example unshielded token vault smart contract
├── scripts/
│   └── go.ts                            # Deployment helper
├── src/
│   ├── hooks/
│   │   ├── useContractState.ts          # Real-time smart contract-state hook
│   │   └── wallet/
│   │       ├── wallet.constants.ts      # Indexer / network constants
│   │       └── services/
│   │           └── contractCalls.ts     # Query helpers
│   ├── components/
│   └── App.tsx
├── package.json
├── states_tutorial.md                   # This guide
└── tutorial.md                          # Deploy-and-run guide
```

Run the frontend with `npm run dev`.
````

**Result:** The clone-and-follow path is now clear and matches the structure used in `midnight-attestation-dapp/tutorial.md`.

---

## 7. Style.md compliance: smart contract terminology

**Feedback / Style check:** `Style.md` requires "smart contract" instead of "contract" in prose.

### Prose changes

| Location | Before | After |
|---|---|---|
| Project structure tree | `Example unshielded token vault contract` | `Example unshielded token vault smart contract` |
| Project structure tree | `Real-time contract-state hook` | `Real-time smart contract-state hook` |
| Ledger table | `The contract's ledger state` | `The smart contract's ledger state` |
| Provider table | `when the contract changes` | `when the smart contract changes` |
| Image alt text | `Console output showing contract state balance logs` | `Console output showing smart contract state balance logs` |
| Token color section | `It reads the contract's balance map... held by the contract` | `It reads the smart contract's balance map... held by the smart contract` |
| UI section | `from the contract's balance map` | `from the smart contract's balance map` |
| Observable section | `part of the contract state observable` | `part of the smart contract state observable` |
| Conclusion | `from the contract's balance map` | `from the smart contract's balance map` |
| Next steps | `Deploy a hello-world contract` | `Deploy a hello-world smart contract` |

**Result:** Prose is now Style.md-compliant. Code identifiers (`queryContractState`, `ContractState`, `contractAddress`, etc.) were left unchanged.

---

## 8. Source-code changes

The tutorial changes were backed by matching source-code changes. Only two source files ended up permanently different from the monorepo version; other files (e.g., `wallet.constants.ts`, `App.tsx`, `scripts/go.ts`) were temporarily switched between Preprod and Preview during testing and are now back to Preprod, matching the original monorepo state.

### `src/hooks/useContractState.ts`

**Before:** Raw WebSocket subscription with manual reconnect, debounce, and cleanup.

```typescript
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  INDEXER_WS,
} from './wallet/wallet.constants';
import {
  getContractState,
  getContractBalance,
  getUserTokenBalance,
} from './wallet/services/contractCalls';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

export function useContractState(
  connectedApi: ConnectedAPI | null,
  contractAddress: string | null,
  selectedTokenId: string | null,
  opts: { pollInterval?: number } = {}
) {
  // ... refs for wsRef, reconnectRef, lastBlockRef, intentionalCloseRef ...

  // WebSocket subscription for push updates
  useEffect(() => {
    if (!connectedApi || !contractAddress) return;

    let ws: WebSocket | null = null;
    let reconnectDelay = 1000;
    const maxReconnectDelay = 30000;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const DEBOUNCE_MS = 500;

    function connect() {
      ws = new WebSocket(INDEXER_WS, 'graphql-ws');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[useContractState] Socket: connected');
        reconnectDelay = 1000;
        ws!.send(JSON.stringify({ type: 'connection_init' }));
        ws!.send(JSON.stringify({
          id: 'contract-state-sub',
          type: 'start',
          payload: {
            query: `
              subscription ContractStateUpdates($address: HexEncoded!) {
                contractActions(address: $address) {
                  state
                  transaction { block { height } }
                }
              }
            `,
            variables: { address: contractAddress },
          },
        }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'data' && msg.payload?.data?.contractActions) {
            const action = msg.payload.data.contractActions;
            const blockHeight = action.transaction?.block?.height;
            if (blockHeight && blockHeight !== lastBlockRef.current) {
              lastBlockRef.current = blockHeight;
              if (debounceTimer) clearTimeout(debounceTimer);
              debounceTimer = setTimeout(() => {
                console.log('[useContractState] Socket: debounced fetch for block', blockHeight);
                fetchState();
                debounceTimer = null;
              }, DEBOUNCE_MS);
            }
          }
          if (msg.type === 'ka') {
            // Keep-alive, ignore
          }
        } catch (e) {
          console.error('[useContractState] Failed to parse message:', e);
        }
      };

      ws.onerror = (err) => {
        if (ws && intentionalCloseRef.current.has(ws)) return;
        console.error('[useContractState] WebSocket error:', err);
      };

      ws.onclose = () => {
        if (ws && intentionalCloseRef.current.has(ws)) {
          console.log('[useContractState] Socket: closed intentionally');
          return;
        }
        console.log(`[useContractState] Socket: disconnected, reconnecting in ${reconnectDelay}ms...`);
        if (reconnectRef.current) clearTimeout(reconnectRef.current);
        reconnectRef.current = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
          connect();
        }, reconnectDelay);
      };
    }

    connect();

    return () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (ws) {
        intentionalCloseRef.current.add(ws);
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ id: 'contract-state-sub', type: 'stop' })); } catch {}
          ws.close();
        }
      }
    };
  }, [connectedApi, fetchState, contractAddress, selectedTokenId]);

  return { state, loading, error, refetch: fetchState };
}
```

**After:** `contractStateObservable` from `indexerPublicDataProvider`, with direct logging of the emitted `ContractState`.

```typescript
import { useState, useEffect, useCallback } from 'react';
import { INDEXER_HTTP, INDEXER_WS, CONTRACT_PATH } from './wallet/wallet.constants';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import {
  getContractState,
  getContractBalance,
  getUserTokenBalance,
} from './wallet/services/contractCalls';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { Subscription } from 'rxjs';

export function useContractState(
  connectedApi: ConnectedAPI | null,
  contractAddress: string | null,
  selectedTokenId: string | null,
  opts: { pollInterval?: number } = {}
) {
  // ... no WebSocket refs needed ...

  // Primary: indexer-backed contract state observable for push updates
  useEffect(() => {
    if (!contractAddress) {
      setLoading(false);
      return;
    }

    const publicDataProvider = indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS);
    let subscription: Subscription;

    try {
      subscription = publicDataProvider
        .contractStateObservable(contractAddress, { type: 'latest' })
        .subscribe({
          next: async (contractState) => {
            console.log('[useContractState] Observable: raw contractState emitted', contractState);
            console.log('[useContractState] Observable: contractState.balance', contractState.balance);

            try {
              const contractModule = await import(CONTRACT_PATH + '/contract/index.js');
              const ledgerState = contractModule.ledger(contractState.data);
              console.log('[useContractState] Observable: deserialized ledger state', {
                totalSupply: ledgerState.totalSupply.toString(),
                totalBurned: ledgerState.totalBurned.toString(),
                burnedBalance: ledgerState.burnedBalance.toString(),
              });
            } catch (e) {
              console.error('[useContractState] Observable: failed to deserialize emitted contractState', e);
            }

            fetchState();
          },
          error: (err) => {
            console.error('[useContractState] Observable error:', err);
          },
        });
    } catch (err: any) {
      console.error('[useContractState] Failed to start observable:', err);
      setError(err.message);
      setLoading(false);
      return;
    }

    return () => {
      subscription?.unsubscribe();
    };
  }, [contractAddress, fetchState]);

  return { state, loading, error, refetch: fetchState };
}
```

**Key differences:**
- Removed all raw WebSocket refs, reconnect logic, debounce timer, and `intentionalCloseRef` WeakSet.
- Added `indexerPublicDataProvider` and `Subscription` from `rxjs`.
- Added `INDEXER_HTTP` import because the provider needs both HTTP and WS URLs.
- Added `CONTRACT_PATH` import for deserializing the emitted `ContractState`.
- The observable `next` handler now receives `contractState` and logs it raw, its balance, and its deserialised ledger fields before calling `fetchState()`.
- Cleanup is a single `subscription?.unsubscribe()`.

### `src/pages/Home.tsx`

**Before:**

```typescript
<a
  href="https://github.com/0xfdbu/midnight-apps/unshielded-token"
  target="_blank"
  rel="noopener noreferrer"
>
```

**After:**

```typescript
<a
  href="https://github.com/0xfdbu/midnight-unshielded-token"
  target="_blank"
  rel="noopener noreferrer"
>
```

**Result:** The **View Source** button now points to the standalone repository.

### Screenshot update

- Replaced the old observable console-log image (`36rglo0x9oaa3zs261w9.png`) with a new screenshot (`z7z4k4ioysti80rkc7qg.png`) that matches the latest logging output.

---

## 9. Standalone repository extraction

**Feedback:** The project originally lived in a subfolder of the larger `midnight-apps` monorepo.

### Link updates

| Before | After |
|---|---|
| `https://github.com/0xfdbu/midnight-apps/tree/main/unshielded-token` | `https://github.com/0xfdbu/midnight-unshielded-token` |
| `https://github.com/0xfdbu/midnight-apps/blob/main/unshielded-token/package.json` | `https://github.com/0xfdbu/midnight-unshielded-token/blob/main/package.json` |
| `https://github.com/0xfdbu/midnight-apps/blob/main/unshielded-token/contracts/Contract.compact` | `https://github.com/0xfdbu/midnight-unshielded-token/blob/main/contracts/Contract.compact` |

### New files in standalone repo

- `.gitignore` — ignores `node_modules/`, keeps compiled contracts tracked
- `CHANGELOG.md` — this file

**Result:** The project is now a clean, standalone repository.

---

## 10. Other minor wording and formatting changes

The following smaller changes were also made and are visible in the full `diff -u` output:

| Location | Before | After |
|---|---|---|
| Section order | `Prerequisites` → `Summary` | `Summary` → `Project setup` → `Prerequisites` → `Dependencies` |
| Section 6 intro | `called / deployed` | `called or deployed` |
| Polling note | `If you want to enable/disable polling fallback` | `If you want to enable or disable polling fallback` |
| Prerequisites | `A Midnight Wallet (e.g., 1AM or Lace)` | `A Midnight wallet extension (e.g., 1AM or Lace)` |
| Prerequisites | — | Added `Git` |

---

## Files changed

- `states_tutorial.md` — comprehensive refactor
- `src/hooks/useContractState.ts` — observable-based updates + direct logging
- `src/hooks/wallet/wallet.constants.ts` — network constants
- `src/lib/constants.ts` — network constant
- `src/pages/Home.tsx` — standalone repo link
- `src/App.tsx` — network connect string
- `src/components/ui/ConnectButton.tsx` — network connect string
- `src/hooks/wallet/services/contractCalls.ts` — network id + address decoding
- `src/pages/Deploy.tsx` — network id
- `scripts/go.ts` — deployment script network config
- `.gitignore` — added
- `CHANGELOG.md` — added

---

## What was intentionally not changed

- `Methodology.md` remains in the old monorepo only; standalone repos do not include it.
- The raw WebSocket "Under the hood" section was kept because it accurately reflects the legacy protocol the Midnight indexer speaks.

---

## Note on `tutorial.md` front matter

After the initial refactor, the `tutorial.md` opening still had a long package list inside `## Prerequisites`, making it feel like a dump. It was restructured to match the cleaner layout used in `states_tutorial.md`:

- Added `## Project setup` with clone/install steps and a finished project structure tree.
- Kept `## Prerequisites` short (Node.js, wallet, faucet tokens, deployed smart contract).
- Moved all package details into a new `## Dependencies` section with a purpose column.

**Result:** The deploy-and-run tutorial now starts with the same clear clone-and-follow path as the state-reading tutorial.
