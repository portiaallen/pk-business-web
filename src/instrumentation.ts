export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { installSafeRuntimeConsole } = await import('./lib/runtime-log');
    installSafeRuntimeConsole();
  }
}
