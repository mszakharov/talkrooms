// Ranks
(function() {

    var $section = $('.moder-ranks'),
        $inputs = $section.find('input');

    var $guest = $('#rank-guest'),
        $admin = $('#rank-admin').closest('.rank');

    var $guestButtons = $('.moder-guest'),
        $rankButton = $('.moder-rank');

    function isSubordinate(role, me) {
        return Boolean(me.level && (!role.level || me.level > role.level));
    }

    function findInput(level) {
        return level > 20 ? $inputs.filter('[value="' + level + '"]') : $guest;
    }

    function getGuestLevel(role) {
        return Math.max(role.user_id ? 10 : 0, Rooms.selected.data.level);
    }

    $inputs.on('click', function() {
        var level = this.value ? Number(this.value) : getGuestLevel(Profile.role);
        if (level !== Profile.role.level) {
            Profile.send({level: level});
        } else {
            Profile.trigger('moderated', this.value ? 'rank' : 'guest');
            Profile.fit();
        }
    });

    $rankButton.on('click', function() {
        var me = Rooms.selected.myRole;
        if (me.isAdmin && isSubordinate(Profile.role, me)) {
            Profile.trigger('moderated', 'ranks');
            Profile.fit();
        }
    });

    Profile.on('moderated', function(state) {
        if (state === 'ranks') {
            findInput(Profile.role.level).prop('checked', true);
            $section.show();
        } else {
            $section.hide();
        }
    });

    Profile.on('moderated', function(state) {
        if (state === 'rank') {
            toggleRankEdit();
        }
    });

    function toggleAdminRank(room) {
        $admin.toggle(room.myRole.level === 80);
    }

    function toggleButtons(isAdmin) {
        var me = Rooms.selected.myRole;
        $guestButtons.toggleClass('moder-guest-editable', me.isAdmin);
        if (Profile.role) {
            toggleRankEdit();
        }
    }

    function toggleRankEdit() {
        var me = Rooms.selected.myRole;
        $rankButton.toggleClass('moder-rank-editable', me.isAdmin && isSubordinate(Profile.role, me));
    }

    Rooms.on('selected.ready', toggleAdminRank);
    Rooms.on('selected.ready', toggleButtons);

    Rooms.on('my.rank.updated', toggleButtons);

    toggleAdminRank(Rooms.selected);
    toggleButtons(Rooms.selected);

})();

