"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

type LoadMoreButtonProps = {
  hasMore: boolean
  loading: boolean
  onClick: () => void
}

export function LoadMoreButton({ hasMore, loading, onClick }: LoadMoreButtonProps) {
  if (!hasMore) return null

  return (
    <div className="flex justify-center pt-4">
      <Button variant="outline" onClick={onClick} disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Carregar mais
      </Button>
    </div>
  )
}
