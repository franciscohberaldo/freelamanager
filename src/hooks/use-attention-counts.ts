"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface AttentionCounts {
  /** Invoices past their due date and still unpaid. */
  overdueInvoices: number
  /** Deals that have not moved in a week. */
  stalledDeals: number
  /** Notas fiscais requested more than seven days ago and not yet issued. */
  stalledNfs: number
}

const EMPTY: AttentionCounts = { overdueInvoices: 0, stalledDeals: 0, stalledNfs: 0 }

/** What needs a look today — feeds the sidebar badges and the bell in the top bar. */
export function useAttentionCounts(): AttentionCounts {
  const [counts, setCounts] = useState<AttentionCounts>(EMPTY)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function load() {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const since = sevenDaysAgo.toISOString()

      const [{ count: overdue }, { count: stalled }, { count: nfs }] = await Promise.all([
        supabase.from("invoices").select("*", { count: "exact", head: true }).eq("status", "overdue"),
        supabase.from("sales_pipeline").select("*", { count: "exact", head: true })
          .not("stage", "in", '("won","lost")').lt("updated_at", since),
        supabase.from("invoices").select("*", { count: "exact", head: true })
          .eq("nf_status", "requested").lt("nf_requested_at", since),
      ])
      if (cancelled) return
      setCounts({ overdueInvoices: overdue ?? 0, stalledDeals: stalled ?? 0, stalledNfs: nfs ?? 0 })
    }

    load()
    return () => { cancelled = true }
  }, [])

  return counts
}
