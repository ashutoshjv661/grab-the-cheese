document.addEventListener("DOMContentLoaded", () => {
  const userGrid = document.querySelector(".grid-user");
  const computerGrid = document.querySelector(".grid-computer");
  const displayGrid = document.querySelector(".grid-display");
  const cubes = document.querySelectorAll(".cube");
  const startButton = document.querySelector("#start");
  const turnDisplay = document.querySelector("#whose-go");
  const infoDisplay = document.querySelector("#info");
  const setupButtons = document.getElementById('setup-buttons')
  const userSquares = [];
  const computerSquares = [];
  let isGameOver = false;
  let currentPlayer = "user"; //user is player 0
  const width = 5;
  let playerNum = 0; //Player 0 or 1
  let ready = false; //if connected
  let enemyReady = false;
  let allCubesPlaced = false; //dont start if not placed
  let cheeseGrabbed = -1;
  turnDisplay.style.display = "none"; //Not showing turn at
  //for Computer Grid generation
  const cubeArray = ["mozzarella","cheddar","gouda","feta","parmesan"];

  //Create Board : grid is a div DOM and squares is an array
  function createBoard(grid, squares) {
    // matrix of 5*5
    for (let i = 0; i < width * width; i++) {
      const square = document.createElement("div");
      square.dataset.id = i; // data-id : present in every htmlElement
      grid.appendChild(square); //generate 25 divs and give them ids and push into array userSquare / computerSquare
      squares.push(square);
    }
  }

  //creating boards : adding 100 divs on user and enemy board 
  createBoard(userGrid, userSquares);
  createBoard(computerGrid, computerSquares);

  // select player mode
  if(gameMode === "singlePlayer"){ 
    startSinglePlayer();
  }else{ 
    startMultiPlayer(); 
  }

  // Multi Player
  function startMultiPlayer() {
    const socket = io(); //io will be registered as a global variable

    //get player Number
    socket.on("player-number", (num) => {
      if (num === -1) {
        infoDisplay.innerHTML = "Sorry, the Server is Full";
      } else {
        playerNum = parseInt(num); //data from socketio is string
        if (playerNum === 1) currentPlayer = "enemy"; // player 1 is enemy 0 is user
        //console.log(playerNum);
        // Get other player status
        socket.emit("check-players");
      }
    });

    //Another player has connected or disconnected
    socket.on("player-connection", (num) => {
      console.log("Player " + num + " has connected or disconnected");
      playerConnectedOrDisconnected(num);
    });

    // On enemy ready
    socket.on("enemy-ready", (num) => {
      enemyReady = true;
      playerReady(num);
      if (ready) {
        //if we are ready
        playGameMulti(socket);
        setupButtons.style.display = "none";
      }
    });

    // Check player status
    socket.on("check-players", (players) => {
      players.forEach((p, i) => {
        //player object and index
        if (p.connected) playerConnectedOrDisconnected(i);
        if (p.ready) {
          playerReady(i);
          if (i !== playerReady) enemyReady = true;
        }
      });
    });

    // On Timeout
    socket.on("timeout", () => {
      infoDisplay.innerHTML = "You have reached the 10 minute limit";
    });

    //readybutton click
    startButton.addEventListener("click", () => {
      if (allCubesPlaced) {
        playGameMulti(socket);
      } else {
        infoDisplay.innerHTML = "Please place all Cheese cubes ";
      }
    });

    // Setup event listeners for firing
    computerSquares.forEach((square) => {
      square.addEventListener("click", () => {
        if (currentPlayer === "user" && ready && enemyReady) {
          cheeseGrabbed = square.dataset.id;
          socket.emit("grab", cheeseGrabbed);
        }
      });
    });

    // On grab Received
    socket.on("grab", (id) => {
      enemyGo(id);
      const square = userSquares[id];
      socket.emit("grab-reply", square.classList);
      playGameMulti(socket);
    });

    // On grab Reply Received
    socket.on("grab-reply", (classList) => {
      revealSquare(classList);
      playGameMulti(socket);
    });

    function playerConnectedOrDisconnected(num) {
      let player = `.p${parseInt(num) + 1}`;
      document.querySelector(`${player} .connected`).classList.toggle('active');
      if(parseInt(num) === playerNum) {
        document.querySelector(player).style.fontWeight = 'bold';
        document.querySelector(player).style.textDecoration = "underline";
      }
    }
  }

 

  //Single Player
  function startSinglePlayer() {
    //only generate cubes in single player mode
    for(i=0;i<5;i++){
      generate(cubeArray[i]);
    }
    startButton.addEventListener('click', () => {
      if (allCubesPlaced) {
        setupButtons.style.display = 'none';
        playGameSingle();
      } else {
        infoDisplay.innerHTML = "Please place all Cheese Cubes ";
      }
    });
  }

  //Draw the enemy cubes in random locations
  function generate(cube) {
    let current = Math.floor(Math.random() * computerSquares.length);
    //The Array.some() method checks if any of the elements in an array pass a test (provided as a function).
    const isTaken = computerSquares[current].classList.contains("taken"); //if any element has class "taken"
    if (!isTaken){
      //if not marked any add the taken class to all divs
      computerSquares[current].classList.add("taken",cube); //add taken and cube name ex. mozzarella
    }else generate(cube); // again do the same thing till this loop is over
  }

  //move around user cubes
  //all div elements with "cube" class contains child divs
  cubes.forEach((cube) => cube.addEventListener("dragstart", dragStart));
  userSquares.forEach((square) => square.addEventListener("dragover", dragOver));
  userSquares.forEach((square) => square.addEventListener("dragenter", dragEnter));
  userSquares.forEach((square) => square.addEventListener("dragleave", dragLeave));
  userSquares.forEach((square) => square.addEventListener("drop", dragDrop));
  userSquares.forEach((square) => square.addEventListener("dragend", dragEnd));

  let draggedCube;
  function dragStart() {
    draggedCube = this;
  }
  function dragOver(e) { e.preventDefault();}  //prevent from default action
  function dragEnter(e) { e.preventDefault();}
  function dragLeave() {}//console.log("drag leave");

  function dragDrop() {
    infoDisplay.innerHTML = "";
    let cubeName = draggedCube.childNodes[0].id; // example cheddar
    console.log(cubeName);
    let placeId = parseInt(this.dataset.id); //"this" refers to 25 div tags happens
    userSquares[placeId].classList.add("taken",cubeName);
    displayGrid.removeChild(draggedCube); 
    if (!displayGrid.querySelector(".cube")) allCubesPlaced = true; //if display grid empty set all cube played
  }

  function dragEnd() {} // console.log("dragend");

  //Game logic for multiplayer
  function playGameMulti(socket) {
    setupButtons.style.display = "none";
    if (isGameOver) return;
    if (!ready) {
      socket.emit("player-ready");
      ready = true;
      playerReady(playerNum);
    }
    if (enemyReady) {
      turnDisplay.style.display = "";
      if (currentPlayer === "user") {
        turnDisplay.innerHTML = "Your Go";
      }
      if (currentPlayer === "enemy") {
        turnDisplay.innerHTML = "Enemy's Go";
      }
    }
  }

  function playerReady(num) {
    let player = `.p${parseInt(num) + 1}`;
    document.querySelector(`${player} .ready`).classList.toggle("active");
  }

  //Game Logic for single player
  function playGameSingle() {
    if (isGameOver) return;
    if (currentPlayer === "user") {
      turnDisplay.style.display = "";
      turnDisplay.innerHTML = "Your Go";
      computerSquares.forEach((square) => square.addEventListener("click", function (e) {
          cheeseGrabbed = square.dataset.id;
          revealSquare(square.classList);
        }));
    }
    if (currentPlayer === "enemy") {
      turnDisplay.style.display = "";
      turnDisplay.innerHTML = "Computers Go";
      setTimeout(enemyGo, 1000);
    }
  }

  //Player  Points if these increase
  let mozzarellaCount = 0;
  let cheddarCount = 0;
  let goudaCount = 0;
  let fetaCount = 0;
  let parmesanCount = 0;

  function revealSquare(classList) {
    const enemySquare = computerGrid.querySelector(`div[data-id='${cheeseGrabbed}']`);
    const obj = Object.values(classList);
    if (!enemySquare.classList.contains("boom") && !enemySquare.classList.contains("miss") && currentPlayer === "user" && !isGameOver) {
      if (obj.includes("mozzarella")) mozzarellaCount++;
      if (obj.includes("cheddar")) cheddarCount++;
      if (obj.includes("gouda")) goudaCount++;
      if (obj.includes("feta")) fetaCount++;
      if (obj.includes("parmesan")) parmesanCount++;
      
      if (obj.includes("taken")) {
        enemySquare.classList.add("boom");
      } else {
        enemySquare.classList.add("miss");
      }
    }else{ 
      if(gameMode === "singlePlayer") playGameSingle();
    }
    checkForWins();
    currentPlayer = "enemy";
    if (gameMode === "singlePlayer") playGameSingle();
  }

  //Cpu points if these increase
  let cpuMozzarellaCount = 0;
  let cpuCheddarCount = 0;
  let cpuGoudaCount = 0;
  let cpuFetaCount = 0;
  let cpuParmesanCount = 0;

  function enemyGo(square) {
    if (gameMode === 'singlePlayer') square = Math.floor(Math.random() * userSquares.length);
    if (!userSquares[square].classList.contains('boom') && !userSquares[square].classList.contains('miss')) {
      const hit = userSquares[square].classList.contains('taken');
      userSquares[square].classList.add(hit ? 'boom' : 'miss');
      if (userSquares[square].classList.contains('mozzarella')) cpuMozzarellaCount++
      if (userSquares[square].classList.contains('cheddar')) cpuCheddarCount++
      if (userSquares[square].classList.contains('gouda')) cpuGoudaCount++
      if (userSquares[square].classList.contains('feta')) cpuFetaCount++
      if (userSquares[square].classList.contains('parmesan')) cpuParmesanCount++
      checkForWins()
    } else if (gameMode === 'singlePlayer') enemyGo();
    currentPlayer = 'user';
    turnDisplay.innerHTML = 'Your Go';
  }

  function checkForWins() {
    let enemy = "computer";
    if (gameMode === "multiPlayer") enemy = "enemy";
    if (mozzarellaCount===1) {
      infoDisplay.innerHTML = `You Grabbed the ${enemy}'s mozzarella`;
      mozzarellaCount = 10;
    }
    if (cheddarCount===1) {
      infoDisplay.innerHTML = `You Grabbed the ${enemy}'s cheddar`;
      cheddarCount = 10;
    }
    if (goudaCount===1) {
      infoDisplay.innerHTML = `You Grabbed the ${enemy}'s gouda`;
      goudaCount = 10;
    }
    if (fetaCount === 1) {
      infoDisplay.innerHTML = `You Grabbed the ${enemy}'s feta`;
      fetaCount = 10;
    }
    if (parmesanCount === 1) {
      infoDisplay.innerHTML = `You Grabbed the ${enemy}'s parmesan`;
      parmesanCount = 10;
    }
    if (cpuMozzarellaCount === 1) {
      infoDisplay.innerHTML = `${enemy} Grabbed your mozzarella`;
      cpuMozzarellaCount = 10;
    }
    if (cpuCheddarCount === 1) {
      infoDisplay.innerHTML = `${enemy} Grabbed your cheddar`;
      cpuCheddarCount = 10;
    }
    if (cpuGoudaCount === 1) {
      infoDisplay.innerHTML = `${enemy} Grabbed your gouda`;
      cpuGoudaCount = 10;
    }
    if (cpuFetaCount === 1) {
      infoDisplay.innerHTML = `${enemy} Grabbed your feta`;
      cpuFetaCount = 10;
    }
    if (cpuParmesanCount === 1) {
      infoDisplay.innerHTML = `${enemy} Grabbed your parmesan`;
      cpuParmesanCount = 10;
    }
    if (mozzarellaCount + cheddarCount + goudaCount + fetaCount + parmesanCount === 50) {
      infoDisplay.innerHTML = "YOU WIN";
      gameOver();
    }
    if (cpuMozzarellaCount + cpuCheddarCount + cpuGoudaCount + cpuFetaCount + cpuParmesanCount === 50) {
      infoDisplay.innerHTML = `${enemy.toUpperCase()} WINS`;
      gameOver();
    }
  }
  //Game over
  function gameOver() {
    isGameOver = true;
    turnDisplay.style.display = "none";
    startButton.removeEventListener("click", playGameSingle);
  }
});
