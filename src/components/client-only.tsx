import { useEffect, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only after the client has hydrated. Returns the optional
 * fallback (or null) during SSR and the initial hydration pass. Use this to
 * gate components that import browser-only libraries (e.g. Leaflet) or make
 * auth-required client calls that should not run on the server.
 */
export function ClientOnly({ children, fallback = null }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return fallback;
  return children;
}
