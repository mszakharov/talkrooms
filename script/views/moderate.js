/* Ignore */
(function() {

    var myLevel;
    var section = $('#profile-moderate');

    var convict = section.find('.moder-convict'),
        decent = section.find('.moder-decent'),
        erase = section.find('.moder-erase')

    var selectedMessage;

    function toggleControls(socket) {
        if (socket.ignore) showConvict(); else showDecent();
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

    function showDecent() {
        convict.hide();
        decent.show();
        Profile.fit();
    }

    function isCurrent(session) {
        return Profile.socket && session.session_id === Profile.socket.session_id;
    }

    function onShow(socket, me) {
        if (socket.session_id && !me) {
            var message = Profile.target && Profile.target.closest('.message');
            selectedMessage = (message && message.length) ? message : null;
            section.children().hide();
            section.show();
        }
    }

    function onReady(data) {
        if (section.is(':hidden')) return;
        if (data.level && data.level >= myLevel) {
            section.find('.moder-safe').show();
            Profile.fit();
        } else {
            toggleControls(Profile.socket);
        }
    }

    var skipWhip;
    function onUpdated(session) {
        if (isCurrent(session)) {
            toggleControls(session);
        }
        if (session.ignore) {
            if (session.session_id === skipWhip) {
                skipWhip = null;
            } else {
                playWhip(0.3);
            }
        }
    }

    function setIgnore(value) {
        return Rest.sessions.update(Profile.socket.session_id, {
            room_id: Room.data.room_id,
            ignore: value
        });
    }

    var whip = new Audio('/script/sound/whip.mp3');
    function playWhip(volume) {
        whip.volume = volume || 0.5;
        whip.currentTime = 0;
        whip.play();
    }

    decent.find('.moder-ignore').on('click', function() {
        skipWhip = Profile.socket.session_id;
        playWhip(0.5);
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

    var isActive;
    function checkLevel(socket) {
        myLevel = socket.level || 0;
        var active = myLevel >= 50;
        if (active !== isActive) {
            isActive = active;
            toggleEvents(active ? 'on' : 'off');
        }
    }

    function toggleEvents(mode) {
        Profile[mode]('show', onShow);
        Profile[mode]('ready', onReady);
        Room[mode]('session.ignore.updated', onUpdated);
    }

    Room.on('enter', checkLevel);

    checkLevel(Room.socket || {});

})();
