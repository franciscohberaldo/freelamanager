"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, Copy, Loader2, LogOut } from "lucide-react"

/**
 * Who you are signed in as, and the two things you may want to do about it. The user id is
 * only ever needed to paste into a support message, so it is a button rather than a wall of
 * hex on the page.
 */
export function AccountCard({ email, userId }: { email: string | null; userId: string | null }) {
  const supabase = createClient()
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)

  async function copyId() {
    if (!userId) return
    try {
      await navigator.clipboard.writeText(userId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Não consegui copiar")
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error("Senhas não coincidem"); return }
    if (password.length < 6) { toast.error("Mínimo 6 caracteres"); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { toast.error("Erro ao alterar senha"); return }
    toast.success("Senha alterada!")
    setPassword("")
    setConfirm("")
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <Card id="conta" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="text-base">Conta</CardTitle>
        <CardDescription>Quem está logado, e como sair ou trocar a senha.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm">{email ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Sessão atual</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copyId} disabled={!userId}>
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copiado" : "Copiar ID"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-3 h-3" />
              Sair
            </Button>
          </div>
        </div>

        <form onSubmit={changePassword} className="space-y-3 pt-4 border-t">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alterar senha</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="new-password" className="text-xs">Nova senha</Label>
              <Input
                id="new-password" type="password" autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirm-password" className="text-xs">Confirmar senha</Label>
              <Input
                id="confirm-password" type="password" autoComplete="new-password"
                value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••"
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={loading || !password}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Alterar senha
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
