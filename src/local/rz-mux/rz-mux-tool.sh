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
#             └── templates -> /usr/share/rhizi/webapp/templates/
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

set -e

die() {
    echo $1 1>&2; exit 1
}

set_path_vars__apache() {
    apache_site_conf=${RZI_NAME}.conf
    apache_site_root=/srv/www/rhizi/mux-root.d/${RZI_NAME}
}

install_instance__neo4j() {

    [[ -e "/etc/init.d/${RZI_NEO4J_SVC_NAME}" ]] && die "${RZI_NEO4J_SVC_NAME} already installed."

    install -v --owner=${NEO4J_USER} --group=adm --directory /etc/neo4j/mux-conf.d/${RZI_NAME} \
                                                             /etc/neo4j/mux-conf.d/${RZI_NAME} \
                                                             /etc/neo4j/mux-conf.d/${RZI_NAME}/ssl \
                                                             /var/lib/neo4j/mux-root.d/${RZI_NAME} \
                                                             /var/lib/neo4j/mux-root.d/${RZI_NAME}/data

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

    ln -vfs -T /etc/neo4j/mux-conf.d/${RZI_NAME}   /var/lib/neo4j/mux-root.d/${RZI_NAME}/conf
    ln -vfs -T /var/lib/neo4j/bin                          /var/lib/neo4j/mux-root.d/${RZI_NAME}/bin
    ln -vfs -T /usr/share/neo4j/lib                        /var/lib/neo4j/mux-root.d/${RZI_NAME}/lib
    ln -vfs -T /usr/share/neo4j/plugins                    /var/lib/neo4j/mux-root.d/${RZI_NAME}/plugins
    ln -vfs -T /usr/share/neo4j/system                     /var/lib/neo4j/mux-root.d/${RZI_NAME}/system

    # set modes, ownership
    chmod +x ${RZI_NEO4J_INIT_SCRIPT_PATH}
}

install_instance__apache() {

    set_path_vars__apache

    install -v --owner=${APACHE_USER} --group=${APACHE_USER} --directory ${apache_site_root} \
                                                             --directory ${apache_site_root}/webapp \
                                                             --directory ${apache_site_root}/webapp/static \
                                                             --directory ${apache_site_root}/auth

    ln -vfs -T /etc/rhizi/mux-conf.d/${RZI_NAME}   /srv/www/rhizi/mux-root.d/${RZI_NAME}/webapp/etc
    ln -vfs -T /usr/lib/rhizi/webapp/static/js             /srv/www/rhizi/mux-root.d/${RZI_NAME}/webapp/static/js
    ln -vfs -T /usr/share/rhizi/webapp/static/css          /srv/www/rhizi/mux-root.d/${RZI_NAME}/webapp/static/css
    ln -vfs -T /usr/share/rhizi/webapp/static/font         /srv/www/rhizi/mux-root.d/${RZI_NAME}/webapp/static/font
    ln -vfs -T /usr/share/rhizi/webapp/static/img          /srv/www/rhizi/mux-root.d/${RZI_NAME}/webapp/static/img
    ln -vfs -T /usr/share/rhizi/webapp/static/lib          /srv/www/rhizi/mux-root.d/${RZI_NAME}/webapp/static/lib
    ln -vfs -T /usr/share/rhizi/webapp/templates/          /srv/www/rhizi/mux-root.d/${RZI_NAME}/webapp/templates

    ln -vfs -T /etc/apache2/sites-available/${apache_site_conf} /etc/apache2/sites-enabled/${apache_site_conf}
}

install_instance__rz() {
    install -v --directory /etc/rhizi/mux-conf.d/${RZI_NAME}

    chmod +x /etc/init.d/rhizi__${RZI_NAME}
}

uninstall_instance__apache() {

    set_path_vars__apache

    rm -rvf /srv/www/rhizi/mux-root.d/${RZI_NAME}
    rm -rvf /etc/apache2/sites-enabled/${apache_site_conf}
    rm -rvf /etc/apache2/sites-available/${apache_site_conf}
}

uninstall_instance__neo4j() {
     rm ${RZI_NEO4J_INIT_SCRIPT_PATH}
     rm -rf /etc/neo4j/mux-conf.d/${RZI_NAME}
     rm -rf /var/lib/neo4j/mux-root.d/${RZI_NAME}
}

uninstall_instance__rz() {
    rm -rvf /etc/rhizi/mux-conf.d/${RZI_NAME}
}

#
# static variables
#
APACHE_USER=www-data
NEO4J_USER=neo4j

RZI_NAME=$2 # rhizi-instance name, preferable a FQDN
RZI_NEO4J_SVC_NAME='neo4j-service__${RZI_NAME}'
RZI_NEO4J_INIT_SCRIPT_PATH=/etc/init.d/${RZI_NEO4J_SVC_NAME}
RZI_NEO4J_PID_FILE=/var/run/${RZI_NEO4J_SVC_NAME}
RZI_RZ_PID_FILE=/var/run/rhizi/${RZI_NAME}.pid

#
# sanity checks
#
[ $UID != 0 ] && die 'must be root to continue.'
[ -z ${RZI_NAME} ] && die 'RZI_NAME arg missing, aborting'
[ -e ${RZI_NEO4J_PID_FILE} ] && die '${RZI_NEO4J_SVC_NAME} server seems to be running, please stop it before continuing'
[ -e ${RZI_RZ_PID_FILE} ] && die '${RZI_RZ_PID_FILE} server seems to be running, please stop it before continuing'

case $1 in
    install)

        python /usr/lib/rhizi/tools/rz-mux/rz-mux-tool.py \
               --template-dir /usr/share/rhizi/rz-mux/ \
               --domain ${RZI_NAME}

        install_instance__apache
        install_instance__neo4j
        install_instance__rz

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
        echo "# [!] please review & adjust /etc/rhizi/mux-conf.d/${RZI_NAME}/rhizi-server.conf"
        echo "#"
    ;;
    uninstall)
        uninstall_instance__apache
        uninstall_instance__neo4j
        uninstall_instance__rz
    ;;
    *)
    echo "Usage: $0 <install|remove>"
    ;;
esac
