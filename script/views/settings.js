(function() {

    var icon = $('.room-settings-icon');
    var form = $.popup('#room-settings', function() {
        form.find('.error').remove();
        topic.val(Room.data.topic);
        hash.val(Room.data.hash).removeClass('invalid');
        searchable.prop('checked', Room.data.searchable);
        submit.prop('disabled', false);
        this.fadeIn(120);
    });

    function validateHash(value, full) {
        if (/[^a-zA-Z\d\-+]/.test(value)) return false;
        if (full && value.length < 3) return false;
        if (value.length > 32) return false;
        return true;
    }

    var topic = $('#edit-room-topic');
    topic.on('change', function() {
        this.value = this.value.trim();
    });

    var hash = $('#edit-room-hash');
    hash.on('input', function() {
        hash.toggleClass('invalid', !validateHash(this.value));
    });
    hash.on('change', function() {
        var value = this.value.trim();
        var valid = validateHash(value, true);
        hash.toggleClass('invalid', !valid);
        this.value = value;
    });

    var searchable = $('#edit-room-searchable');

    var submit = form.find('button[type="submit"]');

    icon.on('click', function() {
        form.show();
    });

    form.on('submit', function(event) {
        event.preventDefault();
        if (!submit.prop('disabled')) {
            updateRoom();
        }
    });

    function filterChanged(data) {
        var empty = true;
        var changed = {};
        for (var key in data) {
            var value = data[key];
            if (value !== Room.data[key]) {
                changed[key] = value;
                empty = false;
            }
        }
        if (!empty) {
            return changed;
        }
    }

    function updateRoom() {
        var data = filterChanged({
            topic: topic.val(),
            hash: hash.val(),
            searchable: searchable.prop('checked') ? 1 : 0
        });
        if (!data) {
            form.hide();
        } else if (data.topic === '') {
            topic.val().focus();
        } else if (data.hash && !validateHash(data.hash, true)) {
            hash.focus();
        } else {
            submit.prop('disabled', true);
            Rest.rooms
                .update(Room.data.hash, data)
                .always(function() {
                    submit.prop('disabled', false);
                })
                .done(function() {
                    form.hide();
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

    function toggle() {
        icon.toggle(Room.admin === true);
    }

    Room.on('admin.changed', function() {
        toggle();
        if (!Room.admin && form.is(':visible')) {
            form.hide();
        }
    });

    toggle();

})();
