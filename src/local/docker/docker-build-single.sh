#!/bin/bash
ROOT_DOCKER_DIR=$(dirname $(realpath $0))/../../../res/docker/
FEDORA_SINGLE_DOCKER=$ROOT_DOCKER_DIR/fedora-single
if [ ! -e .git ]; then
    echo run from top level checkout of rhizi repository
    exit 0
fi
docker build -t rhizi/fedora-single:0.1 -f $FEDORA_SINGLE_DOCKER/Dockerfile $ROOT_DOCKER_DIR
