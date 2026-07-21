const baseUrl = (process.env.POMEBRAIN_BASE_URL ?? "https://pomebrain.vercel.app").replace(/\/$/, "");

async function readJson(path) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { accept: "application/json" } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

const liveness = await readJson("/api/health");
if (!liveness.response.ok || liveness.body.status !== "healthy") {
  throw new Error(`Production liveness failed (${liveness.response.status}).`);
}

const readiness = await readJson("/api/health/readiness");
if (!readiness.response.ok || readiness.body.status !== "ready") {
  const failures = Object.entries(readiness.body.checks ?? {})
    .filter(([, check]) => !check?.ready)
    .map(([name, check]) => `${name}: ${check?.message ?? "not ready"}`)
    .join("; ");
  throw new Error(`Production is live but not launch-ready (${readiness.response.status}): ${failures}`);
}

process.stdout.write(`Pomebrain production is live and launch-ready at ${baseUrl}.\n`);
