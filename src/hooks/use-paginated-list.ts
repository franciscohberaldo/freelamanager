"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Database } from "@/lib/supabase/types"

type TableName = keyof Database["public"]["Tables"]
type RowType<T extends TableName> = Database["public"]["Tables"][T]["Row"]

type Filter = {
  column: string
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "is"
  value: unknown
}

type OrderBy = {
  column: string
  ascending?: boolean
}

type UsePaginatedListParams<T extends TableName> = {
  table: T
  select?: string
  filters?: Filter[]
  orderBy?: OrderBy
  pageSize?: number
  initialData: RowType<T>[]
  initialCount: number
}

type UsePaginatedListReturn<T extends TableName> = {
  items: RowType<T>[]
  loadMore: () => Promise<void>
  hasMore: boolean
  loading: boolean
}

export function usePaginatedList<T extends TableName>({
  table,
  select = "*",
  filters = [],
  orderBy,
  pageSize = 25,
  initialData,
  initialCount,
}: UsePaginatedListParams<T>): UsePaginatedListReturn<T> {
  const [items, setItems] = useState<RowType<T>[]>(initialData)
  const [loading, setLoading] = useState(false)
  const [totalCount] = useState(initialCount)

  const hasMore = items.length < totalCount

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return

    setLoading(true)
    try {
      const supabase = createClient()
      const from = items.length
      const to = from + pageSize - 1

      let query = supabase
        .from(table)
        .select(select, { count: "exact" })
        .range(from, to)

      for (const f of filters) {
        query = query.filter(f.column, f.op, f.value)
      }

      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
      }

      const { data, error } = await query

      if (error) {
        console.error(`usePaginatedList: failed to fetch ${table}`, error)
        return
      }

      if (data) {
        setItems((prev) => [...prev, ...(data as unknown as RowType<T>[])])
      }
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, items.length, pageSize, table, select, filters, orderBy])

  return { items, loadMore, hasMore, loading }
}
