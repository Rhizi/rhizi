# hack to setup rhizi path - needs a proper install
import sys
import os

# to work both from source dir and from deployment dir
path = None
for postfix in [['..', 'bin'], ['..', '..', 'server']]:
    candidate = os.path.join(*([os.path.dirname(__file__)] + postfix))
    if os.path.exists(candidate):
        path = candidate
        break
if None is path:
    print("must be run from one or two directories above server")
    raise SystemExit
sys.path.append(path)
