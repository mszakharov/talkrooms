// Users list
(function() {

    var container = $('#room .room-users');
    var template = $.template('#user-template');

    function renderUser(data) {
        var user = template(data);
        if (data.status) {
            user.find('.nickname').append(' <em>' + formatStatus(data.status) + '</em>');
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

    var roomUrl = /(^|\s)(#[\w\-+]+)\b/g;

    function formatStatus(status) {
        return ~status.indexOf('#') ?
            status.replace(roomUrl, '$1<a class="room-link" target="_blank" href="/$2">$2</a>') :
            status;
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

    Room.on('ready', function() {
        container.fadeIn(150);
    });

    Room.on('leave', hideList);
    Room.on('locked', hideList);
    Room.on('closed', hideList);
    Room.on('lost', hideList);

    function hideList() {
        container.hide();
    }

    function getData(elem) {
        var role_id = Number(elem.attr('data-role'));
        return Room.users.get(role_id) || Room.requests.get(role_id);
    }

    container.on('click', '.me, .userpic', function(event) {
        event.stopPropagation();
        var elem = $(this).closest('.user');
        if (elem.hasClass('me')) {
            Profile.edit(elem);
            $('#my-status').select();
        } else {
            Profile.show(getData(elem), elem);
        }
    });

    container.on('click', '.user:not(.me) .nickname', function(event) {
        if (event.target.nodeName !== 'A') {
            var user = $(this).closest('.user');
            var data = getData(user);
            if (data.come_in != null) {
                Profile.show(data, user);
            } else {
                Room.replyTo(data);
            }
        }
    });

})();

// Create a room
$('.room-create .create-link').on('click', function() {
    Room.create();
});
