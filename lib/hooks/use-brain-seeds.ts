"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase-client";

export type LiveSeed = {
  id: string;
  slug: string;
  type: string;
  status: string;
  createdAt: string;
  content: Record<string, unknown> | null;
};

export type LiveFibre = {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: string;
};

type SeedRow = { id: string; slug: string; type: string; created_at: string; current_version_id: string | null };
type VersionRow = { id: string; status: string; content: Record<string, unknown> | null };
type FibreRow = { id: string; source_seed_id: string; target_seed_id: string; relationship_type: string };

export function useBrainSeeds() {
  const [seeds, setSeeds] = useState<LiveSeed[]>([]);
  const [fibres, setFibres] = useState<LiveFibre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        if (!hasSupabaseBrowserEnv()) {
          throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
        }

        const supabase = createSupabaseBrowserClient();
        const [seedResult, versionResult, fibreResult] = await Promise.all([
          supabase
            .from("seeds")
            .select("id, slug, type, created_at, current_version_id")
            .order("created_at", { ascending: true }),
          supabase.from("seed_versions").select("id, status, content"),
          supabase.from("fibres").select("id, source_seed_id, target_seed_id, relationship_type"),
        ]);

        if (seedResult.error) throw seedResult.error;
        if (versionResult.error) throw versionResult.error;
        if (fibreResult.error) throw fibreResult.error;
        if (!isMounted) return;

        const versionsById = new Map<string, VersionRow>(
          ((versionResult.data ?? []) as VersionRow[]).map((version) => [version.id, version]),
        );

        const nextSeeds: LiveSeed[] = ((seedResult.data ?? []) as SeedRow[]).map((row) => {
          const version = row.current_version_id ? versionsById.get(row.current_version_id) : undefined;
          return {
            id: row.id,
            slug: row.slug,
            type: row.type,
            status: version?.status ?? "draft",
            createdAt: row.created_at,
            content: version?.content ?? null,
          };
        });

        setSeeds(nextSeeds);
        setFibres(
          ((fibreResult.data ?? []) as FibreRow[]).map((row) => ({
            id: row.id,
            sourceId: row.source_seed_id,
            targetId: row.target_seed_id,
            relationshipType: row.relationship_type,
          })),
        );
      } catch (err) {
        if (!isMounted) return;
        setSeeds([]);
        setFibres([]);
        setError(err instanceof Error ? err.message : "Unable to load Brain data from Supabase.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  return { seeds, fibres, loading, error };
}
