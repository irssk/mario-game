// основной класс игры Марио

function MarioGame() {
  var gameUI = GameUI.getInstance();

  var maxWidth; // ширина игрового мира
  var height;
  var viewPort; // ширина холста, видимый порт просмотра
  var tileSize;
  var map;
  var originalMaps;

  var translatedDist; // расстояние переводится (прокрутка сбоку), когда Марио движется вправо
  var centerPos; // центральное положение viewPort, видимый экран
  var marioInGround;

  // случаи
  var mario;
  var element;
  var gameSound;
  var score;

  var keys = [];
  var goombas;
  var powerUps;
  var bullets;
  var bulletFlag = false;

  var currentLevel;

  var animationID;
  var timeOutId;

  var tickCounter = 0; // для анимации Марио
  var maxTick = 25; // максимальное число тиков для отображения спрайта Марио
  var instructionTick = 0; // показывает счетчик инструкций
  var that = this;

  this.init = function(levelMaps, level) {
    height = 480;
    maxWidth = 0;
    viewPort = 1280;
    tileSize = 32;
    translatedDist = 0;
    goombas = [];
    powerUps = [];
    bullets = [];

    gameUI.setWidth(viewPort);
    gameUI.setHeight(height);
    gameUI.show();

    currentLevel = level;
    originalMaps = levelMaps;
    map = JSON.parse(levelMaps[currentLevel]);

    if (!score) {
      // чтобы при изменении уровня использовался тот же экземпляр
      score = new Score();
      score.init();
    }
    score.displayScore();
    score.updateLevelNum(currentLevel);

    if (!mario) {
      // чтобы при изменении уровня использовался тот же экземпляр
      mario = new Mario();
      mario.init();
    } else {
      mario.x = 10;
      mario.frame = 0;
    }
    element = new Element();
    gameSound = new GameSound();
    gameSound.init();

    that.calculateMaxWidth();
    that.bindKeyPress();
    that.startGame();
  };

  that.calculateMaxWidth = function() {
    // вычисляет максимальную ширину игры в зависимости от размера карты
    for (var row = 0; row < map.length; row++) {
      for (var column = 0; column < map[row].length; column++) {
        if (maxWidth < map[row].length * 32) {
          maxWidth = map[column].length * 32;
        }
      }
    }
  };

  that.bindKeyPress = function() {
    var canvas = gameUI.getCanvas(); // для использования с сенсорными событиями

    // привязка клавиш
    document.body.addEventListener('keydown', function(e) {
      keys[e.keyCode] = true;
    });

    document.body.addEventListener('keyup', function(e) {
      keys[e.keyCode] = false;
    });

    // привязка клавиш для сенсорных событий
    canvas.addEventListener('touchstart', function(e) {
      var touches = e.changedTouches;
      e.preventDefault();

      for (var i = 0; i < touches.length; i++) {
        if (touches[i].pageX <= 200) {
          keys[37] = true; // стрелка влево
        }
        if (touches[i].pageX > 200 && touches[i].pageX < 400) {
          keys[39] = true; // правая стрелка
        }
        if (touches[i].pageX > 640 && touches[i].pageX <= 1080) {
          // в сенсорных событиях одна и та же область действует как клавиша спринта и маркера
          keys[16] = true; // клавиша Shift
          keys[17] = true; // клавиша Ctrl
        }
        if (touches[i].pageX > 1080 && touches[i].pageX < 1280) {
          keys[32] = true; //пробел
        }
      }
    });

    canvas.addEventListener('touchend', function(e) {
      var touches = e.changedTouches;
      e.preventDefault();

      for (var i = 0; i < touches.length; i++) {
        if (touches[i].pageX <= 200) {
          keys[37] = false;
        }
        if (touches[i].pageX > 200 && touches[i].pageX <= 640) {
          keys[39] = false;
        }
        if (touches[i].pageX > 640 && touches[i].pageX <= 1080) {
          keys[16] = false;
          keys[17] = false;
        }
        if (touches[i].pageX > 1080 && touches[i].pageX < 1280) {
          keys[32] = false;
        }
      }
    });

    canvas.addEventListener('touchmove', function(e) {
      var touches = e.changedTouches;
      e.preventDefault();

      for (var i = 0; i < touches.length; i++) {
        if (touches[i].pageX <= 200) {
          keys[37] = true;
          keys[39] = false;
        }
        if (touches[i].pageX > 200 && touches[i].pageX < 400) {
          keys[39] = true;
          keys[37] = false;
        }
        if (touches[i].pageX > 640 && touches[i].pageX <= 1080) {
          keys[16] = true;
          keys[32] = false;
        }
        if (touches[i].pageX > 1080 && touches[i].pageX < 1280) {
          keys[32] = true;
          keys[16] = false;
          keys[17] = false;
        }
      }
    });
  };

  // основной игровой цикл
  this.startGame = function() {
    animationID = window.requestAnimationFrame(that.startGame);

    gameUI.clear(0, 0, maxWidth, height);

    if (instructionTick < 1000) {
      that.showInstructions(); // показ инструкций по управлению
      instructionTick++;
    }

    that.renderMap();

    for (var i = 0; i < powerUps.length; i++) {
      powerUps[i].draw();
      powerUps[i].update();
    }

    for (var i = 0; i < bullets.length; i++) {
      bullets[i].draw();
      bullets[i].update();
    }

    for (var i = 0; i < goombas.length; i++) {
      goombas[i].draw();
      goombas[i].update();
    }

    that.checkPowerUpMarioCollision();
    that.checkBulletEnemyCollision();
    that.checkEnemyMarioCollision();

    mario.draw();
    that.updateMario();
    that.wallCollision();
    marioInGround = mario.grounded; // для использования со сдвижным флажком
  };

  this.showInstructions = function() {
    gameUI.writeText('Controls: Arrow keys for direction, shift to run, ctrl for bullets', 30, 30);
    gameUI.writeText('Tip: Jumping while running makes you jump higher', 30, 60);
  };

  this.renderMap = function() {
    // установка false каждый раз при рендеринге карты, чтобы элементы падали с платформы, а не зависали вокруг
    mario.grounded = false;

    for (var i = 0; i < powerUps.length; i++) {
      powerUps[i].grounded = false;
    }
    for (var i = 0; i < goombas.length; i++) {
      goombas[i].grounded = false;
    }

    for (var row = 0; row < map.length; row++) {
      for (var column = 0; column < map[row].length; column++) {
        switch (map[row][column]) {
          case 1: // платформа
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.platform();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 2: // coinBox
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.coinBox();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 3: // powerUp Box
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.powerUpBox();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 4: // uselessBox
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.uselessBox();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 5: // флагшток
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.flagPole();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            break;

          case 6: // флаг
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.flag();
            element.draw();
            break;

          case 7: // pipeLeft
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.pipeLeft();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 8: // pipeRight
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.pipeRight();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 9: // pipeTopLeft
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.pipeTopLeft();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 10: // pipeTopRight
            element.x = column * tileSize;
            element.y = row * tileSize;
            element.pipeTopRight();
            element.draw();

            that.checkElementMarioCollision(element, row, column);
            that.checkElementPowerUpCollision(element);
            that.checkElementEnemyCollision(element);
            that.checkElementBulletCollision(element);
            break;

          case 20: // гумба
            var enemy = new Enemy();
            enemy.x = column * tileSize;
            enemy.y = row * tileSize;
            enemy.goomba();
            enemy.draw();

            goombas.push(enemy);
            map[row][column] = 0;
        }
      }
    }
  };

  this.collisionCheck = function(objA, objB) {
    // получить векторы для проверки
    var vX = objA.x + objA.width / 2 - (objB.x + objB.width / 2);
    var vY = objA.y + objA.height / 2 - (objB.y + objB.height / 2);

    // добавить полуширину и полувысоту объектов
    var hWidths = objA.width / 2 + objB.width / 2;
    var hHeights = objA.height / 2 + objB.height / 2;
    var collisionDirection = null;

    // если вектор x и y меньше половины ширины или половины высоты, то мы должны находиться внутри объекта, что приводит к столкновению
    if (Math.abs(vX) < hWidths && Math.abs(vY) < hHeights) {
      // выясняет, с какой стороны мы сталкиваемся (сверху, снизу, слева или справа)
      var offsetX = hWidths - Math.abs(vX);
      var offsetY = hHeights - Math.abs(vY);

      if (offsetX >= offsetY) {
        if (vY > 0 && vY < 37) {
          collisionDirection = 't';
          if (objB.type != 5) {
            // если флагшток, то пройди сквозь него
            objA.y += offsetY;
          }
        } else if (vY < 0) {
          collisionDirection = 'b';
          if (objB.type != 5) {
            // если флагшток, то пройди сквозь него
            objA.y -= offsetY;
          }
        }
      } else {
        if (vX > 0) {
          collisionDirection = 'l';
          objA.x += offsetX;
        } else {
          collisionDirection = 'r';
          objA.x -= offsetX;
        }
      }
    }
    return collisionDirection;
  };

  this.checkElementMarioCollision = function(element, row, column) {
    var collisionDirection = that.collisionCheck(mario, element);

    if (collisionDirection == 'l' || collisionDirection == 'r') {
      mario.velX = 0;
      mario.jumping = false;

      if (element.type == 5) {
        // флагшток
        that.levelFinish(collisionDirection);
      }
    } else if (collisionDirection == 'b') {
      if (element.type != 5) {
        // только если не флагшток
        mario.grounded = true;
        mario.jumping = false;
      }
    } else if (collisionDirection == 't') {
      if (element.type != 5) {
        mario.velY *= -1;
      }

      if (element.type == 3) {
        // PowerUp коробка
        var powerUp = new PowerUp();

        // дает гриб, если Марио маленький, иначе дает цветок
        if (mario.type == 'small') {
          powerUp.mushroom(element.x, element.y);
          powerUps.push(powerUp);
        } else {
          powerUp.flower(element.x, element.y);
          powerUps.push(powerUp);
        }

        map[row][column] = 4; // устанавливается в бесполезную коробку после появления PowerUp

        // звук при появлении гриба
        gameSound.play('powerUpAppear');
      }

      if (element.type == 11) {
        // цветочная коробка
        var powerUp = new PowerUp();
        powerUp.flower(element.x, element.y);
        powerUps.push(powerUp);

        map[row][column] = 4; // устанавливается в бесполезную коробку после появления PowerUp

        // звук, когда появляется цветок
        gameSound.play('powerUpAppear');
      }

      if (element.type == 2) {
        // коробка для монет
        score.coinScore++;
        score.totalScore += 100;

        score.updateCoinScore();
        score.updateTotalScore();
        map[row][column] = 4; // садится в бесполезную коробку после появления монеты

        // звук при ударе по блоку монет
        gameSound.play('coin');
      }
    }
  };

  this.checkElementPowerUpCollision = function(element) {
    for (var i = 0; i < powerUps.length; i++) {
      var collisionDirection = that.collisionCheck(powerUps[i], element);

      if (collisionDirection == 'l' || collisionDirection == 'r') {
        powerUps[i].velX *= -1; // изменить направление столкновения с любым элементом сбоку
      } else if (collisionDirection == 'b') {
        powerUps[i].grounded = true;
      }
    }
  };

  this.checkElementEnemyCollision = function(element) {
    for (var i = 0; i < goombas.length; i++) {
      if (goombas[i].state != 'deadFromBullet') {
        // чтобы гумбы падали с карты, будучи мертвыми от пули
        var collisionDirection = that.collisionCheck(goombas[i], element);

        if (collisionDirection == 'l' || collisionDirection == 'r') {
          goombas[i].velX *= -1;
        } else if (collisionDirection == 'b') {
          goombas[i].grounded = true;
        }
      }
    }
  };

  this.checkElementBulletCollision = function(element) {
    for (var i = 0; i < bullets.length; i++) {
      var collisionDirection = that.collisionCheck(bullets[i], element);

      if (collisionDirection == 'b') {
        // если столкновение происходит снизу пули, она заземляется, чтобы ее можно было отскочить
        bullets[i].grounded = true;
      } else if (collisionDirection == 't' || collisionDirection == 'l' || collisionDirection == 'r') {
        bullets.splice(i, 1);
      }
    }
  };

  this.checkPowerUpMarioCollision = function() {
    for (var i = 0; i < powerUps.length; i++) {
      var collWithMario = that.collisionCheck(powerUps[i], mario);
      if (collWithMario) {
        if (powerUps[i].type == 30 && mario.type == 'small') {
          // гриб
          mario.type = 'big';
        } else if (powerUps[i].type == 31) {
          // цветок
          mario.type = 'fire';
        }
        powerUps.splice(i, 1);

        score.totalScore += 1000;
        score.updateTotalScore();

        // звук при появлении гриба
        gameSound.play('powerUp');
      }
    }
  };

  this.checkEnemyMarioCollision = function() {
    for (var i = 0; i < goombas.length; i++) {
      if (!mario.invulnerable && goombas[i].state != 'dead' && goombas[i].state != 'deadFromBullet') {
        // если Марио неуязвим или состояние гумбы мертво, столкновения не происходит
        var collWithMario = that.collisionCheck(goombas[i], mario);

        if (collWithMario == 't') {
          // убить гумбов, если столкновение произошло сверху
          goombas[i].state = 'dead';

          mario.velY = -mario.speed;

          score.totalScore += 1000;
          score.updateTotalScore();

          // звук, когда враг умирает
          gameSound.play('killEnemy');
        } else if (collWithMario == 'r' || collWithMario == 'l' || collWithMario == 'b') {
          goombas[i].velX *= -1;

          if (mario.type == 'big') {
            mario.type = 'small';
            mario.invulnerable = true;
            collWithMario = undefined;

            // звук, когда Марио PowerDowns
            gameSound.play('powerDown');

            setTimeout(function() {
              mario.invulnerable = false;
            }, 1000);
          } else if (mario.type == 'fire') {
            mario.type = 'big';
            mario.invulnerable = true;

            collWithMario = undefined;

            // звук, когда Марио PowerDowns
            gameSound.play('powerDown');

            setTimeout(function() {
              mario.invulnerable = false;
            }, 1000);
          } else if (mario.type == 'small') {
            // убить Марио, если произойдет столкновение, когда он маленький
            that.pauseGame();

            mario.frame = 13;
            collWithMario = undefined;

            score.lifeCount--;
            score.updateLifeCount();

            // звук, когда Марио умирает
            gameSound.play('marioDie');

            timeOutId = setTimeout(function() {
              if (score.lifeCount == 0) {
                that.gameOver();
              } else {
                that.resetGame();
              }
            }, 3000);
            break;
          }
        }
      }
    }
  };

  this.checkBulletEnemyCollision = function() {
    for (var i = 0; i < goombas.length; i++) {
      for (var j = 0; j < bullets.length; j++) {
        if (goombas[i] && goombas[i].state != 'dead') {
          // проверять столкновение только в том случае, если гумбы существуют и не мертвы
          var collWithBullet = that.collisionCheck(goombas[i], bullets[j]);
        }

        if (collWithBullet) {
          bullets[j] = null;
          bullets.splice(j, 1);

          goombas[i].state = 'deadFromBullet';

          score.totalScore += 1000;
          score.updateTotalScore();

          // звук, когда враг умирает
          gameSound.play('killEnemy');
        }
      }
    }
  };

  this.wallCollision = function() {
    // для стен (стены смотрового окна)
    if (mario.x >= maxWidth - mario.width) {
      mario.x = maxWidth - mario.width;
    } else if (mario.x <= translatedDist) {
      mario.x = translatedDist + 1;
    }

    // для земли (площадка смотрового окна)
    if (mario.y >= height) {
      that.pauseGame();

      // звук, когда Марио умирает
      gameSound.play('marioDie');

      score.lifeCount--;
      score.updateLifeCount();

      timeOutId = setTimeout(function() {
        if (score.lifeCount == 0) {
          that.gameOver();
        } else {
          that.resetGame();
        }
      }, 3000);
    }
  };

  // управление Марио с помощью ключевых событий
  this.updateMario = function() {
    var friction = 0.9;
    var gravity = 0.2;

    mario.checkMarioType();

    if (keys[38] || keys[32]) {
      // стрелка вверх
      if (!mario.jumping && mario.grounded) {
        mario.jumping = true;
        mario.grounded = false;
        mario.velY = -(mario.speed / 2 + 5.5);

        // положение спрайта Марио
        if (mario.frame == 0 || mario.frame == 1) {
          mario.frame = 3; //right jump
        } else if (mario.frame == 8 || mario.frame == 9) {
          mario.frame = 2; // левый прыжок
        }

        // звук, когда Марио прыгает
        gameSound.play('jump');
      }
    }

    if (keys[39]) {
      // правая стрелка
      that.checkMarioPos(); // если Марио переместится в центр экрана, прокрутите карту

      if (mario.velX < mario.speed) {
        mario.velX++;
      }

      // положение спрайта Марио
      if (!mario.jumping) {
        tickCounter += 1;

        if (tickCounter > maxTick / mario.speed) {
          tickCounter = 0;

          if (mario.frame != 1) {
            mario.frame = 1;
          } else {
            mario.frame = 0;
          }
        }
      }
    }

    if (keys[37]) {
      // стрелка влево
      if (mario.velX > -mario.speed) {
        mario.velX--;
      }

      // положение спрайта Марио
      if (!mario.jumping) {
        tickCounter += 1;

        if (tickCounter > maxTick / mario.speed) {
          tickCounter = 0;

          if (mario.frame != 9) {
            mario.frame = 9;
          } else {
            mario.frame = 8;
          }
        }
      }
    }

    if (keys[16]) {
      // клавиша Shift
      mario.speed = 4.5;
    } else {
      mario.speed = 3;
    }

    if (keys[17] && mario.type == 'fire') {
      // клавиша Ctrl
      if (!bulletFlag) {
        bulletFlag = true;
        var bullet = new Bullet();
        if (mario.frame == 9 || mario.frame == 8 || mario.frame == 2) {
          var direction = -1;
        } else {
          var direction = 1;
        }
        bullet.init(mario.x, mario.y, direction);
        bullets.push(bullet);

        // звук пули
        gameSound.play('bullet');

        setTimeout(function() {
          bulletFlag = false; // позволяет Марио стрелять пулями только через 500 мс
        }, 500);
      }
    }

    // позиция спрайта скорости 0
    if (mario.velX > 0 && mario.velX < 1 && !mario.jumping) {
      mario.frame = 0;
    } else if (mario.velX > -1 && mario.velX < 0 && !mario.jumping) {
      mario.frame = 8;
    }

    if (mario.grounded) {
      mario.velY = 0;

      // заземленное положение спрайта
      if (mario.frame == 3) {
        mario.frame = 0; //гялдя направо
      } else if (mario.frame == 2) {
        mario.frame = 8; // глядя налево
      }
    }

    // изменить позицию Марио
    mario.velX *= friction;
    mario.velY += gravity;

    mario.x += mario.velX;
    mario.y += mario.velY;
  };

  this.checkMarioPos = function() {
    centerPos = translatedDist + viewPort / 2;

    // боковая прокрутка, когда Марио достигает центра окна просмотра
    if (mario.x > centerPos && centerPos + viewPort / 2 < maxWidth) {
      gameUI.scrollWindow(-mario.speed, 0);
      translatedDist += mario.speed;
    }
  };

  this.levelFinish = function(collisionDirection) {
    // игра заканчивается, когда Марио сдвигает флагшток и сталкивается с землей
    if (collisionDirection == 'r') {
      mario.x += 10;
      mario.velY = 2;
      mario.frame = 11;
    } else if (collisionDirection == 'l') {
      mario.x -= 32;
      mario.velY = 2;
      mario.frame = 10;
    }

    if (marioInGround) {
      mario.x += 20;
      mario.frame = 10;
      tickCounter += 1;
      if (tickCounter > maxTick) {
        that.pauseGame();

        mario.x += 10;
        tickCounter = 0;
        mario.frame = 12;

        // звук, когда сцена очищается
        gameSound.play('stageClear');

        timeOutId = setTimeout(function() {
          currentLevel++;
          if (originalMaps[currentLevel]) {
            that.init(originalMaps, currentLevel);
            score.updateLevelNum(currentLevel);
          } else {
            that.gameOver();
          }
        }, 5000);
      }
    }
  };

  this.pauseGame = function() {
    window.cancelAnimationFrame(animationID);
  };

  this.gameOver = function() {
    score.gameOverView();
    gameUI.makeBox(0, 0, maxWidth, height);
    gameUI.writeText('Game Over', centerPos - 80, height - 300);
    gameUI.writeText('Thanks For Playing', centerPos - 122, height / 2);
  };

  this.resetGame = function() {
    that.clearInstances();
    that.init(originalMaps, currentLevel);
  };

  this.clearInstances = function() {
    mario = null;
    element = null;
    gameSound = null;

    goombas = [];
    bullets = [];
    powerUps = [];
  };

  this.clearTimeOut = function() {
    clearTimeout(timeOutId);
  };

  this.removeGameScreen = function() {
    gameUI.hide();

    if (score) {
      score.hideScore();
    }
  };

  this.showGameScreen = function() {
    gameUI.show();
  };
}