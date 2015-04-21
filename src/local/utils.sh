# utilities to be sourced for rhizi bash scripts

if [ "x$NEO4J_ROOT" == "x" ]; then
    NEO4J_SHELL=`which neo4j-shell`
    if [ "x$NEO4J_SHELL" == "x" ]; then
        echo missing neo4j-shell, please define NEO4J_ROOT or place neo4j-shell in PATH
        exit 1
    fi
else
    NEO4J_SHELL="$NEO4J_ROOT/bin/neo4j-shell"
    if [ ! -e $NEO4J_SHELL ]; then
        echo "\$NEO4J_ROOT/bin/neo4j-shell does not exist, fix NEO4J_ROOT"
        exit 1
    fi
fi

function neo4j_running () {
    if [ `uname` == "Darwin" ]; then
        neo4j_count=`netstat -na -ptcp 2>/dev/null | grep 7474 | wc -l`
    else
        neo4j_count=`netstat -ltnop 2>/dev/null | grep 7474 | wc -l`
    fi
    [ $neo4j_count -gt "0" ]
}

function quit_if_no_neo4j_running () {
    if neo4j_running ; then
        return 0
    else
        echo neo4j not running
        exit 0
    fi
}
