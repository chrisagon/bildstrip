import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  comicSources,
  learningObjectives,
  stories,
  type ComicSource,
  type LearningObjectiveRow,
  type Story,
} from "./schema";
import { generateComicSlug } from "./slug-generator";
import { truncateSource } from "./didactic/source";
import type { ComicStatus, Objective } from "./didactic/types";

async function uniqueSlug(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const slug = generateComicSlug();
    const existing = await db
      .select({ id: stories.id })
      .from(stories)
      .where(eq(stories.slug, slug))
      .limit(1);
    if (existing.length === 0) return slug;
  }
  return `story-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function createComicDraft(input: {
  userId: string;
  kind: "document" | "demo";
  audience: string;
  sourceText?: string;
  originalUrl?: string;
  originalName?: string;
  mimeType?: string;
  topic?: string;
}): Promise<Story> {
  const slug = await uniqueSlug();
  const title = input.topic?.slice(0, 80) || "Nouvelle bande dessinée";

  const [story] = await db
    .insert(stories)
    .values({
      title,
      slug,
      userId: input.userId,
      audience: input.audience,
      status: "draft",
    })
    .returning();

  const raw =
    input.kind === "demo" ? (input.topic ?? "") : (input.sourceText ?? "");
  const { text, truncated } = truncateSource(raw);

  await db.insert(comicSources).values({
    storyId: story.id,
    kind: input.kind,
    originalName: input.originalName,
    originalUrl: input.originalUrl,
    mimeType: input.mimeType,
    sizeBytes: raw.length,
    extractionStatus: text ? "done" : "pending",
    extractedText: text,
    truncatedAt: truncated ? text.length : null,
  });

  return story;
}

export async function getComicBySlug(slug: string): Promise<Story | null> {
  const rows = await db
    .select()
    .from(stories)
    .where(eq(stories.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSourceByStoryId(
  storyId: string,
): Promise<ComicSource | null> {
  const rows = await db
    .select()
    .from(comicSources)
    .where(eq(comicSources.storyId, storyId))
    .limit(1);
  return rows[0] ?? null;
}

export async function setComicStatus(
  storyId: string,
  status: ComicStatus,
): Promise<void> {
  await db
    .update(stories)
    .set({ status, updatedAt: new Date() })
    .where(eq(stories.id, storyId));
}

/** Replaces the whole objective list; a re-run must not leave stale notions. */
export async function replaceObjectives(
  storyId: string,
  objectives: Objective[],
): Promise<LearningObjectiveRow[]> {
  await db
    .delete(learningObjectives)
    .where(eq(learningObjectives.storyId, storyId));

  if (objectives.length === 0) return [];

  return db
    .insert(learningObjectives)
    .values(
      objectives.map((objective, index) => ({
        storyId,
        position: index,
        title: objective.title,
        summary: objective.summary,
        sourceQuote: objective.sourceQuote,
      })),
    )
    .returning();
}

export async function getObjectives(
  storyId: string,
): Promise<LearningObjectiveRow[]> {
  return db
    .select()
    .from(learningObjectives)
    .where(eq(learningObjectives.storyId, storyId))
    .orderBy(learningObjectives.position);
}

export async function updateSourceText(
  storyId: string,
  raw: string,
): Promise<{ truncated: boolean }> {
  const { text, truncated } = truncateSource(raw);
  await db
    .update(comicSources)
    .set({
      extractedText: text,
      truncatedAt: truncated ? text.length : null,
      extractionStatus: text ? "done" : "pending",
    })
    .where(eq(comicSources.storyId, storyId));
  await db
    .update(stories)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(stories.id, storyId));
  return { truncated };
}
