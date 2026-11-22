UPDATE fandom_updates
SET item_json = json_set(item_json, '$.image', 'https://pbs.twimg.com/media/HXtLxJEb0AA7QJB.jpg', '$.imageFromPost', json('true')),
    revision = revision + 1
WHERE post_id = '2124374963444723894'
  AND coalesce(json_extract(item_json, '$.image'), '') = '';
