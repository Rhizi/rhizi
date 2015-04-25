#!/bin/bash

if [ ! -e .git ]; then
    echo must run from git checkout directory, the one with the .git directory.
    exit 0
fi
ROOT_DOCKER_DIR=$(dirname $(realpath $0))/../../../res/docker/
NEO4J_TARBALL=$ROOT_DOCKER_DIR/neo4j-community-2.2.1-unix.tar.gz
if [ ! -e $NEO4J_TARBALL ]; then
    echo downloading neo4j community edition 2.2.1
    wget http://neo4j.com/artifact.php?name=neo4j-community-2.2.1-unix.tar.gz -O$NEO4J_TARBALL
fi
docker build -t rhizi/neo4j:2.2.1 -f res/docker/3rd/neo4j-fedora/Dockerfile res/docker
