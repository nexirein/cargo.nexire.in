"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SummaryAutoRefresh({ batchRunId }: { batchRunId: string }) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`summary-${batchRunId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "batch_items",
          filter: `batch_run_id=eq.${batchRunId}`,
        },
        () => router.refresh(),
      )
      .subscribe();

    // Fallback polling every 30s
    intervalRef.current = setInterval(() => router.refresh(), 30_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalRef.current);
    };
  }, [batchRunId, router]);

  return null;
}
