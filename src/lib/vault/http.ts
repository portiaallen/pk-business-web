import { getSessionUser, getSessionTokenFromRequest } from "@/lib/auth";
import { ApiError } from "@/lib/api-error";
/** Authenticate before lookup so anonymous/stale sessions cannot enumerate object existence. */
export async function authenticateVaultRequest(request: Request) {
  if (!(await getSessionUser(getSessionTokenFromRequest(request))))
    throw ApiError.unauthorized();
}
