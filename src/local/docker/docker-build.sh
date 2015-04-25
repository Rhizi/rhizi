#!/bin/bash
ROOT_DOCKER_DIR=$(dirname $(realpath $0))/../../../res/docker/
FEDORA_DOCKER=$ROOT_DOCKER_DIR/fedora
if [ ! -e .git ]; then
    echo run from top level checkout of rhizi repository
    exit 0
fi
docker build -t rhizi/fedora:0.1 $FEDORA_DOCKER
