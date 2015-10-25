"""
File format for Rhizi.

Export and import functionality based on a file format that includes:
- metadata: version information
- documents: each includes:
  commits history
  snapshot (equivalent to applying all the commits on top of each other)
-
"""

from collections import namedtuple
import json


from .model.graph import Topo_Diff, Attr_Diff


# TODO use the ""real"" context, or make sure we have one defined somewhere
RhiziContext = namedtuple('Context', ['user_name', 'rzdoc'])


class RZFile(object):
    # Version of saved file. Whenever this is updated document the changes, and be able to load older files.
    VERSION = 1

    def __init__(self, kernel):
        self.kernel = kernel

    def dump(self, document_names):
        """
        Return full dump of document, including graph and history.

        :param document_names: list of document names
        :return: json unicode string
        """
        return json.dumps(self._dump(document_names))

    def _dump(self, document_names):
        """
        Returns a dictionary to be converted to json that stores the complete information for reproducing the named
        documents.

        :param document_names: list of document names
        :return: dictionary
        """
        users = set()
        documents = []
        for doc_name in document_names:
            users, doc = self._dump_one(doc_name)
            documents.append((doc_name, doc))
            users.update(users)
        return {'documents': documents, 'users': list(users), 'version': self.VERSION}

    def _dump_one(self, rzdoc_name):
        def add_commit_types(commits):
            for commit in commits:
                commit['meta']['type'] = 'topo' if 'link_set_add' in commit else 'attr'
            return commits
        rz_doc = self.kernel.rzdoc__lookup_by_name(rzdoc_name)
        commits = list(sorted(add_commit_types(self.kernel.rzdoc__commit_log(rz_doc, 0)), key=lambda c: c['meta']['ts_created']))
        clone = self.kernel.rzdoc__clone(rz_doc).to_json_dict()
        users = set(c['meta']['author'] for c in commits)
        return users, {'clone': clone, 'commits': commits}


    def _create_doc_from_commits(self, rzdoc_name, commits):
        """
        Create a new document and populate it from given commit list.

        Document might already exist but should be empty if so.

        :param rzdoc_name: name of new or existing document
        :param commits: list of commit objects
        :return: newly created or populated document
        """
        try:
            rzdoc = self.kernel.rzdoc__lookup_by_name(rzdoc_name=rzdoc_name)
        except:
            rzdoc = None
        if rzdoc is None:
            rzdoc = self.kernel.rzdoc__create(rzdoc_name=rzdoc_name)
        f = {
            'topo': lambda js, ctx: self.kernel.diff_commit__topo(topo_diff=Topo_Diff.from_json_dict(js), ctx=ctx),
            'attr': lambda js, ctx: self.kernel.diff_commit__attr(attr_diff=Attr_Diff.from_json_dict(js), ctx=ctx)
        }
        for commit in sorted(commits, key=lambda c: c['meta']['ts_created']):
            ctx = RhiziContext(rzdoc=rzdoc, user_name=commit['meta']['author'])
            print("commit {}".format(commit['meta']))
            f[commit['meta']['type']](commit, ctx)
        return rzdoc


    def load(self, data):
        """
        Load given dictionary into the database. If it is a string assume it is a json
        string and json.loads first. Format is the one returned by dump (TODO: document)

        :param data: dictionary with history and clone of all documents
        :return: list with names of loaded documents
        """
        if isinstance(data, str):
            data = json.loads(str)
        if data['version'] != self.VERSION:
            print("unknown version {}, we expected it to be <= {}".format(data['version'], self.VERSION))
            return []
        loaded_docs = []
        for rzdoc_name, d in data['documents']:
            existing_doc =  self.kernel.rzdoc__lookup_by_name(rzdoc_name)
            if existing_doc is not None:
                # allow empty documents. TODO: faster query (just count(nodes) + count(edges) != 0)
                if not self.kernel.rzdoc__clone(existing_doc).is_empty():
                    print('ignoring "{}" since it already exists and is not empty'.format(rzdoc_name))
                    continue
            assert set(d.keys()) == set(['clone', 'commits'])
            # TODO: single operation, should be faster, but requires writing a "produce commit log" operation
            # that doesn't reset HEAD |commits| times for efficiency, otherwise almost the same as this doc+commits
            # self.kernel.rzdoc__from_clone_and_commits(rzdoc_name, clone=d['clone'], commits=d['commits'])
            self._create_doc_from_commits(rzdoc_name=rzdoc_name, commits=d['commits'])
            loaded_docs.append(rzdoc_name)
        return loaded_docs