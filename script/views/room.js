// Adjust padding to scrollbar width
(function() {

    var sample = document.createElement('div');
    sample.style.width = '100px';
    sample.style.height = '50px'; // >32px to display scrollbar in Firefox
    sample.style.position = 'absolute';
    sample.style.overflowY = 'scroll';
    sample.style.top = '-100px';

    document.body.appendChild(sample);
    var scrollBarWidth = sample.offsetWidth - sample.clientWidth;
    document.body.removeChild(sample);

    if (scrollBarWidth) {
        $('.side-content').css('padding-right', 25 - scrollBarWidth);
    }

})();

// Prevent page scrolling in iOS
(function() {

    function avoidEdges() {
        var pos = this.scrollTop;
        if (pos === 0) {
            this.scrollTop = 1;
        } else if (pos === this.scrollHeight - this.offsetHeight) {
            this.scrollTop = pos - 1;
        }
    }

    function fixScroll(selector) {
        $(selector).addClass('force-scroll').on('touchstart', avoidEdges);
    }

    if (/ip(od|ad|hone)/i.test(navigator.platform)) {
        fixScroll('.talk-content');
        fixScroll('.side-content');
        fixScroll('.dp-calendar');
    }

    $('#header').on('touchmove', function(event) {
        event.preventDefault();
    });

})();

// Toggle sidebar
(function() {

    var body = $('body'),
        side = $('#side'),
        talk = $('#talk');

    function showSide() {
        body.addClass('sliding-side').reflow(); // translate talk without transition
        body.addClass('visible-side').reflow(); // display side before transition
        body.removeClass('sliding-side');
    }

    function hideSide() {
        body.addClass('sliding-side');
    }

    $('.header-show-side').on('click', function(event) {
        if (body.hasClass('visible-side')) {
            hideSide();
        } else if (side.is(':hidden')) {
            showSide();
        }
    });

    talk.on('transitionend', function() {
        if (body.hasClass('sliding-side')) {
            body.removeClass('visible-side sliding-side');
        }
    });

})();

// Scrollable toolbar
(function() {

    var toolbar = $('.header-toolbar'),
        scroller = toolbar.find('.header-toolbar-scroll')[0],
        isScrolled;

    scroller.addEventListener('scroll', function() {
        var scrolled = this.scrollLeft > 0;
        if (scrolled !== isScrolled) {
            toolbar.toggleClass('header-toolbar-scrolled', scrolled);
            isScrolled = scrolled;
        }
    });

    function canScroll() {
        return scroller.scrollWidth > scroller.offsetWidth;
    }

    var dragFrom,
        dragging;

    function drag(pageX) {
        var delta = pageX - dragFrom.pageX;
        if (delta > 5 || delta < -5) {
            dragging = true;
        }
        if (dragging) {
            scroller.scrollLeft = dragFrom.position - delta;
        }
    }

    function drop() {
        toolbar.data('wasDragged', dragging);
        dragging = false;
        dragFrom = null;
    }

    function mouseDrag(event) {
        drag(event.pageX);
    }

    function touchDrag(event) {
        drag(event.originalEvent.touches[0].pageX);
    }

    function mouseDrop(event) {
        drag(event.pageX);
        $document.off('mousemove', mouseDrag);
        $document.off('mouseup',   mouseDrop);
        drop();
    }

    function touchDrop(event) {
        drag(event.originalEvent.changedTouches[0].pageX);
        $document.off('touchmove', touchDrag);
        $document.off('touchend',  touchDrop);
        drop();
    }

    toolbar.on('mousedown', function(event) {
        wasDragged = false;
        if (!event.button && canScroll()) {
            $document.on('mousemove', mouseDrag);
            $document.on('mouseup',   mouseDrop);
            dragFrom = {
                pageX: event.pageX,
                position: scroller.scrollLeft
            };
            event.preventDefault(); // prevent text selection
        }
    });

    toolbar.on('touchstart', function(event) {
        wasDragged = false;
        var touches = event.originalEvent.touches;
        if (touches.length === 1 && canScroll()) {
            $document.on('touchmove', touchDrag);
            $document.on('touchend',  touchDrop);
            dragFrom = {
                pageX: touches[0].pageX,
                position: scroller.scrollLeft
            };
            event.preventDefault(); // prevent mousedown
        }
    });

    // Reset wasDragged after delegated events
    toolbar.on('click', function() {
        toolbar.removeData('wasDragged');
    });

    toolbar.find('.filter-my').on('click', function() {
        if (!wasDragged) {
            $(this).toggleClass('filter-my-selected');
        }
    });

})();

// Topic
(function() {

    var topic = $('.header-title');

    function showTopic() {
        topic.html(Room.data.topic);
    }

    Room.on('enter', showTopic);
    Room.on('room.topic.updated', showTopic);

})();

// Window title
(function() {

    var mainTitle = document.title;
    var mark = String.fromCharCode(9733);

    Room.on('enter', function() {
        document.title = Room.data.topic;
    });

    Room.on('leave', function() {
        document.title = mainTitle;
    });

    Room.on('lost', function() {
        document.title = 'Комната не найдена';
    });

    Room.on('room.topic.updated', function() {
        if (!Room.idle) document.title = Room.data.topic;
    });

    Room.on('talk.updated', function() {
        if (Room.idle) document.title = mark + ' ' + Room.data.topic;
    });

    $window.on('focus', function() {
        if (Room.data) document.title = Room.data.topic;
    });

})();

// Disconnect
(function() {

    var talk = $('#talk');

    function restore() {
        talk.removeClass('disconnected');
    }

    Room.on('disconnected', function() {
        talk.addClass('disconnected');
    });

    Room.on('connected', restore);
    Room.on('enter', restore);

})();

// Notifications
(function() {

    var sound,
        soundEnabled;

    var toolbar = $('.header-toolbar'),
        control = $('.header-sound');

    // Disable sound on mobile devices because of audio limitations
    if (/android|blackberry|iphone|ipad|ipod|mini|mobile/i.test(navigator.userAgent)) {
        control.hide();
        return false;
    }

    function toggleSound(enabled) {
        if (enabled === soundEnabled) return;
        if (enabled) {
            if (!sound) sound = new Sound({
                mp3: '/script/sound/message.mp3',
                ogg: '/script/sound/message.ogg'
            });
            Room.on('talk.updated', notify);
            control.addClass('header-sound-on');
        } else {
            Room.off('talk.updated', notify);
            control.removeClass('header-sound-on');
        }
        soundEnabled = enabled;
    }

    function notify() {
        if (Room.idle) sound.play();
    }

    Room.on('ready', function() {
        var stored = localStorage.getItem('sound_in_' + Room.data.room_id);
        toggleSound(Boolean(stored));
    });

    control.on('click', function() {
        if (toolbar.data('wasDragged')) return;
        toggleSound(!soundEnabled);
        if (soundEnabled) {
            localStorage.setItem('sound_in_' + Room.data.room_id, 1);
        } else {
            localStorage.removeItem('sound_in_' + Room.data.room_id);
        }
    });

})();
