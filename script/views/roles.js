// Roles
(function() {

    var section = $('#profile-roles'),
        current = section.find('.roles-current'),
        inputs = section.find('input');

    function isSubordinate(user) {
        var myLevel = Room.socket.level;
        return Boolean(myLevel && (!user.level || myLevel > user.level));
    }

    function onReady(data) {
        if (isSubordinate(data)) {
            inputs.filter('[value="' + data.level + '"]').prop('checked', true);
            current.addClass('editable');
        } else {
            current.removeClass('editable');
            section.removeClass('expanded');
            Profile.fit();
        }
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
        if (current.hasClass('editable')) {
            section.addClass('expanded');
            Profile.fit();
        }
    });

    inputs.on('click', function() {
        var level = Number(this.value);
        if (level !== Profile.socket.level) {
            var label = $(this).closest('.role').find('label');
            current.html(label.text());
            setLevel(level);
        }
    });

    function toggleEvents(on) {
        var mode = on ? 'on' : 'off';
        Profile[mode]('ready', onReady);
        Profile[mode]('level.updated', onReady);
    }

    function toggleValues() {
        $('#role-admin').closest('.role').toggle(Room.socket.level === 80);
        $('#role-guest').attr('value', Room.data.level);
    }

    function toggleSection(on) {
        toggleEvents(on);
        if (Profile.socket) {
            onReady(Profile.socket);
        }
    }

    Room.on('enter', toggleValues);
    Room.on('level.changed', toggleValues);

    Room.on('admin.changed', toggleSection);

    toggleSection(Room.admin);
    toggleValues();

})();

