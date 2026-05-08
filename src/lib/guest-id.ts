// Stable per-browser id for guest audience members. Persists in localStorage.
const KEY = "walk_guest_id";

export function getGuestId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 36);
      window.localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
