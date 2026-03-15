import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('analyses')
    .addColumn('id', 'text', (col) =>
      col.primaryKey().defaultTo(sql`(lower(hex(randomblob(16))))`)
    )
    .addColumn('repo_url', 'text', (col) => col.notNull())
    .addColumn('commit_sha', 'text')
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('queued'))
    .addColumn('progress', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('ecosystems', 'text', (col) => col.notNull().defaultTo('[]'))
    .addColumn('error', 'text')
    .addColumn('created_at', 'text', (col) =>
      col.notNull().defaultTo(sql`(datetime('now'))`)
    )
    .addColumn('completed_at', 'text')
    .execute();

  await db.schema
    .createIndex('idx_analyses_status')
    .on('analyses')
    .column('status')
    .execute();

  await db.schema
    .createIndex('idx_analyses_created_at')
    .on('analyses')
    .column('created_at')
    .execute();

  await db.schema
    .createTable('dependencies')
    .addColumn('id', 'text', (col) =>
      col.primaryKey().defaultTo(sql`(lower(hex(randomblob(16))))`)
    )
    .addColumn('analysis_id', 'text', (col) =>
      col.notNull().references('analyses.id')
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('version', 'text', (col) => col.notNull())
    .addColumn('ecosystem', 'text', (col) => col.notNull())
    .addColumn('license_spdx', 'text')
    .addColumn('license_raw', 'text')
    .addColumn('license_category', 'text', (col) =>
      col.notNull().defaultTo('unknown')
    )
    .addColumn('is_direct', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('parent_dep_id', 'text')
    .addColumn('registry_url', 'text')
    .execute();

  await db.schema
    .createIndex('idx_dependencies_analysis_id')
    .on('dependencies')
    .column('analysis_id')
    .execute();

  await db.schema
    .createIndex('idx_dependencies_parent_dep_id')
    .on('dependencies')
    .column('parent_dep_id')
    .execute();

  await db.schema
    .createTable('compatible_licenses')
    .addColumn('id', 'text', (col) =>
      col.primaryKey().defaultTo(sql`(lower(hex(randomblob(16))))`)
    )
    .addColumn('analysis_id', 'text', (col) =>
      col.notNull().references('analyses.id')
    )
    .addColumn('license_spdx', 'text', (col) => col.notNull())
    .addColumn('is_compatible', 'integer', (col) => col.notNull())
    .addColumn('reason', 'text', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('idx_compatible_licenses_analysis_id')
    .on('compatible_licenses')
    .column('analysis_id')
    .execute();

  await db.schema
    .createTable('license_cache')
    .addColumn('id', 'text', (col) =>
      col.primaryKey().defaultTo(sql`(lower(hex(randomblob(16))))`)
    )
    .addColumn('ecosystem', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('version', 'text', (col) => col.notNull())
    .addColumn('license_spdx', 'text', (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex('idx_license_cache_unique')
    .on('license_cache')
    .columns(['ecosystem', 'name', 'version'])
    .unique()
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('compatible_licenses').ifExists().execute();
  await db.schema.dropTable('dependencies').ifExists().execute();
  await db.schema.dropTable('license_cache').ifExists().execute();
  await db.schema.dropTable('analyses').ifExists().execute();
}
