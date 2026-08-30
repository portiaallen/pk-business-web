export function getInventoryAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_INVENTORY_URL?.trim() ||
    (process.env.NODE_ENV === "production"
      ? "https://inventory.pkservices.business"
      : "http://localhost:4322")
  );
}

export function getMainAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_MAIN_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    (process.env.NODE_ENV === "production"
      ? "https://www.pkservices.business"
      : "http://localhost:4321")
  );
}
