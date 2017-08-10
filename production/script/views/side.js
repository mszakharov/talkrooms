// Subscriptions
(function() {

    var $list = $('.side-subscriptions');
    var $other = $list.find('.subscriptions-other');

    var $exit = $('<span class="subscription-exit" title="Выйти из комнаты"></span>');

    var index = {};

    var renderRoom = new Template('<li class="subscription"><a href="/#{hash}">{topic}</a></li>');

    var $selected;

    function updateList() {
        var nodes = [];
        index = {};
        Rooms.forEach(function(room) {
            var $item = $(renderRoom(room.data));
            if (room.unread) {
                $item.addClass('subscription-unread');
            }
            nodes.push($item[0]);
            index[room.data.hash] = $item;
        });
        $exit.detach();
        $list.find('.subscription').remove();
        $list.prepend(nodes);
        if (Rooms.selected) {
            select(index[Rooms.selected.data.hash]);
        }
    }

    function select($item) {
        if ($selected) {
            $selected.removeClass('subscription-selected');
            $selected = null;
        }
        if ($item) {
            $selected = $item.addClass('subscription-selected');
        }
        if ($item && $item !== $other) {
            $exit.appendTo($item);
        } else {
            $exit.detach();
        }
    }

    $exit.on('click', function() {
        Rooms.remove(Rooms.selected.data.room_id);
    });

    Rooms.on('explore', function() {
        select($other);
    });

    Rooms.on('select', function(room) {
        select(index[room.data.hash]);
    });

    Rooms.on('updated', updateList);

    updateList();

})();

// Show other rooms on title click
$('.about-link').on('click', function(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    Router.push('+');
});

// Roles list
(function() {

    var container = $('.room-users');
    var template = $.template('#user-template');

    function renderStatus(status) {
        return ' <em>' + Rooms.Roles.formatStatus(status) + '</em>';
    }

    function renderRole(data) {
        if (!data.userpicUrl) {
            data.userpicUrl = Userpics.getUrl(data);
        }
        var $role = template(data);
        if (data.status) {
            $role.find('.nickname').append(renderStatus(data.status));
        }
        if (data.role_id === Rooms.selected.myRole.role_id) {
            $role.addClass('me');
        }
        if (data.annoying) {
            $role.addClass('annoying');
        }
        $role.attr('data-role', data.role_id);
        return $role[0];
    }

    function Group(selector) {
        this.elem = container.find(selector);
        this.list = this.elem.find('.users-list');
        this.amount = this.elem.find('.users-amount');
    }

    Group.prototype.show = function(roles) {
        this.list.html('');
        if (roles.length) {
            this.amount.html(roles.length);
            this.list.append(roles.map(renderRole));
            this.elem.show();
        } else {
            this.elem.hide();
        }
    };

    var onlineGroup  = new Group('.users-online');
    var ignoredGroup = new Group('.users-ignored');
    var waitingGroup = new Group('.users-requests');

    function showOnline(room) {

        var useHidden = !room.myRole.isModerator;
        var useIgnored = !room.myRole.ignored;

        var online  = [],
            hidden  = [],
            ignored = [];

        room.rolesOnline.items.forEach(function(role) {
            if (useIgnored && role.ignored) {
                role.annoying = false;
                ignored.push(role);
            } else if (useHidden && Me.isHidden(role)) {
                role.annoying = true;
                hidden.push(role);
            } else {
                role.annoying = false;
                online.push(role);
            }
        });

        online = online.concat(hidden);

        onlineGroup.show(online);
        ignoredGroup.show(room.myRole.isModerator ? ignored : []);

    }

    function showWaiting(room) {
        waitingGroup.show(room.myRole.isModerator ? room.rolesWaiting.items : []);
    }

    Rooms.on('explore', function() {
        container.hide();
    });

    Rooms.on('select', function() {
        container.hide();
    });

    Rooms.on('selected.ready', function(room) {
        showOnline(room);
        showWaiting(room);
        container.show();
    });

    Rooms.on('selected.denied', function(room) {
        container.hide();
    });

    Rooms.on('selected.roles.updated', showOnline);

    Rooms.on('selected.waiting.updated', showWaiting);

    // Update ignored and hidden groups
    Rooms.on('my.rank.changed', showOnline);

    Me.on('ignores.updated', function() {
        if (Rooms.selected && Rooms.selected.subscription) {
            showOnline(Rooms.selected);
        }
    });

    function getData(elem) {
        var room = Rooms.selected;
        var role_id = Number(elem.attr('data-role'));
        return room.rolesOnline.get(role_id) || room.rolesWaiting.get(role_id);
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
