// Rooms collection
(function() {

    var Rooms = new Events();

    var subscriptions = [];

    // Compare function for sorting
    function byAlias(a, b) {
        if (a.alias > b.alias) return  1;
        if (a.alias < b.alias) return -1;
        return 0;
    }

    Rooms.byHash = {};
    Rooms.byId   = {};

    function indexRoom(room) {
        Rooms.byHash[room.data.hash] = room;
        if (room.data.room_id) {
            Rooms.byId[room.data.room_id] = room;
        }
    };

    function createRoom(data) {
        var room = new Rooms.Room(data);
        indexRoom(room);
        return room;
    }

    function subscribed(room) {
        indexRoom(room); // reindex room_id from response
        Rooms.trigger('subscribed', room);
        if (room === Rooms.selected) {
            Rooms.trigger('selected.ready', room);
        } else {
            room.checkUnread();
        }
        Rooms.trigger('updated');
    }

    function denied(room) {
        if (room === Rooms.selected) {
            Rooms.trigger('selected.denied', room);
        }
    }

    Rooms.explore = function() {
        this.selected = null;
        this.trigger('explore');
    };

    Rooms.leave = function() {
        this.active = false;
        this.selected = null;
        this.forEach(function(room) {
           room.leave();
        });
        this.trigger('leave');
    };

    Rooms.restore = function(room) {
        return Rest.rooms
            .update(room.data.hash, {deleted: false})
            .then(function() {
                room.enter().then(subscribed, denied);
            });
    };

    Rooms.enter = function() {
        if (!this.active) {
            this.active = true;
            this.forEach(function(room) {
                room.enter().then(subscribed, denied);
            });
        }
    };

    Rooms.select = function(hash) {

        var room = this.byHash[hash];

        // Если такой комнаты ещё нет, создаём её
        if (!room) {
            room = this.add({hash: hash, topic: '#' + hash});
        }

        if (room.unread) {
            room.unread = false;
            this.trigger('updated');
        }

        this.selected = room;
        this.trigger('select', room);

        if (room.state === 'ready') {
            this.trigger('selected.ready', room);
        } else if (room.state) {
            this.trigger('selected.denied', room);
        }

    };


    Rooms.reset = function(data, saveSelected) {

        var existing = this.byHash;

        this.byHash = {};
        this.byId   = {};

        // If room already exists, update and use it
        subscriptions = data.map(function(room_data) {
            var same = existing[room_data.hash];
            if (same) {
                same.update(room_data);
                same.checkUnread();
                indexRoom(same);
                return same;
            } else {
                return createRoom(room_data);
            }
        });

        // If selected room was removed
        if (this.selected && !this.byHash[this.selected.data.hash]) {
            if (saveSelected) {
                subscriptions.push(this.selected);
                indexRoom(this.selected);
            } else {
                this.explore();
            }
        }

        subscriptions.sort(byAlias);

        this.trigger('updated');

        if (this.active) {
            this.forEach(function(room) {
                room.enter().then(subscribed, denied);
            });
        }

    };

    Rooms.forEach = function(callback) {
        subscriptions.forEach(callback, this);
    };

    Rooms.updateTopic = function(room, topic) {
        room.update({topic: topic});
        subscriptions.sort(byAlias);
        this.trigger('updated');
    };

    Rooms.updateHash = function(room, hash) {
        delete this.byHash[room.data.hash];
        this.byHash[hash] = room;
        room.data.hash = hash;
        this.trigger('updated');
    };

    Rooms.triggerSelected = function(event, room) {
        if (this.selected === room) {
            this.trigger(event, room);
        }
    };


    Rooms.add = function(data) {

        if (this.byHash[data.hash]) {
            return;
        }

        var room = createRoom(data);

        if (Socket.id && Rooms.active) {
            room.enter().then(subscribed, denied);
        }

        subscriptions.push(room);
        subscriptions.sort(byAlias);

        Rooms.trigger('updated');

        return room;

    };

    Rooms.remove = function(room_id) {

        var room = this.byId[room_id];

        if (!room || room.isDeleted) {
            return false;
        }

        room.leave();
        delete this.byHash[room.data.hash];
        delete this.byId[room.data.room_id];

        subscriptions = subscriptions.filter(function(s) {
            return s !== room;
        });

        if (room === this.selected) {
            Router.push('+');
        }

        this.trigger('updated');

    };


    Socket.on('me.subscriptions.add', function(data) {
        Rooms.add(data);
    });

    Socket.on('me.subscriptions.remove', function(data) {
        Rooms.remove(data.room_id);
    });

    // Come in
    Socket.on('role.come_in.updated', function(data) {
        Rooms.forEach(function(room) {
            var isMe = room.myRole && room.myRole.role_id === data.role_id;
            if (isMe && data.come_in === null) {
                room.enter().then(subscribed, denied);
            }
        });
    });

    // Leave the room if subscription was deleted
    Socket.on('subscription.deleted', function(data) {
        Rooms.forEach(function(room) {
            var sub = room.subscription;
            if (sub && sub.subscription_id === data.subscription_id) {
                room.subscription = null;
                room.setState(null);
                room.enter().then(subscribed, denied); // Get new state
            }
        });
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
        this.soundOn = Boolean(localStorage.getItem('sound_in_' + this.data.room_id));
        this.rolesOnline.reset(data.roles_online);
        this.rolesOnline.add(data.role);
        this.rolesWaiting.reset(data.roles_waiting || []);
        this.rolesWaiting.enabled = Boolean(data.roles_waiting);
        this.setState('ready');
        for (var i = 0; i < this.eventsBuffer.length; i++) {
            var event = this.eventsBuffer[i];
            event[0].call(Rooms, this, event[1]);
        }
        this.eventsBuffer = null;
        return this;
    }

    function denied(xhr) {
        this.eventsBuffer = null;
        if (xhr.status === 404) {
            this.setState(this.isDeleted ? 'deleted' : 'lost');
        } else if (xhr.status === 403) {
            var data = xhr.responseJSON;
            this.myRole = data.role;
            if (data.room) {
                extend(this.data, data.room);
            }
            if (this.data.level === 80) {
                this.setState('closed');
            } else {
                this.setState('locked');
            }
        } else {
            this.setState('error');
        }
        throw this;
    }

    Room.prototype = {

        enter: function() {
            this.eventsBuffer = [];
            return subscribe(this.data.hash)
                .then(subscribed.bind(this))
                .catch(denied.bind(this));
        },

        leave: function() {
            if (this.subscription) {
                Rest.subscriptions.destroy(this.subscription.subscription_id);
                this.subscription = null;
            }
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

        checkUnread: function() {
            var seen = this.data.seen_message_id;
            var last = this.filterUnread ?
                this.data.role_last_message_id :
                this.data.room_last_message_id;
            if (seen && seen < last) {
                this.unread = true;
            }
        },

        isMy: function(data) {
            return data.role_id === this.myRole.role_id;
        },

        mentionsMe: function(mentions) {
            var me = this.myRole.role_id;
            for (var i = mentions.length; i--;) {
                if (mentions[i] === me) return true;
            }
        },

        isForMe: function(message) {
            if (this.myRole.role_id === message.recipient_role_id) {
                return true;
            } else if (message.mentions) {
                return this.mentionsMe(message.mentions);
            }
        },

        isVisible: function(message) {
            var me = this.myRole;
            if (message.role_id === me.role_id) {
                return true;
            }
            if (!me.isModerator && Me.isHidden(message)) {
                return false;
            }
            if (message.ignore && !me.ignored) {
                return false;
            }
            if (this.forMeOnly) {
                return message.recipient_nickname ||
                    message.mentions && this.mentionsMe(message.mentions);
            }
            return true;
        },

        toggleSound: function() {
            this.soundOn = !this.soundOn;
            if (this.soundOn) {
                localStorage.setItem('sound_in_' + this.data.room_id, 1);
            } else {
                localStorage.removeItem('sound_in_' + this.data.room_id);
            }
        }

    };

    Rooms.Room = Room;

})();

// Handle Socket events with room_id
Rooms.pipe = function(event, callback) {
    Socket.on(event, function(data) {
        var room = Rooms.byId[data.room_id];
        if (room) {
            if (room.eventsBuffer) {
                room.eventsBuffer.push([callback, data]);
            } else {
                callback.call(Rooms, room, data);
            }
        }
    });
};

// New room and shuffle
(function() {

    function selectRoom(data) {
        Router.push(data.hash);
    }

    function shuffleFailed(xhr) {
        Rooms.trigger('shuffle.failed');
        throw xhr;
    }

    Rooms.create = function() {
        return Rest.rooms.create()
            .then(selectRoom);
    };

    Rooms.shuffle = function() {
        return Rest.rooms.create('search')
            .then(selectRoom, shuffleFailed);
    };

})();

// Delete room
Rooms.pipe('room.deleted.updated', function(room, data) {
    if (data.deleted && room.myRole.level === 80) {
        room.leave();
        room.isDeleted = true;
        room.state = 'deleted';
        if (room === Rooms.selected) {
            Rooms.trigger('selected.denied', room);
        }
    }
});

// Update room data
(function() {

    function updateRoom(room, data) {
        room.update(data);
    }

    Rooms.pipe('room.topic.updated', function(room, data) {
        Rooms.updateTopic(room, data.topic);
        Rooms.triggerSelected('selected.topic.updated', room);
    });

    Rooms.pipe('room.hash.updated', function(room, data) {
        if (room.data.hash === Router.hash) {
            Router.replace(data.hash, room.data.topic);
        }
        Rooms.updateHash(room, data.hash);
    });

    Rooms.pipe('room.level.updated', function(room, data) {
        room.update(data);
        Rooms.triggerSelected('selected.level.updated', room);
    });

    Rooms.pipe('room.min_session_created.updated', function(room, data) {
        room.update(data);
        Rooms.triggerSelected('selected.alarm.updated', room);
    });

    Rooms.pipe('room.searchable.updated', updateRoom);
    Rooms.pipe('room.watched.updated', updateRoom);

})();

// Update unread messages
Rooms.pipe('role.seen_message_id.updated', function(room, data) {
    var wasUnread = room.unread;
    room.data.seen_message_id = data.seen_message_id;
    room.checkUnread();
    if (room.unread !== wasUnread) {
        Rooms.trigger('updated');
    }
});

// Update roles
(function() {

    function updated(room) {
        Rooms.triggerSelected('selected.roles.updated', room);
    }

    function updateRole(room, data) {
        room.rolesOnline.update(data);
        if (room.myRole.role_id === data.role_id) {
            $.extend(room.myRole, data);
        }
        updated(room);
    }

    Rooms.pipe('role.online', function(room, data) {
        room.rolesOnline.add(data);
        updated(room);
    });

    Rooms.pipe('role.offline', function(room, data) {
        room.rolesOnline.remove(data.role_id);
        updated(room);
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

        data.userpicUrl = null;

        Rooms.forEach(function(room) {
            room.rolesOnline.updateUser(data);
            if (room.myRole && room.myRole.user_id === data.user_id) {
                $.extend(room.myRole, data);
            }
        });

        if (Rooms.selected && Rooms.selected.subscription) {
            Rooms.triggerSelected('selected.roles.updated', Rooms.selected);
        }

    }

    Socket.on('user.userpic.updated', updateUser);
    Socket.on('user.photo.updated', updateUser);

    Socket.on('user.userpic.updated', function(data) {
        var me = Rooms.selected && Rooms.selected.myRole;
        if (me && me.user_id === data.user_id) {
            Rooms.trigger('my.userpic.updated');
        }
    });

})();

// Messages
Rooms.pipe('message.created', function(room, data) {
    if (room.isVisible(data)) {
        var unread = room.filterUnread ? room.isForMe(data) : !room.isMy(data);
        if (room === Rooms.selected) {
            Talk.appendMessage(data);
        } else if (!room.unread && unread) {
            room.unread = true;
            Rooms.trigger('updated');
        }
        if (unread) {
            Rooms.trigger('notification', room);
        }
    }
});

Rooms.pipe('message.content.updated', function(room, data) {
    if (room === Rooms.selected) {
        Talk.updateMessage(data);
    }
});


// Check my rank and load necessary scripts
(function() {

    function checkRank(role) {
        var level = role.level || 0;
        role.isModerator = level >= 50;
        role.isAdmin = level >= 70;
    }

    function checkMyRank(room) {
        var me = room.myRole;
        checkRank(me);
        if (me.isModerator) {
            $.require('views/moderate.js');
        }
        if (me.isAdmin) {
            $.require('views/admin.js');
            $.require('views/ranks.js');
        }
    }

    Rooms.pipe('role.level.updated', function(room, data) {
        if (room.isMy(data)) {
            checkMyRank(room);
            if (Rooms.selected) {
                Rooms.trigger('my.rank.updated', room);
            }
        }
    });

    Rooms.on('selected.ready', checkMyRank);

})();


// Inactive window detection
(function() {

    $window.on('blur', function() {
        Rooms.idle = true;
    });

    $window.on('focus', function() {
        Rooms.idle = false;
    });

})();


// Deprecated namespace
var Room = new Events();

// Emulate old enter event
Rooms.on('selected.ready', function(selected) {
    Room.data = selected.data;
    Room.myRole = selected.myRole;
    Room.moderator = selected.myRole.isModerator;
    Room.trigger('enter', selected);
});
