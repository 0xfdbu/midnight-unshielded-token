# Changelog: `states_tutorial.md` refactor for `midnight-unshielded-token`

> This log compares the original `unshielded-token/states_tutorial.md` from the `midnight-apps` monorepo with the current standalone tutorial. It documents the mentor feedback that was applied and the resulting edits.

---

## 1. Fixed the core claim about `indexerPublicDataProvider`

**Feedback:** The article falsely claimed that `indexerPublicDataProvider` "does not surface subscriptions directly" and therefore required a raw WebSocket workaround.

**Changes:**
- Rewrote Section 1 to state that the provider exposes **streaming subscriptions**.
- Added `contractStateObservable(address, config)` to the provider methods table.
- Added a note explaining that `contractStateObservable` is the same `contractActions` GraphQL subscription, but the provider manages the WebSocket handshake, reconnects, message parsing, and RxJS cleanup.
- Mentioned that the official Midnight bulletin-board UI uses this exact API.

**Result:** The tutorial now teaches the supported SDK API instead of presenting raw WebSocket as the only path.

---

## 2. Restructured real-time updates around `contractStateObservable`

**Feedback:** For a bounty whose deliverables are "using `indexerPublicDataProvider`" and "WebSocket subscriptions for real-time updates," the tutorial must teach the supported API as primary.

**Changes:**
- Renamed Section 6 from **"Real-time updates with WebSocket subscriptions"** to **"Real-time updates with `contractStateObservable`"**.
- Replaced the leading raw-WebSocket code block with an `indexerPublicDataProvider(...).contractStateObservable(...)` example.
- Added a second snippet showing how to use the emitted `ContractState` directly.
- Updated the `useContractState` hook code block to match the refactored source code (`indexerPublicDataProvider` + `Subscription` from `rxjs`).
- Moved the old raw-WebSocket code into a new **"Under the hood: raw WebSocket"** subsection, framed as optional/low-level.

**Result:** `contractStateObservable` is now the primary path; raw WebSocket is preserved as a valuable reference, not a replacement.

---

## 3. Corrected the backwards protocol note

**Feedback:** The closing note incorrectly labeled the hand-rolled WebSocket code as modern `graphql-ws`. In reality, the code uses the legacy `subscriptions-transport-ws` protocol (subprotocol string `graphql-ws`, messages `connection_init`/`start`/`data`/`ka`/`stop`). The modern `graphql-ws` library uses `graphql-transport-ws` with `subscribe`/`next`/`complete`.

**Changes:**
- Rewrote the protocol note to correctly identify the legacy protocol.
- Explained the confusing subprotocol-string overlap.
- Clarified that the Midnight indexer accepts the legacy protocol, which is why the code works.

**Result:** Readers will not be misdirected when debugging handshakes.

---

## 4. Pinned SDK versions

**Feedback:** No `@midnight-ntwrk/*` versions were stated anywhere.

**Changes:**
- Added a **Dependencies** section with a table of exact installed versions:
  - `midnight-js-*` packages: `4.0.4`
  - `@midnight-ntwrk/dapp-connector-api`: `4.0.1`
  - `@midnight-ntwrk/compact-runtime`: `0.15.0`
  - `@midnight-ntwrk/ledger-v8`: `8.0.3`
- Added a note that return types may differ on other releases.

**Result:** Readers can reproduce the tutorial against known-good package versions.

---

## 5. Clarified the `queryZSwapAndContractState` tuple shape

**Feedback:** The tutorial destructured `queryZSwapAndContractState` as a three-tuple `[ZswapChainState, ContractState, LedgerParameters]`, while some references type it as a two-tuple `[ZswapChainState, ContractState]`.

**Changes:**
- Added a **Tuple-shape note** in Section 2.
- Explicitly attributed the three-tuple shape to `@midnight-ntwrk/midnight-js-indexer-public-data-provider` **4.0.4**.
- Noted that other versions may return a two-tuple and readers should adjust accordingly.

**Result:** The claim is now checkable against a stated version.

---

## 6. Restructured prerequisites and added project setup

**Feedback:** Prerequisites were a package dump. The tutorial needed a short bulleted list, a separate dependency section, and an explicit starting point with clone instructions and project structure.

**Changes:**
- Added a **Project setup** section with:
  - `git clone` command
  - `npm install`
  - Project structure tree
  - `npm run dev`
- Shortened **Prerequisites** to a bulleted list (Node.js, Git, wallet, faucet tokens, deployed contract).
- Moved the full package list into a **Dependencies** section with pinned versions and purposes.

**Result:** The tutorial now matches the structure used in `midnight-attestation-dapp/tutorial.md`.

---

## 7. Style.md compliance — "smart contract" terminology

**Feedback / Style check:** `Style.md` requires "smart contract" instead of "contract" in prose.

**Changes:**
- Updated all prose instances of standalone "contract" to "smart contract" in:
  - Project structure comments
  - Table descriptions
  - Image alt text
  - Body paragraphs
  - Next steps list
- Left code identifiers unchanged (`queryContractState`, `ContractState`, `contractAddress`, etc.).

**Result:** Prose is now Style.md-compliant without breaking code references.

---

## 8. Source-code changes reflected in the tutorial

**Changes that kept the tutorial in sync with the working code:**
- Refactored `src/hooks/useContractState.ts` to use `contractStateObservable` as the primary update path.
- Updated network configuration in source files and `scripts/go.ts` (Preprod ↔ Preview migration was tested; final committed state is Preprod).
- Fixed the **View Source** link in `src/pages/Home.tsx` to point to the standalone repo (`https://github.com/0xfdbu/midnight-unshielded-token`).
- Added a console-log screenshot showing `[useContractState] Observable: contract state changed, refetching`.

---

## 9. Standalone repository extraction

**Feedback:** The project originally lived in a subfolder of the larger `midnight-apps` monorepo.

**Changes:**
- Moved `unshielded-token/` into its own repo: `midnight-unshielded-token`.
- Updated internal links and the **View Source** button to point to the standalone repo.
- Added `.gitignore` for `node_modules/` while keeping compiled contracts tracked.

**Result:** The clone-and-follow path is now clean.

---

## Files changed

- `states_tutorial.md` — comprehensive refactor
- `src/hooks/useContractState.ts` — observable-based updates
- `src/hooks/wallet/wallet.constants.ts` — network constants
- `src/lib/constants.ts` — network constant
- `src/pages/Home.tsx` — standalone repo link
- `src/App.tsx` — network connect string
- `src/components/ui/ConnectButton.tsx` — network connect string
- `src/hooks/wallet/services/contractCalls.ts` — network id
- `src/pages/Deploy.tsx` — network id
- `scripts/go.ts` — deployment script network config
- `.gitignore` — added

---

## What was intentionally not changed

- `Methodology.md` remains in the old monorepo only; standalone repos do not include it.
- The raw WebSocket "Under the hood" section was kept (per discussion) because it accurately reflects the legacy protocol the Midnight indexer speaks, and removing it would waste a genuinely valuable reference.
