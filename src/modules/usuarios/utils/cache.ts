import { invalidateCache } from "../../../utils/cache";
import { prisma } from "../../../config/prisma";

export async function invalidateUserCache(
  usuario: { supabaseId?: string; id?: string } | string | null
) {
  let supabaseId: string | undefined;
  let id: string | undefined;

  if (typeof usuario === "string") {
    id = usuario;
  } else {
    supabaseId = usuario?.supabaseId;
    id = usuario?.id;
  }

  if (!supabaseId && id) {
    const found = await prisma.usuario.findUnique({
      where: { id },
      select: { supabaseId: true },
    });
    supabaseId = found?.supabaseId || undefined;
  }

  const keys: string[] = [];
  if (supabaseId) keys.push(`user:${supabaseId}`);
  if (id) keys.push(`user:${id}`);
  if (keys.length) {
    await invalidateCache(keys);
  }
}

