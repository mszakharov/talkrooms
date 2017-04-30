// Roles collection
(function() {

    var extend = Object.assign || $.extend;

    // Compare function for sorting
    function byAlias(a, b) {
        if (a.alias > b.alias) return  1;
        if (a.alias < b.alias) return -1;
        return 0;
    }

    // Normalize nickname for case-insensitive sorting
    function setAlias(role) {
        role.alias = role.nickname.toLowerCase();
    }

    // Insert role into sorted array and return inserted position
    function insertRole(list, role) {
        var i = 0, l = list.length;
        while (i < l && role.alias > list[i].alias) {
            i++;
        }
        list.splice(i, 0, role);
        return i;
    }


    // Remove role from array
    function removeRole(list, role) {
        for (var i = list.length; i--;) {
            if (list[i] === role) {
                return list.splice(i, 1)[0];
            }
        }
    }


    // Collection constructor
    function Roles(fetchOptions) {
        this.index = {};
        this.items = [];
        this.fetchOptions = fetchOptions;
    }

    Roles.prototype = {

        trigger: function() {

        },

        fetch: function() {
            var that = this;
            return Rest.roles
                .get(this.fetchOptions)
                .then(function(roles) {
                    that.reset(roles);
                });
        },

        reset: function(roles) {
            this.index = {};
            this.items = [];
            roles.forEach(setAlias);
            roles.sort(byAlias);
            for (var i = roles.length; i--;) {
                var role = roles[i];
                this.index[role.role_id] = role;
                this.items[i] = role;
            }
        },

        add: function(data) {
            if (this.index[data.role_id]) {
                this.update(data);
            } else {
                setAlias(data);
                insertRole(this.items, data);
                this.index[data.role_id] = data;
                //this.trigger('added', data);
            }
        },

        remove: function(roleId) {
            var role = this.index[roleId];
            if (role) {
                removeRole(this.items, role);
                delete this.index[roleId];
                //this.trigger('removed', role);
            }
        },

        update: function(data) {
            var role = this.index[data.role_id];
            if (role) {
                extend(role, data);
                if (data.nickname) {
                    setAlias(data);
                    removeRole(this.items, role); // Reinsert role to
                    insertRole(this.items, role); // keep items sorted
                }
                //this.trigger('updated', role);
            }
        },

        updateUser: function(data) {
            var roles = this.items;
            for (var i = roles.length; i--;) {
                if (roles[i].user_id === data.user_id) {
                    extend(roles[i], data);
                    //this.trigger('updated', roles[i]);
                    return;
                }
            }
        },

        get: function(roleId) {
            return this.index[roleId];
        }

    };

    // Export helpers to use in view
    Roles.insertRole = insertRole;
    Roles.removeRole = removeRole;

    Room.Roles = Roles;

})();

/* Users cache */
(function() {

    var showIgnored;

    function notIgnored(role) {
        var ignored = role.ignored && !Room.myRole.ignored;
        if (ignored && showIgnored) this.push(role);
        return !ignored;
    }

    function apply() {
        var ignore = [];
        Room.trigger('users.updated', Room.roles.items.filter(notIgnored, ignore), ignore);
    }

    function setAnnoying(role) {
        role.annoying = Room.ignores && Room.ignores(role);
    }

    function setUserpicUrl(role) {
        role.userpicUrl = Userpics.getUrl(role);
    }

    function addRole(role) {
        this.roles.add(role);
        setAnnoying(role);
        setUserpicUrl(role);
        apply();
    }

    function removeRole(role) {
        this.roles.remove(role.role_id);
        apply();
    }

    function updateRole(data) {
        this.roles.update(data);
        apply();
    }

    function updateSilent(data) {
        this.roles.update(data);
    }

    Room.on('enter', function() {
        showIgnored = Room.moderator;
    });

    Room.on('ready', function() {
        this.roles.items.forEach(setAnnoying);
        this.roles.items.forEach(setUserpicUrl);
        apply();
    });

    Room.on('leave', function() {
        this.roles = null;
    });

    Room.on('moderator.changed', function() {
        showIgnored = Room.moderator;
        if (this.roles) {
            this.roles.items.forEach(setAnnoying);
            apply();
        }
    });

    Room.on('me.ignores.updated', function() {
        this.roles.items.forEach(setAnnoying);
        apply();
    });

    Room.on('role.online', addRole);
    Room.on('role.offline', removeRole);

    Room.on('role.nickname.updated', updateRole);
    Room.on('role.status.updated', updateRole);
    Room.on('role.ignored.updated', updateRole);

    Room.on('user.userpic.updated', function(data) {
        this.roles.updateUser(data);
        apply();
    });

    // This events don't affect the view
    Room.on('role.level.updated', updateSilent);
    Room.on('role.expired.updated', updateSilent);

    Room.on('user.photo.updated', function(data) {
        this.roles.updateUser(data);
    });

})();
