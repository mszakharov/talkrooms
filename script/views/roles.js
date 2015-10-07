// Roles
(function() {

    var myLevel,
        isActive;

    var section = $('#profile-roles'),
        current = section.find('.roles-current'),
        inputs = section.find('input');

    var titles = {
        10: 'Посетитель',
        50: 'Модератор',
        70: 'Администратор',
        80: 'Создатель комнаты'
    };

    function onShow(socket, me) {
        if (socket.user_id && !me) {
            current.html(titles[10]);
            section.removeClass('expanded').show();
        }
    }

    function onReady(data) {
        if (section.is(':hidden')) return;
        if (data.level < myLevel) {
            inputs.filter('[value="' + data.level + '"]').prop('checked', true);
        }
        showLevel(data.level);
    }

    function checkLevel(socket) {
        myLevel = socket.level || 0;
        var active = myLevel >= 70;
        if (active !== isActive) {
            isActive = active;
            toggleEvents(active ? 'on' : 'off');
        }
    }

    function toggleEvents(mode) {
        Profile[mode]('show', onShow);
        Profile[mode]('ready', onReady);
    }

    function showLevel(level) {
        current.html(titles[level]).toggleClass('readonly', level >= myLevel);
    }

    function setLevel(level) {
        Rest.roles
            .update(Room.data.room_id, Profile.socket.user_id, {
                level: level
            })
            .done(collapse);
    }

    function collapse() {
        section.removeClass('expanded');
        Profile.fit();
    }

    function isCurrent(user) {
        return Profile.socket && user.user_id === Profile.socket.user_id;
    }

    current.on('click', function() {
        if (!current.hasClass('readonly')) {
            section.addClass('expanded');
            Profile.fit();
        }
    });

    inputs.on('click', function() {
        var level = Number(this.value);
        if (level !== Profile.socket.level) {
            showLevel(level);
            setLevel(level);
        }
    });

    Room.on('enter', checkLevel);

    Room.on('user.level.updated', function(data) {
        if (isCurrent(data) && data.level !== Profile.socket.level) {
            Profile.socket.level = data.level;
            onReady(Profile.socket);
        }
    });

    checkLevel(Room.socket || {});


})();

