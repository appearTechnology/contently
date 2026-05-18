import { pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const brandDna = pgTable('brand_dna', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull(),
  url: text('url').notNull(),
  brandName: text('brandName'),
  industry: text('industry'),
  tagline: text('tagline'),
  valueProposition: text('valueProposition'),
  toneOfVoice: text('toneOfVoice'),
  brandPersonality: text('brandPersonality'),
  targetAudience: text('targetAudience'),
  keyMessages: text('keyMessages'),
  primaryColors: text('primaryColors'),
  secondaryColors: text('secondaryColors'),
  fonts: text('fonts'),
  logoUrl: text('logoUrl'),
  screenshotUrl: text('screenshotUrl'),
  imageryStyle: text('imageryStyle'),
  layoutStyle: text('layoutStyle'),
  rawJson: text('rawJson'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  unique('brand_dna_userId_url_unique').on(table.userId, table.url),
]);

export type BrandDNA = typeof brandDna.$inferSelect;
export type NewBrandDNA = typeof brandDna.$inferInsert;