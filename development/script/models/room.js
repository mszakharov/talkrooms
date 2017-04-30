// Room
var Room = Events.mixin({});

Room.handleEvent = function(event) {
    var room_id = event[1].room_id;
    if (room_id && room_id !== this.id || !this.id) return;
    if (this.eventsBuffer) {
        this.eventsBuffer.push(event);
    } else {
        this.trigger(event[0], event[1]);
    }
};

// Enter a room
(function() {

    function subscribe(hash) {
        return Rest.rooms.create(hash, 'enter', {socket_id: Socket.id});
    }

    function subscribed(data) {
        Room.id = data.room.room_id;
        Room.data = data.room;
        Room.roles = new Room.Roles({
            room_id: Room.id,
            num_online_sockets: {'>': 0}
        });
        Room.roles.reset(data.roles_online);
        Room.myRole = data.role;
        Room.subscription = data.subscription.subscription_id;
        Room.eventsBuffer = [];
        Room.trigger('enter', Room.myRole);
        $.when.apply($, Room.promises).done(ready).fail(error);
    }

    function ready() {
        Room.trigger('ready');
        for (var i = 0; i < Room.eventsBuffer.length; i++) {
            var event = Room.eventsBuffer[i];
            Room.trigger(event[0], event[1]);
        }
        Room.eventsBuffer = null;
    }

    function error() {
        Room.trigger('error');
    }

    function denied(xhr) {
        if (xhr.status === 403) {
            locked(xhr.responseJSON);
        } else if (xhr.status === 404) {
            Room.trigger('lost');
        } else {
            Room.trigger('error', xhr.status);
        }
    }

    function locked(data) {
        if (Room.data.level === 80) {
            Room.trigger('closed');
        } else if (data && data.role_id) {
            Room.comeIn = data.role_id;
            Room.trigger('locked', true);
        } else {
            Room.trigger('locked');
        }
    }

    Room.enter = function(hash) {
        if (this.hash && this.hash !== hash) {
            this.leave();
        }
        this.hash = hash;
        this.promises = [];
        this.trigger('hash.selected');
        Socket.ready.done(function() {
            subscribe(hash).then(subscribed, denied);
        });
    };

    Room.leave = function() {
        Room.trigger('leave');
        if (Room.subscription) {
            Rest.subscriptions.destroy(Room.subscription);
            Room.subscription = null;
        }
        Room.myRole = null;
        Room.data = null;
        Room.hash = null;
        Room.id = null;
    };

    Room.on('role.come_in.updated', function(role) {
        if (Room.comeIn === role.role_id && role.come_in === null) {
            Room.comeIn = null;
            Rest.rooms.get(Room.hash).done(subscribe).fail(stop);
        }
    });

    Socket.on('created', function() {
        if (Room.subscription) {
            Rest.rooms.get(Room.hash).done(subscribe).fail(stop);
        }
    });

    Socket.on('me.user_id.updated', function() {
        if (Room.hash) {
            Socket.subscribe(Room.hash).done(enter).fail(locked);
        }
    });

    $window.on('beforeunload', function(event) {
        Room.leave();
    });

})();

// Compare role_id with my role
Room.isMy = function(data) {
    return this.myRole ? this.myRole.role_id === data.role_id : false;
};

// Update room
(function() {

    function patch(data) {
        $.extend(Room.data, data);
    }

    Room.on('room.hash.updated', function(data) {
        Room.hash = data.hash;
        Router.replace(data.hash, Room.data.topic);
    });

    Room.on('room.topic.updated', patch);
    Room.on('room.hash.updated', patch);
    Room.on('room.searchable.updated', patch);
    Room.on('room.watched.updated', patch);
    Room.on('room.level.updated', patch);
    Room.on('room.min_session_created.updated', patch);

})();

// Leave if subscription deleted
Room.on('subscription.deleted', function(data) {
    if (Room.subscription !== data.subscription_id) return;
    if (Room.data.level === 80) {
        Room.trigger('closed');
    } else if (Room.myRole.level < Room.data.level) {
        Room.comeIn = data.role_id;
        Room.trigger('locked', true);
    }
});

// Delete room
Room.on('room.deleted.updated', function(data) {
    if (!data.deleted) return;
    if (Room.myRole.level === 80) {
        Room.trigger('deleted');
        Room.trigger('leave');
    } else {
        Room.trigger('closed');
        Room.leave();
    }
})

// Update my nickname
Room.on('role.nickname.updated', function(role) {
    if (Room.myRole.role_id === role.role_id) {
        Room.myRole.nickname = role.nickname;
        Room.trigger('my.nickname.updated', role);
    }
});

// Update my status
Room.on('role.status.updated', function(role) {
    if (Room.myRole.role_id === role.role_id) {
        Room.myRole.status = role.status;
    }
});

// Ignored
Room.on('role.ignored.updated', function(role) {
    if (Room.myRole.role_id === role.role_id) {
        Room.myRole.ignored = role.ignored;
    }
});

// Update my userpic
Room.on('user.userpic.updated', function(user) {
    if (Room.myRole.user_id === user.user_id) {
        Room.myRole.userpic = user.userpic;
        Room.trigger('my.userpic.updated', user);
    }
});

// Update my photo
Room.on('user.photo.updated', function(user) {
    if (Room.myRole.user_id === user.user_id) {
        Room.myRole.photo = user.photo;
    }
});

// Ignores
(function() {

    function isEmpty(ignores) {
        return $.isEmptyObject(ignores[0]) && $.isEmptyObject(ignores[1]);
    }

    function isActive(ignores) {
        return ignores && !Room.moderator && !isEmpty(ignores);
    }

    function inIgnores(data) {
        return Boolean(data.user_id ?
            Me.ignores[0][data.user_id] :
            Me.ignores[1][data.session_id]);
    }

    function updateIgnores(data) {
        Me.ignores = data.ignores;
        toggleIgnores();
    }

    function toggleIgnores() {
        Room.ignores = isActive(Me.ignores) ? inIgnores : false;
    }

    Room.on('me.ignores.updated', updateIgnores);
    Room.on('moderator.changed', toggleIgnores);
    Room.on('ready', toggleIgnores);

})();


// Check permissions
(function() {

    function checkLevel() {
        var level = Room.myRole.level || 0;
        setModer(level >= 50);
        setAdmin(level >= 70);
    }

    function setModer(on) {
        if (Room.moderator === on) return;
        if (Room.moderator = on) {
            $.require('views/moderate.js');
            $.require('views/settings.js');
        }
        Room.trigger('moderator.changed', on);
    }

    function setAdmin(on) {
        if (Room.admin === on) return;
        if (Room.admin = on) {
            $.require('views/ranks.js');
        }
        Room.trigger('admin.changed', on);
    }

    Room.on('role.level.updated', function(data) {
        if (Room.myRole.role_id === data.role_id) {
            Room.myRole.level = data.level;
            checkLevel();
        }
    });

    Room.on('enter', checkLevel);

})();

// Hall
Room.showHall = function() {
    this.leave();
    this.trigger('hall');
};

// Create and shuffle
(function() {

    function changeRoom(data) {
        Router.push(data.hash);
    }

    function shuffleFailed() {
        Room.trigger('shuffle.failed');
    }

    Room.create = function() {
        return Rest.rooms.create().done(changeRoom);
    };

    Room.shuffle = function() {
        return Rest.rooms.create('search')
            .done(changeRoom)
            .fail(shuffleFailed);
    };

})();

// Inactive window detection
(function() {

    $window.on('blur', function() {
        Room.idle = true;
    });

    $window.on('focus', function() {
        Room.idle = false;
    });

})();
