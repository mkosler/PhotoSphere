Property = function () {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
            Property.FOV,
            Property.ASPECT,
            Property.NEAR,
            Property.FAR);

    if ($("#viewer").length > 0) {
        var canvas = $("#viewer")[0];

        this.renderer = new THREE.WebGLRenderer({ canvas: canvas });
        this.renderer.setSize(canvas.width, canvas.height);
    } else {
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        $("body").append(this.renderer.domElement);
    }

    this.scene.add(new THREE.AmbientLight(0xffffff));

    this.rooms = {};

    this.currentRoom = null;

    this.lock = false;
};

Property.prototype.onPress = function (x, y) {
    if (this.currentRoom !== null) {
        this.currentRoom.startRotate(x, y);

        var clickedConnections = this.currentRoom.getConnectionsClicked(x, y, this.camera);

        if (clickedConnections.length > 0) {
            var connection = clickedConnections[0];

            this.setCurrentRoom(connection.object.destinationID);
        }
    }
};

Property.prototype.onMove = function (x, y) {
    if (this.currentRoom !== null) {
        this.currentRoom.rotate(x, y);
    }
};

Property.prototype.onRelease = function () {
    if (this.currentRoom !== null) {
        this.currentRoom.endRotate();
    }
};

Property.prototype.onMouseWheel = function (e) {
    e.preventDefault();

    if (e.deltaY < 0) {
        this.camera.fov = Math.max(Property.FOV_MINIMUM, this.camera.fov / Property.SCALE);

        this.camera.updateProjectionMatrix();
    } else if ( e.deltaY > 0) {
        this.camera.fov = Math.min(Property.FOV_MAXIMUM, this.camera.fov * Property.SCALE);

        this.camera.updateProjectionMatrix();
    }
};

Property.prototype.onEditConnection = function (x, y) {
    if (this.currentRoom !== null) {
        this.lock = true;

        var clickedConnections = this.currentRoom.getConnectionsClicked(x, y, this.camera);

        if (clickedConnections.length > 0) {
            // Edit the connection
            var connection = clickedConnections[0];

            var editEvent = new CustomEvent(
                    "propertyEdit", {
                        destinationID: connection.destinationID
                    });

            /*
            // Dispatch event to UI JavaScript
            UI.dispatchEvent(editEvent);

            // Dispatch event to applications using JockeyJS
            Jockey.send(
                "propertyEdit", {
                    "destinationID": connection.destinationID
                }, function () {
                    console.log("Applications have received propertyEdit!");
                });
            */
        } else {
            var createEvent = new Event("propertyCreate");

            // Dispatch event to UI JavaScript
            window.dispatchEvent(createEvent);

            console.log("Dispatched propertyCreate Event");

            /*
            // Dispatch event to applications using JockeyJS
            Jockey.send(
                "propertyCreate", {
                    destinationID: connection.destinationID
                }, function () {
                    console.log("Applications have received propertyCreate!");
                });
            */
        }
    }
};

Property.prototype.onEditComplete = function (e) {
};

Property.prototype.onCreateComplete = function (e) {
};

Property.prototype.bind = function () {
    this.renderer.domElement.addEventListener(
            "dblclick",
            function (e) {
                this.onEditConnection(e.clientX, e.clientY);
            }.bind(this));

    this.renderer.domElement.addEventListener(
            "mousedown",
            function (e) {
                this.onPress(e.clientX, e.clientY);
            }.bind(this));

    this.renderer.domElement.addEventListener(
            "mousemove",
            function (e) {
                this.onMove(e.clientX, e.clientY);
            }.bind(this));

    this.renderer.domElement.addEventListener(
            "mouseup",
            function (e) {
                this.onRelease(e.clientX, e.clientY);
            }.bind(this));

    this.renderer.domElement.addEventListener(
            "mouseout",
            function (e) {
                this.onRelease(e.clientX, e.clientY);
            }.bind(this));

    this.renderer.domElement.addEventListener(
            "mousewheel",
            this.onMouseWheel.bind(this));

    this.renderer.domElement.addEventListener(
            "touchstart",
            function (e) {
                var t = e.touches[0];

                this.onPress(t.clientX, t.clientY);
            }.bind(this));

    this.renderer.domElement.addEventListener(
            "touchmove",
            function (e) {
                var t = e.touches[0];

                this.onMove(t.clientX, t.clientY);
            }.bind(this));

    this.renderer.domElement.addEventListener(
            "touchend",
            function (e) {
                var t = e.touches[0];

                this.onRelease(t.clientX, t.clientY);
            }.bind(this));

    this.renderer.domElement.addEventListener(
            "touchleave",
            function (e) {
                var t = e.touches[0];

                this.onRelease(t.clientX, t.clientY);
            }.bind(this));
};

Property.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
};

Property.prototype.addRoom = function (name, room) {
    this.rooms[name] = room;
};

Property.prototype.setCurrentRoom = function (name) {
    if (this.currentRoom !== null) {
        this.scene.remove(this.currentRoom);
    }

    this.currentRoom = this.rooms[name];

    this.scene.add(this.currentRoom);
};

Property.FOV = 75;

Property.ASPECT = window.innerWidth / window.innerHeight;

Property.NEAR = 0.1;

Property.FAR = 1000;

Property.SCALE = 1.25;

Property.FOV_MINIMUM = 5;

Property.FOV_MAXIMUM = 75;

Property.fromJSON = function (url) {
    var property = new Property();

    $.ajax({
        url: url,

        dataType: "json",

        // TODO: Figure out how to remove the synchronocity
        async: false,

        success: function (result) {
            result.rooms.forEach(function (roomData) {
                var room = new Room(
                    roomData.name,
                    THREE.ImageUtils.loadTexture(roomData.url));

                roomData.connections.forEach(function (connData) {
                    var loc = new THREE.Vector3();

                    room.add(new Connection(
                            loc.fromArray(connData.coordinates),
                            connData.name));
                });

                property.addRoom(roomData.name, room);
            })

            property.setCurrentRoom(result.default_room);
        },

        error: function (request, textStatus, errorThrown) {
            console.log("An error has occurred while retrieving the JSON...");
            console.log(textStatus);
        },

        complete: function (request, textStatus) {
            console.log("JSON request complete!!");
        },
    });

    return property;
};

Property.fromWebpage = function (imageClass) {
    imageClass = imageClass || ".texture";

    var property = new Property();

    $(imageClass).each(function () {
        console.log(this.crossOrigin);

        var room = new Room(this.id, THREE.ImageUtils.loadTexture(this.src));

        property.addRoom(this.id, room);

        property.setCurrentRoom(this.id);
    });

    return property;
};

Property.load = function (url) {
    var property = new Property();

    $.ajax({
        url: url,

        dataType: "json",

        // TODO: Figure out how to remove the synchronocity
        async: false,

        success: function (result) {
            result.rooms.forEach(function (roomData) {
                var src = $("#" + roomData.name)[0].src

                var room = new Room(
                    roomData.name,
                    THREE.ImageUtils.loadTexture(src));

                roomData.connections.forEach(function (connData) {
                    var loc = new THREE.Vector3();

                    room.add(new Connection(
                            loc.fromArray(connData.coordinates),
                            connData.name));
                });

                property.addRoom(roomData.name, room);
            })

            property.setCurrentRoom(result.default_room);
        },

        error: function (request, textStatus, errorThrown) {
            console.log("An error has occurred while retrieving the JSON...");
            console.log(textStatus);
        },

        complete: function (request, textStatus) {
            console.log("JSON request complete!!");
        },
    });

    return property;
};
