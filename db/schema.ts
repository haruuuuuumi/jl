import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const catalogEntries=sqliteTable('catalog_entries',{
 id:text('id').primaryKey(),sourceKey:text('source_key').notNull().unique(),mediaKey:text('media_key').unique(),title:text('title').notNull(),itemJson:text('item_json').notNull(),categoryIds:text('category_ids').notNull(),status:text('status').notNull(),revision:integer('revision').notNull().default(1),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()
},table=>[index('entries_status_idx').on(table.status),index('entries_media_idx').on(table.mediaKey)]);
export const catalogCategories=sqliteTable('catalog_categories',{
 id:text('id').primaryKey(),name:text('name').notNull(),nameKey:text('name_key').notNull().unique(),position:integer('position').notNull(),createdAt:integer('created_at').notNull()
});
export const adminConfig=sqliteTable('admin_config',{
 id:integer('id').primaryKey(),passwordHash:text('password_hash').notNull(),passwordSalt:text('password_salt').notNull(),iterations:integer('iterations').notNull(),createdAt:integer('created_at').notNull()
});
export const adminSessions=sqliteTable('admin_sessions',{
 tokenHash:text('token_hash').primaryKey(),ownerId:text('owner_id').notNull(),expiresAt:integer('expires_at').notNull()
},table=>[index('sessions_expiry_idx').on(table.expiresAt)]);
export const requestLimits=sqliteTable('request_limits',{
 key:text('key').primaryKey(),windowStart:integer('window_start').notNull(),attempts:integer('attempts').notNull()
});
export const wikiPages=sqliteTable('wiki_pages',{
 id:text('id').primaryKey(),title:text('title').notNull(),titleKey:text('title_key').notNull().unique(),summary:text('summary').notNull(),topic:text('topic').notNull(),body:text('body').notNull(),sourcesJson:text('sources_json').notNull(),revision:integer('revision').notNull(),lastProposalId:text('last_proposal_id').notNull(),deleted:integer('deleted').notNull().default(0),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()
},table=>[index('wiki_pages_public_idx').on(table.deleted,table.updatedAt)]);
export const wikiProposals=sqliteTable('wiki_proposals',{
 id:text('id').primaryKey(),pageId:text('page_id'),baseRevision:integer('base_revision').notNull().default(0),title:text('title').notNull(),summary:text('summary').notNull(),topic:text('topic').notNull(),body:text('body').notNull(),sourcesJson:text('sources_json').notNull(),contributor:text('contributor').notNull(),changeNote:text('change_note').notNull(),fingerprint:text('fingerprint').notNull(),status:text('status').notNull().default('pending'),revision:integer('revision').notNull().default(1),reviewNote:text('review_note').notNull().default(''),createdAt:integer('created_at').notNull(),reviewedAt:integer('reviewed_at')
},table=>[index('wiki_proposals_status_idx').on(table.status,table.createdAt),index('wiki_proposals_page_idx').on(table.pageId),index('wiki_proposals_fingerprint_idx').on(table.fingerprint)]);

export const fandomUpdates=sqliteTable('fandom_updates',{postId:text('post_id').primaryKey(),handle:text('handle').notNull(),itemJson:text('item_json').notNull(),postedAt:integer('posted_at').notNull(),importedAt:integer('imported_at').notNull(),status:text('status').notNull().default('published'),revision:integer('revision').notNull().default(1)},table=>[index('fandom_updates_posted_idx').on(table.postedAt)]);
export const fandomUpdateState=sqliteTable('fandom_update_state',{id:integer('id').primaryKey(),leaseUntil:integer('lease_until').notNull().default(0),lockToken:text('lock_token').notNull().default(''),lastAttemptAt:integer('last_attempt_at'),lastSuccessAt:integer('last_success_at'),lastError:text('last_error').notNull().default(''),retryAfter:integer('retry_after').notNull().default(0)});

export const cupidStories=sqliteTable('cupid_stories',{
 id:text('id').primaryKey().notNull(),title:text('title').notNull(),story:text('story').notNull(),username:text('username'),status:text('status').notNull().default('pending'),revision:integer('revision').notNull().default(1),createdAt:integer('created_at').notNull()
},table=>[index('cupid_stories_status_date_idx').on(table.status,table.createdAt,table.id)]);
