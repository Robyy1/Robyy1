import pygame
import sys
import random
import time
import numpy as np
import pickle
import os

# Initialize pygame
pygame.init()

# Constants
WIDTH, HEIGHT = 800, 600
GRID_SIZE = 30
GRID_WIDTH = WIDTH // GRID_SIZE
GRID_HEIGHT = HEIGHT // GRID_SIZE
FPS = 10

# Colors
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
GREEN = (0, 255, 0)
RED = (255, 0, 0)
BLUE = (0, 0, 255)
GRAY = (100, 100, 100)
GOLD = (255, 215, 0)

# Set up display
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Snake Game")

# Clock
clock = pygame.time.Clock()

# Fonts
font = pygame.font.Font(None, 36)
small_font = pygame.font.Font(None, 24)

class Snake:
    def __init__(self):
        self.reset()
    
    def reset(self):
        self.length = 1
        self.positions = [((WIDTH // 2), (HEIGHT // 2))]
        self.direction = random.choice([pygame.K_UP, pygame.K_DOWN, pygame.K_LEFT, pygame.K_RIGHT])
        self.score = 0
        self.upgrades = {
            'auto_turn': False,
            'vision': False,
            'speed_boost': False
        }
        self.speed_multiplier = 1.0
    
    def get_head_position(self):
        return self.positions[0]
    
    def update(self):
        head = self.get_head_position()
        x, y = head
        
        if self.direction == pygame.K_UP:
            y -= GRID_SIZE
        elif self.direction == pygame.K_DOWN:
            y += GRID_SIZE
        elif self.direction == pygame.K_LEFT:
            x -= GRID_SIZE
        elif self.direction == pygame.K_RIGHT:
            x += GRID_SIZE
        
        # Wrap around screen
        if x < 0: x = WIDTH - GRID_SIZE
        if x >= WIDTH: x = 0
        if y < 0: y = HEIGHT - GRID_SIZE
        if y >= HEIGHT: y = 0
        
        new_head = (x, y)
        
        # Check self collision
        if new_head in self.positions[1:]:
            return False
        
        self.positions.insert(0, new_head)
        if len(self.positions) > self.length:
            self.positions.pop()
        
        return True
    
    def change_direction(self, direction):
        # Prevent 180-degree turns
        if (direction == pygame.K_UP and self.direction != pygame.K_DOWN) or \
           (direction == pygame.K_DOWN and self.direction != pygame.K_UP) or \
           (direction == pygame.K_LEFT and self.direction != pygame.K_RIGHT) or \
           (direction == pygame.K_RIGHT and self.direction != pygame.K_LEFT):
            self.direction = direction
    
    def draw(self, surface):
        for p in self.positions:
            pygame.draw.rect(surface, GREEN, pygame.Rect(p[0], p[1], GRID_SIZE, GRID_SIZE))
            pygame.draw.rect(surface, WHITE, pygame.Rect(p[0], p[1], GRID_SIZE, GRID_SIZE), 1)

class Food:
    def __init__(self):
        self.position = (0, 0)
        self.color = RED
        self.randomize_position()
    
    def randomize_position(self, snake_positions=None, walls=None):
        if snake_positions is None:
            snake_positions = []
        if walls is None:
            walls = []
        
        self.position = (random.randint(0, GRID_WIDTH - 1) * GRID_SIZE,
                        random.randint(0, GRID_HEIGHT - 1) * GRID_SIZE)
        
        # Ensure food doesn't spawn on snake or walls
        while (self.position in snake_positions or 
               any(wall.rect.collidepoint(self.position) for wall in walls)):
            self.position = (random.randint(0, GRID_WIDTH - 1) * GRID_SIZE,
                           random.randint(0, GRID_HEIGHT - 1) * GRID_SIZE)
    
    def draw(self, surface):
        pygame.draw.rect(surface, self.color, pygame.Rect(self.position[0], self.position[1], GRID_SIZE, GRID_SIZE))
        pygame.draw.rect(surface, WHITE, pygame.Rect(self.position[0], self.position[1], GRID_SIZE, GRID_SIZE), 2)

class Wall:
    def __init__(self, x, y, width, height):
        self.rect = pygame.Rect(x, y, width, height)
    
    def draw(self, surface):
        pygame.draw.rect(surface, GRAY, self.rect)
        pygame.draw.rect(surface, WHITE, self.rect, 2)

class QLearningAgent:
    def __init__(self):
        self.q_table = {}
        self.learning_rate = 0.1
        self.discount_factor = 0.95
        self.epsilon = 1.0
        self.epsilon_decay = 0.995
        self.epsilon_min = 0.01
        self.load_model()
    
    def get_state(self, snake_head, food_pos, snake_body, walls):
        # Calculate relative position of food
        dx = (food_pos[0] - snake_head[0]) // GRID_SIZE
        dy = (food_pos[1] - snake_head[1]) // GRID_SIZE
        
        # Check danger in each direction
        danger_straight = self.is_danger(snake_head, snake_body, walls, None)
        danger_right = self.is_danger(snake_head, snake_body, walls, 'right')
        danger_left = self.is_danger(snake_head, snake_body, walls, 'left')
        
        # Normalize state
        state = (
            (dx > 0) - (dx < 0),  # food is right/left
            (dy > 0) - (dy < 0),  # food is down/up
            danger_straight,
            danger_right,
            danger_left
        )
        return state
    
    def is_danger(self, snake_head, snake_body, walls, direction=None):
        x, y = snake_head
        
        if direction == 'right':
            x += GRID_SIZE
        elif direction == 'left':
            x -= GRID_SIZE
        elif direction == 'up':
            y -= GRID_SIZE
        elif direction == 'down':
            y += GRID_SIZE
        
        # Check wall collision
        if x < 0 or x >= WIDTH or y < 0 or y >= HEIGHT:
            return 1
        
        # Check self collision
        if (x, y) in snake_body[1:]:
            return 1
        
        # Check wall obstacles
        head_rect = pygame.Rect(x, y, GRID_SIZE, GRID_SIZE)
        for wall in walls:
            if head_rect.colliderect(wall.rect):
                return 1
        
        return 0
    
    def get_action(self, state):
        if random.random() < self.epsilon:
            return random.choice([0, 1, 2])  # straight, right, left
        
        if state not in self.q_table:
            self.q_table[state] = [0, 0, 0]
        
        return np.argmax(self.q_table[state])
    
    def update_q_value(self, state, action, reward, next_state):
        if state not in self.q_table:
            self.q_table[state] = [0, 0, 0]
        if next_state not in self.q_table:
            self.q_table[next_state] = [0, 0, 0]
        
        current_q = self.q_table[state][action]
        max_next_q = max(self.q_table[next_state])
        
        new_q = current_q + self.learning_rate * (reward + self.discount_factor * max_next_q - current_q)
        self.q_table[state][action] = new_q
    
    def get_direction_from_action(self, current_direction, action):
        # 0: straight, 1: right, 2: left
        directions = [pygame.K_UP, pygame.K_RIGHT, pygame.K_DOWN, pygame.K_LEFT]
        current_idx = directions.index(current_direction)
        
        if action == 0:  # straight
            return current_direction
        elif action == 1:  # right
            return directions[(current_idx + 1) % 4]
        else:  # left
            return directions[(current_idx - 1) % 4]
    
    def decay_epsilon(self):
        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay
    
    def save_model(self):
        with open('snake_q_table.pkl', 'wb') as f:
            pickle.dump(self.q_table, f)
    
    def load_model(self):
        try:
            with open('snake_q_table.pkl', 'rb') as f:
                self.q_table = pickle.load(f)
        except FileNotFoundError:
            self.q_table = {}

class AIGame:
    def __init__(self):
        self.snake = Snake()
        self.food = Food()
        self.walls = []
        self.agent = QLearningAgent()
        self.running = True
        self.score = 0
        self.high_score = 0
        self.games_played = 0
    
    def reset_game(self):
        self.snake.reset()
        self.food.randomize_position()
        self.walls = []
        self.score = 0
    
    def generate_maze_walls(self):
        self.walls = []
        # Create border walls
        for x in range(0, WIDTH, GRID_SIZE):
            self.walls.append(Wall(x, 0, GRID_SIZE, GRID_SIZE))
            self.walls.append(Wall(x, HEIGHT - GRID_SIZE, GRID_SIZE, GRID_SIZE))
        for y in range(0, HEIGHT, GRID_SIZE):
            self.walls.append(Wall(0, y, GRID_SIZE, GRID_SIZE))
            self.walls.append(Wall(WIDTH - GRID_SIZE, y, GRID_SIZE, GRID_SIZE))
        
        # Add some internal walls
        for _ in range(10):
            x = random.randrange(GRID_SIZE, WIDTH - GRID_SIZE, GRID_SIZE)
            y = random.randrange(GRID_SIZE, HEIGHT - GRID_SIZE, GRID_SIZE)
            self.walls.append(Wall(x, y, GRID_SIZE * 3, GRID_SIZE))
    
    def run_training(self):
        episodes = 1000
        max_steps = 1000
        
        for episode in range(episodes):
            self.reset_game()
            self.generate_maze_walls()
            state = self.agent.get_state(self.snake.get_head_position(), self.food.position, self.snake.positions, self.walls)
            
            for step in range(max_steps):
                action = self.agent.get_action(state)
                direction = self.agent.get_direction_from_action(self.snake.direction, action)
                self.snake.change_direction(direction)
                
                # Update snake
                if not self.snake.update():
                    reward = -10
                    next_state = None
                    self.agent.update_q_value(state, action, reward, next_state)
                    break
                
                # Check food collision
                if self.snake.get_head_position() == self.food.position:
                    self.snake.length += 1
                    self.score += 1
                    reward = 10
                    self.food.randomize_position(self.snake.positions, self.walls)
                else:
                    reward = -0.1  # Small negative reward for each step
                
                # Check wall collision
                head_rect = pygame.Rect(self.snake.get_head_position()[0], self.snake.get_head_position()[1], GRID_SIZE, GRID_SIZE)
                wall_collision = False
                for wall in self.walls:
                    if head_rect.colliderect(wall.rect):
                        wall_collision = True
                        break
                
                if wall_collision:
                    reward = -10
                    next_state = None
                    self.agent.update_q_value(state, action, reward, next_state)
                    break
                
                next_state = self.agent.get_state(self.snake.get_head_position(), self.food.position, self.snake.positions, self.walls)
                self.agent.update_q_value(state, action, reward, next_state)
                state = next_state
            
            self.agent.decay_epsilon()
            self.games_played += 1
            self.high_score = max(self.high_score, self.score)
            
            if episode % 100 == 0:
                print(f"Episode: {episode}, Epsilon: {self.agent.epsilon:.3f}, High Score: {self.high_score}")
                self.agent.save_model()
    
    def run_demo(self):
        self.reset_game()
        self.generate_maze_walls()
        
        while self.running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                    return
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        return
            
            # AI decision making
            state = self.agent.get_state(self.snake.get_head_position(), self.food.position, self.snake.positions, self.walls)
            action = self.agent.get_action(state)
            direction = self.agent.get_direction_from_action(self.snake.direction, action)
            self.snake.change_direction(direction)
            
            # Update snake
            if not self.snake.update():
                self.reset_game()
                self.generate_maze_walls()
                continue
            
            # Check food collision
            if self.snake.get_head_position() == self.food.position:
                self.snake.length += 1
                self.score += 1
                self.food.randomize_position(self.snake.positions, self.walls)
            
            # Check wall collision
            head_rect = pygame.Rect(self.snake.get_head_position()[0], self.snake.get_head_position()[1], GRID_SIZE, GRID_SIZE)
            for wall in self.walls:
                if head_rect.colliderect(wall.rect):
                    self.reset_game()
                    self.generate_maze_walls()
                    break
            
            # Draw everything
            screen.fill(BLACK)
            
            # Draw grid
            for x in range(0, WIDTH, GRID_SIZE):
                pygame.draw.line(screen, (30, 30, 30), (x, 0), (x, HEIGHT))
            for y in range(0, HEIGHT, GRID_SIZE):
                pygame.draw.line(screen, (30, 30, 30), (0, y), (WIDTH, y))
            
            # Draw walls
            for wall in self.walls:
                wall.draw(screen)
            
            # Draw food
            self.food.draw(screen)
            
            # Draw snake
            self.snake.draw(screen)
            
            # Draw UI
            score_text = font.render(f"Score: {self.score}", True, WHITE)
            high_score_text = font.render(f"High Score: {self.high_score}", True, WHITE)
            games_text = font.render(f"Games Played: {self.games_played}", True, WHITE)
            ai_text = font.render("AI Training Mode", True, BLUE)
            
            screen.blit(score_text, (10, 10))
            screen.blit(high_score_text, (10, 50))
            screen.blit(games_text, (10, 90))
            screen.blit(ai_text, (WIDTH//2 - ai_text.get_width()//2, 10))
            
            pygame.display.flip()
            clock.tick(10)
        
        pygame.quit()
        sys.exit()

class Game:
    def __init__(self):
        self.snake = Snake()
        self.food = Food()
        self.walls = []
        self.game_mode = None
        self.running = True
        self.score = 0
        self.coins = 9999
        self.menu_state = "main"  # main, play, shop, options
    
    def reset_game(self):
        self.snake.reset()
        self.food.randomize_position()
        self.walls = []
        self.score = 0
    
    def generate_maze_walls(self):
        self.walls = []
        # Create border walls
        for x in range(0, WIDTH, GRID_SIZE):
            self.walls.append(Wall(x, 0, GRID_SIZE, GRID_SIZE))
            self.walls.append(Wall(x, HEIGHT - GRID_SIZE, GRID_SIZE, GRID_SIZE))
        for y in range(0, HEIGHT, GRID_SIZE):
            self.walls.append(Wall(0, y, GRID_SIZE, GRID_SIZE))
            self.walls.append(Wall(WIDTH - GRID_SIZE, y, GRID_SIZE, GRID_SIZE))
        
        # Add some internal walls
        for _ in range(10):
            x = random.randrange(GRID_SIZE, WIDTH - GRID_SIZE, GRID_SIZE)
            y = random.randrange(GRID_SIZE, HEIGHT - GRID_SIZE, GRID_SIZE)
            self.walls.append(Wall(x, y, GRID_SIZE * 3, GRID_SIZE))
    
    def draw_menu(self):
        screen.fill(BLACK)
        
        if self.menu_state == "main":
            title = font.render("SNAKE GAME", True, WHITE)
            screen.blit(title, (WIDTH//2 - title.get_width()//2, 100))
            
            # Menu options
            play_btn = pygame.Rect(WIDTH//2 - 100, 200, 200, 50)
            shop_btn = pygame.Rect(WIDTH//2 - 100, 270, 200, 50)
            options_btn = pygame.Rect(WIDTH//2 - 100, 340, 200, 50)
            exit_btn = pygame.Rect(WIDTH//2 - 100, 410, 200, 50)
            
            pygame.draw.rect(screen, BLUE, play_btn)
            pygame.draw.rect(screen, GREEN, shop_btn)
            pygame.draw.rect(screen, GRAY, options_btn)
            pygame.draw.rect(screen, RED, exit_btn)
            
            play_text = font.render("Play", True, WHITE)
            shop_text = font.render("Shop", True, WHITE)
            options_text = font.render("Options", True, WHITE)
            exit_text = font.render("Exit", True, WHITE)
            
            screen.blit(play_text, (play_btn.centerx - play_text.get_width()//2, play_btn.centery - play_text.get_height()//2))
            screen.blit(shop_text, (shop_btn.centerx - shop_text.get_width()//2, shop_btn.centery - shop_text.get_height()//2))
            screen.blit(options_text, (options_btn.centerx - options_text.get_width()//2, options_btn.centery - options_text.get_height()//2))
            screen.blit(exit_text, (exit_btn.centerx - exit_text.get_width()//2, exit_btn.centery - exit_text.get_height()//2))
            
            # Draw coins
            coins_text = small_font.render(f"Coins: {self.coins}", True, GOLD)
            screen.blit(coins_text, (10, 10))
            
            return play_btn, shop_btn, options_btn, exit_btn
        
        elif self.menu_state == "play":
            title = font.render("SELECT GAME MODE", True, WHITE)
            screen.blit(title, (WIDTH//2 - title.get_width()//2, 100))
            
            campaign_btn = pygame.Rect(WIDTH//2 - 150, 200, 300, 50)
            endless_btn = pygame.Rect(WIDTH//2 - 150, 270, 300, 50)
            maze_btn = pygame.Rect(WIDTH//2 - 150, 340, 300, 50)
            back_btn = pygame.Rect(WIDTH//2 - 100, 450, 200, 50)
            
            pygame.draw.rect(screen, BLUE, campaign_btn)
            pygame.draw.rect(screen, GREEN, endless_btn)
            pygame.draw.rect(screen, GRAY, maze_btn)
            pygame.draw.rect(screen, WHITE, back_btn)
            
            campaign_text = font.render("Campaign", True, WHITE)
            endless_text = font.render("Endless", True, WHITE)
            maze_text = font.render("Maze", True, WHITE)
            back_text = font.render("Back", True, BLACK)
            
            screen.blit(campaign_text, (campaign_btn.centerx - campaign_text.get_width()//2, campaign_btn.centery - campaign_text.get_height()//2))
            screen.blit(endless_text, (endless_btn.centerx - endless_text.get_width()//2, endless_btn.centery - endless_text.get_height()//2))
            screen.blit(maze_text, (maze_btn.centerx - maze_text.get_width()//2, maze_btn.centery - maze_text.get_height()//2))
            screen.blit(back_text, (back_btn.centerx - back_text.get_width()//2, back_btn.centery - back_text.get_height()//2))
            
            return campaign_btn, endless_btn, maze_btn, back_btn
        
        elif self.menu_state == "shop":
            title = font.render("SHOP", True, WHITE)
            screen.blit(title, (WIDTH//2 - title.get_width()//2, 50))
            
            # Draw upgrades
            upgrades = [
                ("Auto Turn", 100, self.snake.upgrades['auto_turn']),
                ("Vision", 150, self.snake.upgrades['vision']),
                ("Speed Boost", 200, self.snake.upgrades['speed_boost'])
            ]
            
            buttons = []
            for i, (name, cost, owned) in enumerate(upgrades):
                btn = pygame.Rect(WIDTH//2 - 150, 150 + i * 100, 300, 80)
                color = GREEN if owned else BLUE
                pygame.draw.rect(screen, color, btn)
                pygame.draw.rect(screen, WHITE, btn, 2)
                
                name_text = font.render(name, True, WHITE)
                cost_text = small_font.render(f"Cost: {cost} coins", True, WHITE)
                status = "Owned" if owned else "Buy"
                status_text = small_font.render(status, True, WHITE)
                
                screen.blit(name_text, (btn.x + 10, btn.y + 10))
                screen.blit(cost_text, (btn.x + 10, btn.y + 40))
                screen.blit(status_text, (btn.x + btn.width - 80, btn.y + 10))
                
                buttons.append(btn)
            
            back_btn = pygame.Rect(WIDTH//2 - 100, 500, 200, 50)
            pygame.draw.rect(screen, WHITE, back_btn)
            back_text = font.render("Back", True, BLACK)
            screen.blit(back_text, (back_btn.centerx - back_text.get_width()//2, back_btn.centery - back_text.get_height()//2))
            
            buttons.append(back_btn)
            return buttons
        
        elif self.menu_state == "options":
            title = font.render("OPTIONS", True, WHITE)
            screen.blit(title, (WIDTH//2 - title.get_width()//2, 100))
            
            # Dummy options
            master_vol = pygame.Rect(WIDTH//2 - 150, 200, 300, 50)
            music_vol = pygame.Rect(WIDTH//2 - 150, 270, 300, 50)
            sfx_vol = pygame.Rect(WIDTH//2 - 150, 340, 300, 50)
            ai_btn = pygame.Rect(WIDTH//2 - 150, 410, 300, 50)
            back_btn = pygame.Rect(WIDTH//2 - 100, 500, 200, 50)
            
            pygame.draw.rect(screen, GRAY, master_vol)
            pygame.draw.rect(screen, GRAY, music_vol)
            pygame.draw.rect(screen, GRAY, sfx_vol)
            pygame.draw.rect(screen, BLUE, ai_btn)
            pygame.draw.rect(screen, WHITE, back_btn)
            
            master_text = font.render("Master Volume", True, WHITE)
            music_text = font.render("Music Volume", True, WHITE)
            sfx_text = font.render("SFX Volume", True, WHITE)
            ai_text = font.render("AI Training", True, WHITE)
            back_text = font.render("Back", True, BLACK)
            
            screen.blit(master_text, (master_vol.centerx - master_text.get_width()//2, master_vol.centery - master_text.get_height()//2))
            screen.blit(music_text, (music_vol.centerx - music_text.get_width()//2, music_vol.centery - music_text.get_height()//2))
            screen.blit(sfx_text, (sfx_vol.centerx - sfx_text.get_width()//2, sfx_vol.centery - sfx_text.get_height()//2))
            screen.blit(ai_text, (ai_btn.centerx - ai_text.get_width()//2, ai_btn.centery - ai_text.get_height()//2))
            screen.blit(back_text, (back_btn.centerx - back_text.get_width()//2, back_btn.centery - back_text.get_height()//2))
            
            return master_vol, music_vol, sfx_vol, ai_btn, back_btn
    
    def run(self):
        while self.running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                
                if event.type == pygame.MOUSEBUTTONDOWN:
                    if self.menu_state == "main":
                        play_btn, shop_btn, options_btn, exit_btn = self.draw_menu()
                        if play_btn.collidepoint(event.pos):
                            self.menu_state = "play"
                        elif shop_btn.collidepoint(event.pos):
                            self.menu_state = "shop"
                        elif options_btn.collidepoint(event.pos):
                            self.menu_state = "options"
                        elif exit_btn.collidepoint(event.pos):
                            self.running = False
                    
                    elif self.menu_state == "play":
                        campaign_btn, endless_btn, maze_btn, back_btn = self.draw_menu()
                        if campaign_btn.collidepoint(event.pos):
                            self.game_mode = "campaign"
                            self.reset_game()
                            self.game_loop()
                        elif endless_btn.collidepoint(event.pos):
                            self.game_mode = "endless"
                            self.reset_game()
                            self.game_loop()
                        elif maze_btn.collidepoint(event.pos):
                            self.game_mode = "maze"
                            self.reset_game()
                            self.generate_maze_walls()
                            self.game_loop()
                        elif back_btn.collidepoint(event.pos):
                            self.menu_state = "main"
                    
                    elif self.menu_state == "shop":
                        buttons = self.draw_menu()
                        if len(buttons) > 1:  # Check if back button exists
                            if buttons[-1].collidepoint(event.pos):
                                self.menu_state = "main"
                            else:
                                # Handle upgrade purchases
                                upgrades = [
                                    ("auto_turn", 100),
                                    ("vision", 150),
                                    ("speed_boost", 200)
                                ]
                                for i, (upgrade_key, cost) in enumerate(upgrades):
                                    if buttons[i].collidepoint(event.pos) and not self.snake.upgrades[upgrade_key] and self.coins >= cost:
                                        self.snake.upgrades[upgrade_key] = True
                                        self.coins -= cost
                                        if upgrade_key == "speed_boost":
                                            self.snake.speed_multiplier = 1.5
                    
                    elif self.menu_state == "options":
                        master_vol, music_vol, sfx_vol, ai_btn, back_btn = self.draw_menu()
                        if ai_btn.collidepoint(event.pos):
                            ai_game = AIGame()
                            ai_game.run_demo()
                        elif back_btn.collidepoint(event.pos):
                            self.menu_state = "main"
                
                if event.type == pygame.KEYDOWN:
                    if self.menu_state != "main":
                        if event.key == pygame.K_ESCAPE:
                            self.menu_state = "main"
            
            if self.menu_state == "main":
                self.draw_menu()
            else:
                self.draw_menu()
            
            pygame.display.flip()
            clock.tick(30)
        
        pygame.quit()
        sys.exit()
    
    def game_loop(self):
        running = True
        food_spawned = False
        
        while running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                    self.running = False
                
                if event.type == pygame.KEYDOWN:
                    if event.key in [pygame.K_UP, pygame.K_DOWN, pygame.K_LEFT, pygame.K_RIGHT]:
                        self.snake.change_direction(event.key)
                    elif event.key == pygame.K_ESCAPE:
                        running = False
            
            # Auto-turn upgrade logic
            if self.snake.upgrades['auto_turn']:
                head = self.snake.get_head_position()
                food_pos = self.food.position
                
                # Simple AI to follow food
                if head[0] < food_pos[0]:
                    self.snake.change_direction(pygame.K_RIGHT)
                elif head[0] > food_pos[0]:
                    self.snake.change_direction(pygame.K_LEFT)
                elif head[1] < food_pos[1]:
                    self.snake.change_direction(pygame.K_DOWN)
                elif head[1] > food_pos[1]:
                    self.snake.change_direction(pygame.K_UP)
            
            # Update snake
            if not self.snake.update():
                # Game over
                self.coins += self.score
                running = False
                self.menu_state = "main"
                continue
            
            # Check food collision
            if self.snake.get_head_position() == self.food.position:
                self.snake.length += 1
                self.snake.score += 1
                self.score += 1
                food_spawned = False
            
            # Check wall collision (for maze mode)
            if self.game_mode == "maze":
                head_rect = pygame.Rect(self.snake.get_head_position()[0], self.snake.get_head_position()[1], GRID_SIZE, GRID_SIZE)
                for wall in self.walls:
                    if head_rect.colliderect(wall.rect):
                        self.coins += self.score
                        running = False
                        self.menu_state = "main"
                        break
            
            # Spawn food if needed
            if not food_spawned:
                self.food.randomize_position(self.snake.positions, self.walls)
                food_spawned = True
            
            # Draw everything
            screen.fill(BLACK)
            
            # Draw grid
            for x in range(0, WIDTH, GRID_SIZE):
                pygame.draw.line(screen, (30, 30, 30), (x, 0), (x, HEIGHT))
            for y in range(0, HEIGHT, GRID_SIZE):
                pygame.draw.line(screen, (30, 30, 30), (0, y), (WIDTH, y))
            
            # Draw walls
            for wall in self.walls:
                wall.draw(screen)
            
            # Draw food
            self.food.draw(screen)
            
            # Draw snake
            self.snake.draw(screen)
            
            # Draw UI
            score_text = font.render(f"Score: {self.score}", True, WHITE)
            screen.blit(score_text, (10, 10))
            
            # Draw food prediction (vision upgrade)
            if self.snake.upgrades['vision']:
                pygame.draw.circle(screen, BLUE, (self.food.position[0] + GRID_SIZE//2, self.food.position[1] + GRID_SIZE//2), GRID_SIZE//2, 2)
            
            pygame.display.flip()
            
            # Control game speed
            current_fps = FPS * self.snake.speed_multiplier
            clock.tick(current_fps)

if __name__ == "__main__":
    game = Game()
    game.run()
