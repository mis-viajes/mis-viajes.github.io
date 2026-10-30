import type { Session } from "@supabase/supabase-js";
import { Plane } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { buttonStyles, Card } from "@/components/ui";
import { isTestMode, supabase } from "@/lib/supabase";

type AuthState = { email: string | null; signOut: () => Promise<void> };
const AuthContext = createContext<AuthState>({ email: null, signOut: async () => {} });
export const useAuth = () => useContext(AuthContext);

/**
 * Inicio de sesión con la misma cuenta de Supabase que Mi Día, Finanzas y Kratos.
 * Como todas viven en diego94diaz-oss.github.io, si ya hay sesión en otra app, se reutiliza.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(isTestMode ? null : undefined);

  useEffect(() => {
    if (isTestMode) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (isTestMode) return <AuthContext.Provider value={{ email: "modo de prueba", signOut }}>{children}</AuthContext.Provider>;
  if (session === undefined) return <div className="grid min-h-dvh place-items-center text-sm text-muted">Cargando…</div>;
  if (!session) return <Login />;
  return <AuthContext.Provider value={{ email: session.user.email ?? null, signOut }}>{children}</AuthContext.Provider>;
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setPending(false);
    if (error) setError(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2 text-lg font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-ink">
            <Plane size={18} />
          </span>
          Travel Manager
        </div>
        <p className="mb-4 text-sm text-muted">Inicia sesión con la misma cuenta que usas en Mi Día, Finanzas y Kratos.</p>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="email" className="text-xs font-medium text-muted">Correo</label>
            <input id="email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-xs font-medium text-muted">Contraseña</label>
            <input id="password" type="password" autoComplete="current-password" required className="field" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" className={`${buttonStyles.primary} w-full`} disabled={pending}>
            {pending ? "Entrando…" : "Iniciar sesión"}
          </button>
        </form>
      </Card>
    </div>
  );
}
