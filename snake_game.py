import pygame
import sys
import random
import math

# Initialize pygame
pygame.init()

# Screen dimensions
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Snake Game")

# Colors
BACKGROUND = (15, 20, 25)
SNAKE_HEAD = (50, 205, 50)
SNAKE_BODY = (34, 139, 34)
FOOD_COLOR = (220, 20, 60)
TEXT_COLOR = (220, 220, 220)
GRID_COLOR = (30, 35, 40)
BUTTON_COLOR = (70, 130, 180)
BUTTON_HOVER = (100, 149, 237)

# Game variables
cell_size = 20
grid_width = WIDTH // cell_size
grid_height = HEIGHT // cell_size
snake_speed = 10

# Font
font = pygame.font.SysFont(None, 36)
big_font = pygame.font.SysFont(None, 72)

class Snake:
    def __init__(self):
        self.reset()
        
    def reset(self):
        self.length = 3
        self.positions = [(grid_width // 2, grid_height // 2)]
        self.direction = random.choice([(0, 1), (0, -1), (1, 0), (-1, 0)])
        self.score = 0
        self.grow_pending = 2  # Start with 3 segments
        
    def get_head_position(self):
        return self.positions[0]
    
    def update(self):
        head = self.get_head_position()
        x, y = self.direction
        new_position = (((head[0] + x) % grid_width), ((head[1] + y) % grid_height))
        
        # Check for collision with self
        if new_position in self.positions[1:]:
            return False  # Game over
            
        self.positions.insert(0, new_position)
        
        if self.grow_pending > 0:
            self.grow_pending -= 1
        else:
            self.positions.pop()
            
        return True  # Game continues
    
    def grow(self):
        self.grow_pending += 1
        self.score += 10
    
    def render(self, surface):
        for i, pos in enumerate(self.positions):
            # Draw snake segment
            rect = pygame.Rect(pos[0] * cell_size, pos[1] * cell_size, cell_size, cell_size)
            
            # Head is a different color
            if i == 0:
                pygame.draw.rect(surface, SNAKE_HEAD, rect)
                pygame.draw.rect(surface, (30, 100, 30), rect, 1)
                
                # Draw eyes
                eye_size = cell_size // 5
                # Determine eye positions based on direction
                dx, dy = self.direction
                if dx == 1:  # Right
                    left_eye = (pos[0] * cell_size + cell_size - eye_size - 2, pos[1] * cell_size + 5)
                    right_eye = (pos[0] * cell_size + cell_size - eye_size - 2, pos[1] * cell_size + cell_size - 5 - eye_size)
                elif dx == -1:  # Left
                    left_eye = (pos[0] * cell_size + 2, pos[1] * cell_size + 5)
                    right_eye = (pos[0] * cell_size + 2, pos[1] * cell_size + cell_size - 5 - eye_size)
                elif dy == 1:  # Down
                    left_eye = (pos[0] * cell_size + 5, pos[1] * cell_size + cell_size - eye_size - 2)
                    right_eye = (pos[0] * cell_size + cell_size - 5 - eye_size, pos[1] * cell_size + cell_size - eye_size - 2)
                else:  # Up
                    left_eye = (pos[0] * cell_size + 5, pos[1] * cell_size + 2)
                    right_eye = (pos[0] * cell_size + cell_size - 5 - eye_size, pos[1] * cell_size + 2)
                
                pygame.draw.rect(surface, (0, 0, 0), pygame.Rect(left_eye[0], left_eye[1], eye_size, eye_size))
                pygame.draw.rect(surface, (0, 0, 0), pygame.Rect(right_eye[0], right_eye[1], eye_size, eye_size))
            else:
                pygame.draw.rect(surface, SNAKE_BODY, rect)
                pygame.draw.rect(surface, (20, 80, 20), rect, 1)

class Food:
    def __init__(self):
        self.position = (0, 0)
        self.randomize_position()
        
    def randomize_position(self):
        self.position = (random.randint(0, grid_width - 1), random.randint(0, grid_height - 1))
    
    def render(self, surface):
        rect = pygame.Rect(self.position[0] * cell_size, self.position[1] * cell_size, cell_size, cell_size)
        pygame.draw.rect(surface, FOOD_COLOR, rect)
        pygame.draw.rect(surface, (180, 0, 0), rect, 2)
        
        # Draw a shine effect
        shine_rect = pygame.Rect(
            self.position[0] * cell_size + cell_size // 4,
            self.position[1] * cell_size + cell_size // 4,
            cell_size // 4,
            cell_size // 4
        )
        pygame.draw.ellipse(surface, (255, 200, 200), shine_rect)

def draw_grid(surface):
    for y in range(0, HEIGHT, cell_size):
        for x in range(0, WIDTH, cell_size):
            rect = pygame.Rect(x, y, cell_size, cell_size)
            pygame.draw.rect(surface, GRID_COLOR, rect, 1)

def draw_score(surface, score, game_over=False):
    score_text = font.render(f"Score: {score}", True, TEXT_COLOR)
    surface.blit(score_text, (10, 10))
    
    if game_over:
        game_over_text = big_font.render("GAME OVER", True, (220, 20, 60))
        restart_text = font.render("Press SPACE to restart", True, TEXT_COLOR)
        surface.blit(game_over_text, (WIDTH // 2 - game_over_text.get_width() // 2, HEIGHT // 2 - 50))
        surface.blit(restart_text, (WIDTH // 2 - restart_text.get_width() // 2, HEIGHT // 2 + 20))

def draw_button(surface, text, x, y, width, height, hover=False):
    color = BUTTON_HOVER if hover else BUTTON_COLOR
    pygame.draw.rect(surface, color, (x, y, width, height), border_radius=10)
    pygame.draw.rect(surface, (200, 200, 200), (x, y, width, height), 2, border_radius=10)
    
    text_surf = font.render(text, True, TEXT_COLOR)
    text_rect = text_surf.get_rect(center=(x + width // 2, y + height // 2))
    surface.blit(text_surf, text_rect)

def main():
    snake = Snake()
    food = Food()
    clock = pygame.time.Clock()
    game_over = False
    last_move_time = 0
    move_delay = 100  # milliseconds
    
    while True:
        current_time = pygame.time.get_ticks()
        
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
                
            if event.type == pygame.KEYDOWN:
                if game_over and event.key == pygame.K_SPACE:
                    snake.reset()
                    food.randomize_position()
                    game_over = False
                elif not game_over:
                    if event.key == pygame.K_UP and snake.direction != (0, 1):
                        snake.direction = (0, -1)
                    elif event.key == pygame.K_DOWN and snake.direction != (0, -1):
                        snake.direction = (0, 1)
                    elif event.key == pygame.K_LEFT and snake.direction != (1, 0):
                        snake.direction = (-1, 0)
                    elif event.key == pygame.K_RIGHT and snake.direction != (-1, 0):
                        snake.direction = (1, 0)
        
        if not game_over and current_time - last_move_time > move_delay:
            last_move_time = current_time
            if not snake.update():
                game_over = True
            if snake.get_head_position() == food.position:
                snake.grow()
                food.randomize_position()
                while food.position in snake.positions:
                    food.randomize_position()
        
        # Drawing
        screen.fill(BACKGROUND)
        draw_grid(screen)
        snake.render(screen)
        food.render(screen)
        draw_score(screen, snake.score, game_over)
        
        if game_over:
            overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            overlay.fill((0, 0, 0, 180))
            screen.blit(overlay, (0, 0))
            
            button_width, button_height = 200, 50
            button_x = WIDTH // 2 - button_width // 2
            button_y = HEIGHT // 2 + 80
            
            # Button hover logic
            mouse_x, mouse_y = pygame.mouse.get_pos()
            is_hover = button_x <= mouse_x <= button_x + button_width and button_y <= mouse_y <= button_y + button_height
            
            draw_button(screen, "RESTART", button_x, button_y, button_width, button_height, hover=is_hover)
            
            if is_hover and pygame.mouse.get_pressed()[0]:
                snake.reset()
                food.randomize_position()
                game_over = False
        
        pygame.display.flip()
        clock.tick(60)

if __name__ == "__main__":
    main()