import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { onBecameOnline } from "@/lib/network";
import { syncNow } from "@/lib/sync";

export function SyncProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();

  useEffect(() => {
    void getDb();
  }, []);

  useEffect(() => {
    if (!token) return;
    void syncNow();
    return onBecameOnline(() => {
      void syncNow();
    });
  }, [token]);

  return children;
}
