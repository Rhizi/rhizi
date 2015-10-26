#!/usr/bin/env python

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


"""Setup script for Rhizi."""

import os
import sys

try:
    from setuptools import setup,find_packages
except ImportError:
    from distutils.core import setup,find_packages

version = "0.0.1" # [major].[minor].[release]

# parse README
with open('README.md') as readme_file:
    long_description = readme_file.read()

# parse requirements
with open('requirements.txt') as f:
    required = f.read().splitlines()

# parse requirements for python 2
if sys.version_info[0] == 2:
    with open('requirements-python2.txt') as f:
        required += [dep for dep in f.read().splitlines() if dep != "-r requirements.txt"]

# patch test function
if sys.argv[-1] == 'test':
    test_requirements = [
        'pytest'
    ]
    try:
        modules = map(__import__, test_requirements)
    except ImportError as e:
        err_msg = e.message.replace("No module named ", "")
        msg = "%s is not installed. Install your dev requirements." % err_msg
        raise ImportError(msg)
    os.system('py.test')
    sys.exit()


# run setup
setup(
    name='Rhizi',
    version=version,
    description='Rhizi - collaborative network mapping.',
    long_description =long_description,
    author='',
    author_email='hello@rhizi.com',
    url = "http://rhizi.org",
    download_url='https://github.com/rhizi/rhizi',
    keywords = ["network", "edition", "visualization", "rhizi"],
    packages = find_packages(exclude=['res', 'scripts', 'tests*']),
    install_requires=required,
    entry_points = {
                'console_scripts': [ 'rhizi-server=rhizi.rz_server:main' ]
                },
    license='BSD',
    zip_safe=False,
    classifiers=[
        'Development Status :: 4 - Beta',
        'Environment :: Console',
        'Intended Audience :: Developers',
        'Natural Language :: English',
        "License :: OSI Approved :: GNU Library or Lesser General Public License (LGPL)",
        'Programming Language :: Python',
        'Programming Language :: Python :: 2.7',
        'Programming Language :: Python :: 3',
        'Topic :: Software Development',
    ]
)
