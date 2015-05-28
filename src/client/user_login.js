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

"use strict"

function submit_login_form() {
    var data = {
        email_address : $('#login_email_address').val(),
        password : $('#login_password').val()
    };

    // TODO: validate

    $.ajax({
        type : "POST",
        url: '/login',
        async : false,
        cache : false,
        data : JSON.stringify(data),
        dataType : 'json',
        contentType : "application/json; charset=utf-8",
        success : function () {
            document.location = "/index";
        },
        error : function (xhr, status, err_thrown) {
            $('#login-view_failed-login').show();
        }
    });
}
