#!/bin/bash

. tools/utils.sh

quit_if_no_neo4j_running

$NEO4J_SHELL -file res/neo4j/reset-db__single_link.cypher
