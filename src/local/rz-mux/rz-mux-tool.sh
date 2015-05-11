#!/bin/bash

#
# Multiplexed Neo4J instance installer
#
# generated apache structure:
#
# /srv/www/rhizi/
# └── mux-root.d
#     └── dom-x
#         └── webapp
#             ├── etc -> /etc/rhizi/mux-conf.d/dom-x
#             ├── static
#             │   ├── css -> /usr/share/rhizi/webapp/static/css
#             │   ├── font -> /usr/share/rhizi/webapp/static/font
#             │   ├── img -> /usr/share/rhizi/webapp/static/img
#             │   ├── js -> /usr/lib/rhizi/webapp/static/js
#             │   └── lib -> /usr/share/rhizi/webapp/static/lib
#             └── fragment.d                                           // webapp fragments
#                 ├── js
#                 ├── img
#                 └── template.d                                       // HTML template fragments
#
# generated neo4j dir structure:
#
#    /etc/neo4j/mux-conf.d/
#    └── dom-x
#        ├── neo4j.properties
#        ├── neo4j-server.properties
#        └──  ...
#
#    /var/lib/neo4j/mux-root.d/
#    └── dom-x
#        ├── data/
#        ├── bin -> /var/lib/neo4j/bin
#        ├── conf -> /etc/neo4j/mux-conf.d/dom-y
#        ├── lib -> /usr/share/neo4j/lib
#        ├── plugins -> /usr/share/neo4j/plugins
#        └── system -> /usr/share/neo4j/system
#
# generated rz structure:
#
#    /etc/rhizi/
#    ├── domain-conf.d
#    └── mux-conf.d
#        └── dom-x
#            └── rhizi-server.conf.example
#

die() {
    echo "$1" 1>&2; exit 1
}

set_path_vars() {

    neo4j_module__confdir=/etc/neo4j/mux-conf.d/${RZI_NAME}
    neo4j_module__rootdir=/var/lib/neo4j/mux-root.d/${RZI_NAME}

    rz_module__confdir=/etc/rhizi/mux-conf.d/${RZI_NAME}
    rz_module__bkp=/var/lib/rhizi/mux-bkp.d/${RZI_NAME}

    apache_module__siteconf_filename=${RZI_NAME}.conf
    apache_module__rootdir=/srv/www/rhizi/mux-root.d/${RZI_NAME}

}

install_instance__neo4j() {

    [[ -e "${neo4j_module__rootdir}" ]] && die "error: neo4j module already installed: ${neo4j_module__rootdir}"

    install -v --owner=${NEO4J_USER} --group=adm --directory ${neo4j_module__confdir} \
                                                             ${neo4j_module__confdir}/ssl \
                                                             ${neo4j_module__rootdir} \
                                                             ${neo4j_module__rootdir}/data

    # copy non-generated config files
    cp /etc/neo4j/custom-logback.xml \
       /etc/neo4j/jmx.access \
       /etc/neo4j/jmx.password \
       /etc/neo4j/logging.properties \
       /etc/neo4j/neo4j-http-logging.xml \
       /etc/neo4j/neo4j-wrapper.conf \
       /etc/neo4j/mux-conf.d/${RZI_NAME}
    cp /etc/neo4j/custom-logback.xml \
       /etc/neo4j/ssl/snakeoil.cert \
       /etc/neo4j/ssl/snakeoil.key \
       /etc/neo4j/mux-conf.d/${RZI_NAME}/ssl

    ln -vfs -T /etc/neo4j/mux-conf.d/${RZI_NAME}   ${neo4j_module__rootdir}/conf
    ln -vfs -T /var/lib/neo4j/bin                  ${neo4j_module__rootdir}/bin
    ln -vfs -T /usr/share/neo4j/lib                ${neo4j_module__rootdir}/lib
    ln -vfs -T /usr/share/neo4j/plugins            ${neo4j_module__rootdir}/plugins
    ln -vfs -T /usr/share/neo4j/system             ${neo4j_module__rootdir}/system

}

install_instance__apache() {

    [[ -e "${apache_module__rootdir}" ]] && die "error: apache module already installed: ${apache_module__rootdir}"

    install -v --owner=${APACHE_USER} --group=${APACHE_USER} --directory ${apache_module__rootdir} \
                                                             --directory ${apache_module__rootdir}/auth \
                                                             --directory ${apache_module__rootdir}/webapp \
                                                             --directory ${apache_module__rootdir}/webapp/static \
                                                             --directory ${apache_module__rootdir}/webapp/fragment.d/img \
                                                             --directory ${apache_module__rootdir}/webapp/fragment.d/js \
                                                             --directory ${apache_module__rootdir}/webapp/fragment.d/template.d

    ln -vfs -T /etc/rhizi/mux-conf.d/${RZI_NAME}     ${apache_module__rootdir}/webapp/etc
    ln -vfs -T /usr/lib/rhizi/webapp/static/js       ${apache_module__rootdir}/webapp/static/js
    ln -vfs -T /usr/share/rhizi/webapp/static/css    ${apache_module__rootdir}/webapp/static/css
    ln -vfs -T /usr/share/rhizi/webapp/static/font   ${apache_module__rootdir}/webapp/static/font
    ln -vfs -T /usr/share/rhizi/webapp/static/img    ${apache_module__rootdir}/webapp/static/img
    ln -vfs -T /usr/share/rhizi/webapp/static/lib    ${apache_module__rootdir}/webapp/static/lib

    # enable site
    ln -vfs -T /etc/apache2/sites-available/${apache_module__siteconf_filename} /etc/apache2/sites-enabled/${apache_module__siteconf_filename}
}

install_instance__rhizi() { # depends on install_instance__apache()

    [[ -e "${rz_module__confdir}" ]] && die "error: rhizi module already installed: ${rz_module__confdir}"

    install -v --directory ${rz_module__confdir} \
               --directory ${rz_module__bkp}

    # install default fragments - JS
    cp -vr /usr/share/rhizi/webapp/domain-fragment.d/default/* ${apache_module__rootdir}/webapp/fragment.d/

}

uninstall_instance__apache() {

    rm -rvf ${apache_module__rootdir}
    rm -vf /etc/apache2/sites-enabled/${apache_module__siteconf_filename}
    rm -vf /etc/apache2/sites-available/${apache_module__siteconf_filename}
}

uninstall_instance__neo4j() {

     rm -vf ${RZI_NEO4J_INIT_SCRIPT_PATH}
     rm -rf ${neo4j_module__confdir}
     rm -rf ${neo4j_module__rootdir}
}

uninstall_instance__rhizi() {

    rm -vf ${RZI_RZ_INIT_SCRIPT_PATH}
    rm -rvf ${rz_module__confdir}
    echo "[!] leaving rhizi bkp dir removal to user: ${rz_module__bkp}"
}

#
# static variables
#
APACHE_USER=www-data
NEO4J_USER=neo4j

RZI_NAME=$2 # rhizi-instance name, preferable a FQDN
RZI_NEO4J_SVC_NAME=neo4j-service__${RZI_NAME}
RZI_NEO4J_INIT_SCRIPT_PATH=/etc/init.d/${RZI_NEO4J_SVC_NAME}
RZI_NEO4J_PID_FILE=/var/lib/neo4j/mux-root.d/${RZI_NAME}/data/neo4j-service.pid
RZI_RZ_PID_FILE=/var/run/rhizi/${RZI_NAME}.pid
RZI_RZ_INIT_SCRIPT_PATH=/etc/init.d/rhizi__${RZI_NAME}

#
# sanity checks
#
[ 0 != $UID ] && die 'error: must be root to continue.'
[ -z ${RZI_NAME} ] && die 'error: RZI_NAME arg missing, aborting'
[ -e ${RZI_NEO4J_PID_FILE} ] && die "error: ${RZI_NEO4J_SVC_NAME} server seems to be running, please stop it before continuing"
[ -e ${RZI_RZ_PID_FILE} ] && die "error: ${RZI_RZ_PID_FILE} server seems to be running, please stop it before continuing"

set_path_vars

case $1 in
    install)

        set -e

        install_instance__apache
        install_instance__neo4j
        install_instance__rhizi

        # pass-on extra argument to python: install dom-x ...:
        #    - opt: --rz_config__disable_access_control
        if [ $# -ge 3 ] ; then shift 2; py_extra_args=$@ ; fi
        python /usr/lib/rhizi/tools/rz-mux/rz-mux-tool.py \
               --template-dir /usr/share/rhizi/rz-mux/ \
               --domain ${RZI_NAME} ${py_extra_args}

        # set modes, ownership
        chmod +x ${RZI_NEO4J_INIT_SCRIPT_PATH}
        chmod +x ${RZI_RZ_INIT_SCRIPT_PATH}
        chgrp ${APACHE_USER} /etc/rhizi/mux-conf.d/${RZI_NAME}/*
        chmod o-r /etc/rhizi/mux-conf.d/${RZI_NAME}/*

        tree -ug --noreport /etc/apache2/sites-available
        tree -ug --noreport /etc/apache2/sites-enabled
        tree -ug --noreport /srv/www/rhizi/
        tree -ug --noreport /var/lib/neo4j/mux-root.d/
        tree -ug --noreport /etc/neo4j/mux-conf.d/
        tree -ug --noreport /etc/rhizi/

        echo "# -----------------------------------------------------------------------------"
        echo "# Summery:"
        echo "#"
        echo "# rz instance installed: name: ${RZI_NAME}"
        echo "#"
        echo "# [!] please review / adjust the following:"
        echo "#     - /etc/rhizi/mux-conf.d/${RZI_NAME}/rhizi-server.conf"
        echo "#"
        echo "# [!] adjust instance-specific files here:"
        echo "#     - ${apache_module__rootdir}/webapp/static/fragment.d/js"
        echo "#     - ${apache_module__rootdir}/webapp/static/fragment.d/template.d"
        echo "#"
    ;;
    uninstall)
        echo "[!] This will purge all instance data including:"
        echo "       - '${neo4j_module__rootdir}"
        echo "       - '${apache_module__rootdir}"
        echo ""
        echo "Are you sure you want to proceed? [y/N]"
        read uninstall__proceed
        [ "$uninstall__proceed" != "y" ] && die 'Aborting'

        uninstall_instance__apache
        uninstall_instance__neo4j
        uninstall_instance__rhizi
    ;;
    *)
    echo "Usage: $0 <install|uninstall> <rhizi-instance-FQDN>"
    ;;
esac
