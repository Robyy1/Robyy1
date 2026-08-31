"""
AI Roast Hook — ~20-25s intro animation for the "AI's Ranked" tier list video.

RENDER:
    Draft preview (fast, low-res):
        manim -pql ai_roast_hook.py AIRoastHook

    Final export matching a 1080p60 Resolve timeline:
        manim -pqh --resolution 1920,1080 --fps 60 ai_roast_hook.py AIRoastHook

    Transparent background (if you want to overlay this on top of other footage
    instead of using it as a standalone opening clip):
        manim -pqh -t --resolution 1920,1080 --fps 60 ai_roast_hook.py AIRoastHook
    (transparent export needs a .mov, manim will name the output accordingly)

TIMING:
    All timing is driven by self.play(run_time=...) and self.wait(...) calls.
    Once you record your voiceover, just stretch/shrink the self.wait() values
    in each PART so the beats land on your lines — you don't need to touch
    the animation logic itself.

NOTE:
    Your original tier list has "Grabage" — I assumed that's a typo and used
    "GARBAGE" below. Change TIERS at the top if you actually want to keep it.
"""

from manim import *
import numpy as np
import random

# ---- Color palette (matches your tier list colors) ----
GOD_COLOR     = "#F2545B"
AMAZING_COLOR = "#F2A65A"
DECENT_COLOR  = "#F2E86D"
MEH_COLOR     = "#CFF27E"
GARBAGE_COLOR = "#7CFC8A"
DRUNK_COLOR   = "#7EE8FA"

TIERS = [
    ("GOD TIER", GOD_COLOR),
    ("AMAZING",  AMAZING_COLOR),
    ("DECENT",   DECENT_COLOR),
    ("MEH",      MEH_COLOR),
    ("GARBAGE",  GARBAGE_COLOR),
    ("DRUNK",    DRUNK_COLOR),
]


class AIRoastHook(MovingCameraScene):

    # ---------------------------------------------------------------
    # Helpers
    # ---------------------------------------------------------------
    def make_tier_bar(self, label_text, color, width=8, height=1.4, font_size=60):
        rect = RoundedRectangle(
            corner_radius=0.15, width=width, height=height,
            fill_color=color, fill_opacity=1, stroke_width=0,
        )
        label = Text(label_text, font_size=font_size, weight=BOLD, color=BLACK)
        label.move_to(rect.get_center())
        return VGroup(rect, label)

    def shake(self, mobject, cycles=4, intensity=0.1, run_time=0.4):
        """Jitters a mobject in place, net displacement zero."""
        per = run_time / cycles
        offsets = [
            np.array([random.uniform(-intensity, intensity),
                       random.uniform(-intensity, intensity), 0])
            for _ in range(cycles - 1)
        ]
        offsets.append(-sum(offsets))
        for off in offsets:
            self.play(mobject.animate.shift(off), run_time=per, rate_func=linear)

    def camera_shake(self, intensity=0.15, cycles=6, run_time=0.4):
        frame = self.camera.frame
        per = run_time / cycles
        offsets = [
            np.array([random.uniform(-intensity, intensity),
                       random.uniform(-intensity, intensity), 0])
            for _ in range(cycles - 1)
        ]
        offsets.append(-sum(offsets))
        for off in offsets:
            self.play(frame.animate.shift(off), run_time=per, rate_func=linear)

    # ---------------------------------------------------------------
    # Main scene
    # ---------------------------------------------------------------
    def construct(self):
        self.camera.background_color = "#0A0A0A"

        # ===== PART 1 — Punch-in title =====================================
        line1 = Text("I RANKED", font_size=100, weight=BOLD, color=WHITE)
        line2 = Text("EVERY AI MODEL", font_size=68, weight=BOLD, color=WHITE)
        line2.next_to(line1, DOWN, buff=0.3)
        title_group = VGroup(line1, line2)

        self.play(FadeIn(line1, scale=1.6), run_time=0.35)
        self.shake(line1, cycles=4, intensity=0.08, run_time=0.35)
        self.wait(0.2)
        self.play(FadeIn(line2, shift=UP * 0.3), run_time=0.4)
        self.play(Flash(title_group, color=WHITE, flash_radius=4, line_length=0.6), run_time=0.6)
        self.wait(0.8)
        self.play(title_group.animate.scale(1.15).set_color(GOD_COLOR), run_time=0.4)
        self.wait(0.4)
        self.play(FadeOut(title_group, scale=0.7), run_time=0.35)

        # ===== PART 2 — "FROM GOD TIER..." ==================================
        god_bar = self.make_tier_bar("GOD TIER", GOD_COLOR)

        from_text = Text("FROM", font_size=50, color=WHITE, weight=BOLD)
        from_text.next_to(god_bar, UP, buff=0.4)
        self.play(FadeIn(from_text, shift=DOWN * 0.2), run_time=0.40)
        self.wait(0.5)

        god_bar.shift(LEFT * 9)
        self.add(god_bar)
        self.play(god_bar.animate.move_to(ORIGIN), run_time=0.4,
                   rate_func=rate_functions.ease_out_bounce)
        self.shake(god_bar, cycles=3, intensity=0.04, run_time=0.35)
        self.wait(0.5)
        self.play(FadeOut(VGroup(god_bar, from_text), shift=LEFT * 3), run_time=0.35)



        # ===== PART 3 — "...TO ABSOLUTELY DRUNK" ============================
        drunk_bar = self.make_tier_bar("DRUNK", DRUNK_COLOR)
        to_text = Text("TO ABSOLUTELY", font_size=50, color=WHITE, weight=BOLD)
        to_text.next_to(drunk_bar, UP, buff=0.4)
        self.play(FadeIn(to_text, shift=DOWN * 0.2), run_time=0.25)
        self.wait(0.5)
        drunk_bar.shift(RIGHT * 9)
        self.add(drunk_bar)
        self.play(drunk_bar.animate.move_to(ORIGIN), run_time=0.4,
                   rate_func=rate_functions.ease_out_bounce)
        self.shake(drunk_bar, cycles=3, intensity=0.04, run_time=0.35)
        self.wait(0.5)
        self.play(FadeOut(VGroup(drunk_bar, to_text), scale=0.6), run_time=0.35)


        # ===== PART 4 — Fast tier montage ===================================
        bars = VGroup()
        for name, color in TIERS:
            bars.add(self.make_tier_bar(name, color, width=10, height=1.0, font_size=44))
        bars.arrange(DOWN, buff=0.15)
        bars.scale(0.62)

        for bar in bars:
            self.play(FadeIn(bar, shift=RIGHT * 1.2), run_time=0.22,
                       rate_func=rate_functions.rush_into)

        self.wait(0.3)
        self.play(Indicate(bars[0], color=WHITE, scale_factor=1.15), run_time=0.5)   # GOD TIER
        self.play(Indicate(bars[-1], color=WHITE, scale_factor=1.15), run_time=0.5)  # DRUNK
        self.wait(0.7)
        self.play(FadeOut(bars, shift=DOWN * 0.5), run_time=0.4)

        # ===== PART 5 — Suspense beat on "DRUNK" ============================
        drunk_big = self.make_tier_bar("DRUNK", DRUNK_COLOR, width=9, height=1.6, font_size=70)

        q_text = Text("ONE OF THESE FEELS...", font_size=42, color=WHITE, weight=BOLD)
        q_text.next_to(drunk_big, UP, buff=0.5)
        self.play(Write(q_text), run_time=0.8)
        self.wait(0.8)
        q_text2 = Text("ACTUALLY DRUNK", font_size=55, color=DRUNK_COLOR, weight=BOLD)
        q_text2.move_to(q_text)
        self.play(
            FadeIn(drunk_big, scale=0.5, run_time=0.4),
            Transform(q_text, q_text2, run_time=0.6)
            )
        self.play(Circumscribe(drunk_big, color=WHITE), run_time=0.6)
        self.camera_shake(intensity=0.12, cycles=4, run_time=0.3)

        self.wait(0.6)
        self.play(FadeOut(VGroup(drunk_big, q_text), shift=DOWN * 0.5), run_time=0.4)

        # ===== PART 6 — Final punch / CTA ===================================
        final_text = Text("LET'S RANK THEM", font_size=75, weight=BOLD, color=WHITE)
        self.play(FadeIn(final_text, scale=1.4), run_time=0.4)
        self.camera_shake(intensity=0.12, cycles=5, run_time=0.35)
        self.play(final_text.animate.set_color(GOD_COLOR).scale(1.1), run_time=0.4)
        self.wait(0.6)
        self.play(FadeOut(final_text, scale=3), run_time=0.5)
        self.wait(0.2)  # hold on black — cut to your tier list reveal here