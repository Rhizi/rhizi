#
# bootstrap Rhizi development environment
#
alias dl='ant -f build.ant deploy-local'
alias dr='ant -f build.ant deploy-remote'
alias rs='python src/server/rz_server.py --config-dir=deploy-local/etc/'
alias rz_chrome_rand_profile='chromium --no-proxy-server --temp-profile --user-data-dir=/tmp/rz-dev_chrome_$(date | md5sum | cut -b -8) http://rhizi.local:8080/index'

