// Update level
Room.on('user.level.updated', function(data) {
    var opened = Profile.socket;
    if (opened && opened.user_id === data.user_id) {
        opened.level = data.level;
        Profile.trigger('level.updated', opened);
    }
});

// Update ignored
Room.on('session.ignored.updated', function(data) {
    var opened = Profile.socket;
    if (opened && opened.session_id === data.session_id) {
        opened.ignored = data.ignored;
        Profile.trigger('ignored.updated', opened);
    }
});

// Check level
Profile.isCivilian = function() {
    var socket = this.socket;
    if (socket) {
        return !(socket.level && socket.level >= 50);
    }
};

// Roles section
(function() {

    var section = $('#profile-roles'),
        current = section.find('.roles-current');

    var roles = {
        10: 'Посетитель',
        20: 'Посетитель',
        50: 'Модератор',
        70: 'Администратор',
        80: 'Создатель комнаты'
    };

    function onShow(socket, me) {
        if (socket.user_id && !me && !socket.ignored && !socket.request_id) {
            var preview = Profile.isCivilian() === false;
            current.html(preview ? roles[socket.level] : '');
            section.removeClass('expanded').show();
        }
    }

    function onReady(data) {
        if (section.is(':visible') && (Room.admin || !Profile.isCivilian())) {
            current.html(roles[data.level]);
        } else {
            section.hide();
        }
    }

    function toggleEvents(on) {
        var mode = on ? 'on' : 'off';
        Profile[mode]('show', onShow);
        Profile[mode]('ready', onReady);
        Profile[mode]('level.updated', onReady);
        Profile[mode]('ignored.updated', onIgnored);
    }

    function onIgnored(session) {
        toggleSection(!session.ignored);
    }

    function toggleSection(on) {
        if (on) {
            onShow(Profile.socket, Room.isMy(Profile.socket));
            onReady(Profile.socket);
        } else {
            section.hide();
        }
        Profile.fit();
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

    var convict = section.find('.moder-convict'),
        decent = section.find('.moder-decent'),
        erase = section.find('.moder-erase')

    var selectedMessage;

    function toggleControls(socket) {
        if (socket.ignored) {
            showIgnored(socket.ignored)
            showConvict();
        } else {
            showDecent();
        }
    }

    function toggleErase(message) {
        if (message) {
            var time = message.find('.msg-time').text();
            erase.find('.erase-from').text(time);
            erase.show();
        } else {
            erase.hide();
        }
    }

    function showConvict() {
        toggleErase(selectedMessage);
        decent.hide();
        convict.show();
        Profile.fit();
    }

    function showIgnored(ignored) {
        var date = new Date(ignored);
        convict.find('.moder-ago')
            .attr('datetime', ignored)
            .attr('title', String.mix('Правосудие свершилось $1 в $2', date.toSmartDate(), date.toHumanTime()))
            .text(date.toHumanAgo());
    }

    function showDecent() {
        convict.hide();
        convict.find('.moder-ago').empty();
        decent.show();
        Profile.fit();
    }

    function isCurrent(session) {
        return Profile.socket && session.session_id === Profile.socket.session_id;
    }

    function getMessage(target) {
        var speech = target.closest('.speech');
        if (speech.length) {
            return speech.find('.message').first();
        }
    }

    function onShow(socket, me) {
        if (socket.session_id && !me && Profile.isCivilian() !== false) {
            selectedMessage = Profile.target && getMessage(Profile.target);
            section.children().hide();
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

    var skipWhip;
    function playWhip(session) {
        if (session.ignored) {
            if (session.session_id === skipWhip) {
                skipWhip = null;
            } else {
                whip.play(0.3);
            }
        }
    }

    function setIgnore(value) {
        return Rest.sessions.update(Profile.socket.session_id, {
            room_id: Room.data.room_id,
            ignore: value
        });
    }

    var whip = new Sound({
        mp3: '/script/sound/whip.mp3',
        ogg: '/script/sound/whip.ogg'
    });

    decent.find('.moder-ignore').on('click', function() {
        skipWhip = Profile.socket.session_id;
        whip.play(0.5);
        setIgnore(true).done(showConvict);
    });

    convict.find('.moder-release').on('click', function() {
        setIgnore(false).done(showDecent);
    });

    erase.on('click', function() {
        if (selectedMessage) {
            var message_id = selectedMessage.attr('data-id');
            Rest.messages.create(message_id + '/ignore_below').done(function() {
                Profile.target = null;
                erase.hide();
            });
        }
    });

    function onLevelUpdated() {
        section.show();
        section.children().hide();
        onReady(Profile.socket);
    }

    function toggleEvents(on) {
        var mode = on ? 'on' : 'off';
        Profile[mode]('show', onShow);
        Profile[mode]('ready', onReady);
        Profile[mode]('level.updated', onLevelUpdated);
        Profile[mode]('ignored.updated', toggleControls);
        Room[mode]('session.ignored.updated', playWhip);
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

// Requests
(function() {

    var requests = new Collection({
        index: 'request_id',
        order: 'nickname'
    });

    function getRequests() {
        return Rest.requests.get({room_id: Room.data.room_id}).done(reset);
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

    function removeRequest(request) {
        requests.remove(request.request_id);
        apply();
    }


    function toggleList(on) {
        var mode = on ? 'on' : 'off';
        Room[mode]('enter', getRequests);
        Room[mode]('request.created', addRequest);
        Room[mode]('request.deleted', removeRequest);
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

// Request section
(function() {

    var section = $('#profile-request');

    function onShow(socket, me) {
        if (socket.request_id) {
            section.show();
        }
    }

    function setApproved(value) {
        return Rest.requests.update(Profile.socket.request_id, {
            approved: value
        });
    }

    function hideCurrent(request) {
        if (Profile.socket && Profile.socket.request_id === request.request_id) {
            section.hide();
        }
    }

    function toggleSection(on) {
        var mode = on ? 'on' : 'off';
        Profile[mode]('show', onShow);
        Room[mode]('request.deleted', hideCurrent);
        if (Profile.socket && !on) {
            section.hide();
        }
    }

    section.find('.request-approve').on('click', function() {
        setApproved(true);
    });

    section.find('.request-reject').on('click', function() {
        setApproved(false).done(Profile.hide);
    });

    Room.on('moderator.changed', toggleSection);

    toggleSection(Room.moderator);

})();
