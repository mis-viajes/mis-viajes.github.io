import type { Session } from "@supabase/supabase-js";
import { Plane } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { buttonStyles, Card } from "@/components/ui";
import { clearOfflineData, isNetworkError } from "@/lib/offline";
import { isTestMode, supabase } from "@/lib/supabase";

type AuthState = { email: string | null; signOut: () => Promise<void> };
const AuthContext = createContext<AuthState>({ email: null, signOut: async () => {} });
export const useAuth = () => useContext(AuthContext);

/**
 * Inicio de sesión con la misma cuenta de Supabase que Mi Día, Finanzas y Kratos.
 * Esta app tiene origen propio (mis-viajes.github.io): la sesión se inicia aquí.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(isTestMode ? null : undefined);

  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (isTestMode) return;
    // Sin internet no se puede renovar el token vencido. Eso no es un cierre de sesión:
    // si queda una sesión guardada, se entra en modo consulta con la copia local.
    let watchdog: ReturnType<typeof setTimeout>;
    const enterOffline = () => {
      setOffline(true);
      setSession((s) => s ?? null);
    };
    const load = () => {
      // getSession reintenta renovar el token durante unos 30 s: no se hace esperar en la pantalla de carga.
      clearTimeout(watchdog);
      if (hasStoredSession()) watchdog = setTimeout(enterOffline, navigator.onLine ? 5000 : 0);
      return supabase.auth.getSession().then(({ data, error }) => {
        clearTimeout(watchdog);
        const cutOff = !data.session && (!navigator.onLine || (error !== null && isNetworkError(error))) && hasStoredSession();
        if (cutOff) return enterOffline();
        setOffline(false);
        setSession(data.session);
      });
    };
    load();
    window.addEventListener("online", load);
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s || navigator.onLine) setSession(s);
    });
    return () => {
      clearTimeout(watchdog);
      window.removeEventListener("online", load);
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await clearOfflineData();
    await supabase.auth.signOut();
  };

  if (isTestMode) return <AuthContext.Provider value={{ email: "modo de prueba", signOut }}>{children}</AuthContext.Provider>;
  if (session === undefined) return <div className="grid min-h-dvh place-items-center text-sm text-muted">Cargando…</div>;
  if (!session && offline) return <AuthContext.Provider value={{ email: null, signOut }}>{children}</AuthContext.Provider>;
  if (!session) return <Login />;
  return <AuthContext.Provider value={{ email: session.user.email ?? null, signOut }}>{children}</AuthContext.Provider>;
}

/** supabase-js guarda la sesión en localStorage como sb-<proyecto>-auth-token. */
function hasStoredSession(): boolean {
  try {
    return Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k));
  } catch {
    return false;
  }
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
