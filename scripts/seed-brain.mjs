import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import yaml from "js-yaml";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

async function sb(pathAndQuery, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${pathAndQuery} -> ${res.status}: ${text}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function checksum(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function listDirs(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name);
}

function walkAgentManifests(root) {
  const manifests = [];
  for (const domain of listDirs(root)) {
    const domainPath = path.join(root, domain);
    for (const slugDir of listDirs(domainPath)) {
      const manifestPath = path.join(domainPath, slugDir, "agent.yaml");
      if (fs.existsSync(manifestPath)) {
        const manifest = yaml.load(fs.readFileSync(manifestPath, "utf8"));
        manifests.push({ domain, slugDir, manifest });
      }
    }
  }
  return manifests;
}

function walkSkillPackages(root) {
  const skills = [];
  for (const domain of listDirs(root)) {
    const domainPath = path.join(root, domain);
    for (const slugDir of listDirs(domainPath)) {
      const skillPath = path.join(domainPath, slugDir, "SKILL.md");
      if (!fs.existsSync(skillPath)) continue;

      const raw = fs.readFileSync(skillPath, "utf8");
      const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
      const frontmatter = match ? yaml.load(match[1]) ?? {} : {};
      const body = (match ? match[2] : raw).trim();
      skills.push({ domain, slugDir, frontmatter, body });
    }
  }
  return skills;
}

async function upsertSeed(workspaceId, { slug, type, content, status }) {
  const [seedRow] = await sb("seeds?on_conflict=workspace_id,slug,type", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: { workspace_id: workspaceId, slug, type },
  });

  const [versionRow] = await sb("seed_versions?on_conflict=seed_id,version_number", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: {
      seed_id: seedRow.id,
      version_number: 1,
      status: status ?? "draft",
      content,
      checksum: checksum(content),
    },
  });

  await sb(`seeds?id=eq.${seedRow.id}`, {
    method: "PATCH",
    prefer: "return=minimal",
    body: { current_version_id: versionRow.id },
  });

  return seedRow.id;
}

async function upsertFibre(workspaceId, sourceId, targetId, relationshipType) {
  await sb("fibres?on_conflict=workspace_id,source_seed_id,target_seed_id,relationship_type", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: {
      workspace_id: workspaceId,
      source_seed_id: sourceId,
      target_seed_id: targetId,
      relationship_type: relationshipType,
    },
  });
}

async function resolveWorkspaceId() {
  if (process.env.SEED_WORKSPACE_ID) return process.env.SEED_WORKSPACE_ID;

  const rows = await sb("workspaces?select=id,name&order=created_at.asc&limit=1");
  if (!rows?.length) {
    throw new Error("No workspace found. Sign in once through the app so a workspace gets provisioned, then rerun this script.");
  }
  console.log(`Using workspace: ${rows[0].name} (${rows[0].id})`);
  return rows[0].id;
}

async function main() {
  const workspaceId = await resolveWorkspaceId();

  const skillPackages = walkSkillPackages("skills");
  const skillSlugToId = new Map();

  for (const { domain, slugDir, frontmatter, body } of skillPackages) {
    const slug = frontmatter.name || slugDir;
    const content = {
      name: frontmatter.name ?? slugDir,
      description: frontmatter.description ?? "",
      domain,
      body,
    };
    const id = await upsertSeed(workspaceId, { slug, type: "skill", content, status: "approved" });
    skillSlugToId.set(slug, id);
    console.log(`skill  ${domain}/${slug} -> ${id}`);
  }

  const agentManifests = walkAgentManifests("agents");
  let agentCount = 0;
  let fibreCount = 0;

  for (const { domain, slugDir, manifest } of agentManifests) {
    const slug = manifest.slug || slugDir;
    const id = await upsertSeed(workspaceId, {
      slug,
      type: "agent",
      content: manifest,
      status: manifest.status ?? "draft",
    });
    agentCount += 1;
    console.log(`agent  ${domain}/${slug} -> ${id}`);

    for (const skillSlug of manifest.skills ?? []) {
      const skillId = skillSlugToId.get(skillSlug);
      if (!skillId) {
        console.warn(`  ! ${slug} references unknown skill "${skillSlug}" (no matching SKILL.md)`);
        continue;
      }
      await upsertFibre(workspaceId, id, skillId, "USES");
      fibreCount += 1;
    }
  }

  console.log(`\nDone. ${agentCount} agents, ${skillSlugToId.size} skills, ${fibreCount} fibres.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
