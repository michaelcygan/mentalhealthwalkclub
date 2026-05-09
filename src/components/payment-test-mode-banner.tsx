const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;
  return (
    <div className="w-full border-b border-amber-300 bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
      Test mode — payments use sandbox cards (e.g. <span className="font-mono">4242 4242 4242 4242</span>).
    </div>
  );
}
