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

export interface ContractStateSnapshot {
  totalSupply: bigint;
  totalBurned: bigint;
  burnedBalance: bigint;
  contractBalance: bigint;
  walletBalance: bigint;
  blockHeight?: number;
}

export function useContractState(
  connectedApi: ConnectedAPI | null,
  contractAddress: string | null,
  selectedTokenId: string | null,
  opts: { pollInterval?: number } = {}
) {
  const { pollInterval = 15000 } = opts;
  const [state, setState] = useState<ContractStateSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    if (!contractAddress) {
      setState(null);
      setLoading(false);
      return;
    }
    try {
      const [s, cb, wb] = await Promise.all([
        getContractState(contractAddress),
        selectedTokenId ? getContractBalance(contractAddress, selectedTokenId) : Promise.resolve(0n),
        connectedApi && selectedTokenId ? getUserTokenBalance(connectedApi, selectedTokenId) : Promise.resolve(0n),
      ]);
      // Usable contract balance = raw balance minus tokens that were burned into the contract
      const usableContractBalance = cb > s.burnedBalance ? cb - s.burnedBalance : 0n;
      setState({
        totalSupply: s.totalSupply,
        totalBurned: s.totalBurned,
        burnedBalance: s.burnedBalance,
        contractBalance: usableContractBalance,
        walletBalance: wb,
      });
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connectedApi, contractAddress, selectedTokenId]);

  // Initial fetch + polling fallback (also catches wallet-balance changes that the indexer stream misses)
 
  useEffect(() => {
    if (!contractAddress) {
      setLoading(false);
      return;
    }
    fetchState();
    const id = setInterval(() => {
      fetchState();
    }, pollInterval);
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
