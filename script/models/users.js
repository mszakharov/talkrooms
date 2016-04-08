/* Users cache */
Room.users = (function() {

    var roles = new Collection({
        index: 'role_id',
        order: 'normal_nickname'
    });

    var showIgnored;

    function notIgnored(role) {
        var ignored = role.ignored && !Room.myRole.ignored;
        if (ignored && showIgnored) this.push(role);
        return !ignored;
    }

    function apply() {
        var ignore = [];
        Room.trigger('users.updated', roles.raw.filter(notIgnored, ignore), ignore);
    }

    function getRoles() {
        return Rest.roles
            .get({
                room_id: Room.data.room_id,
                num_online_sockets: {'>': 0}
            })
            .done(reset);
    }

    function reset(data) {
        roles.raw = data;
        roles.raw.forEach(setUserpicUrl);
        roles.raw.forEach(normalizeNickname);
        roles.sort();
    }

    function setAnnoying(role) {
        role.annoying = Room.ignores && Room.ignores(role);
    }

    function setUserpicUrl(role) {
        role.userpicUrl = Userpics.getUrl(role);
    }

    function normalizeNickname(role) {
        var lower = role.nickname.toLowerCase();
        var pure = lower.replace(/[^\wа-яё]/g, '');
        role.normal_nickname = lower === pure ? lower : pure + role.nickname;
    }

    function addRole(role) {
        if (!roles.get(role.role_id)) {
            setAnnoying(role);
            normalizeNickname(role);
            setUserpicUrl(role);
            roles.add(role);
            apply();
        }
    }

    function removeRole(role) {
        roles.remove(role.role_id);
        apply();
    }

    Room.on('enter', function() {
        roles.raw = [];
        showIgnored = Room.moderator;
        this.promises.push(getRoles());
    });

    Room.on('ready', function() {
        roles.raw.forEach(setAnnoying);
        apply();
    });

    Room.on('moderator.changed', function() {
        showIgnored = Room.moderator;
        if (roles.raw.length) {
            roles.raw.forEach(setAnnoying);
            apply();
        }
    });

    Room.on('me.ignores.updated', function() {
        roles.raw.forEach(setAnnoying);
        apply();
    });

    Room.on('role.online', addRole);
    Room.on('role.offline', removeRole);

    Room.on('role.nickname.updated', function(data) {
        var role = roles.get(data.role_id);
        if (role) {
            role.nickname = data.nickname;
            normalizeNickname(role);
            roles.sort();
            apply();
        }
    });

    Room.on('role.status.updated', function(data) {
        var role = roles.get(data.role_id);
        if (role) {
            role.status = data.status;
            apply();
        }
    });

    Room.on('role.level.updated', function(data) {
        var role = roles.get(data.role_id);
        if (role) {
            role.level = data.level;
        }
    });

    Room.on('role.ignored.updated', function(data) {
        var role = roles.get(data.role_id);
        if (role) {
            role.ignored = data.ignored;
            role.moderator_id = data.moderator_id;
            apply();
        }
    });

    Room.on('role.expired.updated', function(data) {
        var role = roles.get(data.role_id);
        if (role) {
            role.expired = data.expired;
        }
    });

    function patchUser(user_id, callback) {
        roles.raw.forEach(function(role) {
            if (role.user_id === user_id) callback(role);
        });
    }

    Room.on('user.userpic.updated', function(data) {
        patchUser(data.user_id, function(role) {
            role.userpic = data.userpic;
            setUserpicUrl(role);
        });
        apply();
    });

    Room.on('user.photo.updated', function(data) {
        patchUser(data.user_id, function(role) {
            role.photo = data.photo;
        });
    });

    return {
        get: function(role_id) {
            return roles.get(role_id);
        }
    };

})();
