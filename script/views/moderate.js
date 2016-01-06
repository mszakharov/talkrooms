// Requests
(function() {

    var requests = new Collection({
        index: 'role_id',
        order: 'nickname'
    });

    function getRequests() {
        if (Room.moderator && Room.data.level !== 80) {
            return Rest.roles.get({room_id: Room.data.room_id, come_in: true}).done(reset);
        } else {
            requests.raw = [];
            apply();
        }
    }

    function reset(data) {
        requests.raw = data;
        requests.raw.forEach(setUserpicUrl);
        requests.sort();
        apply();
    }

    function setUserpicUrl(request) {
        request.userpicUrl = Userpics.getUrl(request);
    }

    function apply() {
        Room.trigger('requests.updated', requests.raw);
    }

    function addRequest(request) {
        if (!requests.get(request.request_id)) {
            setUserpicUrl(request);
            requests.add(request);
            apply();
        }
    }

    function toggleRequest(role) {
        if (role.come_in) {
            addRequest(role);
        } else {
            requests.remove(role.role_id);
            apply();
        }
    }

    function toggleList(on) {
        var mode = on ? 'on' : 'off';
        Room[mode]('enter', getRequests);
        Room[mode]('role.come_in.updated', toggleRequest);
        if (on) {
            Room.requests = requests;
            getRequests();
        } else {
            Room.requests = null;
            Room.trigger('requests.updated', []);
        }
    }

    Room.on('moderator.changed', toggleList);

    toggleList(Room.moderator);

})();

// Update level
Room.on('role.level.updated', function(data) {
    var opened = Profile.socket;
    if (opened && opened.role_id === data.role_id) {
        opened.level = data.level;
        Profile.trigger('level.updated', opened);
    }
});

// Update ignored
Room.on('role.ignored.updated', function(data) {
    var opened = Profile.socket;
    if (opened && opened.role_id === data.role_id) {
        opened.ignored = data.ignored;
        Profile.trigger('ignored.updated', opened);
    }
});

// Update come_in
Room.on('role.come_in.updated', function(data) {
    var opened = Profile.socket;
    if (opened && opened.role_id === data.role_id) {
        opened.come_in = data.come_in;
        Profile.trigger('come_in.updated', opened);
    }
});

// Check level
Profile.isCivilian = function() {
    var socket = this.socket;
    if (socket) {
        return !(socket.level && socket.level >= 50);
    }
};

// Levels section
(function() {

    var section = $('#profile-roles'),
        current = section.find('.roles-current');

    var levels = {
        50: 'Модератор',
        70: 'Администратор',
        80: 'Создатель комнаты',
    };

    function getLevel(role) {
        return levels[role.level] || 'Посетитель';
    }

    function canEnter(role) {
        return (role.level || 0) >= Room.data.level && !role.ignored;
    }

    function onShow(socket, me) {
        if (!me && canEnter(socket)) {
            var preview = Profile.isCivilian() === false;
            current.html(preview ? getLevel(socket) : '');
            section.removeClass('expanded').show();
        }
    }

    function onReady(data) {
        if (!Room.isMy(data) && canEnter(data) && (Room.admin || !Profile.isCivilian())) {
            current.html(getLevel(data));
            section.removeClass('expanded').show();
        } else {
            section.hide();
        }
        Profile.fit();
    }

    function toggleEvents(on) {
        var mode = on ? 'on' : 'off';
        Profile[mode]('show', onShow);
        Profile[mode]('ready', onReady);
        Profile[mode]('level.updated', onReady);
        Profile[mode]('ignored.updated', onReady);
    }

    function toggleSection(on) {
        if (on) {
            onReady(Profile.socket);
        } else {
            section.hide();
            Profile.fit();
        }
    }

    function toggle(on) {
        toggleEvents(on);
        if (Profile.socket) {
            toggleSection(on);
        }
    }

    Room.on('moderator.changed', toggle);

    toggle(Room.moderator);

})();

// Moderate section
(function() {

    var section = $('#profile-moderate');

    var controls = section.children(),
        request = section.find('.moder-request'),
        banish = section.find('.moder-banish'),
        banished = section.find('.moder-banished'),
        ignore = section.find('.moder-ignore'),
        ignored = section.find('.moder-ignored'),
        erase = section.find('.moder-erase');

    var selectedMessage;

    function toggleControls(role) {
        controls.hide();
        if (role.level < Room.data.level) {
            if (role.come_in === 0) {
                banished.show();
                showErase();
            } else {
                request.show();
            }
        } else if (Room.data.level >= 20) {
            banish.show();
        } else if (role.ignored) {
            showIgnored(role.ignored);
            showErase();
        } else {
            ignore.show();
        }
        Profile.fit();
    }

    function showErase() {
        if (selectedMessage) {
            var time = selectedMessage.find('.msg-time').text();
            erase.find('.erase-from').text(time);
            erase.show();
        }
    }

    function hideErase() {
        Profile.target = null;
        erase.hide();
    }

    function showIgnored(since) {
        var date = new Date(since);
        ignored.find('.moder-ago')
            .attr('datetime', since)
            .attr('title', String.mix('Правосудие свершилось $1 в $2', date.toSmartDate(), date.toHumanTime()))
            .text(date.toHumanAgo());
        ignored.show();
    }

    function getMessage(target) {
        var speech = target.closest('.speech');
        if (speech.length) {
            return speech.find('.message').first();
        }
    }

    function onShow(role, me) {
        if (!me && Profile.isCivilian() !== false) {
            selectedMessage = Profile.target && getMessage(Profile.target);
            controls.hide();
            section.show();
        }
    }

    function onReady(data) {
        if (section.is(':hidden')) return;
        if (Profile.isCivilian()) {
            toggleControls(Profile.socket);
            section.show();
        } else {
            section.hide();
        }
    }

    var whipped;
    var whip = new Sound({
        mp3: '/script/sound/whip.mp3',
        ogg: '/script/sound/whip.ogg'
    });

    function playWhip(role) {
        if (role.ignored) {
            if (role.role_id === whipped) {
                whipped = null;
            } else {
                whip.play(0.3);
            }
        }
    }

    function updateRole(data) {
        return Rest.roles.update(Profile.socket.role_id, data);
    }

    ignore.find('.button').on('click', function() {
        whipped = Profile.socket.role_id;
        whip.play(0.5);
        updateRole({ignored: true});
    });

    ignored.find('.moder-release').on('click', function() {
        updateRole({ignored: false});
    });

    banish.find('.button').on('click', function() {
        updateRole({level: Profile.socket.user_id ? 10 : 0, come_in: false});
    });

    banished.find('.moder-release').on('click', function() {
        updateRole({level: Room.data.level, come_in: null});
    });

    erase.on('click', function() {
        if (selectedMessage) {
            var message_id = selectedMessage.attr('data-id');
            Rest.messages.create(message_id + '/ignore_below').done(hideErase);
        }
    });

    request.find('.request-approve').on('click', function() {
        updateRole({level: Room.data.level, come_in: null});
    });

    request.find('.request-reject').on('click', function() {
        updateRole({come_in: false});
    });

    function onLevelUpdated() {
        section.show();
        onReady(Profile.socket);
    }

    function onRoomUpdated() {
        if (Profile.socket && section.is(':visible')) {
            toggleControls(Profile.socket);
        }
    }

    function toggleEvents(on) {
        var mode = on ? 'on' : 'off';
        Profile[mode]('show', onShow);
        Profile[mode]('ready', onReady);
        Profile[mode]('level.updated', onLevelUpdated);
        Profile[mode]('come_in.updated', toggleControls);
        Profile[mode]('ignored.updated', toggleControls);
        Room[mode]('room.level.updated', onRoomUpdated);
        Room[mode]('role.ignored.updated', playWhip);
    }

    function toggleSection(on) {
        toggleEvents(on);
        if (Profile.socket) {
            if (on) {
                onShow(Profile.socket, Room.isMy(Profile.socket));
                onReady(Profile.socket);
            } else {
                section.hide();
            }
            Profile.fit();
        }
    }

    Room.on('moderator.changed', toggleSection);

    toggleSection(Room.moderator);

})();
