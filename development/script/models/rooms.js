// Rooms collection
(function() {

    var Rooms = new Events();

    var subscriptions = [];
    var temporary;

    var selected = new Events();

    // Compare function for sorting
    function byAlias(a, b) {
        if (a.alias > b.alias) return  1;
        if (a.alias < b.alias) return -1;
        return 0;
    }

    Rooms.byHash = {};
    Rooms.byId   = {};

    Rooms.index = function(room) {
        this.byHash[room.data.hash] = room;
        if (room.data.room_id) {
            this.byId[room.data.room_id] = room;
        }
    };

    Rooms.select = function(hash) {

        var room = this.byHash[hash];

        // Если такой комнаты ещё нет, создаём её
        if (!room) {
            room = new Room({hash: hash, topic: '#' + hash});
        }

        selected.room = room;
        this.trigger('select', room);

    };

    Rooms.reset = function(data) {

        this.byHash = {};
        this.byId   = {};

        subscriptions = data.map(function(room_data) {
            var room = new Rooms.Room(room_data);
            Rooms.index(room);
            return room;
        });

        subscriptions.sort(byAlias);

        this.trigger('updated');

    };

    Rooms.forEach = function(callback) {
        subscriptions.forEach(callback, this);
        if (temporary) {
            callback.call(this, temporary);
        }
    };

    Rooms.updateTopic = function(room, topic) {
        room.data.topic = topic;
        setAlias(room);
        subscriptions.sort(byAlias);
        this.trigger('updated');
    };

    Rooms.updateHash = function(room, hash) {
        delete this.byHash[room.data.hash];
        this.byHash[hash] = room;
        room.data.hash = hash;
        this.trigger('updated');
    };

    Socket.on('me.subscriptions.add', function(data) {

        var room;

        // If subscribed to temporary room, use it
        if (temporary && temporary.room_id === data.room_id) {
            room = temporary;
            temporary = null;
        } else {
            room = new Rooms.Room(data);
            Rooms.index(room);
        }

        subscribed.push(room);
        subscribed.sort(byAlias);

        Rooms.trigger('updated');

    });


    Socket.on('me.subscriptions.remove', function(data) {
        var room = Rooms.byId[data.room_id];
        if (room) {
            delete Rooms.byHash[room.data.hash];
            delete Rooms.byId[data.room_id];
            subscribed = subscribed.filter(function(s) {
                return s !== room;
            });
            Rooms.trigger('updated');
        }
    });

    window.Rooms = Rooms;

})();

// Room model
(function() {

    var extend = Object.assign || $.extend;

    var emoji = /[\uD800-\uDBFF\uDC00-\uDFFF\u200D]+\s*/g;

    // Normalize topic for sorting
    function setAlias(room) {
        room.alias = room.data.topic.toLowerCase().replace(emoji, '');
    }

    function Room(data) {
        Events.mixin(this);
        this.data = data;
        this.rolesOnline = new Rooms.Roles();
        this.rolesWaiting = new Rooms.Roles();
        setAlias(this);
    }

    function subscribe(hash) {
        return Rest.rooms.create(hash, 'enter', {
            socket_id: Socket.id
        });
    }

    function subscribed(data) {
        this.update(data.room);
        this.myRole = data.role;
        this.subscription = data.subscription;
        this.rolesOnline.reset(data.roles_online);
        this.rolesWaiting.reset(data.roles_waiting || []);
        this.setState('subscribed');
    }

    function denied(xhr) {
        if (xhr.status === 404) {
            this.setState('error');
        } else if (xhr.status === 403) {
            var data = xhr.responseJSON;
            this.myRole = data && data.role;
            this.setState('locked');
        } else {
            this.setState('error');
        }
    }

    Room.prototype = {

        enter: function() {
            subscribe(this.data.hash)
                .then(subscribed.bind(this))
                .catch(denied.bind(this));
        },

        leave: function() {
            Rest.subscriptions.destroy(this.subscription.subscription_id);
            this.subscription = null;
            this.setState(null);
        },

        setState: function(state) {
            this.state = state;
            this.trigger('state.changed', state);
        },

        update: function(data) {
            extend(this.data, data);
            if (data.topic) {
                setAlias(this);
            }
            this.trigger('updated', data);
        },

    };

    Rooms.Room = Room;

})();

// Handle Socket events with room_id
Rooms.pipe = function(event, callback) {
    Socket.on(event, function(data) {
        var room = Rooms.byId[data.room_id];
        if (room) {
            callback.call(Rooms, room, data);
        }
    });
};

// Update room data
(function() {

    function updateRoom(room, data) {
        room.update(data);
    }

    Rooms.pipe('room.topic.updated', function(room, data) {
        Rooms.updateTopic(room, data.topic);
    });

    Rooms.pipe('room.hash.updated', function(room, data) {
        if (room.data.hash === Router.hash) {
            Router.replace(data.hash, room.data.topic);
        }
        Rooms.updateHash(room, data.hash);
    });

    Rooms.pipe('room.searchable.updated', updateRoom);
    Rooms.pipe('room.watched.updated', updateRoom);
    Rooms.pipe('room.level.updated', updateRoom);
    Rooms.pipe('room.min_session_created.updated', updateRoom);

})();

// Update roles
(function() {

    function updateRole(room, data) {
        room.roles.update(data);
    }

    Rooms.pipe('role.online', function(room, data) {
        room.roles.add(data);
    });

    Rooms.pipe('role.offline', function(room, data) {
        room.roles.remove(data.role_id);
    });

    Rooms.pipe('role.nickname.updated', updateRole);
    Rooms.pipe('role.status.updated', updateRole);
    Rooms.pipe('role.level.updated', updateRole);
    Rooms.pipe('role.ignored.updated', updateRole);
    Rooms.pipe('role.expired.updated', updateRole);

})();

// User events has no room_id,
// so we must match and update roles in all rooms
(function() {

    function updateUser(data) {
        Rooms.forEach(function(room) {
            room.roles.updateUser(data);
        });
    }

    Socket.on('user.userpic.updated', updateUser);
    Socket.on('user.photo.updated', updateUser);

})();

// Create rooms from me.subscriptions
Socket.on('created', function() {
    Rooms.reset(Me.subscriptions);
});
