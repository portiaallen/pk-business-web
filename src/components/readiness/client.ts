export async function readinessFetch(
  path: string,
  clientId?: string,
  input?: object,
) {
  const response = await fetch(path, {
    cache: "no-store",
    ...(input ? { method: "POST", body: JSON.stringify(input) } : {}),
    headers: {
      ...(clientId ? { "x-pk-client-context": clientId } : {}),
      ...(input ? { "Content-Type": "application/json" } : {}),
    },
  });
  const data = await response
    .json()
    .catch(() => ({ error: "Operation unavailable" }));
  if (!response.ok) throw new Error(data.error || "Operation unavailable");
  return data;
}
export async function currentClient() {
  const data = await readinessFetch("/api/auth/client-context");
  const clientId =
    data.activeClientId ||
    (data.clients.length === 1 ? data.clients[0].id : "");
  if (!clientId)
    throw new Error("Choose an authorized client in Account security first");
  return clientId as string;
}
export function human(value: string) {
  return value.replaceAll("_", " ");
}
export function date(value: string | null) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        timeZone: "UTC",
        timeZoneName: "short",
      })
    : "—";
}
