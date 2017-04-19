// Toggle users list
(function() {

    var users = $('.room-users');

    Room.on('ready', function() {
        users.fadeIn(150);
    });

    Room.on('leave', function() {
        users.hide();
    });

})();

// Format status
(function() {

    var roomUrl = /(^|\s)(#[\w\-+]+)\b/g;

    var emoji = /[\uD800-\uDBFF\uDC00-\uDFFF\u200D]+/g

    Room.formatStatus = function(status) {
        var s = status;
        if (~s.indexOf('#')) {
            s = s.replace(roomUrl, '$1<a class="room-link" target="_blank" href="/$2">$2</a>');
        }
        s = s.replace(emoji, '<span class="emoji">$&</span>');
        return s;
    };

})();

// Users list
(function() {

    var container = $('.room-users');
    var template = $.template('#user-template');

    function renderUser(data) {
        var user = template(data);
        if (data.status) {
            user.find('.nickname').append(' <em>' + Room.formatStatus(data.status) + '</em>');
        }
        if (data.role_id === Room.myRole.role_id) {
            user.addClass('me');
        }
        if (data.annoying) {
            user.addClass('annoying');
        }
        user.attr('data-role', data.role_id);
        return user[0];
    }

    function Group(selector) {
        this.elem = container.find(selector);
        this.list = this.elem.find('.users-list');
        this.amount = this.elem.find('.users-amount');
    }

    Group.prototype.show = function(users, sort) {
        this.list.html('');
        if (users.length) {
            this.amount.html(users.length);
            this.list.append(users.map(renderUser));
            if (sort) {
                this.list.find('.annoying').appendTo(this.list);
            }
            this.elem.show();
        } else {
            this.elem.hide();
        }
    };

    var onlineGroup = new Group('.users-online');
    var ignoreGroup = new Group('.users-ignored');

    Room.on('users.updated', function(online, ignore) {
        onlineGroup.show(online, Boolean(Room.ignores));
        ignoreGroup.show(ignore);
    });

    var requestsGroup = new Group('.users-requests');

    Room.on('requests.updated', function(requests) {
        requestsGroup.show(requests);
    });

    function getData(elem) {
        var role_id = Number(elem.attr('data-role'));
        return Room.roles.get(role_id) ||
            (Room.requests ? Room.requests.get(role_id) : undefined);
    }

    container.on('click', '.me, .userpic', function(event) {
        event.stopPropagation();
        var elem = $(this).closest('.user');
        if (elem.hasClass('me')) {
            Profile.edit(elem);
            $('#my-status').select();
        } else {
            Profile.show(getData(elem), {
                target: elem
            });
        }
    });

    container.on('click', '.user:not(.me) .nickname', function(event) {
        if (event.target.nodeName !== 'A') {
            var user = $(this).closest('.user');
            var data = getData(user);
            if (data.come_in != null) {
                Profile.show(data, {
                    target: user
                });
            } else {
                Room.replyTo(data);
            }
        }
    });

})();
