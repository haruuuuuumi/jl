-- Publish the soundtrack compilation with its original X media and credit.
INSERT INTO catalog_entries (
  id, source_key, media_key, title, item_json, category_ids, status, revision, created_at, updated_at
)
SELECT 'soundtrack-2125837308876488704', '2125839841820913760', '2125837308876488704', '[FULL] 35 Minutes of JeoLee Moments', '{"id":"soundtrack-2125837308876488704","title":"[FULL] 35 Minutes of JeoLee Moments","url":"https://x.com/jeoleemoment/status/2125839841820913760","sourceUrl":"https://x.com/jeoleemoment/status/2125839841820913760","category":"Their soundtrack","collections":["Their soundtrack"],"kind":"clip","mediaKey":"2125837308876488704","mediaIndex":null,"mediaCount":1,"duration":"34:34","durationMs":2074133,"videoSrc":"https://video.twimg.com/amplify_video/2125837308876488704/vid/avc1/1280x720/BIk0bDMRAgIABkHA.mp4","image":"https://pbs.twimg.com/amplify_video_thumb/2125837308876488704/img/ilNT8NuVQqN4IAbP.jpg","posterSource":"https://pbs.twimg.com/amplify_video_thumb/2125837308876488704/img/ilNT8NuVQqN4IAbP.jpg","creator":{"name":"JL","handle":"jeoleemoment","avatar":"https://pbs.twimg.com/profile_images/2121799058214064129/6ThKjuVE_normal.jpg","profileUrl":"https://x.com/jeoleemoment"},"postedAt":1795674689141}', '["their-soundtrack"]', 'published', 1, 1795675356813, 1795675356813
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_entries
  WHERE media_key = '2125837308876488704' AND source_key <> '2125839841820913760'
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
