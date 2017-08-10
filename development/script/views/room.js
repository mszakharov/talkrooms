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
        main = $('#main');

    var icon = $('.header-show-side');

    function showSide() {
        body.addClass('sliding-side').reflow(); // translate talk without transition
        body.addClass('visible-side');
        body.removeClass('sliding-side');
    }

    function hideSide() {
        body.addClass('sliding-side');
    }

    icon.on('click', function(event) {
        if (body.hasClass('visible-side')) {
            hideSide();
        } else {
            showSide();
        }
    });

    main.on('transitionend', function() {
        if (body.hasClass('sliding-side')) {
            body.removeClass('visible-side sliding-side');
        }
    });

    Rooms.on('select', function() {
        if (body.hasClass('visible-side')) {
            hideSide();
        }
    });

    Rooms.on('explore', function() {
        if (body.hasClass('visible-side')) {
            hideSide();
        }
    });

    Rooms.on('updated', function() {
        var unread = false;
        Rooms.forEach(function(room) {
            if (room.unread) unread = true;
        });
        icon.toggleClass('header-side-unread', unread);
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
        toolbar.removeData('wasDragged'); // reset on click prevented by fastclick
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

})();

// Update header depending on room state
(function() {

    var title = $('.toolbar-title'),
        tools = $('.toolbar-tools'),
        date  = $('.header-date');

    function getTitle(room) {
        if (room.state === 'lost') {
            return 'Комната не найдена';
        }
        if (room.state === 'deleted') {
            return '<span class="toolbar-deleted">' + room.data.topic + '</span>';
        }
        return room.data.topic;
    }

    function showTopic(room) {
        title.html(room.data.topic);
    }

    function showTitle(text) {
        toggleToolbar(false);
        title.html(text);
    }

    function toggleToolbar(ready) {
        title.toggleClass('changing', !ready);
        tools.toggleClass('hidden', !ready);
        date.toggleClass('hidden', !ready);
    }

    Rooms.on('explore', function() {
        showTitle('Комнаты');
    });

    Rooms.on('select', function(room) {
        showTitle(getTitle(room));
        toggleToolbar(room.state === 'ready');
    });

    Rooms.on('selected.ready', function(room) {
        showTitle(getTitle(room));
        toggleToolbar(true);
    });

    Rooms.on('selected.denied', function(room) {
        showTitle(getTitle(room));
    });

    Rooms.on('selected.topic.updated', showTopic);

})();

// Window title
(function() {

    var mainTitle = document.title;
    var unreadMark = String.fromCharCode(9733);

    Rooms.on('explore', function(room) {
        document.title = 'Комнаты';
    });

    Rooms.on('select', function(room) {
        document.title = room.data.topic;
    });

    Rooms.on('selected.ready', function(room) {
        document.title = room.data.topic;
    });

    Rooms.on('selected.topic.updated', function(room) {
        if (!Room.idle) document.title = room.data.topic;
    });

    Rooms.on('leave', function() {
        document.title = mainTitle;
    });

    // Show notification mark in inactive tab
    Rooms.on('notification', function() {
        if (Rooms.idle) {
            document.title = unreadMark + ' ' + Room.data.topic;
        }
    });

    // Hide notification mark
    $window.on('focus', function() {
        var room = Rooms.selected;
        if (room) {
            document.title = room.data.topic;
        }
    });

})();

// Disconnect
(function() {

    var talk = $('#talk');

    Socket.on('disconnected', function() {
        talk.addClass('disconnected');
    });

    Socket.on('connected', function() {
        talk.removeClass('disconnected');
    });

})();
