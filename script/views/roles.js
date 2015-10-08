// Roles
(function() {

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
        if (Room.isSubordinate(data)) {
            inputs.filter('[value="' + data.level + '"]').prop('checked', true);
            current.removeClass('readonly');
        } else {
            current.addClass('readonly');
        }
        showLevel(data.level);
    }

    function showLevel(level) {
        current.html(titles[level]);
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

    function toggleEvents(on) {
        var mode = on ? 'on' : 'off';
        Profile[mode]('show', onShow);
        Profile[mode]('ready', onReady);
        Profile[mode]('level.updated', onReady);
    }

    function toggleAdminRole() {
        $('#role-admin').closest('.role').toggle(Room.socket.level === 80);
    }

    Room.on('enter', toggleAdminRole);

    Room.on('admin.changed', function(on) {
        toggleEvents(on);
    });

    toggleEvents(Room.admin);
    toggleAdminRole();

})();

