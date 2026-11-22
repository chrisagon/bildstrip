import { pgTable, text, integer, timestamp, uuid, jsonb, boolean, serial, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { ComicStatus, DialogueLine } from './didactic/types';

export const panelStatus = pgEnum('panel_status', [
  'pending',
  'generating',
  'done',
  'failed',
  'stale',
]);

// Stories table
export const stories = pgTable('stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  style: text('style').default('noir').notNull(),
  userId: text('user_id').notNull(),
  usesOwnApiKey: boolean('uses_own_api_key').default(false),
  status: text('status').$type<ComicStatus>().default('draft').notNull(),
  audience: text('audience'),
  language: text('language').default('fr').notNull(),
  creditCost: integer('credit_cost'),
  visibility: text('visibility').$type<'private' | 'unlisted'>().default('private').notNull(),
  shareToken: text('share_token').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Pages table
export const pages = pgTable('pages', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').references(() => stories.id, { onDelete: 'cascade' }).notNull(),
  pageNumber: integer('page_number').notNull(),
  prompt: text('prompt').notNull(),
  characterImageUrls: jsonb('character_image_urls').$type<string[]>().default([]).notNull(),
  generatedImageUrl: text('generated_image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const storiesRelations = relations(stories, ({ many }) => ({
  pages: many(pages),
}));

export const pagesRelations = relations(pages, ({ one }) => ({
  story: one(stories, {
    fields: [pages.storyId],
    references: [stories.id],
  }),
}));

// Feedback table
export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  message: text('message').notNull(),
  userId: text('user_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Source document or demo brief for a didactic comic
export const comicSources = pgTable('comic_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').references(() => stories.id, { onDelete: 'cascade' }).notNull().unique(),
  kind: text('kind').$type<'document' | 'demo'>().notNull(),
  originalName: text('original_name'),
  originalUrl: text('original_url'),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  extractionStatus: text('extraction_status').$type<'pending' | 'done' | 'failed'>().default('pending').notNull(),
  extractedText: text('extracted_text'),
  truncatedAt: integer('truncated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Learning objectives proposed by the model, selected by the user
export const learningObjectives = pgTable('learning_objectives', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').references(() => stories.id, { onDelete: 'cascade' }).notNull(),
  position: integer('position').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  sourceQuote: text('source_quote'),
  selected: boolean('selected').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Scenario proposals; exactly one becomes chosen
export const scenarioDrafts = pgTable('scenario_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').references(() => stories.id, { onDelete: 'cascade' }).notNull(),
  templateId: text('template_id').notNull(),
  title: text('title').notNull(),
  synopsis: text('synopsis').notNull(),
  beats: jsonb('beats').$type<string[]>().default([]).notNull(),
  estimatedPages: integer('estimated_pages').notNull(),
  status: text('status').$type<'proposed' | 'chosen'>().default('proposed').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Fixed cast, created before the storyboard
export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').references(() => stories.id, { onDelete: 'cascade' }).notNull(),
  position: integer('position').notNull(),
  name: text('name').notNull(),
  role: text('role').$type<'protagonist' | 'foil' | 'mentor' | 'comic-relief'>().notNull(),
  appearance: text('appearance').notNull(),
  portraitPrompt: text('portrait_prompt').notNull(),
  portraitUrl: text('portrait_url'),
  status: text('status').$type<'pending' | 'done' | 'failed'>().default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// One drawn panel. Images never contain lettering.
export const panels = pgTable('panels', {
  id: uuid('id').primaryKey().defaultRandom(),
  pageId: uuid('page_id').references(() => pages.id, { onDelete: 'cascade' }).notNull(),
  position: integer('position').notNull(),
  intent: text('intent').notNull(),
  visualPrompt: text('visual_prompt').notNull(),
  caption: text('caption').default('').notNull(),
  dialogue: jsonb('dialogue').$type<DialogueLine[]>().default([]).notNull(),
  characterIndexes: jsonb('character_indexes').$type<number[]>().default([]).notNull(),
  imageUrl: text('image_url'),
  status: panelStatus('status').default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Journal and idempotency guard for background work
export const jobs = pgTable('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  storyId: uuid('story_id').references(() => stories.id, { onDelete: 'cascade' }).notNull(),
  pageId: uuid('page_id').references(() => pages.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  status: text('status').$type<'pending' | 'running' | 'done' | 'failed'>().default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Append-only credit movements; Redis holds the live balance
export const creditLedger = pgTable('credit_ledger', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  delta: integer('delta').notNull(),
  reason: text('reason').notNull(),
  storyId: uuid('story_id').references(() => stories.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Types
export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;

export type ComicSource = typeof comicSources.$inferSelect;
export type NewComicSource = typeof comicSources.$inferInsert;

export type LearningObjectiveRow = typeof learningObjectives.$inferSelect;
export type NewLearningObjective = typeof learningObjectives.$inferInsert;

export type ScenarioDraftRow = typeof scenarioDrafts.$inferSelect;
export type NewScenarioDraft = typeof scenarioDrafts.$inferInsert;

export type CharacterRow = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;

export type PanelRow = typeof panels.$inferSelect;
export type NewPanel = typeof panels.$inferInsert;

export type JobRow = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export type CreditLedgerRow = typeof creditLedger.$inferSelect;
export type NewCreditLedgerRow = typeof creditLedger.$inferInsert;