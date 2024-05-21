export default class AddFunctions {
  static compMoveRange(rangeAttackUser, rangeMove, cellCanMove) {
    rangeAttackUser.forEach((itemAttack) => {
      rangeMove.forEach((itemMove) => {
        if (itemMove === itemAttack) {
          cellCanMove.push(itemMove);
        }
      });
    });
  }

  static getRandomNumber(num) {
    return Math.floor(Math.random() * num);
  }

  static isPlayableCharacter(char) {
    if (char.character.type === 'bowman' || char.character.type === 'magician' || char.character.type === 'swordsman') {
      return true;
    }
    return false;
  }

  static levelUp(char) {
    const character = char;
    character.level += 1;

    AddFunctions.levelUpAttackDefence(character);

    character.health += 80;
    if (character.health > 100) {
      character.health = 100;
    }

    Math.round(character.health);

    return character;
  }

  static levelUpAttackDefence(char) {
    const character = char;
    character.attack = Math.round(Math.max(
      character.attack,
      (character.attack * (80 + character.health)) / 100,
    ));
    character.defence = Math.round(Math.max(
      character.defence,
      (character.defence * (80 + character.health)) / 100,
    ));
    return character;
  }

  static statsUpdate(level, points, bestPoints) {
    const statsLevel = document.querySelector('.level');
    const statsPoints = document.querySelector('.points');
    const statsBestPoints = document.querySelector('.best-points');

    statsLevel.innerText = level;
    statsPoints.innerText = points;
    statsBestPoints.innerText = bestPoints;
  }
}
