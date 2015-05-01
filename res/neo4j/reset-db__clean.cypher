//
// [!] Deprecated in favor of auto-initialization by rhizi server,
//     left as to aid clearing the DB during development.
//

// Flush
match (n) optional match (n)-[r]-() delete r,n;

