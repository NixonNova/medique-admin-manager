export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureAdmin } = await import("@/lib/ensure-admin");
    await ensureAdmin();
  }
}
