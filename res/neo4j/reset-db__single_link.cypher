// Flush
match (n) optional match (n)-[r]-() delete n,r;

//
// Constraints
//
// FIXME: use wildcard constraint when supported
//
create constraint on (x:Person) assert x.name is unique;
create constraint on (x:Skill) assert x.name is unique;

// Data
create (x:Person {name:'Bob',     id: 'p_0', description: 'Bob is ...' });
create (x:Skill  {name:'Kung-Fu', id: 's_0', description: 'Kung-Fu is ...'});
match (m:Person {id: 'p_0'}),(n:Skill {id: 's_0'}) create (m)-[:Knows {id: 'l_0'}]->(n);
