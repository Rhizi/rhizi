#!/usr/bin/python2.7

#    This file is part of rhizi, a collaborative knowledge graph editor.
#    Copyright (C) 2014-2015  Rhizi
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as published
#    by the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.


import click

from datetime import datetime
from glob import glob
import os
from subprocess import Popen
from os.path import basename, dirname, exists
import re
import shutil


# Set by command line arguments, defaults below Click.command()
root = None
docker_container_id = None
neo4j_shell = None

debug = True

backup_template = 'backup-%s.dump'
backup_glob = backup_template % '*'
backup_re = re.compile(backup_template % '(\d\d\d\d)(\d\d)(\d\d)')

DAILY_KEPT = 7  # should be >= 7
WEEKLY_KEPT = 5  # should be >= 5

def unlink(filename):
    if debug:
        print("unlinking %s")
    os.unlink(filename)

def makedirs(path):
    if exists(path):
        return
    if debug:
        print("makedirs %s" % path)
    os.makedirs(path)

def copy(src, dst):
    if debug:
        print("copy %s %s" % (src, dst))
    if not exists(src):
        print("bug: %s doesn't exist") % src
        raise SystemExit
    dst_path = dirname(dst)
    if not exists(dst_path):
        makedirs(dst_path)
    shutil.copy(src, dst)

def neo4jshell(command, stdout):
    args = [neo4j_shell, '-c', command]
    if docker_container_id is not None:
        args = ['docker', 'exec', docker_container_id] + args
    if debug:
        print("executing %s (%r)" % (' '.join(args), args))
    Popen(args=args, stdout=open(stdout, 'w+')).wait()

def next_daily_filename():
    filename = os.path.join(daily_root(), backup_template % datetime.now().strftime('%Y%m%d'))
    return filename

def daily_root():
    return os.path.join(root, 'daily')

def weekly_root():
    return os.path.join(root, 'weekly')

def monthly_root():
    return os.path.join(root, 'monthly')

def backup_year_month_day(filename):
    return map(int, backup_re.match(basename(filename)).groups())

def to_weekly(filename):
    year, month, day = backup_year_month_day(filename)
    _, (wkly_year, wkly_month, wkly_day) = latest_weekly()
    # import pdb; pdb.set_trace()
    delta = datetime(year, month, day) - datetime(wkly_year, wkly_month, wkly_day)
    return delta.days >= 7

def to_monthly(filename):
    """ return True if filename is newer by a month from the newest monthly """
    year, month, day = backup_year_month_day(filename)
    _, (monthly_year, monthly_month, monthly_day) = latest_monthly()
    if monthly_year < year:
        month += 12
    return month > monthly_month and day >= monthly_day

def latest_weekly():
    return latest(weekly_root())

def latest_monthly():
    return latest(monthly_root())

def latest(subdir):
    """
    returns filename, (year, month, day)
    """
    filenames = glob(os.path.join(subdir, backup_glob))
    if len(filenames) == 0:
        return 'no_such_file', (1848, 1, 1)
    return max((fname, backup_year_month_day(fname)) for fname in filenames)

def sorted_backups(subdir):
    def cmp_files(fa, fb):
        ta = os.stat(fa).st_mtime
        tb = os.stat(fb).st_mtime
        if ta == tb:
            return 0
        if ta < tb:
            return -1
        return 1
    return sorted(glob(os.path.join(weekly_root(), backup_glob)), cmp=cmp_files)

def create_daily_backup():
    filename = next_daily_filename()
    makedirs(dirname(filename))
    neo4jshell("dump", stdout=filename)
    return filename

@click.command()
@click.option('--root', 'cli_root', default='/var/lib/rhizi/backup',
              type=click.Path(exists=True))
@click.option('--docker', 'cli_docker_container_id', default=None)
@click.option('--neo4j-shell', 'cli_neo4j_shell', default='neo4j-shell')
def backup(cli_root, cli_docker_container_id, cli_neo4j_shell):

    global root
    global docker_container_id
    global neo4j_shell
    root = cli_root
    docker_container_id = cli_docker_container_id
    neo4j_shell = cli_neo4j_shell

    # create the daily backup
    filename = create_daily_backup()

    # copy out to weekly if a week passed since last weekly, otherwise remove excess
    if to_weekly(filename):
        copy(filename, os.path.join(weekly_root(), basename(filename)))
    for filename in sorted_backups(daily_root())[DAILY_KEPT:]:
        unlink(filename)

    # rotate out to monthly if a month passed since last monthly, otherwise remove excess
    if to_monthly(filename):
        copy(filename, os.path.join(monthly_root(), basename(filename)))
    for filename in sorted_backups(weekly_root())[WEEKLY_KEPT:]:
        unlink(filename)

if __name__ == '__main__':
    backup()
