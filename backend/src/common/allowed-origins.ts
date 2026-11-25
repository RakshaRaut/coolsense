// Browser origins allowed to call the API and open sockets: FRONTEND_URL
// (comma-separated) plus the local Vite dev server.
export function allowedOrigins(
  frontendUrl = process.env.FRONTEND_URL ?? '',
): string[] {
  const developmentOrigins =
    process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  return [
    ...new Set([
      ...frontendUrl
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
      ...developmentOrigins,
    ]),
  ];
}
