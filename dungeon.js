function Dungeon(opt)
{
	// set the default options
	opt = merge(
	{
		sizeX : 30,
		sizeY : 30,
		doubled : false,
		roomCount : 5,
		roomMinX : 5,
		roomMinY : 5,
		roomMaxX : 5,
		roomMaxY : 5,
		keys : 0,
		restartTimer : 100,
		tries : 100
	}, opt || {});

	var self = this;
	var grid;
	var walls;
	var rooms;
	var started;
	var tries; // will be set when we start generating

	// tile properties
	var tile =
	{
		start : 'start',
		end : 'end',
		empty : 'empty',
		room : 'room',
		wall : 'wall',
		hall : 'hall',
		door : 'door'
	};

	// properties
	this.percent = 0;
	this.time = 0;
	this.done = false;
	this.working = false;
	this.cancelled = false;

	// sets the options
	this.setOptions = function(options)
	{
		opt = merge(opt, options)
	}

	// cancels the generator
	this.cancel = function()
	{
		this.cancelled = true;
	}

	// starts the generation
	this.generate = function()
	{			
		if ( arguments.length == 0 )
		{
			self.done = false;
			self.working = true;
			self.cancelled = false;
			tries = opt.tries;
			started = $time();
		}

		opt.tries--;

		// order of functions to execute
		var ftns = [createGrid, createRooms, placeRandomWalls, createHallsAndDoors, fixWalls, setStartAndEnd, createPaths, cleanUp];

		// success flag of the functions
		var success = true;

		// loop through the functions
		for ( var i = 0; i < ftns.length; i++ )
		{
			if ( self.cancelled ) break;
			if ( !ftns[i]() ) { success = false; break; } // bummer
			else self.percent = i / ftns.length;
		}

		// lets start again, give it some time
		if ( !success || self.cancelled )
		{
			// try again?
			if ( !self.cancelled )
			{
				if ( opt.tries > 0 )
				{
					setTimeout(function()
					{
						self.generate(true);
					}, opt.restartTimer);
					return;
				}
			}

			opt.tries = tries;
			self.percent = 0;
			self.time = 0;
			self.done = false;
			self.working = false;
			self.cancelled = true;
			return;
		}

		// it got this far, it must be done
		opt.tries = tries;
		self.percent = 1;
		self.time = $time() - started;
		self.done = true;
		self.working = false;
		self.cancelled = false;
	}

	this.render = function(id)
	{
		var html = '';

		// grid
		html += '<table id="grid" cellpadding="0" cellspacing="0">';
		for ( var i = 0; i < grid.length; i++ )
		{
			// rows
			html += '<tr>';
			for ( var j = 0; j < grid[0].length; j++ )
			{
				var g = grid[i][j].split('_');

				// make the keys/doors display in order
				if ( g[0] == 'key' || g[0] == 'door' )
					g[1] = opt.keys - parseInt(g[1]);
				
				// make the cell
				html += '<td id="' + i + '_' + j + '" class="' + g[0] + '">' + (g[1] || '&nbsp;') + '</td>';
			}
			html += '</tr>';
		}
		html += '</table>';

		// write it
		if ( id )
			document.getElementById(id).innerHTML = html;
		else 
			document.body.innerHTML = html;
	}

	this.getDungeon = function()
	{
		return grid;
	}

	// creates an empty grid to play with
	function createGrid()
	{
		grid = [];
		walls = [];
		rooms = []; // will not be used in the for loops below

		for ( var i = 0; i < opt.sizeY; i++ )
		{
			grid[i] = [];
			walls[i] = [];
			for ( var j = 0; j < opt.sizeX; j++ )
			{
				grid[i][j] = tile.empty;
				walls[i][j] = i == 0 || j == 0 || i == opt.sizeY - 1 || j == opt.sizeX ? 1 : 0;
			}
		}

		return true;
	}

	function createRooms()
	{
		var time = $time();
		var roomCount = opt.roomCount;

		while ( roomCount > 0 )
		{
			// if the time runs out
			if ( (time + (roomCount * 500)) < $time() )
				break;

			// make a random room size
			var width = $rand(opt.roomMinX, opt.roomMaxX);
			var height = $rand(opt.roomMinY, opt.roomMaxY);

			// find a random spot to see if the room fits
			var x = $rand(2, grid[0].length - 2 - width);
			var y = $rand(2, grid.length - 2 - height);

			// assume we did
			var found = true;

			for ( var i = y; i < y + height + 1; i++ )
			{
				for ( var j = x; j < x + width + 1; j++ )
				{
					if ( grid[i][j] != tile.empty ||
						grid[i - 1][j - 1] != tile.empty ||
						grid[i - 1][j + 1] != tile.empty ||
						grid[i + 1][j + 1] != tile.empty ||
						grid[i + 1][j - 1] != tile.empty ||
						grid[i + 1][j] != tile.empty ||
						grid[i - 1][j] != tile.empty ||
						grid[i][j + 1] != tile.empty ||
						grid[i][j - 1] != tile.empty ||
						grid[i + 2][j] != tile.empty ||
						grid[i - 2][j] != tile.empty ||
						grid[i][j + 2] != tile.empty ||
						grid[i][j - 2] != tile.empty )
					found = false;
				}
			}

			if ( found )
			{
				for ( i = y; i < y + height; i++ )
					for ( j = x; j < x + width; j++ )
						grid[i][j] = tile.room;

				createRoom(x, y, width, height);
				roomCount--;
			}
		} // end while

		return roomCount == 0;
	}

	function createRoom(x, y, width, height)
	{
		// corners! this prevents the astar to come in through the corners
		walls[y][x] = 1; // top left
		walls[y][x - 1] = 1;
		walls[y - 1][x] = 1;
		walls[y - 1][x - 1] = 1;
		walls[y][x + width] = 1; // top right
		walls[y][x + width - 1] = 1;
		walls[y - 1][x + width] = 1;
		walls[y - 1][x + width - 1] = 1;
		walls[y + height][x + width] = 1; // bottom right
		walls[y + height][x + width - 1] = 1;
		walls[y + height - 1][x + width - 1] = 1;
		walls[y + height - 1][x + width] = 1;
		walls[y + height - 1][x] = 1; // bottom left
		walls[y + height - 1][x - 1] = 1;
		walls[y + height][x - 1] = 1;
		walls[y + height][x] = 1;

		// imaginary border around the room, makes the doors going into the room more random
		for ( var i = y - 1; i < y + height + 1; i++ )
		{
			if ( i % 2 ) continue; // need a way in
			walls[i][x - 1] = 1;
			walls[i][x + width] = 1;
		}
		for ( var j = x - 1; j < x + width + 1; j++ )
		{
			if ( j % 2 ) continue; // need a way in
			walls[y - 1][j] = 1;
			walls[y + height][j] = 1;
		}

		// add some room properties to the array
		var tx = $rand(x + 1, x + width - 1);
		var ty = $rand(y + 1, y + height - 1);

		rooms.push(
		{
			id : $time(),
			x : x,
			y : y,
			tx : tx,
			ty : ty,
			width : x + width,
			height : y + height,
			doors : [],
			key : '',
			order : -99
		});
	}

	function addDoorToRoomAt(x, y)
	{
		for ( var i = 0; i < rooms.length; i++ )
		{
			var room = rooms[i];
			if ( x >= room.x && x <= room.width &&
				y >= room.y && y <= room.height )
			room.doors.push({ x : x, y : y });
		}
	}

	function placeRandomWalls()
	{
		var count = opt.roomCount;
		while ( count > 0 )
		{
			var x = $rand(1, grid[0].length - 1);
			var y = $rand(1, grid.length - 1);

			if ( grid[y][x] == tile.roomTarget )
				continue;

			walls[y][x] = 1;
			count--;
		}

		return true;
	}

	function createHallsAndDoors()
	{
		for ( var i = 0; i < rooms.length; i++ )
		{
			var room1 = rooms[i];
			var room2 = rooms[i + 1];
			if ( !room2 )
				room2 = rooms[0];
			
			var result = AStar(walls, [room1.tx, room1.ty], [room2.tx, room2.ty], 'Manhattan');
			if ( result.length == 0 )
				return false;
			
			for ( var n = 1; n < result.length; n++ )
			{
				var x = result[n][0];
				var y = result[n][1];
				var x1, y1;

				if ( grid[y][x] == tile.empty )
				{
					grid[y][x] = tile.hall;

					// in front
					if ( result[n + 1] )
					{
						x1 = result[n + 1][0];
						y1 = result[n + 1][1];
						if ( grid[y1][x1] == tile.room )
						{
							grid[y1][x1] = tile.door;
							addDoorToRoomAt(x1, y1);
						}
					}
				}
				else if ( grid[y][x] == tile.room )
				{
					// in back
					if ( result[n + 1] )
					{
						x1 = result[n + 1][0];
						y1 = result[n + 1][1];
						if ( grid[y1][x1] == tile.empty )
						{
							grid[y][x] = tile.door;
							addDoorToRoomAt(x, y);
						}
					}
				} // end if else
			}
		} // end for i loop

		return true;
	}

	function fixWalls()
	{
		for ( var i = 0; i < grid.length; i++ )
			for ( var j = 0; j < grid[0].length; j++ )
				walls[i][j] = grid[i][j] == tile.empty ? 1 : 0;
		
		return true;
	}

	function setStartAndEnd()
	{
		// we find the fewest amount of doors from all the rooms

		rooms.sort(function(a, b)
		{
			return a.doors.length - b.doors.length;
		});

		grid[rooms[0].ty][rooms[0].tx] = tile.start;
		grid[rooms[1].ty][rooms[1].tx] = tile.end;

		return true;
	}

	function createPaths()
	{
		// there are no keys
		if ( opt.keys == 0 ) 
			return true;

		var last_room;
		var time = $time();

		// the start and end... remember the setStartAndEnd function
		rooms[0].order = 99;
		rooms[1].order = 0;

		// set the keys
		for ( var i = 0; i < opt.keys; i++ )
		{
			if ( i == 0 )
			{
				for ( var j = 0; j < rooms[1].doors.length; j++ )
				{
					var door = rooms[1].doors[j];
					grid[door.y][door.x] = 'door_' + i;
					walls[door.y][door.x] = 1;
				}

				// pick the last room, any last room
				last_room = $rand(2, rooms.length - 1);

				var room = rooms[last_room];
				room.key = i;
				room.order = i + 1;
				grid[room.ty][room.tx] = 'key_' + i;

				continue;
			}

			var placed = false;
			while ( !placed )
			{
				if ( (time + (opt.keys * 500)) < $time() )
					return false;

				var index = $rand(2, rooms.length - 1);
				var room = rooms[index];
				if ( grid[room.ty][room.tx] == tile.room )
				{
					placed = true;
					room.key = i;
					room.order = i + 1;
					grid[room.ty][room.tx] = 'key_' + i;

					for ( var j = 0; j < rooms[last_room].doors.length; j++ )
					{
						var door = rooms[last_room].doors[j];
						grid[door.y][door.x] = 'door_' + i;
						walls[door.y][door.x] = 1;
					}

					last_room = index;
				}
			} // end while
		}

		// now make sure its possible to beat the level
		return checkPaths();
	}

	function checkPaths()
	{
		rooms.sort(function(a, b)
		{
			return a.order - b.order;
		}).reverse();

		var stop = false;
		var finish = false;

		for ( var i = 0; i < rooms.length; i++ )
		{
			var room = rooms[i];

			if ( stop || finish || room.order == -99 )
				continue;

			if ( !rooms[i + 1] )
			{
				finish = true;
				continue;
			}

			if ( AStar(walls, [room.tx, room.ty], [rooms[i + 1].tx, rooms[i + 1].ty], 'Manhattan').length == 0 )
			{
				stop = true;
				continue;
			}

			if ( rooms[i + 2] )
			{
				for ( var j = 0; j < rooms[i + 2].doors.length; j++ )
				{
					var door = rooms[i + 2].doors[j];
					walls[door.y][door.x] = 0;
				}
			}
		}

		return !stop;
	}

	function cleanUp()
	{
		if ( !opt.doubled )
			return true;

		// make sure the halls' corners don't touch
		for ( var i = 0; i < grid.length; i++ )
		{
			for ( var j = 0; j < grid[0].length; j++ )
			{
				// bottom right and top left touch
				if ( grid[i][j] == 'hall' && grid[i][j + 1] == 'empty' && grid[i + 1][j] == 'empty' && grid[i + 1][j + 1] == 'hall' )
					return false;
				// bottom left and top right touch
				if ( grid[i][j] == 'empty' && grid[i][j + 1] == 'hall' && grid[i + 1][j] == 'hall' && grid[i + 1][j + 1] == 'empty' )
					return false;
			}
		}

		for ( var i = 0; i < grid.length; i += 2 )
		{
			var y = [];
			for ( var j = 0; j < grid[0].length; j++ )
				y[j] = grid[i][j];
			grid.splice(i, 0, y);
		}

		for ( var i = 0; i < grid.length; i++ )
		{
			for ( var j = 0; j < grid[0].length; j += 2 )
				grid[i].splice(j, 0, grid[i][j]);
		}

		// everything is quadrubled... fix the key and doors
		for ( var i = 0; i < grid.length - 1; i++ )
		{
			for ( var j = 0; j < grid[0].length - 1; j++ )
			{
				// keys
				for ( var k = 0; k < opt.keys; k++ )
				{
					var key = 'key_' + k;

					if ( grid[i][j] == key &&
						grid[i][j + 1] == key &&
						grid[i + 1][j + 1] == key &&
						grid[i + 1][j] == key )
						grid[i][j + 1] = grid[i + 1][j] = grid[i + 1][j + 1] = tile.room;
				}

				// doors
				if ( grid[i][j].indexOf('door') > -1 &&
					grid[i][j + 1].indexOf('door') > -1 &&
					grid[i + 1][j + 1].indexOf('door') > -1 &&
					grid[i + 1][j].indexOf('door') > -1 )
				{
					// top
					if ( grid[i - 1][j] == tile.hall && grid[i - 1][j + 1] == tile.hall )
						grid[i - 1][j] = grid[i - 1][j + 1] = grid[i][j];
					// bottom
					if ( grid[i + 2][j] == tile.hall && grid[i + 2][j + 1] == tile.hall )
						grid[i + 2][j] = grid[i + 2][j + 1] = grid[i][j];
					// right
					if ( grid[i][j + 2] == tile.hall && grid[i + 1][j + 2] == tile.hall )
						grid[i][j + 2] = grid[i + 1][j + 2] = grid[i][j];
					// left
					if ( grid[i][j - 1] == tile.hall && grid[i + 1][j - 1] == tile.hall )
						grid[i][j - 1] = grid[i + 1][j - 1] = grid[i][j];
					
					// its now a room
					grid[i][j] = grid[i][j + 1] = grid[i + 1][j] = grid[i + 1][j + 1] = tile.room;
				}

				// start/end
				if ( grid[i][j] == tile.start )
					grid[i][j + 1] = grid[i + 1][j] = grid[i + 1][j + 1] = tile.room;
				if ( grid[i][j] == tile.end )
					grid[i][j + 1] = grid[i + 1][j] = grid[i + 1][j + 1] = tile.room;
			}
		}

		return true;
	}


	// misc functions

	// returns timestamp
	function $time()
	{
		return (new Date).getTime();
	}

	// returns a random number
	function $rand(min, max)
	{
		return min + Math.floor((Math.random() * (max - min)));
	}

	// merges two objects
	function merge(o1, o2)
	{
		o1 = o1 || {};
		o2 = o2 || {};

		for ( var key in o2 )
		{
			var value = o2[key];
			try 
			{
				if ( value.constructor === Object )
					o1[key] = merge(key, value);
				else
					o1[key] = value;
			}
			catch (e)
			{
				o1[key] = value;
			}
		}

		return o1;
	}
}