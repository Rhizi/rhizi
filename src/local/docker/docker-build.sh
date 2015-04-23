#!/bin/bash
ROOT_DOCKER_DIR=$(dirname $(realpath $0))
FEDORA_DOCKER=$ROOT_DOCKER_DIR/fedora
if [ ! -e .git ]; then
    echo run from top level checkout of rhizi repository
    exit 0
fi
NEO4J_TARBALL=$FEDORA_DOCKER/neo4j-community-2.2.1-unix.tar.gz
if [ ! -e $NEO4J_TARBALL ]; then
    echo downloading neo4j community edition 2.2.1
    wget http://neo4j.com/artifact.php?name=neo4j-community-2.2.1-unix.tar.gz -O$NEO4J_TARBALL
fi
docker build -t alon/rhizi:test1 $FEDORA_DOCKER
