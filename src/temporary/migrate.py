"""
This tool does some migrations on the database.

We intend to have a format to export to be used for migration to a newer/older rhizi database,
but since this tool is currently written and useful it is being put, intended as temporary, to the db.
"""

import base64
import gzip

from py2neo import Graph, watch

graph_db = None

def base64_gzip(text):
    return base64.encodestring(gzip.zlib.compress(text))

def update_blob_compression_to_gzip():
    nodes = [row.x for row in graph_db.cypher.execute('match (x:__COMMIT) return x')]
    changed = 0
    for node in nodes:
        if node['name'] == 'root-commit':
            continue
        blob = node['blob']
        if blob[:1] != '{':
            decoded = base64.decodestring(blob)
            try:
                blob = gzip.zlib.decompress(decoded)
            except:
                try:
                    blob = gzip.zlib.decompress(decoded, 16)
                except:
                    import pdb; pdb.set_trace()
        new_blob = base64_gzip(blob)
        if new_blob != node['blob']:
            changed += 1
            node['blob'] = new_blob
    if changed > 0:
        print('updated %s commit node blobs' % changed)
        graph_db.push(*nodes)
    else:
        print("all commit node blobs are up to date")

def rhizi_db_version():
    return map(int, graph_db.cypher.execute('match (x:__RZDB_META) return x')[0].x['schema_version'].split('.'))

def main():
    global graph_db
    watch("httpstream")
    graph_db = Graph('http://localhost:17474/db/data')

    rhizi_major, rhizi_minor, rhizi_micro = rhizi_db_version()
    print("rhizi db schema version: %r.%r.%r" % (rhizi_major, rhizi_minor, rhizi_micro))

    if rhizi_major <= 0 and rhizi_minor <= 2:
        update_blob_compression_to_gzip()

if __name__ == '__main__':
    main()
