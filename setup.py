#!/usr/bin/env python

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
    packages = find_packages(),
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
