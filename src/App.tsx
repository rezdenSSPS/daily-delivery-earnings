import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "./integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import Dashboard from "./pages/Index";
import AuthPage from "./pages/Auth";
import { ThemeProvider } from "./components/theme-provider";

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // První načtení: Zkusíme získat session. Toto je klíčové.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false); // Ukončíme načítání, AŽ KDYŽ máme odpověď.
    });

    // Následně nasloucháme změnám (přihlášení/odhlášení)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Při odpojení komponenty přestaneme naslouchat
    return () => subscription.unsubscribe();
  }, []);

  // Dokud se nenačetla informace o session, zobrazíme jednoduchou načítací obrazovku
  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            Načítání...
        </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <div className="min-h-screen bg-background text-foreground">
            {/* Rozhodnutí, co zobrazit, děláme až po načtení */}
            {!session ? <AuthPage /> : <Dashboard key={session.user.id} session={session} />}
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
