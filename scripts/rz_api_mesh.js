/**
 * API calls designed to execute in decentralized fashion
 */
define(['rz_api_backend'], function(rz_api_backend) {
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
