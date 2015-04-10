# hack to setup rhizi path - needs a proper install
import sys
import os

# to work both from source dir and from deployment dir
candidate = None
for down in [['..', '..'], ['..']]:
    candidate = os.path.join(*([os.path.dirname(__file__)] + down + ['server']))
    if os.path.exists(candidate):
        break
if None is candidate:
    print("must be run from one or two directories above server")
    raise SystemExit
sys.path.append(candidate)
