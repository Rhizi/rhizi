import inspect
import logging
import tempfile
import unittest

import db_controller as dbc
from db_op import DBO_cypher_query
from domain_cri import DBO_random_data_generation__domain__CRI
from rz_server import Config


class Test_Domain_CRI(unittest.TestCase):

    @classmethod
    def setUpClass(self):
        cfg = Config.init_from_file('res/etc/rhizi-server.conf')
        self.db_ctl = dbc.DB_Controller(cfg)
        self.log = logging.getLogger('rhizi')
        self.log.addHandler(logging.StreamHandler())

    def test_random_data_generation__domain__CRI(self, export_as_csv=True):
        """
        test:
           - random CRI domain data generation
           - DB dump in cvs format: person x skill x skill-level
        """
        op = DBO_random_data_generation__domain__CRI()
        self.db_ctl.exec_op(op)

        if False == export_as_csv:
            return

        q_arr = ['match (n: Person)',
                 'with n',
                 'match (n)-[r:Novice|Intermediate|Expert]->(m:Skill)',  # [!] expect link type to be proficiency level
                 'return n.name, collect({skill_name: m.name, skill_level: r.proficiency})'
                 ]
        op = DBO_cypher_query(q_arr)

        cur_f_name = inspect.stack()[0][3]
        def q_process_result_set():
            with tempfile.NamedTemporaryFile(prefix='rz_%s' % (cur_f_name), dir='/tmp', suffix='.csv', delete=False) as f_out:
                for _, _, r_set in op:
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

if __name__ == "__main__":
    unittest.main()
