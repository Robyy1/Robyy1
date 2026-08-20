"""
Hello Manim — a small showcase scene.

Run it with:
    manim -pql hello_manim.py HelloManim      # quick preview (480p)
    manim -pqh hello_manim.py HelloManim      # high quality (1080p)

-p opens the video when it's done, -q[l/m/h] sets quality (low/med/high).
"""

from manim import *
import numpy as np


class HelloManim(MovingCameraScene):
    def construct(self):
        self.camera.background_color = "#0a0a12"

        # ---- 1. A quiet animated backdrop -------------------------------
        # A few soft, drifting gradient blobs behind everything else, so the
        # scene doesn't open on dead flat black.
        blobs = VGroup()
        colors = [BLUE_E, PURPLE_E, TEAL_E, "#3b1f66"]
        for i in range(4):
            blob = Circle(radius=2.2, color=colors[i], fill_opacity=0.18, stroke_width=0)
            blob.move_to(
                np.array([np.cos(i * PI / 2) * 3.5, np.sin(i * PI / 2) * 2, 0])
            )
            blobs.add(blob)
        self.add(blobs)
        for i, blob in enumerate(blobs):
            blob.add_updater(
                lambda m, dt, i=i: m.shift(
                    np.array(
                        [
                            np.cos(self.renderer.time + i) * dt * 0.15,
                            np.sin(self.renderer.time * 0.7 + i) * dt * 0.15,
                            0,
                        ]
                    )
                )
            )

        # ---- 2. "Hello" writes itself in, letter by letter ---------------
        hello = Text("Hello", font_size=90, weight=BOLD)
        hello.set_color_by_gradient(BLUE_B, TEAL_A)
        hello.move_to(UP * 0.6)

        self.play(
            AnimationGroup(
                *[
                    FadeIn(letter, shift=DOWN * 0.6, scale=1.4)
                    for letter in hello
                ],
                lag_ratio=0.12,
            ),
            run_time=1.4,
            rate_func=rate_functions.ease_out_back,
        )

        # ---- 3. "Manim" assembles from scattered, tumbling letters -------
        manim_word = Text("Manim", font_size=90, weight=BOLD)
        manim_word.set_color_by_gradient(PINK, ORANGE, YELLOW)
        manim_word.next_to(hello, DOWN, buff=0.35)

        scattered = VGroup()
        spin_angles = []
        for letter in manim_word:
            ghost = letter.copy()
            ghost.move_to(
                manim_word.get_center()
                + np.array(
                    [np.random.uniform(-6, 6), np.random.uniform(-3.5, 3.5), 0]
                )
            )
            angle = np.random.uniform(-2, 2)
            ghost.rotate(angle)
            ghost.set_opacity(0)
            scattered.add(ghost)
            spin_angles.append(angle)

        self.add(scattered)
        self.play(
            AnimationGroup(
                *[
                    ghost.animate.move_to(letter.get_center())
                    .rotate(-angle)
                    .set_opacity(1)
                    for ghost, letter, angle in zip(scattered, manim_word, spin_angles)
                ],
                lag_ratio=0.06,
            ),
            run_time=1.6,
            rate_func=rate_functions.ease_out_expo,
        )
        self.remove(scattered)
        self.add(manim_word)

        full_title = VGroup(hello, manim_word)

        # ---- 4. A soft glow pass behind the finished title ---------------
        glow = VGroup(
            *[
                full_title.copy()
                .set_opacity(0.06)
                .scale(1 + 0.03 * k)
                .set_color(WHITE)
                for k in range(1, 5)
            ]
        )
        self.add(glow)
        glow.set_z_index(-1)
        self.play(FadeIn(glow), run_time=0.5)

        # ---- 5. Orbiting accent dots ---------------------------------------
        orbit_center = full_title.get_center()
        dots = VGroup()
        for i in range(6):
            dot = Dot(radius=0.06, color=[YELLOW, PINK, TEAL][i % 3])
            angle = i * TAU / 6
            dot.move_to(orbit_center + np.array([np.cos(angle), np.sin(angle), 0]) * 3.2)
            dots.add(dot)
        self.play(LaggedStartMap(FadeIn, dots, lag_ratio=0.1, scale=0.2), run_time=0.6)

        dots.add_updater(
            lambda m, dt: m.rotate(dt * 0.6, about_point=orbit_center)
        )

        # ---- 6. A confident little pulse to land the word ------------------
        self.play(
            full_title.animate.scale(1.08),
            rate_func=rate_functions.there_and_back,
            run_time=0.6,
        )

        # ---- 7. Slow camera push-in as a finishing flourish -----------------
        self.play(
            self.camera.frame.animate.scale(0.82).move_to(full_title),
            run_time=1.8,
            rate_func=smooth,
        )

        self.wait(1.2)

        # ---- 8. Clean exit --------------------------------------------------
        dots.clear_updaters()
        blobs.clear_updaters()
        self.play(
            *[FadeOut(m) for m in [full_title, glow, dots, blobs]],
            run_time=0.8,
        )