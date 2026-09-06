import pygame
import random

# Initialize Pygame
pygame.init()

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (213, 50, 80)
GREEN = (0, 255, 0)
BLUE = (50, 153, 213)

# Display settings
WIDTH = 600
HEIGHT = 400
BLOCK_SIZE = 20
SPEED = 15

# Set up display
display = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption('Snake Game')
clock = pygame.time.Clock()

font = pygame.font.SysFont(None, 35)

def message(msg, color):
    text = font.render(msg, True, color)
    text_rect = text.get_rect(center=(WIDTH/2, HEIGHT/2))
    display.blit(text, text_rect)

def game_loop():
    game_over = False
    
    # Initial snake position
    x1 = WIDTH / 2
    y1 = HEIGHT / 2
    
    # Movement direction
    x1_change = 0
    y1_change = 0
    
    # Snake body (list of coordinates)
    snake_list = []
    snake_length = 1
    
    # Food position
    food_x = round(random.randrange(0, WIDTH - BLOCK_SIZE) / 20.0) * 20.0
    food_y = round(random.randrange(0, HEIGHT - BLOCK_SIZE) / 20.0) * 20.0
    
    while not game_over:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return
            
            # Handle key presses
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_LEFT and x1_change != BLOCK_SIZE:
                    x1_change = -BLOCK_SIZE
                    y1_change = 0
                elif event.key == pygame.K_RIGHT and x1_change != -BLOCK_SIZE:
                    x1_change = BLOCK_SIZE
                    y1_change = 0
                elif event.key == pygame.K_UP and y1_change != BLOCK_SIZE:
                    y1_change = -BLOCK_SIZE
                    x1_change = 0
                elif event.key == pygame.K_DOWN and y1_change != -BLOCK_SIZE:
                    y1_change = BLOCK_SIZE
                    x1_change = 0
        
        # Update snake position
        x1 += x1_change
        y1 += y1_change
        
        # Check wall collision
        if x1 >= WIDTH or x1 < 0 or y1 >= HEIGHT or y1 < 0:
            game_over = True
        
        # Draw background and food
        display.fill(BLUE)
        pygame.draw.rect(display, RED, [food_x, food_y, BLOCK_SIZE, BLOCK_SIZE])
        
        # Update snake body
        snake_head = []
        snake_head.append(x1)
        snake_head.append(y1)
        snake_list.append(snake_head)
        
        # Remove tail if snake is longer than allowed length
        if len(snake_list) > snake_length:
            snake_list.pop(0)
        
        # Check self-collision
        for segment in snake_list[:-1]:
            if segment == snake_head:
                game_over = True
        
        # Draw snake
        for segment in snake_list:
            pygame.draw.rect(display, GREEN, [segment[0], segment[1], BLOCK_SIZE, BLOCK_SIZE])
        
        # Check food collision
        if x1 == food_x and y1 == food_y:
            food_x = round(random.randrange(0, WIDTH - BLOCK_SIZE) / 20.0) * 20.0
            food_y = round(random.randrange(0, HEIGHT - BLOCK_SIZE) / 20.0) * 20.0
            snake_length += 1
        
        # Draw score
        score_text = font.render(f"Score: {snake_length - 1}", True, WHITE)
        display.blit(score_text, [0, 0])
        
        pygame.display.update()
        clock.tick(SPEED)
    
    # Game over screen
    display.fill(BLUE)
    message("Game Over! Press Q to Quit or C to Play Again", RED)
    pygame.display.update()
    
    # Wait for user input
    quit_game = False
    while not quit_game:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                quit_game = True
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_q:
                    return
                if event.key == pygame.K_c:
                    game_loop()

# Run the game
game_loop()
pygame.quit()
