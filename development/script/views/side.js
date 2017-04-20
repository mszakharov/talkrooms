// Subscriptions
(function() {

    var $list = $('.side-subscriptions');

    var $other = $list.find('.subscriptions-other');

    var subscribed = [];
        isSubscribed = {};

    var lastRoom;
    var itemsIndex = {};

    var renderRoom = new Template('<li class="subscription"><a href="/#{hash}">{topic}</a></li>');

    function byAlias(a, b) {
        if (a.alias > b.alias) return  1;
        if (a.alias < b.alias) return -1;
        return 0;
    }

    // Normalize topic for case-insensitive sorting
    function setAlias(room) {
        room.alias = room.topic.toLowerCase();
    }

    function updateList() {
        itemsIndex = {};
        $list.find('.subscription').remove();
        if (lastRoom) {
            itemsIndex[lastRoom.hash] = $(renderRoom(lastRoom)).prependTo($list);
        }
        for (var i = subscribed.length; i--;) {
            var room = subscribed[i];
            itemsIndex[room.hash] = $(renderRoom(room)).prependTo($list);
        }
    }

    var $selected;

    function select($item) {
        if ($selected) {
            $selected.removeClass('subscription-selected');
            $selected = null;
        }
        if ($item) {
            $selected = $item.addClass('subscription-selected');
        }
    }

    Room.on('hall', function() {
        select($other);
    });

    Room.on('hash.selected', function() {
        select(itemsIndex[Room.hash]);
    });

    Room.on('enter', function() {
        if (!isSubscribed[Room.hash]) {
            lastRoom = Room.data;
            updateList();
            select(itemsIndex[Room.hash]);
        }
    });

    Socket.on('me.subscriptions.add', function (data) {
        setAlias(data);
        if (!isSubscribed[data.hash]) {
            subscribed.push(data);
            subscribed.sort(byAlias);
            isSubscribed[data.hash] = true;
            updateList();
        }
    });

    Socket.on('me.subscriptions.remove', function(data) {
        if (isSubscribed[data.hash]) {
            delete isSubscribed[data.hash];
            for (var i = subscribed.length; i--;) {
                if (subscribed[i].hash === data.hash) {
                    subscribed.splice(i, 1)[0];
                }
            }
            updateList();
        }
    });

    Me.ready.done(function() {
        subscribed = Me.subscriptions.map(function(subscription) {
            return $.extend({}, subscription.room);
        });
        subscribed.forEach(function(room) {
            setAlias(room);
            isSubscribed[room.hash] = true;
        });
        subscribed.sort(byAlias);
        updateList();
    });

})();

// Show other rooms on title click
$('.about-link').on('click', function(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    Room.showHall();
});


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
