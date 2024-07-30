import pygame

pygame.init()

lenght = 800
height = 600

pygame.display.set_mode(lenght, height)
pygame.display.set_caption("hello world!")

for event in pygame.event.get():
    if event.type == pygame.QUIT:
        pygame.quit()
        quit()