import subprocess
import re
import json

verbose = False

BASE="http://rhizi.local:7474/db/data"

def c(cmd, incoming=None):
    if verbose:
        print("executing %r" % cmd)
        print(incoming)
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if incoming:
        p.stdin.write(incoming)
    if p.stdin:
        p.stdin.close()
    p.wait()
    ret = p.stdout.read()
    return ret

def curl(path, incoming):
    return c(["curl", "-H", 'Accept: application/json', "-H", 'Content-Type: application/json', '-XPOST', '-d@-', path],
             incoming=incoming)

def transact(datum):
    transaction_output = curl(BASE + "/transaction/", '{"statements": [  ] }')
    commit = re.search("http://.*commit", transaction_output).group()
    ret = curl(commit, json.dumps(datum))
    obj = json.loads(ret)
    return obj

def run(statements, one_at_a_time):
    def single_request_data(statements):
        return {'statements': [{'statement': s} for s in statements]}
    results = []
    if one_at_a_time:
        data = [single_request_data([statement]) for statement in statements]
    else:
        data = [single_request_data(statements)]
    for datum in data:
        results.append(transact(datum))
    return results
