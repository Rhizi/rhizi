// Flush
match (n) optional match (n)-[r]-() delete r,n;

//
// Constraints
//
// FIXME: use wildcard constraint when supported
//
create constraint on (x:Person) assert x.name is unique;
create constraint on (x:Skill) assert x.name is unique;

// init commit block chain
create (n:HEAD:Commit {hash: 'da39a3ee5e6b4b0d3255bfef95601890afd80709', blob: '', id: 'da39a3ee5e6b4b0d3255bfef95601890afd80709', name: 'root-commit', ts_created: 0 });

// Data
create (x:Person {name:'Bob',     id: 'p_0', description: 'Bob is ...' });
create (x:Skill  {name:'Kung-Fu', id: 's_0', description: 'Kung-Fu is ...'});
match (m:Person {id: 'p_0'}),(n:Skill {id: 's_0'}) create (m)-[:Knows {id: 'l_0'}]->(n);
