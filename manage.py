#!/usr/bin/python
import sys
import argparse
import rhizi.rz_server as server

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--config-dir', '-c', default="deploy-local", required=True)
    return p

def main(args=None):
    """Launch Rhizi with a config file"""

    if args is None:
        args = sys.argv[1:]

    # load parser
    parser = parse_args()
    
    # parse command line arguments
    parsed_args = parser.parse_args(args)

    print("Launching rhizi with config '%s'..."%parsed_args.config_dir)

if __name__ == "__main__":
    server.main()
