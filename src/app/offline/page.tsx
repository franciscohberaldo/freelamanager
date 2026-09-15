"use client"

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-6">
      <div className="text-5xl">📡</div>
      <h1 className="text-3xl font-light tracking-tight">Sem conexão</h1>
      <p className="text-muted-foreground max-w-sm">
        Você está offline. Algumas páginas visitadas recentemente podem estar disponíveis.
        Verifique sua conexão e tente novamente.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
      >
        Tentar novamente
      </button>
    </div>
  )
}
