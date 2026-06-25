// useVault.js — fetches vault state and re-fetches live when the vault changes.

import React from "react";
import { fetchState, subscribe } from "../lib/vaultClient.js";

export function useVault() {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const reload = React.useCallback(async () => {
    try {
      const next = await fetchState();
      setData(next);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    reload();
    const unsubscribe = subscribe(reload); // live refresh on vault edits
    return unsubscribe;
  }, [reload]);

  return { data, loading, error, reload };
}
