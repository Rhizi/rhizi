#!/bin/bash

. tools/utils.sh

quit_if_no_neo4j_running

./tools/neo4j-cypher < res/neo4j/reset-db__clean.cypher
