import inspect
import logging
import tempfile
import unittest

import db_controller as dbc
from db_op import DBO_raw_query_set, DBO_rzdoc__create
from neo4j_test_util import rand_label
from rz_config import RZ_Config
from test_util import generate_random_RZDoc
from test_util__pydev import debug__pydev_pd_arg
from test_util__rzdoc import DBO_RDG__skill_graph


class Test_Domain_CRI(unittest.TestCase):

    @classmethod
    def setUpClass(self):
        cfg = RZ_Config.init_from_file('res/etc/rhizi-server.conf')
        self.db_ctl = dbc.DB_Controller(cfg.neo4j_url)
        self.log = logging.getLogger('rhizi')
        self.log.addHandler(logging.StreamHandler())

    def test_random_data_generation__domain__CRI(self, export_as_csv=True):
        """
        test:
           - random CRI domain data generation
           - DB dump in cvs format: person x skill x skill-level
        """

        skill_set = ['Cryptocurrency',
                     'Database architecture',
                     'Web-development',
                     'Mobile-development',
                     'Machine learning',
                     'Guitar Playing',
                     'Image processing',
                     'Algebra',
                     'Calculus',
                     'Molecular-Biology',
                     'Graphic design',
                     'Geo-location services',
                     'Drone-building',
                     'Artificial-intelligence',
                     'Distributed information systems',
                     'Wordpress',
                     'Woodworking',
                     'Quality-control',
                     'Video-editing',
                     'Soldering',
                     'Network engineering',
                     'GIT',
                     'Electronic music',
                     'Network administration']

        name_set = ['John',
                    'William',
                    'James',
                    'Charles',
                    'George',
                    'Frank',
                    'Joseph',
                    'Thomas',
                    'Henry',
                    'Robert',
                    'Edward',
                    'Harry',
                    'Walter',
                    'Arthur',
                    'Fred',
                    'Albert',
                    'Samuel',
                    'David',
                    'Louis',
                    'Joe',
                    'Charlie',
                    'Clarence',
                    'Richard',
                    'Andrew',
                    'Daniel',
                    'Ernest',
                    'Mary',
                    'Anna',
                    'Emma',
                    'Elizabeth',
                    'Minnie',
                    'Margaret',
                    'Ida',
                    'Alice',
                    'Bertha',
                    'Sarah',
                    'Annie',
                    'Clara',
                    'Ella',
                    'Florence',
                    'Cora',
                    'Martha',
                    'Laura',
                    'Nellie',
                    'Grace',
                    'Carrie',
                    'Maude',
                    'Mabel',
                    'Bessie',
                    'Jennie',
                    'Gertrude',
                    'Julia']

        test_label = rand_label()
        rzdoc = generate_random_RZDoc(test_label)

        op = DBO_rzdoc__create(rzdoc)
        self.db_ctl.exec_op(op)

        op = DBO_RDG__skill_graph(rzdoc,
                                  lim_n=10,
                                  skill_set=skill_set,
                                  name_set=name_set)
        self.db_ctl.exec_op(op)

        if False == export_as_csv:
            return

        q_arr = ['match (n: Person)',
                 'with n',
                 'match (n)-[r:Novice|Intermediate|Expert]->(m:Skill)',  # [!] expect link type to be proficiency level
                 'return n.name, collect({skill_name: m.name, skill_level: r.proficiency})'
                 ]
        op = DBO_raw_query_set(q_arr)

        #
        # write csv file
        #
        cur_f_name = inspect.stack()[0][3]
        def q_process_result_set():
            with tempfile.NamedTemporaryFile(prefix='rz_%s' % (cur_f_name), dir='/tmp', suffix='.csv', delete=False) as f_out:
                for _, _, r_set in op.iter__r_set():
                    for row in r_set:
                        person_name, skill_dict_set = row  # person to {sname: skill, s:pro: skill_level{ dict set
                        cvs_line_arr = [person_name]
                        for skill_dict in skill_dict_set:
                            skill_name = skill_dict['skill_name']
                            skill_level = skill_dict['skill_level']
                            cvs_line_arr += [skill_name, skill_level]
                        f_out.write(','.join(cvs_line_arr) + '\n')
                f_out.write('\n')

        op.process_result_set = q_process_result_set
        self.db_ctl.exec_op(op)

@debug__pydev_pd_arg
def main():
    unittest.main()

if __name__ == "__main__":
    main()
