/*
    This file is part of rhizi, a collaborative knowledge graph editor.
    Copyright (C) 2014-2015  Rhizi

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * API calls designed to execute in decentralized fashion
 */
define(['rz_api_backend'],
function(rz_api_backend) {
    function RZ_API_Mesh() {
        
        /**
         * suggest diff block and await commit/reject consensus
         */
        // @ajax-trans
        this.broadcast_possible_next_diff_block = function (diff_set) {
            
            function on_success(data){
                // TODO impl
            }
            
            rz_api_backend.commit_diff_set(diff_set);
        }
    }
    return new RZ_API_Mesh();
});
