import os
import json
import re
from xml.dom import minidom
from debian.changelog import Changelog
from dateutil.tz import tzlocal
from datetime import datetime
import subprocess
import collections


RHIZI_SOURCE_REPO = os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))

def replace(filename, oldtext, newtext):
    with open(filename) as fd:
        existing_text = fd.read()
    with open(filename, 'w+') as fd:
        fd.write(existing_text.replace(oldtext, newtext))


def check_output(args):
    if isinstance(args, str):
        args = args.split()
    return subprocess.check_output(args=args)


class Versions(object):
    def __init__(self):
        self.setup_py_path = os.path.join(RHIZI_SOURCE_REPO, 'setup.py')
        self.debian_changelog_path = os.path.join(RHIZI_SOURCE_REPO, 'res/debian/pkg__rhizi-common/changelog')
        self.package_json_path = os.path.join(RHIZI_SOURCE_REPO, 'package.json')
        self.build_ant_path = os.path.join(RHIZI_SOURCE_REPO, 'build.ant')
        self.filenames = [self.setup_py_path, self.debian_changelog_path,
                          self.package_json_path, self.build_ant_path]
        self.reload()

    def reload(self):
        changelog = open(self.debian_changelog_path).read()

        self.debian_changelog = Changelog(changelog)
        self.debian = self.debian_changelog.full_version

        self.setup_py_text = open(self.setup_py_path).read()
        setup_py_results = re.findall(r'version\s*=\s*["\']([0-9]*\.[0-9]*\.[0-9]*)',
                                      self.setup_py_text)
        assert len(setup_py_results) == 1
        self.setup_py = setup_py_results[0]

        self.package_json_json = json.load(open(self.package_json_path),
                                           object_pairs_hook=collections.OrderedDict)
        self.package_json = self.package_json_json['version']

        build = minidom.parse(self.build_ant_path)
        self.build_ant_et = build
        build_ant_versions = [x.attributes['value'].value for x in
                              build.getElementsByTagName('property')
                              if x.attributes['name'].value == 'pkg_version']
        assert len(build_ant_versions) == 1
        self.build_ant = build_ant_versions[0]
        self.version = self.debian

    def ensure_synced(self):
        """
        setup.py
        debian - res/debian/pkg__rhizi-common/changelog
        package.json
        """
        if self.setup_py != self.debian:
            print("setup.py {} != debian {}".format(self.setup_py, self.debian))
            raise SystemExit
        if self.package_json != self.debian:
            print("package.json {} != debian {}".format(self.package_json, self.debian))
            raise SystemExit
        if self.build_ant != self.debian:
            print("build.ant {} != debian {}".format(self.build_ant, self.debian))
            raise SystemExit

    def bump_version(self, debian_changelog):
        old_ver = self.setup_py
        new_ver = self.next_micro()
        # debian changelog
        now = datetime.now(tz=tzlocal()).strftime("%a, %d %b %Y %H:%M:%S %z")
        self.debian_changelog.new_block(
            version=new_ver,
            author='{} <{}>'.format(check_output('git config user.name'.split()).strip(),
                                    check_output('git config user.email'.split()).strip()),
            package="rhizi",
            distributions="unstable",
            urgency='low',
            changes=['  * {}'.format(c) for c in debian_changelog],
            date=now)
        with open(self.debian_changelog_path, 'w+') as fd:
            fd.write(str(self.debian_changelog))
        # build.ant - not using minidom since it doesn't keep whitespace, too
        # much churn
        replace(self.build_ant_path, old_ver, new_ver)

        # setup.py
        replace(self.setup_py_path, old_ver, new_ver)

        # package.json - not using json.dump because it reorders keys
        self.package_json_json['version'] = new_ver
        with open(self.package_json_path, 'w+') as fd:
            json.dump(self.package_json_json, fd,
                      indent=2, separators=(',', ': '))

        # update internal versions
        self.reload()

    def next_micro(self):
        major, minor, micro = map(int, self.setup_py.split('.'))
        return '{}.{}.{}'.format(major, minor, micro + 1)

    def by_tag(self):
        all = [x.strip() for x in check_output('git tag'.split()).split()]
        return sorted([x for x in all if x.startswith('v-')])[-1][2:]

versions = Versions()
