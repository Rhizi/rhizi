# Rhizi
A collaborative editor for organizing, communicating, and analyzing data in graph form.

# Dependencies
- Neo4J DB server >= 2.1.5 - http://neo4j.com/download/
- Flask - http://flask.pocoo.org/
- Apache Ant >= 1.9.0
- Python 2.7
- python-enum
- python-gevent
- python-gevent-websocket
- python-six
- python-socketio
- python-futures >= 2.2.0

For rz-backup:
- python-click >= 3.3 (not tested with anything prior)

## Client
All of the following are already bundled but noted here for reference:
- feedback - https://github.com/ivoviz/feedback (it also bundles html2canvas)
- jquery
- d3
- FileSaver

# Installation
## Apt based systems: Debian / Ubuntu
<code># apt-get install \
ant \
python-flask \
python-socketio \
python-gevent \
python-six \
python-pip \
ruby-sass
</code>

## Generic
use pip to install all requirements

 $ pip install flask
 $ pip install gevent-socketio

# Use
## Running Rhizi Locally
To run Rhizi locally:
- Run neo4j locally on the default 7474 port
- Add <code>127.0.0.1 rhizi.local</code> to your hosts file
- Launch run-local.sh:<br>
<code>$ ./run-local.sh</code>

Or perform the following by hand:

- Invoke the local deployment Ant target:<br>
<code>ant -f ./build.ant deploy-local</code>
- Run rhizi-server.py:<br>
<code>$ cd deploy-local && python bin/rz_server.py --config-dir=etc</code>

Command line use documentation can be view with:
:$ python rz_server.py -h

## Configuration
Rhizi configuration is currently documented in code, see <code>src/server/rz_server.py#Config</code>

## User addition
Through the sign up page you can add users.

## Changing users roles
This is possible through the src/local/rz_cli_tool as follows:
./src/local/rz_cli_tool.py --config-dir res/etc --user-db-path res/user_db.db --email alon@rhizi.local --role-add admin

# Development
Build currently uses Apache Ant(http://ant.apache.org/) and [make](https://www.gnu.org/software/make/)

To update the css files you need [sass](http://sass-lang.com/). To rebuild the css files issue make from the top level directory:

 $ make

 For dev mode(debbuging, manual file load) use `?debug=1` at end of URL: e.g. `file://rhizifolder/html.index?debug=1`

## CSS / SCSS Coding Conventions
- assume use of modern browsers
- indent files using 4 space characters
- apply alphabetical ordering whenever possible: selectors, directives, etc.
- use a combination of CSS classes / IDs to draw common/unique styling, eg. <code>class=form-Foo\_input-field id=email-field</code>
- minimize use of CSS directives, remove directives which have no effect
- avoid using browser-specific CSS directives when hand-writing CSS code

## Neo4J DB management
- to reset the DB:
 $ neo4j-shell -file res/neo4j/reset-db__clean.cypher
- then to add a single test link:
 $ neo4j-shell -file res/neo4j/reset-db__single_link.cypher

## Running server tests
Test code makes use of Python's unittest - run by invoking them with python,
or by creating a launch configuration in your IDE of choice.

Note: server test-cases do not yet support pre-run DB state validation and are
likely to leave DB side-effects.

## Installing on windows (WIP)
mingw doesn't have python support, so using mingw (I want a unix native python)

- www.cygwin.com setup-x86_64.exe
- use correct mirror (i.e. mirror.isoc.org.il)
- defaults (c:\cygwin64)
- python + gvim + vim + python-six + git + git-completion + tig + ruby + ruby-sass + make + gcc-core + autoconf + automake
- start cygwin shell
- cd to directory of install
- git clone or extract tarball
- cd rhizi
- install neo4j from neo4j.com community eddition (neo4j-community_windows_2_1_6.exe)
- install python prerequisites:
- download get-pip.py from http://pip.pypa.io/en/latest/installing.html
- $ python get-pip.py
- install JDK: java SE development Kit 8 jdk-8u31-windows-x64.exe
- install ant: winant.googlecode.com/files/winant-install-v7.exe
  - specify JDK install directory, i.e. C:\Program Files\Java\jdk1.8.0_31
- Current ant bug: /usr/bin/rhizi is translated by ant to \usr\bin\rhizi and so it fails to find rhizi.
  - solution 1: replace /usr/bin/rhizi with rhizi, it will find rhizi in PATH
  - solution 2: ?
- pip install flask
- pip install gevent-websocket
  - pip install gevent never completes setup.py stage
    - solution 1: pip install cython git+git://github.com/surfly/gevent.git#egg=gevent
    - didn't complete.

# Deployment
- obtain a server configuration by either adjusting res/etc/rhizi-server.conf.example or reusing an already active one.
- the following configuration keys will likely need changing: DEBUG, SECRET_KEY, root_path, access_control, etc.
- let targetDomain be the target domain (i.e. rhizi.example.com)
- place configuration at res/production-patch-set/${targetDomain}/rhizi-server.production.conf
- use the build.ant deploy-remote target:
  - adjust targetDomain path: should point at the configuration's file dir
  - adjust remoteDeployServer to point at the target server
- use res/debian/rhizi.init to run rhizi as a system process: rz_server.py will need chmod'ing to +x

- Deploying:
 $ ant -v -f build.ant -DremoteDeployServer=rhizi.example.com -Drsync_module=/srv/www/rhizi.example.com deploy-remote

## getting the current config file from the server:

 $ targetDomain="cri.rhizi.net"
 $ mkdir res/production-patch-set/${targetDomain}
 $ scp rz-1:/etc/rhizi/rhizi-server.conf res/production-patch-set/${targetDomain}/rhizi-server.production.conf

## Tools
### rz-doc

This is the only way to merge a number of documents right now. Here is how:

It is installed by default to /srv/www/<domain>/tools/rz-doc, lets call that rz-doc for short.

rz-doc --list-names
 - will show all available documents. uses default config in /etc/rhizi/rhizi-server.conf, can be overridden with --config-dir

1. rz-doc --list-names > merge.file
2. rz-doc --merge-file merge.file --merge-target "All Documents"

creates a new doc called "All Documents" with the contents of all rzdocs in merge.file.
