import type { LiveSeed } from "@/lib/hooks/use-brain-seeds";

export function seedName(seed: LiveSeed) {
  const content = seed.content as { name?: string } | null;
  if (content?.name) return content.name;
  return seed.slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function seedSummary(seed: LiveSeed) {
  const content = seed.content as { purpose?: string; description?: string; example_task?: string } | null;
  return content?.purpose ?? content?.description ?? content?.example_task ?? "No summary recorded yet.";
}

export function seedDomain(seed: LiveSeed) {
  const content = seed.content as { primary_domain?: string; domain?: string } | null;
  return content?.primary_domain ?? content?.domain ?? "general";
}

export function seedRelatedSkills(seed: LiveSeed) {
  const content = seed.content as { skills?: string[] } | null;
  return Array.isArray(content?.skills) ? (content?.skills as string[]) : [];
}
