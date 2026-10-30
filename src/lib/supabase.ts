import { createClient } from "@supabase/supabase-js";

/**
 * Proyecto Supabase COMPARTIDO con Mi Día, Finanzas y Kratos. La clave publicable es
 * pública por diseño: los datos se protegen con Row Level Security + inicio de sesión.
 * En GitHub Pages todas las apps comparten origen, así que la sesión de Mi Día sirve aquí.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ivzzgeoeygggaoazcoeq.supabase.co";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_G2liTTYj_Ik4LCmh0b2rNw_mPukyFlD";

/** Solo para pruebas locales contra PostgREST: token fijo en lugar del inicio de sesión. */
const TEST_TOKEN = import.meta.env.VITE_TEST_ACCESS_TOKEN as string | undefined;

export const supabase = TEST_TOKEN
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { accessToken: async () => TEST_TOKEN })
  : createClient(SUPABASE_URL, SUPABASE_KEY);

export const isTestMode = Boolean(TEST_TOKEN);

export const DOCS_BUCKET = "tm-documentos";
