// Room settings section
(function() {

    var form = $('#settings-admin');

    var topic = $('#edit-room-topic');
    var hash = $('#edit-room-hash');
    var searchable = $('#edit-room-searchable');
    var watched = $('#edit-room-watched');
    var levels = form.find('.room-levels input');
    var closed = levels.filter('[value="80"]').closest('.checkbox');

    var submit = Settings.find('.submit button');
    var remove = Settings.find('.room-remove');

    searchable.prop('disabled', true);

    function toggleControls(room) {
        var myRole = room.myRole;
        var isCreator = myRole.level === 80;
        if (myRole.isAdmin) {
            updateControls(room.data, isCreator);
            closed.toggle(isCreator);
            hash.parent().toggle(Boolean(isCreator && myRole.user_id));
            form.find('.settings-login').toggle(!Me.authorized && isCreator);
            form.show();
            submit.closest('.submit').show();
            remove.toggle(isCreator && room.data.level === 80);
        } else {
            form.hide();
            submit.closest('.submit').hide();
            remove.hide();
        }
    }

    function updateControls(data, isCreator) {
        topic.val(data.topic);
        hash.val(data.hash).removeClass('invalid');
        searchable.prop('checked', data.searchable);
        searchable.closest('.checkbox').toggle(Boolean(data.searchable));
        watched.prop('checked', data.watched);
        levels.filter('[value="' + data.level + '"]').prop('checked', true);
        toggleSearchable(data.level < 20);
    }

    function toggleSearchable(visible) {
        searchable.closest('.settings-section').toggle(visible);
    }

    function toggleRemove(visible) {
        var me = Rooms.selected.myRole;
        remove.toggle(visible && me.level === 80);
    }

    function validateHash(value, full) {
        if (/[^a-zA-Z\d\-+]/.test(value)) return false;
        if (full && value.length < 3) return false;
        if (value.length > 32) return false;
        return true;
    }

    function filterChanged(current, data) {
        var empty = true;
        var changed = {};
        for (var key in data) {
            var value = data[key];
            if (value !== current[key]) {
                changed[key] = value;
                empty = false;
            }
        }
        if (!empty) {
            return changed;
        }
    }

    function updateRoom(room) {
        var data = filterChanged(room.data, {
            topic: topic.val(),
            hash: hash.val(),
            //searchable: searchable.prop('checked') ? 1 : 0,
            watched: watched.prop('checked') ? 1 : 0,
            level: Number(levels.filter(':checked').attr('value') || room.data.level)
        });
        if (!data) {
            Settings.hide();
        } else if (data.topic === '') {
            topic.val().focus();
        } else if (data.hash && !validateHash(data.hash, true)) {
            hash.focus();
        } else {
            submit.prop('disabled', true);
            Rest.rooms
                .update(room.data.hash, data)
                .always(function() {
                    submit.prop('disabled', false);
                })
                .done(function() {
                    Settings.hide();
                })
                .fail(showError);
        }
    }

    function showError(error) {
        if (error.status === 409) {
            var context = hash.parent();
            context.append('<p class="error">Увы, этот адрес уже занят, выберите другой</p>');
            hash.one('input', function() {
                context.find('.error').remove();
            });
        }
    }

    topic.on('change', function() {
        this.value = this.value.trim();
    });

    hash.on('input', function() {
        hash.toggleClass('invalid', !validateHash(this.value));
    });

    hash.on('change', function() {
        var value = this.value.trim();
        var valid = validateHash(value, true);
        hash.toggleClass('invalid', !valid);
        this.value = value;
    });

    levels.on('click', function() {
        var level = Number(this.value);
        toggleSearchable(level < 20);
        toggleRemove(level === 80);
    });

    form.on('submit', function(event) {
        event.preventDefault();
        if (!Rooms.selected.myRole.isAdmin) {
            Settings.hide();
        } else if (!submit.prop('disabled')) {
            updateRoom(Rooms.selected);
        }
    });

    submit.on('click', function() {
        if (!this.disabled) {
            updateRoom(Rooms.selected);
        }
    });

    remove.find('.link').on('click', function() {
        var room = Rooms.selected;
        Rest.rooms
            .update(room.data.hash, {deleted: true})
            .then(function() {
                Settings.hide();
            });
    });

    Rooms.on('my.rank.updated', toggleControls);
    Rooms.on('selected.ready', toggleControls);

    if (Rooms.selected && Rooms.selected.myRole) {
        toggleControls(Rooms.selected);
    }

})();

// Restore deleted room
$('.entry-restore').on('click', function() {
    var room = Rooms.selected;
    Rooms.restore(room).fail(function() {
        room.leave();
        alert('Восстановление уже невозможно');
    });
});
