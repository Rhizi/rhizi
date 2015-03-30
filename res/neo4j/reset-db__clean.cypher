// Flush
match (n) optional match (n)-[r]-() delete r,n;


// init mainpage doc
create (n:__RZDOC {id: 'a000a000', name: 'Welcome Rhizi'});

// init commit block chain
create (n:__RZDOC_NS_META_a000a000:__Commit:__HEAD {hash: 'da39a3ee5e6b4b0d3255bfef95601890afd80709', blob: '', id: 'da39a3ee5e6b4b0d3255bfef95601890afd80709', name: 'root-commit', ts_created: 0 });


//
// Constraints
//
// FIXME: use wildcard constraint when supported
//
create constraint on (x:__RZDOC) assert x.id   is unique;

create constraint on (x:Person) assert x.id is unique;
create constraint on (x:Skill)  assert x.id is unique;
create constraint on (x:Person) assert x.name is unique;
create constraint on (x:Skill)  assert x.name is unique;

