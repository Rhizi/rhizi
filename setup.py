#!/usr/bin/env python



try:
    from setuptools import setup,find_packages
except ImportError:
    from distutils.core import setup,find_packages

version = "0.0.1" # [major].[minor].[release]

# parse README
with open('README.md') as readme_file:
    long_description = readme_file.read()

# parse
with open('requirements.txt') as f:
    required = f.read().splitlines()


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
                'console_scripts': [ 'rhizi-server=manage.__main__:main' ]
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
