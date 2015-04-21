#!/bin/bash
if [ ! -e .git ]; then
    echo run from top level checkout of rhizi repository
    exit 0
fi
if [ ! -e docker/fedora/neo4j-community-2.2.1-unix.tar.gz ]; then
    echo downloading neo4j community edition 2.2.1
    wget http://neo4j.com/artifact.php?name=neo4j-community-2.2.1-unix.tar.gz -Odocker/fedora/neo4j-community-2.2.1-unix.tar.gz
fi
docker build -t alon/rhizi:test1 docker/fedora
