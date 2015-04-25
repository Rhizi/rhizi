#!/bin/bash
docker run --name rhizi.neo4j -p 7474:7474 -d rhizi/neo4j:2.2.1 ./neo4j console
