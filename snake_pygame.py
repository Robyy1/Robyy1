import pygame
import random
import sys

# Initialize pygame
pygame.init()

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (255, 0, 0)
GREEN = (0, 255, 0)
DARK_GREEN = (0, 200, 0)
GRAY = (40, 40, 40)

# Game settings
CELL_SIZE = 20
GRID_WIDTH = 30
GRID_HEIGHT = 20
SCREEN_WIDTH = CELL_SIZE * GRID_WIDTH
SCREEN_HEIGHT = CELL_SIZE * GRID_HEIGHT
FPS = 10

# Set up display
screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
pygame.display.set_caption("Snake Game")
clock = pygame.time.Clock()
font = pygame.font.Font(None, 36)
big_font = pygame.font.Font(None, 72)


class Snake:
    def __init__(self):
        self.reset()

    def reset(self):
        self.body = [(10, 10), (9, 10), (8, 10)]
        self.direction = (1, 0)
        self.grow = False

    def move(self):
        head_x, head_y = self.body[0]
        dx, dy = self.direction
        new_head = (head_x + dx, head_y + dy)
        self.body.insert(0, new_head)
        if not self.grow:
            self.body.pop()
        else:
            self.grow = False

    def change_direction(self, new_direction):
        opposite = (-self.direction[0], -self.direction[1])
        if new_direction != opposite:
            self.direction = new_direction

    def check_collision(self):
        head = self.body[0]
        if head[0] < 0 or head[0] >= GRID_WIDTH or head[1] < 0 or head[1] >= GRID_HEIGHT:
            return True
        if head in self.body[1:]:
            return True
        return False


class Food:
    def __init__(self):
        self.position = (0, 0)
        self.spawn()

    def spawn(self, snake_body=None):
        if snake_body is None:
            snake_body = []
        while True:
            pos = (random.randint(0, GRID_WIDTH - 1), random.randint(0, GRID_HEIGHT - 1))
            if pos not in snake_body:
                self.position = pos
                return


def draw_grid():
    for x in range(0, SCREEN_WIDTH, CELL_SIZE):
        pygame.draw.line(screen, (30, 30, 30), (x, 0), (x, SCREEN_HEIGHT))
    for y in range(0, SCREEN_HEIGHT, CELL_SIZE):
        pygame.draw.line(screen, (30, 30, 30), (0, y), (SCREEN_WIDTH, y))


def draw_snake(snake):
    for i, segment in enumerate(snake.body):
        x = segment[0] * CELL_SIZE
        y = segment[1] * CELL_SIZE
        rect = pygame.Rect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
        if i == 0:
            pygame.draw.rect(screen, DARK_GREEN, rect)
            eye_size = 4
            ex = x + CELL_SIZE // 2
            ey = y + CELL_SIZE // 2
            dx, dy = snake.direction
            if dx == 1:
                offsets = [(4, -4), (4, 4)]
            elif dx == -1:
                offsets = [(-4, -4), (-4, 4)]
            elif dy == -1:
                offsets = [(-4, -4), (4, -4)]
            else:
                offsets = [(-4, 4), (4, 4)]
            for ox, oy in offsets:
                pygame.draw.circle(screen, WHITE, (ex + ox, ey + oy), eye_size // 2)
        else:
            pygame.draw.rect(screen, GREEN, rect)


def draw_food(food):
    x = food.position[0] * CELL_SIZE + CELL_SIZE // 2
    y = food.position[1] * CELL_SIZE + CELL_SIZE // 2
    pygame.draw.circle(screen, RED, (x, y), CELL_SIZE // 2 - 2)


def draw_score(score):
    score_text = font.render(f"Score: {score}", True, WHITE)
    screen.blit(score_text, (10, 10))


def draw_game_over(score):
    overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT))
    overlay.set_alpha(180)
    overlay.fill(BLACK)
    screen.blit(overlay, (0, 0))
    game_over_text = big_font.render("GAME OVER", True, RED)
    score_text = font.render(f"Score: {score}", True, WHITE)
    restart_text = font.render("Press SPACE to restart or ESC to quit", True, WHITE)
    screen.blit(game_over_text, (SCREEN_WIDTH // 2 - game_over_text.get_width() // 2, SCREEN_HEIGHT // 2 - 60))
    screen.blit(score_text, (SCREEN_WIDTH // 2 - score_text.get_width() // 2, SCREEN_HEIGHT // 2))
    screen.blit(restart_text, (SCREEN_WIDTH // 2 - restart_text.get_width() // 2, SCREEN_HEIGHT // 2 + 50))


def draw_start_screen():
    screen.fill(BLACK)
    title_text = big_font.render("SNAKE", True, GREEN)
    start_text = font.render("Press SPACE to start", True, WHITE)
    controls_text = font.render("Use Arrow Keys or WASD to move", True, GRAY)
    screen.blit(title_text, (SCREEN_WIDTH // 2 - title_text.get_width() // 2, SCREEN_HEIGHT // 2 - 60))
    screen.blit(start_text, (SCREEN_WIDTH // 2 - start_text.get_width() // 2, SCREEN_HEIGHT // 2 + 10))
    screen.blit(controls_text, (SCREEN_WIDTH // 2 - controls_text.get_width() // 2, SCREEN_HEIGHT // 2 + 60))


def main():
    snake = Snake()
    food = Food()
    food.spawn(snake.body)
    score = 0
    game_state = "start"

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.KEYDOWN:
                if game_state == "start":
                    if event.key == pygame.K_SPACE:
                        game_state = "playing"
                    elif event.key == pygame.K_ESCAPE:
                        pygame.quit()
                        sys.exit()
                elif game_state == "playing":
                    if event.key in (pygame.K_UP, pygame.K_w):
                        snake.change_direction((0, -1))
                    elif event.key in (pygame.K_DOWN, pygame.K_s):
                        snake.change_direction((0, 1))
                    elif event.key in (pygame.K_LEFT, pygame.K_a):
                        snake.change_direction((-1, 0))
                    elif event.key in (pygame.K_RIGHT, pygame.K_d):
                        snake.change_direction((1, 0))
                    elif event.key == pygame.K_ESCAPE:
                        game_state = "gameover"
                elif game_state == "gameover":
                    if event.key == pygame.K_SPACE:
                        snake.reset()
                        food.spawn(snake.body)
                        score = 0
                        game_state = "playing"
                    elif event.key == pygame.K_ESCAPE:
                        pygame.quit()
                        sys.exit()

        if game_state == "playing":
            snake.move()
            if snake.body[0] == food.position:
                snake.grow = True
                score += 10
                food.spawn(snake.body)
            if snake.check_collision():
                game_state = "gameover"

        screen.fill(BLACK)
        draw_grid()

        if game_state == "start":
            draw_start_screen()
        elif game_state == "playing":
            draw_food(food)
            draw_snake(snake)
            draw_score(score)
        elif game_state == "gameover":
            draw_food(food)
            draw_snake(snake)
            draw_score(score)
            draw_game_over(score)

        pygame.display.flip()
        clock.tick(FPS)


if __name__ == "__main__":
    main()
