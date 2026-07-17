const { Client } = require("pg");
const fs = require("fs");
const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await client.connect();
  const sql = fs.readFileSync("supabase/migrations/20260728000000_search_items_stable_order.sql", "utf8");
  await client.query(sql);
  console.log("search_items ORDER BY now has i.id as final tiebreaker.");

  const p1 = await client.query("select id from search_items(null,null,null,null,20,0,null,null)");
  const p2 = await client.query("select id from search_items(null,null,null,null,20,20,null,null)");
  const ids1 = p1.rows.map((r) => r.id);
  const ids2 = p2.rows.map((r) => r.id);
  const overlap = ids1.filter((id) => ids2.includes(id));
  console.log("page1 count:", ids1.length, "page2 count:", ids2.length, "overlap:", overlap.length);
  // Repeat call twice to check stability across repeated executions
  const p1b = await client.query("select id from search_items(null,null,null,null,20,0,null,null)");
  const same = JSON.stringify(p1.rows.map(r=>r.id)) === JSON.stringify(p1b.rows.map(r=>r.id));
  console.log("page1 stable across repeated calls:", same);

  await client.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
