#!/bin/bash

. tools/utils.sh

quit_if_no_neo4j_running

./src/local/neo4j-cypher < res/neo4j/reset-db__clean.cypher
