const badges = [
  { title: "Authentic hand print", text: "Genuine Bagru hand block printing" },
  { title: "7-day easy returns", text: "See our return policy for details" },
  { title: "Free shipping", text: "On all orders" },
  { title: "COD available", text: "Pay on delivery across India" },
] as const;

export function TrustBadges() {
  return (
    <ul
      aria-label="Our promises"
      className="border-border mt-8 grid grid-cols-2 gap-3 border-t pt-6"
    >
      {badges.map((b) => (
        <li key={b.title} className="text-sm">
          <p className="font-semibold">{b.title}</p>
          <p className="text-muted text-xs">{b.text}</p>
        </li>
      ))}
    </ul>
  );
}
