export async function register() {
  // register() is compiled for both runtimes; Node-only code (postgres, fs,
  // process.exit) stays behind this check and a dynamic import so the Edge
  // bundle never sees it.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateOnBoot } = await import("./lib/db/migrate");
    await migrateOnBoot();
  }
}
