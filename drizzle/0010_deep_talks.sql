-- Add Deep talks and its first clip from @jeoleemoment.
INSERT INTO catalog_categories (id, name, name_key, position, created_at)
SELECT 'deep-talks', 'Deep talks', 'deep talks', MAX(3, COALESCE(MAX(position), 3)) + 1, 1795690132391
FROM catalog_categories WHERE 1
ON CONFLICT(name_key) DO NOTHING;
--> statement-breakpoint
INSERT INTO catalog_entries (
  id, source_key, media_key, title, item_json, category_ids, status, revision, created_at, updated_at
)
SELECT 'deep-talks-2125901788494905345', '2125902654404694101', '2125901788494905345', '[FULL] JeoLee Gets to Know the Ong Fam', '{"id":"deep-talks-2125901788494905345","title":"[FULL] JeoLee Gets to Know the Ong Fam","url":"https://x.com/jeoleemoment/status/2125902654404694101","sourceUrl":"https://x.com/jeoleemoment/status/2125902654404694101","category":"Deep talks","collections":["Deep talks"],"kind":"clip","mediaKey":"2125901788494905345","mediaIndex":null,"mediaCount":1,"duration":"29:09","durationMs":1749683,"videoSrc":"https://video.twimg.com/amplify_video/2125901788494905345/vid/avc1/1280x720/jcveCc2yrC7kcYRB.mp4","image":"https://pbs.twimg.com/amplify_video_thumb/2125901788494905345/img/3wPNV3ex6ooSjjQ8.jpg","posterSource":"https://pbs.twimg.com/amplify_video_thumb/2125901788494905345/img/3wPNV3ex6ooSjjQ8.jpg","creator":{"name":"JL","handle":"jeoleemoment","avatar":"https://pbs.twimg.com/profile_images/2121799058214064129/6ThKjuVE_normal.jpg","profileUrl":"https://x.com/jeoleemoment"},"postedAt":1795689664828}',
       json_array((SELECT id FROM catalog_categories WHERE name_key = 'deep talks')), 'published', 1, 1795690132391, 1795690132391
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_entries
  WHERE media_key = '2125901788494905345' AND source_key <> '2125902654404694101'
)
ON CONFLICT(source_key) DO UPDATE SET
  media_key = excluded.media_key,
  title = excluded.title,
  item_json = json_set(excluded.item_json, '$.id', catalog_entries.id),
  category_ids = excluded.category_ids,
  status = excluded.status,
  revision = catalog_entries.revision + 1,
  updated_at = excluded.updated_at
WHERE catalog_entries.status = 'pending';
--> statement-breakpoint
UPDATE catalog_entries
SET category_ids = json_insert(category_ids, '$[#]', (SELECT id FROM catalog_categories WHERE name_key = 'deep talks')),
    revision = revision + 1,
    updated_at = 1795690132391
WHERE (source_key = '2125902654404694101' OR media_key = '2125901788494905345')
  AND status = 'published'
  AND NOT EXISTS (
    SELECT 1 FROM json_each(catalog_entries.category_ids)
    WHERE value = (SELECT id FROM catalog_categories WHERE name_key = 'deep talks')
  );
