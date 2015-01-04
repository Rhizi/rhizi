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
create (n:__HEAD:__Commit {hash: 'adc83b19e793491b1c6ea0fd8b46cd9f32e592fc', blob: ''}) create (n)-[:__Parent]->(n);

// Data
create (x:Person {name:'Bob',     id: 'p_0', description: 'Bob is ...' });
create (x:Skill  {name:'Kung-Fu', id: 's_0', description: 'Kung-Fu is ...'});
match (m:Person {id: 'p_0'}),(n:Skill {id: 's_0'}) create (m)-[:Knows {id: 'l_0'}]->(n);
