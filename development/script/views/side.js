// Toggle side lists
(function() {

    var rooms = $('.side-rooms'),
        users = $('.room-users');

    function showRooms() {
        users.hide();
        rooms.show();
    }

    $('.hall-link').on('click', function(event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        if (rooms.is(':hidden')) {
            showRooms();
        } else if (Room.subscription) {
            rooms.hide();
            users.show();
        }
    });

    Room.on('ready', function() {
        rooms.hide();
        users.fadeIn(150);
    });

    Room.on('leave', function() {
        users.hide();
    });

    Room.on('locked', showRooms);
    Room.on('closed', showRooms);
    Room.on('lost',   showRooms);

})();

// Room list
(function() {

    var lists = $('.rooms-lists'),
        recentList = new List(lists.find('.rooms-recent')),
        myList     = new List(lists.find('.rooms-my'));

    var renderLink = new Template('<li data-hash="{hash}"><a href="/#{hash}">{topic}</a></li>');

    function List(elem) {
        this.elem = elem;
    }

    List.prototype.update = function(rooms) {
        this.elem.find('ul').remove();
        if (rooms.length) {
            this.elem.append('<ul>' + rooms.map(renderLink).join('') + '</ul>');
            this.elem.show();
        } else {
            this.elem.hide();
        }
    };

    function updateLists() {
        recentList.update(Me.recent_rooms);
        myList.update(Me.rooms);
        if (Room.hash) {
            selectCurrent();
        }
    }

    function selectCurrent() {
        lists.find('li[data-hash="' + Room.hash + '"]').addClass('rooms-selected');
    }

    $('.rooms-shuffle > .link').on('click', function() {
        Room.shuffle();
    });

    $('.rooms-create > .link').on('click', function() {
        Room.create();
    });

    recentList.elem.find('.rooms-title').on('click', function() {
        recentList.elem.removeClass('rooms-folded');
        myList.elem.addClass('rooms-folded');
    });

    myList.elem.find('.rooms-title').on('click', function() {
        myList.elem.removeClass('rooms-folded');
        recentList.elem.addClass('rooms-folded');
    });

    Socket.on('me.recent_rooms.updated', updateLists);
    Socket.on('me.rooms.updated', updateLists);

    Me.ready.done(updateLists);

    Room.on('hash.selected', selectCurrent);

    Room.on('leave', function() {
        lists.find('.rooms-selected').removeClass('rooms-selected');
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
