import { Game } from "../events/event.lunched.js";

interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  condition: (data: any) => boolean;
}

export class AchievementManager {
  private achievements: Map<string, Achievement> = new Map();

  constructor(private game: Game) {
    this.initListeners();
  }

  public register(achievement: Achievement): void {
    this.achievements.set(achievement.id, achievement);
  }

  private initListeners(): void {
    // On écoute l'événement émis par le jeu
    this.game.on('monsterDefeated', (data) => {
      this.checkAchievements('monsterDefeated', data);
    });
  }

  private checkAchievements(eventKey: string, data: any): void {
    for (const [id, achievement] of this.achievements) {
      if (!achievement.unlocked && achievement.condition(data)) {
        achievement.unlocked = true;
        this.game.emit('achievementUnlocked', achievement);
      }
    }
  }
}