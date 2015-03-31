// Flush
match (n) optional match (n)-[r]-() delete r,n;


// init mainpage doc
create (n:__RZDOC {id: 'a000a000', name: 'Welcome Rhizi'});

// init commit block chain
create (n:__RZDOC_NS_META_a000a000:__COMMIT:__HEAD {hash: 'adc83b19e793491b1c6ea0fd8b46cd9f32e592fc', blob: '', id: 'adc83b19e793491b1c6ea0fd8b46cd9f32e592fc', name: 'root-commit', ts_created: 0 });


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

