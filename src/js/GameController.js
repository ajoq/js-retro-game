/* eslint-disable max-len */
import AddFunctions from './AddFunctions';
import cursors from './cursors';
import distance from './distance';
import GamePlay from './GamePlay';
import GameState from './GameState';
import PositionedCharacter from './PositionedCharacter';
import Team from './Team';
import themes from './themes';

export default class GameController {
  constructor(gamePlay, stateService) {
    this.gamePlay = gamePlay;
    this.stateService = stateService;
    this.gameState = new GameState();
    this.cleanGameProperty();
  }

  init() {
    this.gamePlay.drawUi(themes[this.level]);

    if (this.stateService.storage.length > 0) {
      this.gameState.bestPoints = this.stateService.load().bestPoints;
    }

    this.gamePlay.addNewGameListener(this.newGame.bind(this));
    this.gamePlay.addSaveGameListener(this.saveGame.bind(this));
    this.gamePlay.addLoadGameListener(this.loadGame.bind(this));
    this.addCellListeners();
    this.startGame();
  }

  addCellListeners() {
    this.gamePlay.addCellEnterListener(this.onCellEnter.bind(this));
    this.gamePlay.addCellLeaveListener(this.onCellLeave.bind(this));
    this.gamePlay.addCellClickListener(this.onCellClick.bind(this));
  }

  startGame() {
    AddFunctions.statsUpdate(this.level, this.points, this.gameState.bestPoints);
    this.userTeam.playerStartTeam();
    this.compTeam.compStartTeam();
    this.setCharactersArr();
    this.gamePlay.redrawPositions(this.characters);
  }

  newGame() {
    this.cleanGameProperty();
    this.gamePlay.drawUi(themes[this.level]);
    this.clearCellListeners();
    this.addCellListeners();
    this.startGame();
  }

  saveGame() {
    this.gameState.saveDataGame(this);
    this.stateService.save(this.gameState);
    GamePlay.showError('The game is saved');
  }

  loadGame() {
    if (this.stateService.storage.length === 0) {
      GamePlay.showError('No saved game');
      return;
    }
    const loadClass = this.stateService.load();
    this.cleanGameProperty();
    this.level = loadClass.gameData.level;
    this.points = loadClass.gameData.points;
    this.gamePlay.drawUi(themes[this.setTheme()]);
    this.userTeam.loadGameTeam(loadClass.gameData.userTeam.characters);
    this.compTeam.loadGameTeam(loadClass.gameData.compTeam.characters);
    const ghostCharacters = [...this.userTeam.characters, ...this.compTeam.characters];

    ghostCharacters.forEach((item, index) => {
      this.characters.push(
        new PositionedCharacter(item, loadClass.gameData.characters[index].position),
      );
    });

    this.clearCellListeners();
    this.addCellListeners();
    this.gamePlay.redrawPositions(this.characters);
    AddFunctions.statsUpdate(this.level, this.points, this.gameState.bestPoints);
    GamePlay.showError('The game is loaded');
  }

  onCellClick(index) {
    // TODO: react to click
    const characterInCell = this.checkCharacterInCell(index); // Ищем персонажа в ячейке

    // Проверяем, есть ли персонаж в ячейке и играбелен ли он
    if (characterInCell && AddFunctions.isPlayableCharacter(characterInCell)) {
      // Снимаем выделение с ранее активного персонажа
      if (this.activeCharacterIndex || this.activeCharacterIndex === 0) {
        this.gamePlay.deselectCell(this.activeCharacterIndex);
      }

      this.gamePlay.selectCell(index);
      this.activeCharacterIndex = index;
      this.activeCharacter = characterInCell;
    }

    // Проверяем, есть ли персонаж в ячейке, если противник и его нельзя атаковать - выдаем ошибку
    if (characterInCell && !AddFunctions.isPlayableCharacter(characterInCell)) {
      // Можно ли атаковать противника
      if (!this.canAttack) {
        // Если выбран активный персонаж, а противника нельзя атаковать, выводим сообщение
        if (this.activeCharacter) {
          GamePlay.showError('The opponent cannot be attacked');
          return;
        }

        GamePlay.showError('This is the opponent\'s character!');
        return;
      }

      if (!this.activeCharacter) return;
      // Атака
      const damage = +(Math.max(
        this.activeCharacter.character.attack - characterInCell.character.defence,
        this.activeCharacter.character.attack * 0.1,
      )).toFixed(1);
      characterInCell.character.health -= damage;
      characterInCell.character.health = +(characterInCell.character.health).toFixed(1);

      this.gamePlay.deselectCell(this.activeCharacterIndex);
      this.gamePlay.deselectCell(index);

      this.activeCharacterIndex = null;
      this.activeCharacter = null;
      this.canAttack = null;
      this.gamePlay.setCursor(cursors.auto);

      (async () => {
        await this.gamePlay.showDamage(index, damage);

        //   Проверка на смерть противника
        if (characterInCell.character.health <= 0) {
          this.death(this.compTeam, characterInCell);
        }

        this.gamePlay.redrawPositions(this.characters);

        // Переход хода
        this.turn = false;

        // Остался кто в команде компа?
        if (this.compTeam.characters.length > 0) {
          this.whoseTurn();
        } else {
          setTimeout(() => {
            this.gameLoop();
          }, 100);
        }
      })();
    }

    // Перемещение
    if (!characterInCell && this.canMove != null) {
      // Убираем выделение предыдущей ячейки
      this.gamePlay.deselectCell(this.activeCharacter.position);
      this.activeCharacter.position = index; // Меняем позицию

      this.canMove = null;
      this.activeCharacterIndex = null;
      this.activeCharacter = null;
      this.gamePlay.deselectCell(index);
      this.gamePlay.setCursor(cursors.auto);

      this.gamePlay.redrawPositions(this.characters);

      // Переход хода
      this.turn = false;
      this.whoseTurn();
    }
  }

  onCellEnter(index) {
    // TODO: react to mouse enter
    const characterInCell = this.checkCharacterInCell(index); // Ищем персонажа в ячейке

    if (characterInCell) {
      // Курсор pointer, если персонаж свой
      if (AddFunctions.isPlayableCharacter(characterInCell)) {
        this.gamePlay.setCursor(cursors.pointer);
      }

      // Показываем информацию о персонаже
      this.gamePlay.showCellTooltip(`\u{1F396} ${characterInCell.character.level} \u{2694} ${characterInCell.character.attack} \u{1F6E1} ${characterInCell.character.defence} \u{2764} ${characterInCell.character.health}`, index);
    }

    // Доступные ячейки для перемещения, если выбран активный персонаж
    if (this.activeCharacter && !characterInCell) {
      const range = distance(this.activeCharacter, this.activeCharacterIndex, 'move');
      range.forEach((item) => {
        if (item === index) {
          this.gamePlay.selectCell(index, 'green');
          this.gamePlay.setCursor(cursors.pointer);
          this.canMove = item;
        }
      });

      if (this.activeCharacter && !this.canMove) {
        this.gamePlay.setCursor(cursors.notallowed);
      }
    }

    // Доступные ячейки для атаки, если выбран активный персонаж + недоступные действия
    if (this.activeCharacter && characterInCell && !AddFunctions.isPlayableCharacter(characterInCell)) {
      const range = distance(this.activeCharacter, this.activeCharacterIndex, 'attack');

      // Выделяем ячейку для атаки
      range.forEach((item) => {
        if (item === index) {
          this.gamePlay.selectCell(index, 'red');
          this.gamePlay.setCursor(cursors.crosshair);
          this.canAttack = true;
        }
      });

      // Недоступные действия, если выходим за рамки области атаки и курсор наведен на противника
      if (!this.canAttack && !AddFunctions.isPlayableCharacter(characterInCell)) {
        this.gamePlay.setCursor(cursors.notallowed);
      }
    }
  }

  onCellLeave(index) {
    // TODO: react to mouse leave
    const characterInCell = this.checkCharacterInCell(index); // Ищем персонажа в ячейке

    this.gamePlay.setCursor(cursors.auto); // Сбрасываем курсор

    // Убираем инфу персонажа
    if (characterInCell) {
      this.gamePlay.hideCellTooltip(index);
    }

    // Убираем подсветку доступного хода
    if (this.activeCharacter && !characterInCell) {
      this.gamePlay.deselectCell(index);
      this.canMove = null;
    }

    // Убираем подсветку доступной атаки
    if (this.activeCharacter && characterInCell && !AddFunctions.isPlayableCharacter(characterInCell)) {
      this.gamePlay.deselectCell(index);
      this.canAttack = null;
    }
  }

  // Ход противника
  turnComp() {
    // Ищем, есть ли кто в зоне поражения. Если нет - идем к противнику
    let activeCompCharacter = null; // Персонаж компа, который будет делать ход
    let willBeAttacked = null; // Персонаж игрока, который будет атакован

    // Перебираем команду компа и выбираем цель для атаки, если такая есть
    this.compTeam.characters.find((compChar) => {
      // Ищем позицию персонажа компа, positionedCharacter на выходе
      const posChar = this.characters.find((char) => char.character === compChar);

      // Вычисляем доступную дистанцию для атаки
      const rangeAttack = distance(posChar, posChar.position, 'attack');

      // Проверяем, есть ли в зоне атаки противник
      rangeAttack.find((itemIndex) => {
        const characterInCell = this.checkCharacterInCell(itemIndex);

        // Если есть и персонаж игрока - цель для атаки выбрана
        if (characterInCell && AddFunctions.isPlayableCharacter(characterInCell)) {
          willBeAttacked = characterInCell;
          return willBeAttacked;
        }
        return false;
      });

      // Если есть цель для атаки - атакуем
      if (willBeAttacked) {
        activeCompCharacter = posChar;

        // Подсвечиваем персонажа, который атакует
        this.gamePlay.selectCell(activeCompCharacter.position);
        // Подсвечиваем персонажа, которого атакуем
        this.gamePlay.selectCell(willBeAttacked.position, 'red');

        const damage = +(Math.max(
          activeCompCharacter.character.attack - willBeAttacked.character.defence,
          activeCompCharacter.character.attack * 0.1,
        )).toFixed(1);
        willBeAttacked.character.health -= damage;
        willBeAttacked.character.health = +(willBeAttacked.character.health).toFixed(1);

        (async () => {
          await this.gamePlay.showDamage(willBeAttacked.position, damage);

          this.gamePlay.deselectCell(activeCompCharacter.position);
          this.gamePlay.deselectCell(willBeAttacked.position);

          // Проверка на смерть противника
          if (willBeAttacked.character.health <= 0) {
            this.death(this.userTeam, willBeAttacked);
          }

          this.gamePlay.redrawPositions(this.characters);
          this.turn = true; // Передача хода

          // Остался кто в команде юзера?
          if (this.userTeam.characters.length === 0) {
            setTimeout(() => {
              GamePlay.showError('Game over!');
              this.clearCellListeners();
            }, 100);
          }
        })();

        return activeCompCharacter;
      }
      return false;
    });

    if (activeCompCharacter) return;

    // Если нет цели для атаки - перемещаемся
    // Команда компа - выбираем самого мощного по атаке
    activeCompCharacter = this.strongCharacter(this.compTeam.characters);

    const rangeMove = distance(activeCompCharacter, activeCompCharacter.position, 'move');

    // Проверяем, нет ли в ячейке другого персонажа, чтобы не занять его место
    rangeMove.forEach((item, index, array) => {
      const filledCell = this.checkCharacterInCell(item);
      if (filledCell) {
        array.splice(index, 1);
      }
    });

    // Ищем ближайшие ячейки рядом с персонажами игрока, с которых можем атаковать
    const rangeAttackUser = new Set();

    this.userTeam.characters.find((userChar) => {
      const posChar = this.characters.find((char) => char.character === userChar);

      // Дистанция атаки активного компа с позиции противника
      const range = distance(activeCompCharacter, posChar.position, 'attack');

      range.forEach((item) => {
        rangeAttackUser.add(item);
      });
      return false;
    });

    // Найти пересечения rangeMove и rangeAttackUser - куда можем ходить
    const cellCanMove = [];

    AddFunctions.compMoveRange(rangeAttackUser, rangeMove, cellCanMove);

    // Если не нашли, куда ходить - расширяем диапазон поисков
    if (cellCanMove.length === 0) {
      rangeAttackUser.forEach((item) => {
        this.userTeam.characters.forEach(() => {
          // Дистанцию атаки активного компа с позиции противника
          const range = distance(activeCompCharacter, item, 'attack');

          range.forEach((itemCell) => {
            rangeAttackUser.add(itemCell);
          });
        });
      });

      AddFunctions.compMoveRange(rangeAttackUser, rangeMove, cellCanMove);
    }

    // Двигаемся к игроку
    [activeCompCharacter.position] = cellCanMove;
    this.gamePlay.redrawPositions(this.characters);
    this.turn = true; // Передача хода
  }

  // Смерть персонажа
  death(team, posCharacter) {
    team.characters.forEach((item, index, array) => {
      if (item === posCharacter.character) {
        array.splice(index, 1);
      }
    });
    this.characters.forEach((item, index, array) => {
      if (item.character === posCharacter.character) {
        array.splice(index, 1);
      }
    });
  }

  gameLoop() {
    this.userTeam.characters.forEach((item) => {
      this.points += item.health;
      this.points = +(this.points).toFixed(1);
      this.gameState.saveBestPoints(this.points);
      this.updateBestPoints();
      AddFunctions.levelUp(item);
    });

    GamePlay.showError(`You win! Points: ${this.points}`);

    this.level += 1;
    this.gamePlay.drawUi(themes[this.setTheme()]);
    this.userTeam.playerUpdateTeam(this.level, this.userTeam.characters.length);
    this.compTeam.compUpdateTeam(this.level, this.userTeam.characters.length);
    this.characters = [];
    this.allowPlayerPositions = [];
    this.allowCompPositions = [];
    this.setCharactersArr();
    this.gamePlay.redrawPositions(this.characters);
    AddFunctions.statsUpdate(this.level, this.points, this.gameState.bestPoints);

    this.whoseTurn();
  }

  clearCellListeners() {
    this.gamePlay.cellEnterListeners = [];
    this.gamePlay.cellLeaveListeners = [];
    this.gamePlay.cellClickListeners = [];
  }

  cleanGameProperty() {
    this.level = 1; // Храним значение текущего уровня игры
    this.turn = true; // true - ходит игрок, false - ходит компьютер
    this.points = 0; // Баллы при выигрыше

    // Каждая команда - экземпляр класса Team. Создаем стартовые команды
    this.userTeam = new Team();
    this.compTeam = new Team();

    this.allowPlayerPositions = []; // Позиции для генерации персонажей игрока
    this.allowCompPositions = []; // Позиции для генерации персонажей противника

    // Массив всех персонажей для хранения состояния позиций (массив из объектов PositionedCharacter)
    this.characters = [];
    this.activeCharacterIndex = null; // Храним индекс активного персонажа
    this.activeCharacter = null; // Храним активного персонажа

    this.canAttack = null; // Можем ли атаковать
    this.canMove = null; // Можем ли переместиться
  }

  // Определяем самого сильного по атаке персонажа противника
  strongCharacter(characters) {
    const arr = characters;

    if (arr.length > 1) {
      arr.sort((a, b) => (a.attack > b.attack ? -1 : 1));
    }

    return this.characters.find((item) => item.character === arr[0]);
  }

  // Поиск персонажа в ячейке
  checkCharacterInCell(index) {
    return this.characters.find((item) => item.position === index);
  }

  // Генерируем позицию персонажа, заполняем массив this.characters (формируем массив из объектов PositionedCharacter)
  generatePositions(team, positions) {
    team.characters.forEach((item) => {
      const randomPosition = AddFunctions.getRandomNumber(positions.length);
      const newPosition = positions[randomPosition];
      positions.splice(randomPosition, 1); // Исключаем дубли при генерации

      this.characters.push(
        new PositionedCharacter(item, newPosition),
      );
    });
  }

  setCharactersArr() {
    // Собираем возможные позиции появления игроков
    this.getPlayerPositions();
    this.getCompPositions();

    // Наполняем массив this.characters всеми персонажами с позициями (формируем массив из объектов PositionedCharacter)
    this.generatePositions(this.userTeam, this.allowPlayerPositions);
    this.generatePositions(this.compTeam, this.allowCompPositions);
  }

  // Список возможных ячеек, в которых может появиться персонаж игрока
  getPlayerPositions() {
    for (let i = 0; i < this.gamePlay.boardSize ** 2;) {
      if (i % 2 === 0) {
        this.allowPlayerPositions.push(i);
        i += 1;
      } else {
        this.allowPlayerPositions.push(i);
        i += 7;
      }
    }
  }

  // Список возможных ячеек, в которых может появиться персонаж компа
  getCompPositions() {
    for (let i = 6; i < this.gamePlay.boardSize ** 2;) {
      if (i % 2 === 0) {
        this.allowCompPositions.push(i);
        i += 1;
      } else {
        this.allowCompPositions.push(i);
        i += 7;
      }
    }
  }

  setTheme() {
    let themeNumber = this.level % 4;
    if (themeNumber === 0) {
      themeNumber = 4;
    }
    return themeNumber;
  }

  updateBestPoints() {
    if (this.stateService.storage.length === 0) {
      return;
    }
    const loadData = this.stateService.load();

    if (this.gameState.bestPoints > loadData.bestPoints) {
      loadData.bestPoints = this.gameState.bestPoints;
      this.stateService.save(loadData);
    }
  }

  // Проверяем, чей ход
  whoseTurn() {
    if (!this.turn) {
      this.turnComp();
    }
  }
}
