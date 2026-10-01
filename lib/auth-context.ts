import { createContext, useContext } from "react";
import type { Session } from "@supabase/supabase-js";

export const AuthContext = createContext<{ session: Session | null }>({ session: null });
export const useAuth = () => useContext(AuthContext);
